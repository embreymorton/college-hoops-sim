import { calculateOverall, POSITIONS, type Player, type Position } from '../engine'
import {
  deriveAttributeDevelopmentGains,
  deriveDevelopmentSummary,
  derivePlayerCareerHistory,
  derivePlayerCareerSummary,
  deriveProgramCommitments,
  getRecruit,
  type CompletedSeasonArchive,
  type DynastyState,
  type OffseasonProgramState,
  type PlayerDevelopmentSummary,
  type PlayerAttributeDevelopmentGain,
  type ProgramPrestigeReason,
  type Recruit,
  type RecruitingState,
} from '../dynasty'

const PRESTIGE_REASON_COPY: Readonly<Record<ProgramPrestigeReason, string>> = {
  'national-contender': 'Reputation improved after a national contender season.',
  'tournament-run': 'Reputation improved after a strong Tournament run.',
  'strong-season': 'Reputation improved after a strong season.',
  'met-expectations': 'Reputation held steady after meeting expectations.',
  'disappointing-season': 'Reputation declined after a disappointing season.',
  'major-decline': 'Reputation declined after a major down year.',
}

export function formatPrestigeReason(reason: ProgramPrestigeReason): string {
  return PRESTIGE_REASON_COPY[reason]
}

export function formatSignedPrestigeChange(change: number): string {
  return change > 0 ? `+${change}` : String(change)
}

/**
 * Offseason-presentation formatting helpers. These read canonical
 * `CompletedSeasonArchive` / `OffseasonState` / `CompletedRecruitingClass`
 * facts and format them for the turnover report — they never derive new
 * Development, roster-assembly, or Recruiting facts themselves.
 */

function latestArchivedRoster(
  archive: CompletedSeasonArchive,
  programId: string,
): readonly Player[] {
  return (
    archive.postseason.programStates[programId]?.team.roster ??
    archive.season.programStates[programId]?.team.roster ??
    []
  )
}

function comparePositionThenName(first: Player, second: Player): number {
  return (
    POSITIONS.indexOf(first.position) - POSITIONS.indexOf(second.position) ||
    first.lastName.localeCompare(second.lastName)
  )
}

/** Graduating Seniors from the archived roster for one Program. */
export interface DepartureRow {
  readonly player: Player
  readonly seniorCareer: {
    readonly seasonsPlayed: number
    readonly pointsPerGame: number
    readonly reboundsPerGame: number
    readonly assistsPerGame: number
    readonly peakOverall: number
  } | null
}

export function deriveDepartures(
  dynasty: DynastyState,
  archive: CompletedSeasonArchive,
  programId: string,
): readonly DepartureRow[] {
  return latestArchivedRoster(archive, programId)
    .filter(({ classYear }) => classYear === 'SR')
    .slice()
    .sort(comparePositionThenName)
    .map((player) => {
      const history = derivePlayerCareerHistory(dynasty, player.id)
      const summary = derivePlayerCareerSummary(history)
      return {
        player,
        seniorCareer: {
          seasonsPlayed: history.seasons.length,
          pointsPerGame: summary.pointsPerGame,
          reboundsPerGame: summary.reboundsPerGame,
          assistsPerGame: summary.assistsPerGame,
          peakOverall: summary.peakOverall,
        },
      }
    })
}

export interface DevelopmentRow {
  readonly player: Player
  readonly summary: PlayerDevelopmentSummary
  readonly gains: readonly PlayerAttributeDevelopmentGain[]
}

export function deriveVisibleDevelopmentGains(
  before: Player,
  after: Player,
): readonly PlayerAttributeDevelopmentGain[] {
  return deriveAttributeDevelopmentGains(before, after).slice(0, 3)
}

/** Before/after development for every returning (non-graduated) Player. */
export function deriveDevelopmentRows(
  archive: CompletedSeasonArchive,
  programId: string,
  offseasonProgram: OffseasonProgramState,
): readonly DevelopmentRow[] {
  const archivedById = new Map(
    latestArchivedRoster(archive, programId).map((player) => [player.id, player]),
  )
  return offseasonProgram.returningPlayers
    .map((after): DevelopmentRow | undefined => {
      const before = archivedById.get(after.id)
      if (!before) return undefined
      return {
        player: after,
        summary: deriveDevelopmentSummary(programId, before, after),
        gains: deriveVisibleDevelopmentGains(before, after),
      }
    })
    .filter((row): row is DevelopmentRow => row !== undefined)
    .sort((first, second) =>
      second.summary.overallChange - first.summary.overallChange ||
      comparePositionThenName(first.player, second.player),
    )
}

/** Highest positive OVR gain; row ordering supplies the stable tiebreak. */
export function deriveBiggestLeap(
  rows: readonly DevelopmentRow[],
): DevelopmentRow | null {
  return rows
    .filter(({ summary }) => summary.overallChange > 0)
    .slice()
    .sort((first, second) =>
      second.summary.overallChange - first.summary.overallChange ||
      comparePositionThenName(first.player, second.player),
    )[0] ?? null
}

const ATTRIBUTE_LABELS: Readonly<Record<PlayerAttributeDevelopmentGain['attribute'], string>> = {
  finishing: 'Finishing',
  shooting: 'Shooting',
  playmaking: 'Playmaking',
  ballHandling: 'Ball Handling',
  perimeterDefense: 'Perimeter Def',
  interiorDefense: 'Interior Def',
  rebounding: 'Rebounding',
  athleticism: 'Athleticism',
  stamina: 'Stamina',
}

export function formatDevelopmentGains(
  gains: readonly PlayerAttributeDevelopmentGain[],
): string {
  return gains.map(({ attribute, change }) => `${ATTRIBUTE_LABELS[attribute]} +${change}`).join(' · ')
}

export function formatSeniorCareerContext(
  career: NonNullable<DepartureRow['seniorCareer']>,
  programName: string,
): string {
  const seasons = `${career.seasonsPlayed} ${career.seasonsPlayed === 1 ? 'season' : 'seasons'}`
  return `${seasons} with ${programName} · ${career.pointsPerGame.toFixed(1)} PPG · ${career.reboundsPerGame.toFixed(1)} RPG · ${career.assistsPerGame.toFixed(1)} APG · Peak ${career.peakOverall} OVR`
}

export type CommitTiming = 'regular' | 'postseason' | 'late'

export function deriveCommitTiming(
  timing: import('../dynasty').CommitmentTiming,
): CommitTiming {
  if (timing.kind === 'late') return 'late'
  return timing.period <= 24 ? 'regular' : 'postseason'
}

export function formatCommitTimingLabel(timing: CommitTiming): string {
  switch (timing) {
    case 'regular':
      return 'Regular'
    case 'postseason':
      return 'Postseason'
    case 'late':
      return 'Late'
    default:
      return timing
  }
}

export interface IncomingRecruitRow {
  readonly recruit: Recruit
  readonly timing: CommitTiming
}

/** The finalized incoming class for one Program, in national-rank order. */
export function deriveIncomingClass(
  recruiting: RecruitingState,
  programId: string,
): readonly IncomingRecruitRow[] {
  return deriveProgramCommitments(recruiting, programId)
    .map((commitment) => {
      const recruit = getRecruit(recruiting, commitment.playerId)
      if (!recruit) return undefined
      return { recruit, timing: deriveCommitTiming(commitment.timing) }
    })
    .filter((row): row is IncomingRecruitRow => row !== undefined)
    .sort((first, second) => first.recruit.nationalRank - second.recruit.nationalRank)
}

export interface PositionCounts {
  readonly position: Position
  readonly count: number
}

export function derivePositionCounts(
  players: readonly { readonly position: Position }[],
): readonly PositionCounts[] {
  return POSITIONS.map((position) => ({
    position,
    count: players.filter((player) => player.position === position).length,
  }))
}

export interface ClassAverages {
  readonly signeeCount: number
  readonly averageOverall: number
  readonly averagePotential: number
}

/** Mean OVR/POT across a finalized class's signees — presentation arithmetic only. */
export function deriveClassAverages(
  recruits: readonly Recruit[],
): ClassAverages {
  if (recruits.length === 0) {
    return { signeeCount: 0, averageOverall: 0, averagePotential: 0 }
  }
  const totalOverall = recruits.reduce(
    (sum, recruit) => sum + calculateOverall(recruit.player),
    0,
  )
  const totalPotential = recruits.reduce(
    (sum, recruit) => sum + recruit.player.potential,
    0,
  )
  return {
    signeeCount: recruits.length,
    averageOverall: totalOverall / recruits.length,
    averagePotential: totalPotential / recruits.length,
  }
}

export function formatAverage(value: number): string {
  return value.toFixed(1)
}

/** Mean derived OVR across an assembled roster — presentation arithmetic only. */
export function deriveRosterAverageOverall(players: readonly Player[]): number {
  if (players.length === 0) return 0
  return players.reduce((sum, player) => sum + calculateOverall(player), 0) / players.length
}
