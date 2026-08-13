import { POSITIONS, type Position } from './player'
import {
  derivePlayerMinutesV1,
  getEligibleRotationPositions,
  validateRotationV1,
  type RotationV1,
  type RotationV1ValidationIssue,
} from './rotationV1'
import type { Team } from './team'

/** One projected starter Player ID at each canonical floor position. */
export type ProjectedStartingFive = Readonly<Record<Position, string>>

export type ProjectedStartingFiveIssueCode =
  | 'INVALID_ROTATION'
  | 'INCOMPLETE_UNIQUE_LINEUP'

export interface ProjectedStartingFiveIssue {
  readonly code: ProjectedStartingFiveIssueCode
  readonly message: string
  readonly rotationIssues?: readonly RotationV1ValidationIssue[]
}

export type ProjectedStartingFiveResult =
  | {
      readonly valid: true
      readonly startingFive: ProjectedStartingFive
      readonly issues: readonly []
    }
  | {
      readonly valid: false
      readonly startingFive: null
      readonly issues: readonly ProjectedStartingFiveIssue[]
    }

interface CandidateLineup {
  readonly playerIds: readonly string[]
  readonly positionalMinutes: number
  readonly naturalAssignments: number
  readonly totalPlayerMinutes: number
}

function compareLineups(
  candidate: CandidateLineup,
  incumbent: CandidateLineup,
): number {
  if (candidate.positionalMinutes !== incumbent.positionalMinutes) {
    return candidate.positionalMinutes - incumbent.positionalMinutes
  }
  if (candidate.naturalAssignments !== incumbent.naturalAssignments) {
    return candidate.naturalAssignments - incumbent.naturalAssignments
  }
  if (candidate.totalPlayerMinutes !== incumbent.totalPlayerMinutes) {
    return candidate.totalPlayerMinutes - incumbent.totalPlayerMinutes
  }

  for (let index = 0; index < POSITIONS.length; index += 1) {
    const comparison = incumbent.playerIds[index]!.localeCompare(
      candidate.playerIds[index]!,
    )
    if (comparison !== 0) return comparison
  }

  return 0
}

/**
 * Projects a unique, position-addressable Starting Five from committed V1 use.
 *
 * Exact backtracking maximizes represented positional minutes, then natural
 * assignments, then selected Players' aggregate minutes. Canonical position
 * order plus lexicographically smaller stable Player IDs breaks final ties.
 * This is a read-only projection with no independent gameplay effect.
 */
export function deriveProjectedStartingFive(
  team: Team,
  rotation: RotationV1,
): ProjectedStartingFiveResult {
  const validation = validateRotationV1(team, rotation)

  if (!validation.valid) {
    return {
      valid: false,
      startingFive: null,
      issues: [{
        code: 'INVALID_ROTATION',
        message: 'Cannot project a Starting Five from an invalid Rotation V1.',
        rotationIssues: validation.issues,
      }],
    }
  }

  const rosterById = new Map(
    team.roster.map((player) => [player.id, player] as const),
  )
  const totalMinutes = derivePlayerMinutesV1(rotation)
  const candidatesByPosition = Object.fromEntries(
    POSITIONS.map((position) => [
      position,
      Object.entries(rotation.minutesByPosition[position])
        .filter(([playerId, minutes]) =>
          minutes > 0 &&
          getEligibleRotationPositions(rosterById.get(playerId)!).includes(position),
        )
        .map(([playerId]) => playerId)
        .sort((first, second) => first.localeCompare(second)),
    ]),
  ) as Record<Position, string[]>
  let best: CandidateLineup | null = null
  const selectedPlayerIds: string[] = []
  const usedPlayerIds = new Set<string>()

  function search(positionIndex: number): void {
    if (positionIndex === POSITIONS.length) {
      const lineup: CandidateLineup = {
        playerIds: [...selectedPlayerIds],
        positionalMinutes: POSITIONS.reduce(
          (sum, position, index) =>
            sum + rotation.minutesByPosition[position][selectedPlayerIds[index]!]!,
          0,
        ),
        naturalAssignments: POSITIONS.reduce(
          (count, position, index) =>
            count + Number(
              rosterById.get(selectedPlayerIds[index]!)!.position === position,
            ),
          0,
        ),
        totalPlayerMinutes: selectedPlayerIds.reduce(
          (sum, playerId) => sum + totalMinutes[playerId]!,
          0,
        ),
      }

      if (!best || compareLineups(lineup, best) > 0) best = lineup
      return
    }

    const position = POSITIONS[positionIndex]!
    for (const playerId of candidatesByPosition[position]) {
      if (usedPlayerIds.has(playerId)) continue
      usedPlayerIds.add(playerId)
      selectedPlayerIds.push(playerId)
      search(positionIndex + 1)
      selectedPlayerIds.pop()
      usedPlayerIds.delete(playerId)
    }
  }

  search(0)

  if (!best) {
    return {
      valid: false,
      startingFive: null,
      issues: [{
        code: 'INCOMPLETE_UNIQUE_LINEUP',
        message:
          'The valid Rotation does not provide one unique positive-minute Player at every position.',
      }],
    }
  }

  const playerIds = (best as CandidateLineup).playerIds
  return {
    valid: true,
    startingFive: Object.fromEntries(
      POSITIONS.map((position, index) => [position, playerIds[index]!]),
    ) as ProjectedStartingFive,
    issues: [],
  }
}
