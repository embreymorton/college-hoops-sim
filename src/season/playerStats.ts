import type { PlayerGameStats } from '../engine'
import type { ScheduledGame } from '../schedule'
import type {
  CompletedSeasonGame,
  PlayerGameLogEntry,
  PlayerSeasonStats,
  SeasonProgramState,
  SeasonState,
} from './domain'
import { getCompletedGamesForProgram } from './queries'

const TOTAL_FIELDS = [
  'minutes',
  'points',
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

type TotalField = (typeof TOTAL_FIELDS)[number]
type PlayerTotals = Record<TotalField, number> & { gamesPlayed: number }

interface ProgramGameSide {
  readonly stats: readonly PlayerGameStats[]
  readonly opponentProgramId: string
  readonly location: 'home' | 'away'
  readonly teamScore: number
  readonly opponentScore: number
}

function getProgramState(
  season: SeasonState,
  programId: string,
): SeasonProgramState {
  const programState = season.programStates[programId]

  if (!programState) {
    throw new RangeError(`Unknown Season Program ID "${programId}".`)
  }

  return programState
}

function assertRosterPlayer(
  season: SeasonState,
  programId: string,
  playerId: string,
): void {
  const programState = getProgramState(season, programId)

  if (programState.team.roster.some(({ id }) => id === playerId)) {
    return
  }

  const belongsToAnotherProgram = Object.entries(season.programStates).some(
    ([candidateProgramId, candidateState]) =>
      candidateProgramId !== programId &&
      candidateState.team.roster.some(({ id }) => id === playerId),
  )

  if (belongsToAnotherProgram) {
    throw new RangeError(
      `Player "${playerId}" does not belong to Season Program "${programId}".`,
    )
  }

  throw new RangeError(`Unknown Season Player ID "${playerId}".`)
}

function createEmptyTotals(): PlayerTotals {
  return {
    gamesPlayed: 0,
    minutes: 0,
    points: 0,
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

function finalizePlayerStats(
  programId: string,
  playerId: string,
  totals: PlayerTotals,
): PlayerSeasonStats {
  return {
    programId,
    playerId,
    ...totals,
    minutesPerGame: divideOrZero(totals.minutes, totals.gamesPlayed),
    pointsPerGame: divideOrZero(totals.points, totals.gamesPlayed),
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

function compareCompletedGames(
  first: CompletedSeasonGame,
  second: CompletedSeasonGame,
): number {
  return (
    first.game.round - second.game.round ||
    first.game.index - second.game.index ||
    first.game.id.localeCompare(second.game.id)
  )
}

function getCompletedProgramGames(
  season: SeasonState,
  programId: string,
): CompletedSeasonGame[] {
  getProgramState(season, programId)

  return getCompletedGamesForProgram(season, programId)
    .slice()
    .sort(compareCompletedGames)
}

function getProgramGameSide(
  game: ScheduledGame,
  completed: CompletedSeasonGame['result'],
  programId: string,
): ProgramGameSide {
  if (game.homeProgramId === programId) {
    return {
      stats: completed.homePlayerStats,
      opponentProgramId: game.awayProgramId,
      location: 'home',
      teamScore: completed.homeScore,
      opponentScore: completed.awayScore,
    }
  }

  return {
    stats: completed.awayPlayerStats,
    opponentProgramId: game.homeProgramId,
    location: 'away',
    teamScore: completed.awayScore,
    opponentScore: completed.homeScore,
  }
}

/** Derives one stat row for every Player on a Program's current roster. */
export function deriveProgramPlayerSeasonStats(
  season: SeasonState,
  programId: string,
): PlayerSeasonStats[] {
  const programState = getProgramState(season, programId)
  const totalsByPlayerId = new Map(
    programState.team.roster.map(({ id }) => [id, createEmptyTotals()] as const),
  )

  for (const { game, result } of getCompletedProgramGames(season, programId)) {
    const side = getProgramGameSide(game, result, programId)

    for (const stats of side.stats) {
      const totals = totalsByPlayerId.get(stats.playerId)

      if (!totals) {
        continue
      }

      if (stats.minutes > 0) {
        totals.gamesPlayed += 1
      }

      for (const field of TOTAL_FIELDS) {
        totals[field] += stats[field]
      }
    }
  }

  return programState.team.roster.map(({ id }) =>
    finalizePlayerStats(programId, id, totalsByPlayerId.get(id)!),
  )
}

/** Derives one current-roster Player's totals and rates from completed games. */
export function derivePlayerSeasonStats(
  season: SeasonState,
  programId: string,
  playerId: string,
): PlayerSeasonStats {
  assertRosterPlayer(season, programId, playerId)

  return deriveProgramPlayerSeasonStats(season, programId).find(
    (stats) => stats.playerId === playerId,
  )!
}

/** Derives every current-roster Player exactly once in stable Program-ID order. */
export function deriveSeasonPlayerStats(
  season: SeasonState,
): PlayerSeasonStats[] {
  return Object.keys(season.programStates)
    .sort((first, second) => first.localeCompare(second))
    .flatMap((programId) =>
      deriveProgramPlayerSeasonStats(season, programId),
    )
}

/** Projects one entry per completed Team game, including explicit DNP rows. */
export function getPlayerGameLog(
  season: SeasonState,
  programId: string,
  playerId: string,
): PlayerGameLogEntry[] {
  assertRosterPlayer(season, programId, playerId)

  return getCompletedProgramGames(season, programId).map(({ game, result }) => {
    const side = getProgramGameSide(game, result, programId)
    const storedStats = side.stats.find((stats) => stats.playerId === playerId)

    if (!storedStats) {
      throw new RangeError(
        `Completed GameResult "${game.id}" has no PlayerGameStats for "${playerId}".`,
      )
    }

    return {
      scheduledGameId: game.id,
      round: game.round,
      opponentProgramId: side.opponentProgramId,
      location: side.location,
      teamScore: side.teamScore,
      opponentScore: side.opponentScore,
      result: result.winnerId === programId ? 'W' : 'L',
      didPlay: storedStats.minutes > 0,
      stats: { ...storedStats },
    }
  })
}
