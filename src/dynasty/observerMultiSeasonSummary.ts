import { deriveNationalChampion } from '../postseason'
import { deriveConferenceStandings, deriveProgramRecord } from '../season'
import type { DynastyState } from './domain'
import { deriveCompletedSeasonHonors } from './awards'
import { deriveProgramReputation } from './programReputation'
import { deriveHistoricalTournamentOutcome, type HistoricalTournamentOutcome } from './seasonYearbook'

export interface ObserverMultiSeasonSummaryDescriptor {
  readonly startSeasonNumber: number
  readonly endSeasonNumber: number
  readonly rolloverCount: 1 | 5 | 10
  readonly viewedProgramId: string
}

export interface ObserverMultiSeasonSummaryRow {
  readonly seasonNumber: number
  readonly championProgramId: string
  readonly record: { readonly wins: number; readonly losses: number }
  readonly conferenceFinish: number
  readonly tournamentOutcome: HistoricalTournamentOutcome
  readonly nationalPlayerOfYear: { readonly playerName: string; readonly programId: string } | null
  readonly tournamentMop: { readonly playerName: string; readonly programId: string } | null
}

export interface ObserverMultiSeasonSummary {
  readonly descriptor: ObserverMultiSeasonSummaryDescriptor
  readonly viewedProgramName: string
  readonly rows: readonly ObserverMultiSeasonSummaryRow[]
  readonly bestSeason: ObserverMultiSeasonSummaryRow
  readonly championships: number
  readonly startingReputation: number | null
  readonly endingReputation: number | null
  readonly reputationMovement: number | null
}

export function deriveObserverMultiSeasonSummary(
  dynasty: DynastyState,
  descriptor: ObserverMultiSeasonSummaryDescriptor,
): ObserverMultiSeasonSummary {
  if (descriptor.endSeasonNumber - descriptor.startSeasonNumber + 1 !== descriptor.rolloverCount) {
    throw new RangeError('Multi-Season summary range does not match its rollover count.')
  }
  const viewedProgram = dynasty.universe.programs.find(({ id }) => id === descriptor.viewedProgramId)
  if (!viewedProgram) throw new RangeError('Multi-Season summary references an unknown Viewed Program.')

  const archives = dynasty.history
    .filter(({ seasonNumber }) => seasonNumber >= descriptor.startSeasonNumber && seasonNumber <= descriptor.endSeasonNumber)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
  if (archives.length !== descriptor.rolloverCount) {
    throw new RangeError('Multi-Season summary requires exactly one archive per simulated Season.')
  }

  const rows = archives.map((archive): ObserverMultiSeasonSummaryRow => {
    const championProgramId = deriveNationalChampion(archive.postseason)
    if (!championProgramId) throw new RangeError(`Season ${archive.seasonNumber} has no National Champion.`)
    const conferenceFinish = deriveConferenceStandings(
      dynasty.universe,
      archive.season,
      viewedProgram.conferenceId,
    ).findIndex(({ programId }) => programId === viewedProgram.id) + 1
    if (conferenceFinish === 0) throw new RangeError(`Season ${archive.seasonNumber} is missing the Viewed Program.`)
    const honors = deriveCompletedSeasonHonors(archive, dynasty.universe)
    const resolveAward = (type: 'national-player-of-the-year' | 'tournament-most-outstanding-player') => {
      const honor = honors.find((candidate) => candidate.type === type)
      return honor ? { playerName: `${honor.player.firstName} ${honor.player.lastName}`, programId: honor.program.id } : null
    }
    return {
      seasonNumber: archive.seasonNumber,
      championProgramId,
      record: deriveProgramRecord(archive.season, viewedProgram.id),
      conferenceFinish,
      tournamentOutcome: deriveHistoricalTournamentOutcome(archive, viewedProgram.id),
      nationalPlayerOfYear: resolveAward('national-player-of-the-year'),
      tournamentMop: resolveAward('tournament-most-outstanding-player'),
    }
  })
  const bestSeason = [...rows].sort((a, b) =>
    b.record.wins - a.record.wins || a.record.losses - b.record.losses || b.seasonNumber - a.seasonNumber)[0]!
  const starting = deriveProgramReputation(dynasty, viewedProgram.id, descriptor.startSeasonNumber - 1)
  const ending = deriveProgramReputation(dynasty, viewedProgram.id, descriptor.endSeasonNumber)
  return {
    descriptor,
    viewedProgramName: viewedProgram.name,
    rows,
    bestSeason,
    championships: rows.filter(({ tournamentOutcome }) => tournamentOutcome.status === 'national-champion').length,
    startingReputation: starting.score,
    endingReputation: ending.score,
    reputationMovement: starting.score === null || ending.score === null ? null : ending.score - starting.score,
  }
}
