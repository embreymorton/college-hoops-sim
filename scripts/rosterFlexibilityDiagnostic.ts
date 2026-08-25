import {
  POSITIONS,
  TEAM_ROSTER_SIZE,
  calculateOverall,
  calculateTeamStrength,
  createRng,
  generateDefaultRotationV1,
  type Player,
  type Position,
  type Team,
} from '../src/engine'
import {
  deriveBaseRecruitAttraction,
  generateRecruitingClass,
  type PositionCounts,
  type Recruit,
} from '../src/dynasty'
import { createRecruitingDynasty } from '../src/dynasty/recruiting/testSupport'
import type { DynastyState } from '../src/dynasty'
import type { SeasonState } from '../src/season'

export type FlexDiagnosticModel = 'baseline' | 'b1' | 'b2'

const emptyCounts = (): Record<Position, number> => ({ PG: 0, SG: 0, SF: 0, PF: 0, C: 0 })
const sumCounts = (counts: PositionCounts): number => POSITIONS.reduce((sum, position) => sum + counts[position], 0)

export interface CapacitySnapshot {
  readonly returners: PositionCounts
  readonly mandatory: PositionCounts
  readonly remainingScholarships: number
  readonly flexible: number
}

export function deriveFlexibleCapacity(returners: PositionCounts): CapacitySnapshot {
  const mandatory = Object.fromEntries(POSITIONS.map((position) => [
    position,
    Math.max(0, 2 - returners[position]),
  ])) as Record<Position, number>
  const remainingScholarships = TEAM_ROSTER_SIZE - sumCounts(returners)
  const flexible = remainingScholarships - sumCounts(mandatory)
  if (remainingScholarships < 0 || flexible < 0) throw new RangeError('Returners cannot satisfy the candidate 2–3 roster envelope.')
  return { returners, mandatory, remainingScholarships, flexible }
}

export function isJointOfferSetFeasible(
  returners: PositionCounts,
  commitments: PositionCounts,
  offers: PositionCounts,
): boolean {
  const remaining = TEAM_ROSTER_SIZE - sumCounts(returners) - sumCounts(commitments)
  const offerTotal = sumCounts(offers)
  if (remaining < 0 || offerTotal > remaining) return false
  if (POSITIONS.some((position) => returners[position] + commitments[position] + offers[position] > 3)) return false
  const mandatoryAfterOffers = POSITIONS.reduce(
    (sum, position) => sum + Math.max(0, 2 - returners[position] - commitments[position] - offers[position]),
    0,
  )
  return remaining - offerTotal >= mandatoryAfterOffers
}

function positionCounts(players: readonly Player[]): Record<Position, number> {
  const counts = emptyCounts()
  for (const player of players) counts[player.position] += 1
  return counts
}

function projectedReturners(team: Team): Player[] {
  return team.roster.filter(({ classYear }) => classYear !== 'SR')
}

function cloneSeasonWithSeniorDemand(season: SeasonState, demand: PositionCounts): SeasonState {
  const remaining = { ...demand }
  const programStates = Object.fromEntries(Object.entries(season.programStates)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([programId, state]) => [programId, {
      ...state,
      team: {
        ...state.team,
        roster: state.team.roster.map((player) => {
          const senior = remaining[player.position] > 0
          if (senior) remaining[player.position] -= 1
          return { ...player, classYear: senior ? 'SR' as const : 'JR' as const }
        }),
      },
    }]))
  if (POSITIONS.some((position) => remaining[position] !== 0)) {
    throw new RangeError('Synthetic diagnostic demand exceeds available positional population.')
  }
  return { ...season, programStates }
}

function nearestDemandForSupply(target: number): number {
  let bestDemand = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let demand = 0; demand <= 96; demand += 1) {
    const supply = Math.max(18, Math.ceil(demand * 1.65))
    const distance = Math.abs(supply - target)
    if (distance < bestDistance) {
      bestDemand = demand
      bestDistance = distance
    }
  }
  return bestDemand
}

export function deriveBalancedSupplyDemand(totalClassSize: number, mandatory: PositionCounts): PositionCounts {
  const target = Math.max(18 * POSITIONS.length, totalClassSize)
  const targetByPosition = emptyCounts()
  const base = Math.floor(target / POSITIONS.length)
  let remainder = target - base * POSITIONS.length
  for (const position of POSITIONS) {
    targetByPosition[position] = Math.max(base + (remainder > 0 ? 1 : 0), mandatory[position])
    if (remainder > 0) remainder -= 1
  }
  return Object.fromEntries(POSITIONS.map((position) => [
    position,
    nearestDemandForSupply(targetByPosition[position]),
  ])) as PositionCounts
}

interface FlowEdge {
  to: number
  reverse: number
  capacity: number
  originalCapacity: number
  recruitId?: string
  programId?: string
  position?: Position
}

class FlowNetwork {
  readonly graph: FlowEdge[][]
  constructor(size: number) { this.graph = Array.from({ length: size }, () => []) }
  addEdge(from: number, to: number, capacity: number, metadata: Partial<FlowEdge> = {}): void {
    const forward: FlowEdge = { to, reverse: this.graph[to]!.length, capacity, originalCapacity: capacity, ...metadata }
    const reverse: FlowEdge = { to: from, reverse: this.graph[from]!.length, capacity: 0, originalCapacity: 0 }
    this.graph[from]!.push(forward)
    this.graph[to]!.push(reverse)
  }
  maxFlow(source: number, sink: number): number {
    let flow = 0
    while (true) {
      const parent = Array.from({ length: this.graph.length }, () => null as { node: number; edge: number } | null)
      const queue = [source]
      parent[source] = { node: source, edge: -1 }
      for (let index = 0; index < queue.length && !parent[sink]; index += 1) {
        const node = queue[index]!
        for (let edgeIndex = 0; edgeIndex < this.graph[node]!.length; edgeIndex += 1) {
          const edge = this.graph[node]![edgeIndex]!
          if (edge.capacity <= 0 || parent[edge.to]) continue
          parent[edge.to] = { node, edge: edgeIndex }
          queue.push(edge.to)
          if (edge.to === sink) break
        }
      }
      if (!parent[sink]) return flow
      let node = sink
      while (node !== source) {
        const step = parent[node]!
        const edge = this.graph[step.node]![step.edge]!
        edge.capacity -= 1
        this.graph[node]![edge.reverse]!.capacity += 1
        node = step.node
      }
      flow += 1
    }
  }
}

interface AssignmentInput {
  readonly needsByProgram: Readonly<Record<string, PositionCounts>>
  readonly recruits: readonly Recruit[]
  readonly dynasty: DynastyState
}

interface AssignmentResult {
  readonly assignedByProgram: Readonly<Record<string, readonly Recruit[]>>
  readonly requested: number
  readonly assigned: number
}

function assignExact({ needsByProgram, recruits, dynasty }: AssignmentInput): AssignmentResult {
  const programPositions = Object.entries(needsByProgram).sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([programId, needs]) => POSITIONS.filter((position) => needs[position] > 0)
      .map((position) => ({ programId, position, capacity: needs[position] })))
  return flowAssign(programPositions, recruits, dynasty)
}

function flowAssign(
  programPositions: readonly { programId: string; position: Position; capacity: number }[],
  recruits: readonly Recruit[],
  dynasty: DynastyState,
  programCaps?: Readonly<Record<string, number>>,
): AssignmentResult {
  const programIds = [...new Set(programPositions.map(({ programId }) => programId))].sort()
  const source = 0
  const programOffset = 1
  const positionOffset = programOffset + programIds.length
  const recruitOffset = positionOffset + programPositions.length
  const sink = recruitOffset + recruits.length
  const network = new FlowNetwork(sink + 1)
  const programNode = new Map(programIds.map((id, index) => [id, programOffset + index]))
  for (const programId of programIds) {
    const requested = programCaps?.[programId] ?? programPositions.filter((entry) => entry.programId === programId)
      .reduce((sum, entry) => sum + entry.capacity, 0)
    network.addEdge(source, programNode.get(programId)!, requested)
  }
  programPositions.forEach((entry, index) => {
    const node = positionOffset + index
    network.addEdge(programNode.get(entry.programId)!, node, entry.capacity)
    const compatible = recruits.filter(({ player }) => player.position === entry.position)
      .sort((first, second) => {
        const firstUtility = first.qualityScore + deriveBaseRecruitAttraction(dynasty, first, entry.programId)
        const secondUtility = second.qualityScore + deriveBaseRecruitAttraction(dynasty, second, entry.programId)
        return secondUtility - firstUtility || first.nationalRank - second.nationalRank || first.player.id.localeCompare(second.player.id)
      })
    for (const recruit of compatible) {
      const recruitIndex = recruits.findIndex(({ player }) => player.id === recruit.player.id)
      network.addEdge(node, recruitOffset + recruitIndex, 1, {
        recruitId: recruit.player.id, programId: entry.programId, position: entry.position,
      })
    }
  })
  recruits.forEach((_, index) => network.addEdge(recruitOffset + index, sink, 1))
  const assigned = network.maxFlow(source, sink)
  const assignedByProgram: Record<string, Recruit[]> = Object.fromEntries(programIds.map((id) => [id, []]))
  for (let index = 0; index < programPositions.length; index += 1) {
    for (const edge of network.graph[positionOffset + index]!) {
      if (!edge.recruitId || edge.originalCapacity !== 1 || edge.capacity !== 0) continue
      const recruit = recruits.find(({ player }) => player.id === edge.recruitId)
      if (recruit) assignedByProgram[edge.programId!]!.push(recruit)
    }
  }
  return {
    assignedByProgram,
    requested: Object.values(programCaps ?? {}).length > 0
      ? Object.values(programCaps!).reduce((sum, value) => sum + value, 0)
      : programPositions.reduce((sum, entry) => sum + entry.capacity, 0),
    assigned,
  }
}

function assignFlexible(
  baseCountsByProgram: Readonly<Record<string, PositionCounts>>,
  flexibleByProgram: Readonly<Record<string, number>>,
  recruits: readonly Recruit[],
  dynasty: DynastyState,
): AssignmentResult {
  const capacities = Object.entries(baseCountsByProgram).sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([programId, counts]) => POSITIONS.map((position) => ({
      programId,
      position,
      capacity: Math.max(0, 3 - counts[position]),
    })).filter(({ capacity }) => capacity > 0)
      .map((entry) => ({
        ...entry,
        bestUtility: recruits.filter(({ player }) => player.position === entry.position)
          .reduce((best, recruit) => Math.max(
            best,
            recruit.qualityScore + deriveBaseRecruitAttraction(dynasty, recruit, programId),
          ), Number.NEGATIVE_INFINITY),
      }))
      .sort((first, second) =>
        second.bestUtility - first.bestUtility ||
        POSITIONS.indexOf(first.position) - POSITIONS.indexOf(second.position),
      ))
  return flowAssign(capacities, recruits, dynasty, flexibleByProgram)
}

function b1Target(returners: readonly Player[]): PositionCounts {
  const counts = positionCounts(returners)
  const qualities = Object.fromEntries(POSITIONS.map((position) => {
    const players = returners.filter((player) => player.position === position)
    return [position, players.length === 0 ? 0 : players.reduce((sum, player) => sum + calculateOverall(player), 0) / players.length]
  })) as Record<Position, number>
  const eligible = POSITIONS.filter((position) => counts[position] <= 3)
    .sort((first, second) => qualities[first] - qualities[second] || POSITIONS.indexOf(first) - POSITIONS.indexOf(second))
  const target = Object.fromEntries(POSITIONS.map((position) => [position, 2])) as Record<Position, number>
  let extras = 2
  for (const position of eligible) {
    if (extras === 0) break
    if (counts[position] <= 3 && target[position] < 3) {
      target[position] = 3
      extras -= 1
    }
  }
  if (POSITIONS.some((position) => counts[position] > target[position])) {
    for (const position of POSITIONS.filter((entry) => counts[entry] === 3)) target[position] = 3
    while (sumCounts(target) > 12) {
      const removable = [...POSITIONS].reverse().find((position) => target[position] === 3 && counts[position] <= 2)
      if (!removable) break
      target[removable] = 2
    }
  }
  return target
}

export interface ModelCycleResult {
  readonly model: FlexDiagnosticModel
  readonly seed: string
  readonly success: boolean
  readonly classSize: number
  readonly supply: PositionCounts
  readonly mandatory: PositionCounts
  readonly flexibleScholarships: number
  readonly unmatchedMandatory: number
  readonly unmatchedFlexible: number
  readonly totalSupplyFailure: number
  readonly positionalSupplyFailure: number
  readonly compatibilityFailure: number
  readonly illegalRosters: number
  readonly offerFeasibilityFailures: number
  readonly emergencyGeneration: 0
  readonly fallbackMandatoryNodes: number
  readonly fallbackFlexibleNodes: number
  readonly unsignedByPosition: PositionCounts
  readonly finalPatterns: readonly string[]
  readonly positionAtThree: PositionCounts
  readonly shapeChanges: number
  readonly flexibleAssignments: PositionCounts
  readonly recruits: readonly Recruit[]
  readonly teamStrengths: readonly number[]
  readonly rosters: Readonly<Record<string, readonly Player[]>>
}

function productionSupply(season: SeasonState, dynastySeed: string, model: FlexDiagnosticModel): { recruits: Recruit[]; supply: PositionCounts } {
  const recruits = generateRecruitingClass({
    dynastySeed,
    targetSeasonNumber: season.seasonNumber + 1,
    season,
    capacityModel: model === 'b2' ? 'flexible-v1' : 'exact-v0',
  })
  const supply = positionCounts(recruits.map(({ player }) => player))
  return { recruits, supply }
}

export function runModelCycle(model: FlexDiagnosticModel, seed: string, teams?: Readonly<Record<string, Team>>): ModelCycleResult {
  const base = createRecruitingDynasty(seed)
  const season = teams
    ? { ...base.activeSeason!, programStates: Object.fromEntries(Object.entries(base.activeSeason!.programStates).map(([programId, state]) => [programId, { ...state, team: teams[programId]! }])) }
    : base.activeSeason!
  const dynasty = { ...base, activeSeason: season }
  const returnersByProgram = Object.fromEntries(Object.entries(season.programStates).map(([programId, { team }]) => [programId, projectedReturners(team)]))
  const priorCounts = Object.fromEntries(Object.entries(season.programStates).map(([programId, { team }]) => [programId, positionCounts(team.roster)]))
  const exactNeeds: Record<string, PositionCounts> = {}
  const mandatoryNeeds: Record<string, PositionCounts> = {}
  const flexibleByProgram: Record<string, number> = {}
  for (const programId of Object.keys(returnersByProgram).sort()) {
    const returnerCounts = positionCounts(returnersByProgram[programId]!)
    if (model === 'baseline') {
      exactNeeds[programId] = Object.fromEntries(POSITIONS.map((position) => [position, priorCounts[programId]![position] - returnerCounts[position]])) as PositionCounts
    } else if (model === 'b1') {
      const target = b1Target(returnersByProgram[programId]!)
      exactNeeds[programId] = Object.fromEntries(POSITIONS.map((position) => [position, target[position] - returnerCounts[position]])) as PositionCounts
    } else {
      const capacity = deriveFlexibleCapacity(returnerCounts)
      mandatoryNeeds[programId] = capacity.mandatory
      flexibleByProgram[programId] = capacity.flexible
    }
  }
  const baselineClass = productionSupply(season, seed, model)
  let recruits = baselineClass.recruits
  let supply = baselineClass.supply
  if (model === 'b1') {
    const demand = Object.fromEntries(POSITIONS.map((position) => [position, Object.values(exactNeeds).reduce((sum, needs) => sum + needs[position], 0)])) as PositionCounts
    const synthetic = cloneSeasonWithSeniorDemand(season, demand)
    ;({ recruits, supply } = productionSupply(synthetic, seed, model))
  } else if (model === 'b2') {
    const mandatory = Object.fromEntries(POSITIONS.map((position) => [position, Object.values(mandatoryNeeds).reduce((sum, needs) => sum + needs[position], 0)])) as PositionCounts
    const demand = deriveBalancedSupplyDemand(baselineClass.recruits.length, mandatory)
    const synthetic = cloneSeasonWithSeniorDemand(season, demand)
    ;({ recruits, supply } = productionSupply(synthetic, seed, model))
  }
  const mandatoryLeague = model === 'b2'
    ? Object.fromEntries(POSITIONS.map((position) => [position, Object.values(mandatoryNeeds).reduce((sum, needs) => sum + needs[position], 0)])) as PositionCounts
    : Object.fromEntries(POSITIONS.map((position) => [position, Object.values(exactNeeds).reduce((sum, needs) => sum + needs[position], 0)])) as PositionCounts
  const first = assignExact({ needsByProgram: model === 'b2' ? mandatoryNeeds : exactNeeds, recruits, dynasty })
  const used = new Set(Object.values(first.assignedByProgram).flat().map(({ player }) => player.id))
  let second: AssignmentResult = { assignedByProgram: {}, requested: 0, assigned: 0 }
  if (model === 'b2') {
    const baseCounts = Object.fromEntries(Object.keys(returnersByProgram).map((programId) => {
      const players = [...returnersByProgram[programId]!, ...(first.assignedByProgram[programId] ?? []).map(({ player }) => player)]
      return [programId, positionCounts(players)]
    }))
    second = assignFlexible(baseCounts, flexibleByProgram, recruits.filter(({ player }) => !used.has(player.id)), dynasty)
  }
  const rosters: Record<string, Player[]> = {}
  const flexibleAssignments = emptyCounts()
  for (const programId of Object.keys(returnersByProgram).sort()) {
    const flex = second.assignedByProgram[programId] ?? []
    for (const recruit of flex) flexibleAssignments[recruit.player.position] += 1
    rosters[programId] = [
      ...returnersByProgram[programId]!.map((player) => ({
        ...player,
        classYear: ({ FR: 'SO', SO: 'JR', JR: 'SR' } as const)[player.classYear as 'FR' | 'SO' | 'JR'],
      })),
      ...(first.assignedByProgram[programId] ?? []).map(({ player }) => player),
      ...flex.map(({ player }) => player),
    ]
  }
  const assignedIds = new Set(Object.values(rosters).flat().filter(({ classYear }) => classYear === 'FR').map(({ id }) => id))
  const unsignedByPosition = positionCounts(recruits.filter(({ player }) => !assignedIds.has(player.id)).map(({ player }) => player))
  const finalPatterns: string[] = []
  const positionAtThree = emptyCounts()
  let illegalRosters = 0
  let shapeChanges = 0
  let offerFeasibilityFailures = 0
  const teamStrengths: number[] = []
  for (const [programId, players] of Object.entries(rosters).sort(([a], [b]) => a.localeCompare(b))) {
    const counts = positionCounts(players)
    finalPatterns.push(POSITIONS.map((position) => counts[position]).join('-'))
    for (const position of POSITIONS) if (counts[position] === 3) positionAtThree[position] += 1
    if (POSITIONS.some((position) => counts[position] !== priorCounts[programId]![position])) shapeChanges += 1
    if (players.length !== 12 || POSITIONS.some((position) => counts[position] < 2 || counts[position] > 3)) illegalRosters += 1
    const returnerCounts = positionCounts(returnersByProgram[programId]!)
    const commitmentCounts = emptyCounts()
    const offerCounts = positionCounts(players.filter((player) => !returnersByProgram[programId]!.some(({ id }) => id === player.id)))
    if (!isJointOfferSetFeasible(returnerCounts, commitmentCounts, offerCounts)) offerFeasibilityFailures += 1
    if (players.length === 12 && POSITIONS.every((position) => counts[position] >= 2 && counts[position] <= 3)) {
      const team = { ...season.programStates[programId]!.team, roster: players }
      try {
        teamStrengths.push(calculateTeamStrength(team, generateDefaultRotationV1(team)).overall)
      } catch (error) {
        throw new RangeError(
          `Diagnostic Rotation failure model=${model} seed=${seed} program=${programId} counts=${JSON.stringify(counts)} unique=${new Set(players.map(({ id }) => id)).size}`,
          { cause: error },
        )
      }
    }
  }
  const unmatchedMandatory = first.requested - first.assigned
  const unmatchedFlexible = second.requested - second.assigned
  const requestedTotal = first.requested + second.requested
  const assignedTotal = first.assigned + second.assigned
  const positionalSupplyFailure = POSITIONS.reduce((sum, position) => sum + Math.max(0, mandatoryLeague[position] - supply[position]), 0)
  const totalSupplyFailure = Math.max(0, requestedTotal - recruits.length)
  const compatibilityFailure = totalSupplyFailure === 0 && positionalSupplyFailure === 0 ? requestedTotal - assignedTotal : 0
  return {
    model, seed,
    success: illegalRosters === 0 && unmatchedMandatory === 0 && unmatchedFlexible === 0 && offerFeasibilityFailures === 0,
    classSize: recruits.length, supply, mandatory: mandatoryLeague,
    flexibleScholarships: Object.values(flexibleByProgram).reduce((sum, value) => sum + value, 0),
    unmatchedMandatory, unmatchedFlexible, totalSupplyFailure, positionalSupplyFailure, compatibilityFailure,
    illegalRosters, offerFeasibilityFailures, emergencyGeneration: 0,
    fallbackMandatoryNodes: first.requested, fallbackFlexibleNodes: second.requested,
    unsignedByPosition, finalPatterns, positionAtThree, shapeChanges, flexibleAssignments,
    recruits, teamStrengths, rosters,
  }
}

export interface AggregateDiagnostic {
  readonly cycles: number
  readonly successful: number
  readonly failures: number
  readonly illegalRosters: number
  readonly unmatchedMandatory: number
  readonly unmatchedFlexible: number
  readonly compatibilityFailures: number
  readonly offerFeasibilityFailures: number
  readonly supplyMean: PositionCounts
  readonly mandatoryMean: PositionCounts
  readonly surplusOverMandatoryMean: PositionCounts
  readonly unsignedMean: PositionCounts
  readonly flexibleScholarshipsMean: number
  readonly fallbackMandatoryNodes: number
  readonly fallbackFlexibleNodes: number
  readonly classSizeMean: number
  readonly fiveStarsMean: number
  readonly fourStarsMean: number
  readonly recruitOverallMean: number
  readonly recruitPotentialMean: number
  readonly top25OverallMean: number
  readonly top25PotentialMean: number
  readonly shapeChanges: number
  readonly positionAtThree: PositionCounts
  readonly flexibleAssignments: PositionCounts
  readonly teamStrengthMean: number
  readonly teamStrengthP90: number
  readonly teamStrength90Plus: number
}

const mean = (values: readonly number[]) => values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
const percentile = (values: readonly number[], fraction: number) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) * fraction)]!
}

export function aggregateCycles(results: readonly ModelCycleResult[]): AggregateDiagnostic {
  const recruits = results.flatMap(({ recruits }) => recruits)
  const strengths = results.flatMap(({ teamStrengths }) => teamStrengths)
  const top25 = results.flatMap(({ recruits: entries }) => [...entries].sort((a, b) => a.nationalRank - b.nationalRank).slice(0, 25))
  return {
    cycles: results.length,
    successful: results.filter(({ success }) => success).length,
    failures: results.filter(({ success }) => !success).length,
    illegalRosters: results.reduce((sum, result) => sum + result.illegalRosters, 0),
    unmatchedMandatory: results.reduce((sum, result) => sum + result.unmatchedMandatory, 0),
    unmatchedFlexible: results.reduce((sum, result) => sum + result.unmatchedFlexible, 0),
    compatibilityFailures: results.reduce((sum, result) => sum + result.compatibilityFailure, 0),
    offerFeasibilityFailures: results.reduce((sum, result) => sum + result.offerFeasibilityFailures, 0),
    supplyMean: Object.fromEntries(POSITIONS.map((position) => [position, mean(results.map(({ supply }) => supply[position]))])) as PositionCounts,
    mandatoryMean: Object.fromEntries(POSITIONS.map((position) => [position, mean(results.map(({ mandatory }) => mandatory[position]))])) as PositionCounts,
    surplusOverMandatoryMean: Object.fromEntries(POSITIONS.map((position) => [position, mean(results.map((result) => result.supply[position] - result.mandatory[position]))])) as PositionCounts,
    unsignedMean: Object.fromEntries(POSITIONS.map((position) => [position, mean(results.map(({ unsignedByPosition }) => unsignedByPosition[position]))])) as PositionCounts,
    flexibleScholarshipsMean: mean(results.map(({ flexibleScholarships }) => flexibleScholarships)),
    fallbackMandatoryNodes: results.reduce((sum, result) => sum + result.fallbackMandatoryNodes, 0),
    fallbackFlexibleNodes: results.reduce((sum, result) => sum + result.fallbackFlexibleNodes, 0),
    classSizeMean: mean(results.map(({ classSize }) => classSize)),
    fiveStarsMean: mean(results.map(({ recruits: entries }) => entries.filter(({ stars }) => stars === 5).length)),
    fourStarsMean: mean(results.map(({ recruits: entries }) => entries.filter(({ stars }) => stars === 4).length)),
    recruitOverallMean: mean(recruits.map(({ player }) => calculateOverall(player))),
    recruitPotentialMean: mean(recruits.map(({ player }) => player.potential)),
    top25OverallMean: mean(top25.map(({ player }) => calculateOverall(player))),
    top25PotentialMean: mean(top25.map(({ player }) => player.potential)),
    shapeChanges: results.reduce((sum, result) => sum + result.shapeChanges, 0),
    positionAtThree: Object.fromEntries(POSITIONS.map((position) => [position, results.reduce((sum, result) => sum + result.positionAtThree[position], 0)])) as PositionCounts,
    flexibleAssignments: Object.fromEntries(POSITIONS.map((position) => [position, results.reduce((sum, result) => sum + result.flexibleAssignments[position], 0)])) as PositionCounts,
    teamStrengthMean: mean(strengths), teamStrengthP90: percentile(strengths, 0.9),
    teamStrength90Plus: strengths.filter((value) => value >= 90).length,
  }
}

export function runPairedDiagnostic(seedCount: number, prefix = 'roster-flex'): Record<FlexDiagnosticModel, AggregateDiagnostic> {
  const results = { baseline: [] as ModelCycleResult[], b1: [] as ModelCycleResult[], b2: [] as ModelCycleResult[] }
  for (let index = 0; index < seedCount; index += 1) {
    const seed = `${prefix}-${String(index).padStart(4, '0')}`
    for (const model of ['baseline', 'b1', 'b2'] as const) results[model].push(runModelCycle(model, seed))
  }
  return { baseline: aggregateCycles(results.baseline), b1: aggregateCycles(results.b1), b2: aggregateCycles(results.b2) }
}

export function runMultiSeasonDiagnostic(
  seedCount: number,
  seasons: number,
  prefix = 'roster-flex-multi',
): Record<FlexDiagnosticModel, AggregateDiagnostic> {
  const results = { baseline: [] as ModelCycleResult[], b1: [] as ModelCycleResult[], b2: [] as ModelCycleResult[] }
  for (let seedIndex = 0; seedIndex < seedCount; seedIndex += 1) {
    for (const model of ['baseline', 'b1', 'b2'] as const) {
      let teams: Record<string, Team> | undefined
      for (let season = 1; season <= seasons; season += 1) {
        const cycleSeed = `${prefix}-${String(seedIndex).padStart(3, '0')}-season-${season}`
        const result = runModelCycle(model, cycleSeed, teams)
        results[model].push(result)
        const source = createRecruitingDynasty(cycleSeed).activeSeason!
        teams = Object.fromEntries(Object.keys(result.rosters).sort().map((programId) => [programId, {
          ...source.programStates[programId]!.team,
          roster: [...result.rosters[programId]!],
        }]))
      }
    }
  }
  return { baseline: aggregateCycles(results.baseline), b1: aggregateCycles(results.b1), b2: aggregateCycles(results.b2) }
}

export function determinismFingerprint(result: ModelCycleResult): string {
  return JSON.stringify({
    success: result.success, supply: result.supply, mandatory: result.mandatory,
    unsigned: result.unsignedByPosition, patterns: result.finalPatterns,
    assignments: result.flexibleAssignments,
  })
}

export function shuffleProgramOrder(teams: Readonly<Record<string, Team>>, seed: string): Record<string, Team> {
  const entries = Object.entries(teams)
  const rng = createRng(seed)
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const other = rng.int(0, index)
    ;[entries[index], entries[other]] = [entries[other]!, entries[index]!]
  }
  return Object.fromEntries(entries)
}
