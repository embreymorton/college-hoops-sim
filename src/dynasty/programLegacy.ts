import { TOURNAMENT_ROUNDS } from '../postseason'
import { deriveProgramRecord, type ProgramRecord } from '../season'
import type { DynastyState } from './domain'
import {
  deriveHistoricalTournamentOutcome,
  type HistoricalTournamentOutcome,
} from './seasonYearbook'

export const PROGRAM_LEGACY_RECENT_SEASON_LIMIT = 5

export interface ProgramLegacySeason {
  readonly seasonNumber: number
  readonly record: ProgramRecord
  readonly tournamentOutcome: HistoricalTournamentOutcome
}

export interface ProgramLegacy {
  readonly programId: string
  readonly completedSeasons: number
  readonly wins: number
  readonly losses: number
  readonly tournamentAppearances: number
  readonly championships: number
  readonly runnerUpFinishes: number
  readonly bestTournamentOutcome: HistoricalTournamentOutcome | null
  readonly bestRegularSeason: ProgramLegacySeason | null
  readonly recentSeasons: readonly ProgramLegacySeason[]
}

function tournamentFinishRank(outcome: HistoricalTournamentOutcome): number {
  switch (outcome.status) {
    case 'did-not-qualify':
      return 0
    case 'eliminated':
      return TOURNAMENT_ROUNDS.indexOf(outcome.round) + 1
    case 'runner-up':
      return TOURNAMENT_ROUNDS.length + 1
    case 'national-champion':
      return TOURNAMENT_ROUNDS.length + 2
  }
}

function compareBestRegularSeason(
  first: ProgramLegacySeason,
  second: ProgramLegacySeason,
): number {
  return (
    second.record.wins - first.record.wins ||
    first.record.losses - second.record.losses ||
    second.seasonNumber - first.seasonNumber
  )
}

/** Pure Program résumé derived only from canonical completed Dynasty archives. */
export function deriveProgramLegacy(
  dynasty: Pick<DynastyState, 'history' | 'universe'>,
  programId: string,
): ProgramLegacy {
  if (!dynasty.universe.programs.some(({ id }) => id === programId)) {
    throw new RangeError(`Unknown Program ID "${programId}" for Program Legacy.`)
  }

  const seasons = dynasty.history
    .map((archive): ProgramLegacySeason => {
      if (!archive.season.programStates[programId]) {
        throw new RangeError(
          `Completed Season ${archive.seasonNumber} is missing Program "${programId}".`,
        )
      }
      return {
        seasonNumber: archive.seasonNumber,
        record: deriveProgramRecord(archive.season, programId),
        tournamentOutcome: deriveHistoricalTournamentOutcome(archive, programId),
      }
    })
    .sort((first, second) => second.seasonNumber - first.seasonNumber)

  const tournamentSeasons = seasons.filter(
    ({ tournamentOutcome }) => tournamentOutcome.status !== 'did-not-qualify',
  )
  const bestTournamentOutcome = seasons
    .map(({ tournamentOutcome }) => tournamentOutcome)
    .sort((first, second) => tournamentFinishRank(second) - tournamentFinishRank(first))[0] ?? null

  return {
    programId,
    completedSeasons: seasons.length,
    wins: seasons.reduce((total, { record }) => total + record.wins, 0),
    losses: seasons.reduce((total, { record }) => total + record.losses, 0),
    tournamentAppearances: tournamentSeasons.length,
    championships: tournamentSeasons.filter(
      ({ tournamentOutcome }) => tournamentOutcome.status === 'national-champion',
    ).length,
    runnerUpFinishes: tournamentSeasons.filter(
      ({ tournamentOutcome }) => tournamentOutcome.status === 'runner-up',
    ).length,
    bestTournamentOutcome,
    bestRegularSeason: seasons.slice().sort(compareBestRegularSeason)[0] ?? null,
    recentSeasons: seasons.slice(0, PROGRAM_LEGACY_RECENT_SEASON_LIMIT),
  }
}
