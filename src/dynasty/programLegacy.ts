import { calculateOverall, calculateTeamStrength } from '../engine'
import { TOURNAMENT_ROUNDS } from '../postseason'
import {
  deriveConferenceStandings,
  deriveProgramRecord,
  type ProgramRecord,
} from '../season'
import type { DynastyState } from './domain'
import { deriveProgramCommitments, getRecruit } from './recruiting/queries'
import {
  deriveHistoricalTournamentOutcome,
  type HistoricalTournamentOutcome,
} from './seasonYearbook'

export interface ProgramTrajectorySeason {
  readonly seasonNumber: number
  readonly teamOverall: number
  readonly record: ProgramRecord
  readonly conferencePlace: number
  readonly tournamentOutcome: HistoricalTournamentOutcome
  readonly incomingClass: {
    readonly signeeCount: number
    readonly averageOverall: number | null
  } | null
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
  readonly bestRegularSeason: ProgramTrajectorySeason | null
  readonly trajectorySeasons: readonly ProgramTrajectorySeason[]
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
  first: ProgramTrajectorySeason,
  second: ProgramTrajectorySeason,
): number {
  return (
    second.record.wins - first.record.wins ||
    first.record.losses - second.record.losses ||
    second.seasonNumber - first.seasonNumber
  )
}

/** Pure Program résumé derived only from canonical completed Dynasty archives. */
export function deriveProgramLegacy(
  dynasty: Pick<DynastyState, 'history' | 'universe' | 'completedRecruitingHistory'>,
  programId: string,
): ProgramLegacy {
  if (!dynasty.universe.programs.some(({ id }) => id === programId)) {
    throw new RangeError(`Unknown Program ID "${programId}" for Program Legacy.`)
  }

  const program = dynasty.universe.programs.find(({ id }) => id === programId)!
  const recruitingClassesBySeason = new Map<number, DynastyState['completedRecruitingHistory'][number]>()
  for (const completedClass of dynasty.completedRecruitingHistory) {
    if (recruitingClassesBySeason.has(completedClass.targetSeasonNumber)) {
      throw new RangeError(
        `Multiple finalized Recruiting classes target Season ${completedClass.targetSeasonNumber}.`,
      )
    }
    recruitingClassesBySeason.set(completedClass.targetSeasonNumber, completedClass)
  }

  const seasons = dynasty.history
    .map((archive): ProgramTrajectorySeason => {
      const programState = archive.season.programStates[programId]
      if (!programState) {
        throw new RangeError(
          `Completed Season ${archive.seasonNumber} is missing Program "${programId}".`,
        )
      }
      const conferencePlace = deriveConferenceStandings(
        dynasty.universe,
        archive.season,
        program.conferenceId,
      ).findIndex(({ programId: standingProgramId }) => standingProgramId === programId) + 1
      if (conferencePlace === 0) {
        throw new RangeError(
          `Completed Season ${archive.seasonNumber} Conference standings are missing Program "${programId}".`,
        )
      }
      const completedClass = recruitingClassesBySeason.get(archive.seasonNumber)
      const incomingRecruits = completedClass
        ? deriveProgramCommitments(completedClass.recruitingState, programId).map(({ playerId }) => {
            const recruit = getRecruit(completedClass.recruitingState, playerId)
            if (!recruit) {
              throw new RangeError(
                `Finalized Recruiting class for Season ${archive.seasonNumber} is missing committed Recruit "${playerId}".`,
              )
            }
            return recruit
          })
        : null
      return {
        seasonNumber: archive.seasonNumber,
        teamOverall: calculateTeamStrength(programState.team, programState.rotation).overall,
        record: deriveProgramRecord(archive.season, programId),
        conferencePlace,
        tournamentOutcome: deriveHistoricalTournamentOutcome(archive, programId),
        incomingClass: incomingRecruits === null
          ? null
          : {
              signeeCount: incomingRecruits.length,
              averageOverall: incomingRecruits.length === 0
                ? null
                : incomingRecruits.reduce(
                    (total, recruit) => total + calculateOverall(recruit.player),
                    0,
                  ) / incomingRecruits.length,
            },
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
    trajectorySeasons: seasons,
  }
}
