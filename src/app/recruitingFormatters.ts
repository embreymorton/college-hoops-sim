import { POSITIONS, type Position } from '../engine'
import {
  FINAL_RECRUITING_PERIOD,
  REGULAR_SEASON_RECRUITING_PERIODS,
  type ProgramRecruitingBoard,
  type RecruitingPhase,
  type RecruitingTargetStatus,
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

/**
 * "Preseason" before any Recruiting period has resolved, otherwise
 * "Period N / D". Presentation-only — the underlying period number is
 * unchanged; Period 0 simply reads better as Preseason than "0 / 24".
 */
export function formatRecruitingPeriodLabel(
  phase: RecruitingPhase,
  lastResolvedPeriod: number,
): string {
  if (lastResolvedPeriod === 0) {
    return 'Preseason'
  }
  return `Period ${lastResolvedPeriod} / ${getRecruitingPeriodDenominator(phase)}`
}

/** "Regular Season · Preseason" / "Regular Season · Period 8 / 24" / "Postseason · Period 26 / 28". */
export function formatRecruitingPeriodLine(
  phase: RecruitingPhase,
  lastResolvedPeriod: number,
): string {
  return `${formatRecruitingPhaseLabel(phase).toUpperCase()} · ${formatRecruitingPeriodLabel(phase, lastResolvedPeriod).toUpperCase()}`
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

/** Concise player-facing reason an Offer is unavailable. */
export function formatOfferCapacityMessage(
  board: ProgramRecruitingBoard,
  position: Position,
): string {
  if (board.capacityModel !== 'flexible-v1') {
    return `${board.activeOfferCountsByPosition[position]} / ${board.remainingOpeningsByPosition[position]} ${position} offers currently active`
  }
  const projectedCount = board.projectedCountsByPosition?.[position]
  if (projectedCount !== undefined && projectedCount >= 3) return 'Position is full'

  const activeOfferTotal = POSITIONS.reduce(
    (sum, current) => sum + board.activeOfferCountsByPosition[current],
    0,
  )
  const remainingScholarships = board.remainingScholarships ?? 0
  if (activeOfferTotal >= remainingScholarships) {
    return (board.flexibleOpenings ?? 0) > 0
      ? 'All flexible scholarships are currently reserved'
      : 'All remaining scholarships are currently reserved'
  }
  if ((board.flexibleOpenings ?? 0) <= 0) return 'No flexible scholarships remain'
  return 'Required capacity must remain available'
}

export function formatRecruitCapacityContext(
  board: ProgramRecruitingBoard,
  position: Position,
  hasActiveOffer: boolean,
): string {
  if (board.capacityModel !== 'flexible-v1') {
    return hasActiveOffer
      ? `This offer reserves 1 ${position} opening.`
      : `Projected ${position} opening available`
  }
  const mandatoryNeed = board.mandatoryNeedsByPosition?.[position] ?? 0
  const activeOffersAtPosition = board.activeOfferCountsByPosition[position]
  const usesRequiredCapacity = hasActiveOffer
    ? activeOffersAtPosition <= mandatoryNeed
    : activeOffersAtPosition < mandatoryNeed
  if (usesRequiredCapacity) {
    return hasActiveOffer
      ? `This offer reserves capacity for a required ${position} need.`
      : `Fills required ${position} need`
  }
  if (hasActiveOffer) return 'This offer reserves 1 flexible scholarship.'
  return board.availableOfferSlotsByPosition[position] > 0
    ? 'Flexible scholarship available'
    : 'Would use shared flexible capacity'
}

export interface RecruitingPositionNeed {
  readonly position: Position
  readonly remaining: number
}

/** Serializable roll-up of one Program's `ProgramRecruitingBoard` for compact summaries. */
export interface RecruitingHubTotals {
  readonly projectedTotal: number
  readonly remainingTotal: number
  readonly signedTotal: number
  readonly offersTotal: number
  readonly mandatoryTotal: number
  readonly flexibleTotal: number
  /** Only positions with a remaining opening, in roster-position order. */
  readonly needsByPosition: readonly RecruitingPositionNeed[]
}

/**
 * Aggregates an already-derived `ProgramRecruitingBoard` into the compact
 * facts the Hub summary and Board empty state both need — never a new
 * Recruiting query, just presentation-layer arithmetic over public fields.
 */
export function deriveRecruitingHubTotals(
  board: ProgramRecruitingBoard,
): RecruitingHubTotals {
  const legacyProjectedTotal = POSITIONS.reduce(
    (sum, position) => sum + board.projectedOpeningsByPosition[position],
    0,
  )
  const legacyRemainingTotal = POSITIONS.reduce(
    (sum, position) => sum + board.remainingOpeningsByPosition[position],
    0,
  )
  const signedTotal = board.signedCommitmentCount ?? legacyProjectedTotal - legacyRemainingTotal
  const remainingTotal = board.remainingScholarships ?? legacyRemainingTotal
  const projectedTotal = signedTotal + remainingTotal
  const offersTotal = POSITIONS.reduce(
    (sum, position) => sum + board.activeOfferCountsByPosition[position],
    0,
  )
  const needs = board.mandatoryNeedsByPosition ?? board.remainingOpeningsByPosition
  const needsByPosition = POSITIONS.filter(
    (position) => needs[position] > 0,
  ).map((position) => ({
    position,
    remaining: needs[position],
  }))
  const mandatoryTotal = needsByPosition.reduce((sum, need) => sum + need.remaining, 0)
  const flexibleTotal = board.flexibleOpenings ?? Math.max(0, remainingTotal - mandatoryTotal)

  return {
    projectedTotal,
    remainingTotal,
    signedTotal,
    offersTotal,
    mandatoryTotal,
    flexibleTotal,
    needsByPosition,
  }
}
