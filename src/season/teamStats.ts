import type { PlayerGameStats } from '../engine'
import type { TeamSeasonStats, SeasonState } from './domain'
import { getCompletedGamesForProgram } from './queries'

const TEAM_TOTAL_FIELDS = [
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'turnovers',
  'fieldGoalsMade',
  'fieldGoalsAttempted',
  'threePointersMade',
  'threePointersAttempted',
  'freeThrowsMade',
  'freeThrowsAttempted',
] as const satisfies readonly (keyof PlayerGameStats)[]

type TeamTotalField = (typeof TEAM_TOTAL_FIELDS)[number]
type TeamTotals = Record<TeamTotalField, number> & {
  gamesPlayed: number
  points: number
  pointsAllowed: number
}

function createEmptyTotals(): TeamTotals {
  return {
    gamesPlayed: 0,
    points: 0,
    pointsAllowed: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  }
}

function divideOrZero(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

/** Derives one Program's regular-season Team totals and rates from canonical results. */
export function deriveTeamSeasonStats(
  season: SeasonState,
  programId: string,
): TeamSeasonStats {
  if (!season.programStates[programId]) {
    throw new RangeError(`Unknown Season Program ID "${programId}".`)
  }

  const totals = createEmptyTotals()

  for (const { game, result } of getCompletedGamesForProgram(season, programId)) {
    const isHome = game.homeProgramId === programId
    const playerStats = isHome
      ? result.homePlayerStats
      : result.awayPlayerStats

    totals.gamesPlayed += 1
    totals.points += isHome ? result.homeScore : result.awayScore
    totals.pointsAllowed += isHome ? result.awayScore : result.homeScore

    for (const row of playerStats) {
      for (const field of TEAM_TOTAL_FIELDS) {
        totals[field] += row[field]
      }
    }
  }

  return {
    programId,
    ...totals,
    pointsPerGame: divideOrZero(totals.points, totals.gamesPlayed),
    opponentPointsPerGame: divideOrZero(
      totals.pointsAllowed,
      totals.gamesPlayed,
    ),
    pointDifferentialPerGame: divideOrZero(
      totals.points - totals.pointsAllowed,
      totals.gamesPlayed,
    ),
    reboundsPerGame: divideOrZero(totals.rebounds, totals.gamesPlayed),
    assistsPerGame: divideOrZero(totals.assists, totals.gamesPlayed),
    stealsPerGame: divideOrZero(totals.steals, totals.gamesPlayed),
    blocksPerGame: divideOrZero(totals.blocks, totals.gamesPlayed),
    turnoversPerGame: divideOrZero(totals.turnovers, totals.gamesPlayed),
    fieldGoalPercentage: divideOrZero(
      totals.fieldGoalsMade,
      totals.fieldGoalsAttempted,
    ),
    threePointPercentage: divideOrZero(
      totals.threePointersMade,
      totals.threePointersAttempted,
    ),
    freeThrowPercentage: divideOrZero(
      totals.freeThrowsMade,
      totals.freeThrowsAttempted,
    ),
  }
}

/** Derives one Team row per Program in stable Program-ID order. */
export function deriveSeasonTeamStats(season: SeasonState): TeamSeasonStats[] {
  return Object.keys(season.programStates)
    .sort((first, second) => first.localeCompare(second))
    .map((programId) => deriveTeamSeasonStats(season, programId))
}
