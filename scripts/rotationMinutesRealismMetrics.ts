import {
  POSITIONS,
  calculateOverall,
  calculateTeamStrength,
  derivePlayerMinutesV1,
  generateNaturalDefaultRotationV1,
  type Position,
} from '../src/engine'
import {
  deriveNationalPlayerLeaders,
  deriveSeasonPlayerStats,
  type SeasonState,
} from '../src/season'

export const MINUTE_BANDS = ['40', '36–39', '32–35', '20–31', 'below 20'] as const
export type MinuteBand = (typeof MINUTE_BANDS)[number]
export type SeasonPartition = 'all' | 'season1' | 'season5plus'
export type Exact40Origin =
  | 'naturalAlready40'
  | 'natural36ToFlexible40'
  | 'naturalBelow36ToFlexible40'
  | 'other'

export interface RotationMinuteObservation {
  readonly seed: string
  readonly seasonNumber: number
  readonly programId: string
  readonly playerId: string
  readonly position: Position
  readonly overall: number
  readonly teamOverall: number
  readonly assignedMinutes: number
  readonly naturalMinutes: number
  readonly naturalPositionMinutes: number
  readonly secondaryMinutes: number
  readonly secondaryByPath: Readonly<Record<string, number>>
  readonly minutesPerGame: number
  readonly isTeamHighestOverall: boolean
  readonly isTeamTopThreeOverall: boolean
  readonly isTopTenPpg: boolean
  readonly isTopTenApg: boolean
  readonly isTopTenRpg: boolean
}

export interface CountRate {
  readonly count: number
  readonly total: number
  readonly rate: number
}

export interface RotationMinutesSummary {
  readonly observations: number
  readonly rotationPlayers: number
  readonly minuteBands: Readonly<Record<MinuteBand, CountRate>>
  readonly teams: {
    readonly total: number
    readonly atLeastOne: CountRate
    readonly atLeastTwo: CountRate
    readonly atLeastThree: CountRate
  }
  readonly exact40Origins: Readonly<Record<Exact40Origin, CountRate>>
  readonly exact40ByPosition: Readonly<Record<Position, CountRate>>
  readonly exact40ByOverallBand: Readonly<Record<string, CountRate>>
  readonly exact40SecondaryPaths: Readonly<Record<string, { players: number; minutes: number }>>
  readonly exact40NaturalMinutes: number
  readonly exact40SecondaryMinutes: number
  readonly eliteRates: {
    readonly allRotationPlayers: CountRate
    readonly teamHighestOverall: CountRate
    readonly teamTopThreeOverall: CountRate
    readonly topTenPpg: CountRate
    readonly topTenApg: CountRate
    readonly topTenRpg: CountRate
  }
  readonly assigned40ActualMpg: {
    readonly players: number
    readonly average: number
    readonly minimum: number
    readonly maximum: number
    readonly approximately40: number
  }
}

export function minuteBand(minutes: number): MinuteBand {
  if (minutes === 40) return '40'
  if (minutes >= 36) return '36–39'
  if (minutes >= 32) return '32–35'
  if (minutes >= 20) return '20–31'
  return 'below 20'
}

export function classifyExact40Origin(
  naturalMinutes: number,
  flexibleMinutes: number,
): Exact40Origin {
  if (flexibleMinutes !== 40) return 'other'
  if (naturalMinutes === 40) return 'naturalAlready40'
  if (naturalMinutes === 36) return 'natural36ToFlexible40'
  if (naturalMinutes < 36) return 'naturalBelow36ToFlexible40'
  return 'other'
}

export function seasonPartition(seasonNumber: number): Exclude<SeasonPartition, 'all'> | undefined {
  if (seasonNumber === 1) return 'season1'
  if (seasonNumber >= 5) return 'season5plus'
  return undefined
}

function rankedPlayerIds(
  players: readonly { readonly id: string; readonly overall: number }[],
): readonly string[] {
  return players.slice().sort(
    (first, second) => second.overall - first.overall || first.id.localeCompare(second.id),
  ).map(({ id }) => id)
}

export function extractSeasonRotationMinuteObservations(
  season: SeasonState,
  seed: string,
): RotationMinuteObservation[] {
  const statsByPlayerId = new Map(
    deriveSeasonPlayerStats(season).map((stats) => [stats.playerId, stats]),
  )
  const leaders = deriveNationalPlayerLeaders(season)
  const leaderIds = (category: 'points' | 'assists' | 'rebounds') =>
    new Set(leaders[category].map(({ playerId }) => playerId))
  const topPpg = leaderIds('points')
  const topApg = leaderIds('assists')
  const topRpg = leaderIds('rebounds')

  return Object.entries(season.programStates)
    .sort(([first], [second]) => first.localeCompare(second))
    .flatMap(([programId, { team, rotation }]) => {
      const flexibleMinutes = derivePlayerMinutesV1(rotation)
      const naturalMinutes = derivePlayerMinutesV1(generateNaturalDefaultRotationV1(team))
      const rankings = rankedPlayerIds(team.roster.map((player) => ({
        id: player.id,
        overall: calculateOverall(player),
      })))
      const highest = rankings[0]
      const topThree = new Set(rankings.slice(0, 3))
      const teamOverall = calculateTeamStrength(team, rotation).overall

      return team.roster.map((player) => {
        const secondaryByPath: Record<string, number> = {}
        let secondaryMinutes = 0
        for (const floorPosition of POSITIONS) {
          if (floorPosition === player.position) continue
          const minutes = rotation.minutesByPosition[floorPosition][player.id] ?? 0
          if (minutes <= 0) continue
          secondaryMinutes += minutes
          secondaryByPath[`${player.position}→${floorPosition}`] = minutes
        }
        return {
          seed,
          seasonNumber: season.seasonNumber,
          programId,
          playerId: player.id,
          position: player.position,
          overall: calculateOverall(player),
          teamOverall,
          assignedMinutes: flexibleMinutes[player.id] ?? 0,
          naturalMinutes: naturalMinutes[player.id] ?? 0,
          naturalPositionMinutes:
            rotation.minutesByPosition[player.position][player.id] ?? 0,
          secondaryMinutes,
          secondaryByPath,
          minutesPerGame: statsByPlayerId.get(player.id)?.minutesPerGame ?? 0,
          isTeamHighestOverall: player.id === highest,
          isTeamTopThreeOverall: topThree.has(player.id),
          isTopTenPpg: topPpg.has(player.id),
          isTopTenApg: topApg.has(player.id),
          isTopTenRpg: topRpg.has(player.id),
        }
      })
    })
}

function countRate(count: number, total: number): CountRate {
  return { count, total, rate: total === 0 ? 0 : count / total }
}

function rateFor(
  observations: readonly RotationMinuteObservation[],
  predicate: (observation: RotationMinuteObservation) => boolean,
): CountRate {
  const selected = observations.filter(predicate)
  return countRate(selected.filter(({ assignedMinutes }) => assignedMinutes === 40).length, selected.length)
}

function overallBand(overall: number): string {
  if (overall >= 90) return '90+'
  if (overall >= 85) return '85–89'
  if (overall >= 80) return '80–84'
  if (overall >= 75) return '75–79'
  return 'below 75'
}

export function summarizeRotationMinutes(
  observations: readonly RotationMinuteObservation[],
): RotationMinutesSummary {
  const rotationPlayers = observations.filter(({ assignedMinutes }) => assignedMinutes > 0)
  const exact40 = rotationPlayers.filter(({ assignedMinutes }) => assignedMinutes === 40)
  const teamCounts = new Map<string, number>()
  for (const observation of exact40) {
    const key = `${observation.seed}:${observation.seasonNumber}:${observation.programId}`
    teamCounts.set(key, (teamCounts.get(key) ?? 0) + 1)
  }
  const allTeams = new Set(observations.map(
    ({ seed, seasonNumber, programId }) => `${seed}:${seasonNumber}:${programId}`,
  ))
  const origins = exact40.map(({ naturalMinutes, assignedMinutes }) =>
    classifyExact40Origin(naturalMinutes, assignedMinutes),
  )
  const paths: Record<string, { players: number; minutes: number }> = {}
  for (const observation of exact40) {
    for (const [path, minutes] of Object.entries(observation.secondaryByPath)) {
      const current = paths[path] ?? { players: 0, minutes: 0 }
      current.players += 1
      current.minutes += minutes
      paths[path] = current
    }
  }
  const mpg = exact40.map(({ minutesPerGame }) => minutesPerGame)

  return {
    observations: observations.length,
    rotationPlayers: rotationPlayers.length,
    minuteBands: Object.fromEntries(MINUTE_BANDS.map((band) => [
      band,
      countRate(rotationPlayers.filter((value) => minuteBand(value.assignedMinutes) === band).length, rotationPlayers.length),
    ])) as Record<MinuteBand, CountRate>,
    teams: {
      total: allTeams.size,
      atLeastOne: countRate([...teamCounts.values()].filter((count) => count >= 1).length, allTeams.size),
      atLeastTwo: countRate([...teamCounts.values()].filter((count) => count >= 2).length, allTeams.size),
      atLeastThree: countRate([...teamCounts.values()].filter((count) => count >= 3).length, allTeams.size),
    },
    exact40Origins: Object.fromEntries(([
      'naturalAlready40',
      'natural36ToFlexible40',
      'naturalBelow36ToFlexible40',
      'other',
    ] as const).map((origin) => [origin, countRate(origins.filter((value) => value === origin).length, exact40.length)])) as Record<Exact40Origin, CountRate>,
    exact40ByPosition: Object.fromEntries(POSITIONS.map((position) => [
      position,
      rateFor(rotationPlayers, (value) => value.position === position),
    ])) as Record<Position, CountRate>,
    exact40ByOverallBand: Object.fromEntries([
      '90+', '85–89', '80–84', '75–79', 'below 75',
    ].map((band) => [band, rateFor(rotationPlayers, (value) => overallBand(value.overall) === band)])),
    exact40SecondaryPaths: paths,
    exact40NaturalMinutes: exact40.reduce((sum, value) => sum + value.naturalPositionMinutes, 0),
    exact40SecondaryMinutes: exact40.reduce((sum, value) => sum + value.secondaryMinutes, 0),
    eliteRates: {
      allRotationPlayers: rateFor(rotationPlayers, () => true),
      teamHighestOverall: rateFor(observations, (value) => value.isTeamHighestOverall),
      teamTopThreeOverall: rateFor(observations, (value) => value.isTeamTopThreeOverall),
      topTenPpg: rateFor(observations, (value) => value.isTopTenPpg),
      topTenApg: rateFor(observations, (value) => value.isTopTenApg),
      topTenRpg: rateFor(observations, (value) => value.isTopTenRpg),
    },
    assigned40ActualMpg: {
      players: mpg.length,
      average: mpg.length === 0 ? 0 : mpg.reduce((sum, value) => sum + value, 0) / mpg.length,
      minimum: mpg.length === 0 ? 0 : Math.min(...mpg),
      maximum: mpg.length === 0 ? 0 : Math.max(...mpg),
      approximately40: mpg.filter((value) => Math.abs(value - 40) <= 0.05).length,
    },
  }
}

export function partitionRotationMinuteObservations(
  observations: readonly RotationMinuteObservation[],
): Readonly<Record<SeasonPartition, readonly RotationMinuteObservation[]>> {
  return {
    all: observations,
    season1: observations.filter(({ seasonNumber }) => seasonNumber === 1),
    season5plus: observations.filter(({ seasonNumber }) => seasonNumber >= 5),
  }
}
