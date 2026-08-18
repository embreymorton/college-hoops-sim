import { MAX_TEAM_PRESTIGE, MIN_TEAM_PRESTIGE } from '../engine'
import { rankAtLargeCandidates, type PostseasonState } from '../postseason'
import type { SeasonState } from '../season'
import type { UniverseDefinition } from '../universe'
import type {
  DynastyState,
  ProgramPrestigeReason,
  ProgramPrestigeUpdate,
} from './domain'

export type PrestigeTargetMapping = 'linear-range' | 'league-distribution'

export interface ProgramPrestigeProjectionOptions {
  readonly targetMapping?: PrestigeTargetMapping
  readonly annualCap?: 2 | 3
  readonly convergenceRate?: number
}

export const PROGRAM_PRESTIGE_V1 = {
  targetMapping: 'league-distribution',
  annualCap: 3,
  convergenceRate: 0.15,
} as const

export interface ProgramPrestigeHistoryRow {
  readonly label: 'Start' | `Season ${number}`
  readonly seasonNumber: number | null
  readonly prestige: number
  readonly change: number | null
  readonly current: boolean
}

export interface ProgramPrestigeHistory {
  readonly programId: string
  readonly startingPrestige: number
  readonly currentPrestige: number
  readonly dynastyChange: number
  readonly peakPrestige: number
  readonly rows: readonly ProgramPrestigeHistoryRow[]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function roundAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

function tournamentFloorRank(postseason: PostseasonState, programId: string): number | null {
  if (!postseason.field.some((entry) => entry.programId === programId)) return null
  const wins = Object.values(postseason.resultsByGameId)
    .filter((result) => result.winnerId === programId).length
  const fieldSize = postseason.field.length
  return wins >= 4 ? 1 : wins === 3 ? 2 : wins === 2 ? 4 : wins === 1 ? 8 : fieldSize
}

function targetForRank(
  rank: number,
  currentPrestigesDescending: readonly number[],
  mapping: PrestigeTargetMapping,
): number {
  if (mapping === 'league-distribution') return currentPrestigesDescending[rank - 1]!
  const high = currentPrestigesDescending[0]!
  const low = currentPrestigesDescending.at(-1)!
  const ratio = currentPrestigesDescending.length === 1
    ? 0
    : (rank - 1) / (currentPrestigesDescending.length - 1)
  return Math.round(high + (low - high) * ratio)
}

function reasonFor(
  change: number,
  tournamentFloor: number | null,
  programCount: number,
): ProgramPrestigeReason {
  if (change === 0) return 'met-expectations'
  if (change < 0) return change <= -3 ? 'major-decline' : 'disappointing-season'
  if (tournamentFloor !== null && tournamentFloor <= 4) return 'national-contender'
  if (tournamentFloor !== null && tournamentFloor < programCount / 2) return 'tournament-run'
  return 'strong-season'
}

/** Projects one bounded Prestige update for every Program without mutating inputs. */
export function projectProgramPrestigeUpdates(
  universe: UniverseDefinition,
  season: SeasonState,
  postseason: PostseasonState,
  options: ProgramPrestigeProjectionOptions = {},
): readonly ProgramPrestigeUpdate[] {
  const mapping = options.targetMapping ?? PROGRAM_PRESTIGE_V1.targetMapping
  const annualCap = options.annualCap ?? PROGRAM_PRESTIGE_V1.annualCap
  const convergenceRate = options.convergenceRate ?? PROGRAM_PRESTIGE_V1.convergenceRate
  if (!(convergenceRate > 0 && convergenceRate <= 1)) {
    throw new RangeError('Prestige convergence rate must be greater than 0 and at most 1.')
  }
  const programIds = universe.programs.map(({ id }) => id)
  const regularOrder = rankAtLargeCandidates(season, programIds)
  const regularRank = new Map(regularOrder.map((programId, index) => [programId, index + 1]))
  const targetPrestiges = universe.programs
    .map(({ basePrestige }) => basePrestige)
    .sort((first, second) => second - first)

  return [...programIds].sort().map((programId) => {
    const team = postseason.programStates[programId]?.team ?? season.programStates[programId]?.team
    if (!team) throw new RangeError(`Completed Season is missing Program "${programId}".`)
    const seasonRank = regularRank.get(programId)!
    const floor = tournamentFloorRank(postseason, programId)
    const effectivePerformanceRank = floor === null ? seasonRank : Math.min(seasonRank, floor)
    const targetPrestige = targetForRank(effectivePerformanceRank, targetPrestiges, mapping)
    const uncappedChange = roundAwayFromZero(
      (targetPrestige - team.prestige) * convergenceRate,
    )
    const change = clamp(uncappedChange, -annualCap, annualCap)
    const newPrestige = clamp(
      team.prestige + change,
      MIN_TEAM_PRESTIGE,
      MAX_TEAM_PRESTIGE,
    )
    const actualChange = newPrestige - team.prestige
    return {
      programId,
      previousPrestige: team.prestige,
      targetPrestige,
      newPrestige,
      change: actualChange,
      regularSeasonRank: seasonRank,
      effectivePerformanceRank,
      reason: reasonFor(actualChange, floor, programIds.length),
    }
  })
}

/** Derives a Program's Prestige trail from immutable definitions and canonical snapshots. */
export function deriveProgramPrestigeHistory(
  dynasty: Pick<DynastyState, 'universe' | 'history' | 'activeSeason' | 'offseason'>,
  programId: string,
): ProgramPrestigeHistory {
  const definition = dynasty.universe.programs.find(({ id }) => id === programId)
  if (!definition) throw new RangeError(`Unknown Program ID "${programId}" for Prestige history.`)

  const snapshots = dynasty.history
    .slice()
    .sort((first, second) => first.seasonNumber - second.seasonNumber)
    .map((archive) => {
      const team = archive.postseason.programStates[programId]?.team ??
        archive.season.programStates[programId]?.team
      if (!team) {
        throw new RangeError(
          `Completed Season ${archive.seasonNumber} is missing Program "${programId}".`,
        )
      }
      return { seasonNumber: archive.seasonNumber, prestige: team.prestige }
    })

  const activeTeam = dynasty.activeSeason?.programStates[programId]?.team
  const offseasonProgram = dynasty.offseason?.programs[programId]
  const currentPrestige = activeTeam?.prestige ?? offseasonProgram?.prestige ??
    snapshots.at(-1)?.prestige ?? definition.basePrestige
  const currentSeasonNumber = dynasty.activeSeason?.seasonNumber ??
    dynasty.offseason?.targetSeasonNumber ?? null
  const timeline = [
    { seasonNumber: null, prestige: definition.basePrestige },
    ...snapshots,
    ...(currentSeasonNumber !== null &&
      !snapshots.some(({ seasonNumber }) => seasonNumber === currentSeasonNumber)
      ? [{ seasonNumber: currentSeasonNumber, prestige: currentPrestige }]
      : []),
  ]
  const rows = timeline.map((snapshot, index): ProgramPrestigeHistoryRow => ({
    label: snapshot.seasonNumber === null ? 'Start' : `Season ${snapshot.seasonNumber}`,
    seasonNumber: snapshot.seasonNumber,
    prestige: snapshot.prestige,
    change: index === 0 ? null : snapshot.prestige - timeline[index - 1]!.prestige,
    current: index === timeline.length - 1,
  }))

  return {
    programId,
    startingPrestige: definition.basePrestige,
    currentPrestige,
    dynastyChange: currentPrestige - definition.basePrestige,
    peakPrestige: Math.max(...timeline.map(({ prestige }) => prestige), currentPrestige),
    rows,
  }
}
