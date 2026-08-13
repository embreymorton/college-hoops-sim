import { POSITIONS, type Position } from './player'
import {
  MAX_PLAYER_MINUTES,
  MINUTES_PER_POSITION,
  TOTAL_ROTATION_MINUTES,
} from './rotation'
import {
  getEligibleRotationPositions,
  validateRotationV1,
  type RotationV1,
  type RotationV1ValidationIssue,
} from './rotationV1'
import type { Team } from './team'

export type SimpleRotationIntentIssueCode =
  | 'UNKNOWN_PLAYER'
  | 'INVALID_PLAYER_MINUTES'
  | 'INVALID_TOTAL_MINUTES'
  | 'INFEASIBLE_POSITION_COVERAGE'
  | 'INVALID_COMPILED_ROTATION'

export interface SimpleRotationIntentIssue {
  readonly code: SimpleRotationIntentIssueCode
  readonly message: string
  readonly playerId?: string
  readonly position?: Position
  readonly actual?: number
  readonly expected?: number
  readonly rotationIssues?: readonly RotationV1ValidationIssue[]
}

export type SimpleRotationIntentResult =
  | {
      readonly valid: true
      readonly rotation: RotationV1
      readonly issues: readonly []
    }
  | {
      readonly valid: false
      readonly rotation: null
      readonly issues: readonly SimpleRotationIntentIssue[]
    }

interface FlowEdge {
  readonly to: number
  readonly reverseIndex: number
  capacity: number
  readonly cost: number
  flow: number
}

function addFlowEdge(
  graph: FlowEdge[][],
  from: number,
  to: number,
  capacity: number,
  cost: number,
): FlowEdge {
  const forward: FlowEdge = {
    to,
    reverseIndex: graph[to]!.length,
    capacity,
    cost,
    flow: 0,
  }
  const reverse: FlowEdge = {
    to: from,
    reverseIndex: graph[from]!.length,
    capacity: 0,
    cost: -cost,
    flow: 0,
  }
  graph[from]!.push(forward)
  graph[to]!.push(reverse)
  return forward
}

/**
 * Compiles aggregate Player-minute intent into canonical Rotation V1.
 *
 * The exact min-cost flow first satisfies every requested Player total and
 * every 40-minute floor-position bucket. Natural assignments cost zero and
 * secondary assignments cost one, so a successful solution globally minimizes
 * secondary minutes without changing any requested total. Stable Player-ID and
 * `POSITIONS` ordering make equally optimal solutions repeatable.
 */
export function compileSimpleRotationIntent(
  team: Team,
  requestedMinutesByPlayerId: Readonly<Record<string, number>>,
): SimpleRotationIntentResult {
  const issues: SimpleRotationIntentIssue[] = []
  const rosterById = new Map(
    team.roster.map((player) => [player.id, player] as const),
  )
  let requestedTotal = 0

  for (const [playerId, minutes] of Object.entries(requestedMinutesByPlayerId)) {
    if (Number.isFinite(minutes)) requestedTotal += minutes

    if (!rosterById.has(playerId)) {
      issues.push({
        code: 'UNKNOWN_PLAYER',
        message: `Unknown player ID "${playerId}" in simple Rotation intent.`,
        playerId,
      })
    }

    if (
      !Number.isFinite(minutes) ||
      minutes < 0 ||
      minutes > MAX_PLAYER_MINUTES
    ) {
      issues.push({
        code: 'INVALID_PLAYER_MINUTES',
        message:
          `Player "${playerId}" requested ${minutes} minutes; ` +
          `the valid range is 0–${MAX_PLAYER_MINUTES}.`,
        playerId,
        actual: minutes,
        expected: MAX_PLAYER_MINUTES,
      })
    }
  }

  if (requestedTotal !== TOTAL_ROTATION_MINUTES) {
    issues.push({
      code: 'INVALID_TOTAL_MINUTES',
      message:
        `Simple Rotation intent requests ${requestedTotal} total minutes ` +
        `instead of ${TOTAL_ROTATION_MINUTES}.`,
      actual: requestedTotal,
      expected: TOTAL_ROTATION_MINUTES,
    })
  }

  if (issues.length > 0) {
    return { valid: false, rotation: null, issues }
  }

  const activePlayers = team.roster
    .filter((player) => (requestedMinutesByPlayerId[player.id] ?? 0) > 0)
    .sort((first, second) => first.id.localeCompare(second.id))
  const source = 0
  const playerOffset = 1
  const positionOffset = playerOffset + activePlayers.length
  const sink = positionOffset + POSITIONS.length
  const graph: FlowEdge[][] = Array.from({ length: sink + 1 }, () => [])
  const assignmentEdges = new Map<string, FlowEdge>()
  const positionSinkEdges = new Map<Position, FlowEdge>()

  for (const [playerIndex, player] of activePlayers.entries()) {
    const playerNode = playerOffset + playerIndex
    addFlowEdge(
      graph,
      source,
      playerNode,
      requestedMinutesByPlayerId[player.id]!,
      0,
    )

    const eligiblePositions = [...getEligibleRotationPositions(player)].sort(
      (first, second) =>
        Number(first !== player.position) - Number(second !== player.position) ||
        POSITIONS.indexOf(first) - POSITIONS.indexOf(second),
    )

    for (const position of eligiblePositions) {
      const positionNode = positionOffset + POSITIONS.indexOf(position)
      const edge = addFlowEdge(
        graph,
        playerNode,
        positionNode,
        requestedMinutesByPlayerId[player.id]!,
        position === player.position ? 0 : 1,
      )
      assignmentEdges.set(`${player.id}:${position}`, edge)
    }
  }

  for (const [positionIndex, position] of POSITIONS.entries()) {
    const edge = addFlowEdge(
      graph,
      positionOffset + positionIndex,
      sink,
      MINUTES_PER_POSITION,
      0,
    )
    positionSinkEdges.set(position, edge)
  }

  let totalFlow = 0

  while (totalFlow < TOTAL_ROTATION_MINUTES) {
    const distances = Array<number>(graph.length).fill(Number.POSITIVE_INFINITY)
    const previousNode = Array<number>(graph.length).fill(-1)
    const previousEdge = Array<number>(graph.length).fill(-1)
    distances[source] = 0

    for (let pass = 0; pass < graph.length - 1; pass += 1) {
      let changed = false

      for (let node = 0; node < graph.length; node += 1) {
        if (!Number.isFinite(distances[node])) continue

        for (const [edgeIndex, edge] of graph[node]!.entries()) {
          const nextDistance = distances[node]! + edge.cost

          if (edge.capacity > 0 && nextDistance < distances[edge.to]!) {
            distances[edge.to] = nextDistance
            previousNode[edge.to] = node
            previousEdge[edge.to] = edgeIndex
            changed = true
          }
        }
      }

      if (!changed) break
    }

    if (previousNode[sink] === -1) break

    let addedFlow = TOTAL_ROTATION_MINUTES - totalFlow

    for (let node = sink; node !== source; node = previousNode[node]!) {
      const edge = graph[previousNode[node]!]![previousEdge[node]!]!
      addedFlow = Math.min(addedFlow, edge.capacity)
    }

    for (let node = sink; node !== source; node = previousNode[node]!) {
      const from = previousNode[node]!
      const edge = graph[from]![previousEdge[node]!]!
      const reverse = graph[edge.to]![edge.reverseIndex]!
      edge.capacity -= addedFlow
      edge.flow += addedFlow
      reverse.capacity += addedFlow
      reverse.flow -= addedFlow
    }

    totalFlow += addedFlow
  }

  if (totalFlow !== TOTAL_ROTATION_MINUTES) {
    const uncoveredPositions = POSITIONS.filter(
      (position) => positionSinkEdges.get(position)!.flow < MINUTES_PER_POSITION,
    )
    return {
      valid: false,
      rotation: null,
      issues: uncoveredPositions.map((position) => ({
        code: 'INFEASIBLE_POSITION_COVERAGE',
        message:
          `${position} can receive only ${positionSinkEdges.get(position)!.flow} ` +
          `of ${MINUTES_PER_POSITION} requested floor minutes from eligible Players.`,
        position,
        actual: positionSinkEdges.get(position)!.flow,
        expected: MINUTES_PER_POSITION,
      })),
    }
  }

  const minutesByPosition = Object.fromEntries(
    POSITIONS.map((position) => [position, {}]),
  ) as RotationV1['minutesByPosition']

  for (const player of activePlayers) {
    for (const position of getEligibleRotationPositions(player)) {
      const minutes = assignmentEdges.get(`${player.id}:${position}`)?.flow ?? 0
      if (minutes > 0) minutesByPosition[position][player.id] = minutes
    }
  }

  const rotation: RotationV1 = { minutesByPosition }
  const validation = validateRotationV1(team, rotation)

  if (!validation.valid) {
    return {
      valid: false,
      rotation: null,
      issues: [{
        code: 'INVALID_COMPILED_ROTATION',
        message: 'Compiled simple Rotation intent failed canonical validation.',
        rotationIssues: validation.issues,
      }],
    }
  }

  return { valid: true, rotation, issues: [] }
}
