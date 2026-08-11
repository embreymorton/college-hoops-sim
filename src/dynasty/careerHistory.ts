import { calculateOverall, type ClassYear, type Player } from '../engine'
import { derivePlayerSeasonStats, type PlayerSeasonStats, type SeasonState } from '../season'
import type { DynastyState } from './domain'
import type { RecruitStarRating } from './recruiting/domain'

/** One Season of a Player's career, current or archived, chronologically ordered. */
export interface PlayerCareerSeasonRow {
  readonly seasonNumber: number
  readonly programId: string
  readonly classYear: ClassYear
  readonly overall: number
  readonly potential: number
  /** Overall gained entering this Season; null for the Player's earliest known Season. */
  readonly developmentGain: number | null
  readonly stats: PlayerSeasonStats
  /** True only for the current in-progress Season's row. */
  readonly isActive: boolean
}

/** Canonical recruiting facts for a Player who entered through national Recruiting. */
export interface PlayerRecruitingOrigin {
  readonly targetSeasonNumber: number
  readonly stars: RecruitStarRating
  readonly nationalRank: number
  readonly positionRank: number
  readonly entryOverall: number
  readonly entryPotential: number
  readonly committedProgramId: string | null
}

export interface PlayerCareerHistory {
  readonly playerId: string
  readonly seasons: readonly PlayerCareerSeasonRow[]
  /** Null for original Universe Players with no canonical Recruiting record. */
  readonly recruitingOrigin: PlayerRecruitingOrigin | null
}

interface SeasonRosterMatch {
  readonly programId: string
  readonly player: Player
}

function findPlayerInSeason(
  season: SeasonState,
  playerId: string,
): SeasonRosterMatch | null {
  for (const programId of Object.keys(season.programStates).sort()) {
    const player = season.programStates[programId]!.team.roster.find(
      (candidate) => candidate.id === playerId,
    )
    if (player) {
      return { programId, player }
    }
  }

  return null
}

function buildSeasonRow(
  season: SeasonState,
  match: SeasonRosterMatch,
  isActive: boolean,
): Omit<PlayerCareerSeasonRow, 'developmentGain'> {
  return {
    seasonNumber: season.seasonNumber,
    programId: match.programId,
    classYear: match.player.classYear,
    overall: calculateOverall(match.player),
    potential: match.player.potential,
    stats: derivePlayerSeasonStats(season, match.programId, match.player.id),
    isActive,
  }
}

function findRecruitingOrigin(
  dynasty: DynastyState,
  playerId: string,
): PlayerRecruitingOrigin | null {
  for (const completedClass of dynasty.completedRecruitingHistory) {
    const recruit = completedClass.recruitingState.recruits.find(
      (candidate) => candidate.player.id === playerId,
    )

    if (!recruit) {
      continue
    }

    const commitment =
      completedClass.recruitingState.commitmentsByPlayerId[playerId]

    return {
      targetSeasonNumber: completedClass.targetSeasonNumber,
      stars: recruit.stars,
      nationalRank: recruit.nationalRank,
      positionRank: recruit.positionRank,
      entryOverall: calculateOverall(recruit.player),
      entryPotential: recruit.player.potential,
      committedProgramId: commitment?.programId ?? null,
    }
  }

  return null
}

/**
 * Derives one Player's chronological career — Season, class, OVR, development
 * gain, and canonical production — from archived Dynasty Season snapshots and
 * the active Season, connected purely by stable Player ID. Reuses the
 * existing Player Season Stats projection; it stores no separate history.
 */
export function derivePlayerCareerHistory(
  dynasty: DynastyState,
  playerId: string,
): PlayerCareerHistory {
  const archivedRows = [...dynasty.history]
    .sort((first, second) => first.seasonNumber - second.seasonNumber)
    .flatMap((archive) => {
      const match = findPlayerInSeason(archive.season, playerId)
      return match ? [buildSeasonRow(archive.season, match, false)] : []
    })

  const activeMatch = dynasty.activeSeason
    ? findPlayerInSeason(dynasty.activeSeason, playerId)
    : null
  const activeRow = activeMatch
    ? [buildSeasonRow(dynasty.activeSeason!, activeMatch, true)]
    : []

  const rows = [...archivedRows, ...activeRow].sort(
    (first, second) => first.seasonNumber - second.seasonNumber,
  )

  if (rows.length === 0) {
    throw new RangeError(`Unknown Player ID "${playerId}" for Career History.`)
  }

  const seasons: PlayerCareerSeasonRow[] = rows.map((row, index) => ({
    ...row,
    developmentGain: index === 0 ? null : row.overall - rows[index - 1]!.overall,
  }))

  return {
    playerId,
    seasons,
    recruitingOrigin: findRecruitingOrigin(dynasty, playerId),
  }
}
