import { getGamesForProgram } from '../schedule'
import type {
  CompletedSeasonGame,
  ProgramRecord,
  SeasonState,
} from './domain'
import type { ScheduledGame } from '../schedule'

export function getGamesForRound(
  season: SeasonState,
  round: number,
): ScheduledGame[] {
  return season.schedule.games.filter((game) => game.round === round)
}

export function getCompletedGamesForRound(
  season: SeasonState,
  round: number,
): CompletedSeasonGame[] {
  return getGamesForRound(season, round).flatMap((game) => {
    const result = season.resultsByGameId[game.id]
    return result ? [{ game, result }] : []
  })
}

export function getPendingGamesForRound(
  season: SeasonState,
  round: number,
): ScheduledGame[] {
  return getGamesForRound(season, round).filter(
    ({ id }) => season.resultsByGameId[id] === undefined,
  )
}

export function isRoundComplete(
  season: SeasonState,
  round: number,
): boolean {
  const games = getGamesForRound(season, round)
  return (
    games.length > 0 &&
    games.every(({ id }) => season.resultsByGameId[id] !== undefined)
  )
}

/** Lowest round containing an unplayed game, or undefined after completion. */
export function getCurrentRound(season: SeasonState): number | undefined {
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    if (getPendingGamesForRound(season, round).length > 0) {
      return round
    }
  }

  return undefined
}

export function isRegularSeasonComplete(season: SeasonState): boolean {
  return season.schedule.games.every(
    ({ id }) => season.resultsByGameId[id] !== undefined,
  )
}

export function getScheduleForProgram(
  season: SeasonState,
  programId: string,
): ScheduledGame[] {
  return getGamesForProgram(season.schedule, programId)
}

export function getCompletedGamesForProgram(
  season: SeasonState,
  programId: string,
): CompletedSeasonGame[] {
  return getScheduleForProgram(season, programId).flatMap((game) => {
    const result = season.resultsByGameId[game.id]
    return result ? [{ game, result }] : []
  })
}

export function getPendingGamesForProgram(
  season: SeasonState,
  programId: string,
): ScheduledGame[] {
  return getScheduleForProgram(season, programId).filter(
    ({ id }) => season.resultsByGameId[id] === undefined,
  )
}

export function getNextGameForProgram(
  season: SeasonState,
  programId: string,
): ScheduledGame | undefined {
  return getPendingGamesForProgram(season, programId).sort(
    (first, second) => first.round - second.round || first.index - second.index,
  )[0]
}

function deriveRecordFromGames(
  games: readonly CompletedSeasonGame[],
  programId: string,
): ProgramRecord {
  const wins = games.filter(({ result }) => result.winnerId === programId).length

  return { wins, losses: games.length - wins }
}

export function deriveProgramRecord(
  season: SeasonState,
  programId: string,
): ProgramRecord {
  return deriveRecordFromGames(
    getCompletedGamesForProgram(season, programId),
    programId,
  )
}

export function deriveConferenceRecord(
  season: SeasonState,
  programId: string,
): ProgramRecord {
  return deriveRecordFromGames(
    getCompletedGamesForProgram(season, programId).filter(
      ({ game }) => game.type === 'conference',
    ),
    programId,
  )
}
