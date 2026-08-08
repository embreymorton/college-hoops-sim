import type { UniverseDefinition } from '../universe'
import type { SeasonState, StandingRow } from './domain'
import {
  deriveConferenceRecord,
  deriveProgramRecord,
  getCompletedGamesForProgram,
} from './queries'

function percentage(wins: number, losses: number): number {
  const games = wins + losses
  return games === 0 ? 0 : wins / games
}

function compareRatioDescending(
  firstWins: number,
  firstLosses: number,
  secondWins: number,
  secondLosses: number,
): number {
  const firstGames = firstWins + firstLosses
  const secondGames = secondWins + secondLosses
  const firstDenominator = firstGames === 0 ? 1 : firstGames
  const secondDenominator = secondGames === 0 ? 1 : secondGames

  return (
    secondWins * firstDenominator -
    firstWins * secondDenominator
  )
}

function compareConferencePercentage(
  first: StandingRow,
  second: StandingRow,
): number {
  return compareRatioDescending(
    first.conferenceWins,
    first.conferenceLosses,
    second.conferenceWins,
    second.conferenceLosses,
  )
}

function compareOverallPercentage(
  first: StandingRow,
  second: StandingRow,
): number {
  return compareRatioDescending(
    first.wins,
    first.losses,
    second.wins,
    second.losses,
  )
}

function compareProgramId(first: StandingRow, second: StandingRow): number {
  if (first.programId < second.programId) {
    return -1
  }

  return first.programId > second.programId ? 1 : 0
}

function compareHeadToHead(
  season: SeasonState,
  first: StandingRow,
  second: StandingRow,
): number {
  const games = getCompletedGamesForProgram(season, first.programId).filter(
    ({ game }) =>
      game.homeProgramId === second.programId ||
      game.awayProgramId === second.programId,
  )
  const firstWins = games.filter(
    ({ result }) => result.winnerId === first.programId,
  ).length
  const secondWins = games.length - firstWins

  return secondWins - firstWins
}

function compareWithoutHeadToHead(
  first: StandingRow,
  second: StandingRow,
): number {
  return compareOverallPercentage(first, second) || compareProgramId(first, second)
}

function orderConferencePercentageGroup(
  season: SeasonState,
  group: StandingRow[],
): StandingRow[] {
  if (group.length !== 2) {
    return group.sort(compareWithoutHeadToHead)
  }

  const [first, second] = group as [StandingRow, StandingRow]
  const headToHead = compareHeadToHead(season, first, second)

  return headToHead === 0
    ? group.sort(compareWithoutHeadToHead)
    : headToHead < 0
      ? [first, second]
      : [second, first]
}

/** Derives one Conference table without adding standings to Season facts. */
export function deriveConferenceStandings(
  universe: UniverseDefinition,
  season: SeasonState,
  conferenceId: string,
): StandingRow[] {
  if (
    season.universeId !== universe.id ||
    season.universeVersion !== universe.version
  ) {
    throw new RangeError(
      'Season Universe identity/version does not match the supplied Universe.',
    )
  }

  if (!universe.conferences.some(({ id }) => id === conferenceId)) {
    throw new RangeError(`Unknown Conference ID "${conferenceId}".`)
  }

  const rows = universe.programs
    .filter((program) => program.conferenceId === conferenceId)
    .map(({ id: programId }): StandingRow => {
      const overall = deriveProgramRecord(season, programId)
      const conference = deriveConferenceRecord(season, programId)

      return {
        programId,
        wins: overall.wins,
        losses: overall.losses,
        conferenceWins: conference.wins,
        conferenceLosses: conference.losses,
        winPercentage: percentage(overall.wins, overall.losses),
        conferenceWinPercentage: percentage(
          conference.wins,
          conference.losses,
        ),
      }
    })
    .sort(compareConferencePercentage)
  const ordered: StandingRow[] = []

  for (let start = 0; start < rows.length; ) {
    let end = start + 1

    while (
      end < rows.length &&
      compareConferencePercentage(rows[start]!, rows[end]!) === 0
    ) {
      end += 1
    }

    ordered.push(
      ...orderConferencePercentageGroup(season, rows.slice(start, end)),
    )
    start = end
  }

  return ordered
}
