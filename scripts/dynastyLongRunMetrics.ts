import {
  CLASS_YEARS,
  POSITIONS,
  calculateOverall,
  calculateTeamStrength,
  type ClassYear,
  type Player,
  type Position,
} from '../src/engine'
import type {
  CompletedRecruitingClass,
  OffseasonState,
} from '../src/dynasty'
import { deriveNationalChampion, type PostseasonState } from '../src/postseason'
import { deriveProgramRecord, type SeasonState } from '../src/season'

export const PRESTIGE_BANDS = ['80–100', '60–79', '40–59', '1–39'] as const
export type PrestigeBand = (typeof PRESTIGE_BANDS)[number]

export interface DistributionSummary {
  readonly count: number
  readonly average: number
  readonly median: number
  readonly standardDeviation: number
  readonly p10: number
  readonly p25: number
  readonly p75: number
  readonly p90: number
  readonly minimum: number
  readonly maximum: number
}

export interface PlayerTalentRecord {
  readonly seasonNumber: number
  readonly playerId: string
  readonly programId: string
  readonly classYear: ClassYear
  readonly position: Position
  readonly overall: number
  readonly potential: number
}

export interface TeamTalentRecord {
  readonly programId: string
  readonly prestige: number
  readonly overall: number
  readonly winPercentage: number
}

export interface SeasonTalentMetrics {
  readonly seasonNumber: number
  readonly teams: readonly TeamTalentRecord[]
  readonly players: readonly PlayerTalentRecord[]
  readonly teamOverall: DistributionSummary
  readonly playerOverall: DistributionSummary
  readonly classOverall: Readonly<Record<ClassYear, DistributionSummary>>
  readonly classPotential: Readonly<Record<ClassYear, DistributionSummary>>
  readonly classPotentialGap: Readonly<Record<ClassYear, DistributionSummary>>
  readonly positionCounts: Readonly<Record<Position, number>>
  readonly highEndCounts: Readonly<Record<80 | 85 | 90 | 95, number>>
}

export interface DevelopmentRecord {
  readonly seasonNumber: number
  readonly playerId: string
  readonly programId: string
  readonly transition: 'FR→SO' | 'SO→JR' | 'JR→SR'
  readonly overallGain: number
}

export interface SignedRecruitRecord {
  readonly playerId: string
  readonly programId: string
  readonly targetSeasonNumber: number
  readonly prestige: number
  readonly prestigeBand: PrestigeBand
  readonly nationalRank: number
  readonly stars: 2 | 3 | 4 | 5
  readonly overall: number
  readonly potential: number
}

export interface IdentityAudit {
  readonly duplicateActivePlayerIds: number
  readonly duplicateNewRecruitIds: number
  readonly newRecruitExistingPersonCollisions: number
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (values.length === 0) return 0
  if (fraction < 0 || fraction > 1) {
    throw new RangeError('Percentile fraction must be between 0 and 1.')
  }
  const sorted = [...values].sort((first, second) => first - second)
  const position = (sorted.length - 1) * fraction
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const lower = sorted[lowerIndex]!
  const upper = sorted[upperIndex]!
  return lower + (upper - lower) * (position - lowerIndex)
}

export function summarizeDistribution(
  values: readonly number[],
): DistributionSummary {
  const mean = average(values)
  const variance = average(values.map((value) => (value - mean) ** 2))
  return {
    count: values.length,
    average: mean,
    median: percentile(values, 0.5),
    standardDeviation: Math.sqrt(variance),
    p10: percentile(values, 0.1),
    p25: percentile(values, 0.25),
    p75: percentile(values, 0.75),
    p90: percentile(values, 0.9),
    minimum: values.length === 0 ? 0 : Math.min(...values),
    maximum: values.length === 0 ? 0 : Math.max(...values),
  }
}

export function linearSlope(
  points: readonly { readonly x: number; readonly y: number }[],
): number {
  if (points.length < 2) return 0
  const xMean = average(points.map(({ x }) => x))
  const yMean = average(points.map(({ y }) => y))
  const numerator = points.reduce(
    (sum, { x, y }) => sum + (x - xMean) * (y - yMean),
    0,
  )
  const denominator = points.reduce(
    (sum, { x }) => sum + (x - xMean) ** 2,
    0,
  )
  return denominator === 0 ? 0 : numerator / denominator
}

export function correlation(
  pairs: readonly { readonly first: number; readonly second: number }[],
): number {
  if (pairs.length < 2) return 0
  const firstMean = average(pairs.map(({ first }) => first))
  const secondMean = average(pairs.map(({ second }) => second))
  const numerator = pairs.reduce(
    (sum, { first, second }) =>
      sum + (first - firstMean) * (second - secondMean),
    0,
  )
  const firstSquares = pairs.reduce(
    (sum, { first }) => sum + (first - firstMean) ** 2,
    0,
  )
  const secondSquares = pairs.reduce(
    (sum, { second }) => sum + (second - secondMean) ** 2,
    0,
  )
  const denominator = Math.sqrt(firstSquares * secondSquares)
  return denominator === 0 ? 0 : numerator / denominator
}

export function prestigeBand(prestige: number): PrestigeBand {
  if (prestige >= 80) return '80–100'
  if (prestige >= 60) return '60–79'
  if (prestige >= 40) return '40–59'
  return '1–39'
}

export function extractSeasonTalentMetrics(
  season: SeasonState,
): SeasonTalentMetrics {
  const teams = Object.entries(season.programStates)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([programId, { team, rotation }]) => {
      const record = deriveProgramRecord(season, programId)
      return {
        programId,
        prestige: team.prestige,
        overall: calculateTeamStrength(team, rotation).overall,
        winPercentage: (record.wins + record.losses) === 0
          ? 0
          : record.wins / (record.wins + record.losses),
      }
    })
  const players = Object.entries(season.programStates)
    .sort(([first], [second]) => first.localeCompare(second))
    .flatMap(([programId, { team }]) => team.roster.map((player) => ({
      seasonNumber: season.seasonNumber,
      playerId: player.id,
      programId,
      classYear: player.classYear,
      position: player.position,
      overall: calculateOverall(player),
      potential: player.potential,
    })))

  return {
    seasonNumber: season.seasonNumber,
    teams,
    players,
    teamOverall: summarizeDistribution(teams.map(({ overall }) => overall)),
    playerOverall: summarizeDistribution(players.map(({ overall }) => overall)),
    classOverall: Object.fromEntries(CLASS_YEARS.map((classYear) => [
      classYear,
      summarizeDistribution(players
        .filter((player) => player.classYear === classYear)
        .map(({ overall }) => overall)),
    ])) as Record<ClassYear, DistributionSummary>,
    classPotential: Object.fromEntries(CLASS_YEARS.map((classYear) => [
      classYear,
      summarizeDistribution(players
        .filter((player) => player.classYear === classYear)
        .map(({ potential }) => potential)),
    ])) as Record<ClassYear, DistributionSummary>,
    classPotentialGap: Object.fromEntries(CLASS_YEARS.map((classYear) => [
      classYear,
      summarizeDistribution(players
        .filter((player) => player.classYear === classYear)
        .map(({ overall, potential }) => potential - overall)),
    ])) as Record<ClassYear, DistributionSummary>,
    positionCounts: Object.fromEntries(POSITIONS.map((position) => [
      position,
      players.filter((player) => player.position === position).length,
    ])) as Record<Position, number>,
    highEndCounts: Object.fromEntries(([80, 85, 90, 95] as const).map(
      (threshold) => [
        threshold,
        players.filter(({ overall }) => overall >= threshold).length,
      ],
    )) as Record<80 | 85 | 90 | 95, number>,
  }
}

export function deriveDevelopmentRecords(
  season: SeasonState,
  offseason: OffseasonState,
): DevelopmentRecord[] {
  const records: DevelopmentRecord[] = []
  for (const [programId, { team }] of Object.entries(season.programStates)) {
    const developedById = new Map(
      offseason.programs[programId]?.returningPlayers.map((player) => [
        player.id,
        player,
      ]) ?? [],
    )
    for (const before of team.roster) {
      if (before.classYear === 'SR') continue
      const after = developedById.get(before.id)
      if (!after) {
        throw new RangeError(`Missing developed returner "${before.id}".`)
      }
      records.push({
        seasonNumber: season.seasonNumber,
        playerId: before.id,
        programId,
        transition: `${before.classYear}→${after.classYear}` as DevelopmentRecord['transition'],
        overallGain: calculateOverall(after) - calculateOverall(before),
      })
    }
  }
  return records.sort((first, second) =>
    first.programId.localeCompare(second.programId) ||
    first.playerId.localeCompare(second.playerId),
  )
}

export function extractSignedRecruitRecords(
  recruitingClass: CompletedRecruitingClass,
  prestigeByProgramId: Readonly<Record<string, number>>,
): SignedRecruitRecord[] {
  const state = recruitingClass.recruitingState
  const recruitsById = new Map(state.recruits.map((recruit) => [
    recruit.player.id,
    recruit,
  ]))
  return Object.values(state.commitmentsByPlayerId)
    .map((commitment) => {
      const recruit = recruitsById.get(commitment.playerId)
      const prestige = prestigeByProgramId[commitment.programId]
      if (!recruit || prestige === undefined) {
        throw new RangeError('Recruiting commitment references missing calibration facts.')
      }
      return {
        playerId: recruit.player.id,
        programId: commitment.programId,
        targetSeasonNumber: state.targetSeasonNumber,
        prestige,
        prestigeBand: prestigeBand(prestige),
        nationalRank: recruit.nationalRank,
        stars: recruit.stars,
        overall: calculateOverall(recruit.player),
        potential: recruit.player.potential,
      }
    })
    .sort((first, second) =>
      first.nationalRank - second.nationalRank ||
      first.playerId.localeCompare(second.playerId),
    )
}

export function deriveChampionCounts(
  postseasons: readonly PostseasonState[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const postseason of postseasons) {
    const champion = deriveNationalChampion(postseason)
    if (champion) counts[champion] = (counts[champion] ?? 0) + 1
  }
  return counts
}

export function auditIdentityCollisions(options: {
  readonly activePlayerIds: readonly string[]
  readonly existingPersonIds: ReadonlySet<string>
  readonly newRecruitIds: readonly string[]
}): IdentityAudit {
  return {
    duplicateActivePlayerIds:
      options.activePlayerIds.length - new Set(options.activePlayerIds).size,
    duplicateNewRecruitIds:
      options.newRecruitIds.length - new Set(options.newRecruitIds).size,
    newRecruitExistingPersonCollisions: options.newRecruitIds.filter(
      (id) => options.existingPersonIds.has(id),
    ).length,
  }
}

export function serializedSizeBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

export function playerCeilingRates(players: readonly PlayerTalentRecord[]): {
  readonly atPotential: number
  readonly withinOne: number
  readonly withinThree: number
} {
  if (players.length === 0) {
    return { atPotential: 0, withinOne: 0, withinThree: 0 }
  }
  const gaps = players.map(({ overall, potential }) => potential - overall)
  return {
    atPotential: gaps.filter((gap) => gap === 0).length / gaps.length,
    withinOne: gaps.filter((gap) => gap <= 1).length / gaps.length,
    withinThree: gaps.filter((gap) => gap <= 3).length / gaps.length,
  }
}

export function graduatingPlayers(season: SeasonState): Player[] {
  return Object.values(season.programStates).flatMap(({ team }) =>
    team.roster.filter(({ classYear }) => classYear === 'SR'),
  )
}
