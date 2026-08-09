import {
  FINAL_RECRUITING_PERIOD,
  getRecruit,
  REGULAR_SEASON_RECRUITING_PERIODS,
  type RecruitingPhase,
  type RecruitingState,
  type RecruitingTargetStatus,
  type RecruitStarRating,
} from '../dynasty'

/**
 * Recruiting-presentation formatting helpers. These format existing
 * Recruiting query output (phase, period, target status, standing) for
 * display — they never derive new Recruiting facts or re-decide legality
 * themselves.
 */

/** "Regular Season" / "Postseason" — a minimal safe label for phases 6B does not yet present. */
export function formatRecruitingPhaseLabel(phase: RecruitingPhase): string {
  switch (phase) {
    case 'regular-season':
      return 'Regular Season'
    case 'postseason':
      return 'Postseason'
    case 'late':
      return 'Late Recruiting'
    case 'finalized':
      return 'Finalized'
    default:
      return phase
  }
}

/** The canonical period denominator for the current phase (24 or the full 28-period clock). */
export function getRecruitingPeriodDenominator(phase: RecruitingPhase): number {
  return phase === 'regular-season'
    ? REGULAR_SEASON_RECRUITING_PERIODS
    : FINAL_RECRUITING_PERIOD
}

/** "Regular Season · Period 8 / 24" / "Postseason · Period 26 / 28". */
export function formatRecruitingPeriodLine(
  phase: RecruitingPhase,
  lastResolvedPeriod: number,
): string {
  const denominator = getRecruitingPeriodDenominator(phase)
  return `${formatRecruitingPhaseLabel(phase).toUpperCase()} · PERIOD ${lastResolvedPeriod} / ${denominator}`
}

/** "#1", "#7" — a 1-based rank, used for both national rank and Program standing. */
export function formatRankLabel(rank: number): string {
  return `#${rank}`
}

interface RecruitStatusLabelOptions {
  readonly status: RecruitingTargetStatus
  readonly isOnBoard: boolean
  readonly hasActiveOffer: boolean
  readonly committedProgramName?: string
}

/**
 * A clean semantic status word for one Recruit relative to the controlled
 * Program — never a raw concatenation of internal flags (e.g. never
 * "BACKUP | committed").
 */
export function formatRecruitStatusLabel({
  status,
  isOnBoard,
  hasActiveOffer,
  committedProgramName,
}: RecruitStatusLabelOptions): string {
  switch (status) {
    case 'committed':
      return 'Committed'
    case 'committed-elsewhere':
      return committedProgramName
        ? `Committed — ${committedProgramName}`
        : 'Committed Elsewhere'
    case 'position-filled':
      return 'Position Filled'
    case 'active':
    default:
      // An active offer already implies board membership, independent of
      // whether the caller cares to distinguish "on board" as its own state.
      if (hasActiveOffer) {
        return 'Offered'
      }
      if (isOnBoard) {
        return 'On Board'
      }
      return 'Active'
  }
}

/** "1 / 1 SG offers currently active" — the concrete reason an Offer is unavailable. */
export function formatOfferCapacityMessage(
  position: string,
  activeOfferCount: number,
  remainingOpenings: number,
): string {
  return `${activeOfferCount} / ${remainingOpenings} ${position} offers currently active`
}

export interface RecentControlledCommitment {
  readonly nationalRank: number
  readonly playerName: string
  readonly position: string
  readonly stars: RecruitStarRating
}

/**
 * The controlled Program's own commitment resolved in the most recently
 * resolved Recruiting period, if any — cheaply derived from canonical
 * commitment timing, never a new persisted event log.
 */
export function deriveRecentControlledCommitment(
  recruiting: RecruitingState,
  controlledProgramId: string,
): RecentControlledCommitment | undefined {
  const commitment = Object.values(recruiting.commitmentsByPlayerId).find(
    (candidate) =>
      candidate.programId === controlledProgramId &&
      candidate.timing.kind === 'period' &&
      candidate.timing.period === recruiting.lastResolvedPeriod &&
      recruiting.lastResolvedPeriod > 0,
  )

  if (!commitment) {
    return undefined
  }

  const recruit = getRecruit(recruiting, commitment.playerId)

  if (!recruit) {
    return undefined
  }

  return {
    nationalRank: recruit.nationalRank,
    playerName: `${recruit.player.firstName} ${recruit.player.lastName}`,
    position: recruit.player.position,
    stars: recruit.stars,
  }
}
