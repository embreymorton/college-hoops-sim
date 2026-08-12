import type { Position } from '../engine'
import {
  deriveRecruitingBattleView,
  deriveRecruitingCommitmentActivity,
  getRecruit,
  type ControlledRecruitingPosition,
  type DynastyState,
  type ProgramRecruitingBoard,
  type RecruitingBattlePosition,
  type RecruitingBattleView,
  type RecruitingCommitmentActivity,
  type RecruitingCommitmentActivityKind,
  type RecruitingReadiness,
  type RecruitStarRating,
} from '../dynasty'
import type { ProgramDefinition } from '../universe'

/**
 * Player-safe Recruiting battle presentation helpers. These only format and
 * regroup the existing `deriveRecruitingBattleView` /
 * `deriveRecruitingCommitmentActivity` selector output for display — they
 * never derive new Recruiting facts, thresholds, or probabilities.
 */

/** Restrained categorical label — never a percentage or progress estimate. */
export function formatReadinessLabel(readiness: RecruitingReadiness): string {
  switch (readiness) {
    case 'early':
      return 'Early Interest'
    case 'developing':
      return 'Developing'
    case 'serious':
      return 'Serious Battle'
    case 'decision-imminent':
      return 'Decision Imminent'
    case 'committed':
      return 'Committed'
    default:
      return readiness
  }
}

/** Competitor-facing label for one pursuing Program's relative standing. */
export function formatBattlePositionLabel(
  position: RecruitingBattlePosition,
): string {
  switch (position) {
    case 'leading':
      return 'Leading'
    case 'competitive':
      return 'Competitive'
    case 'trailing':
      return 'Trailing'
    default:
      return position
  }
}

/** Controlled-Program-facing label, including non-pursuit and commitment outcomes. */
export function formatControlledPositionLabel(
  position: ControlledRecruitingPosition,
): string {
  switch (position) {
    case 'leading':
      return 'We Lead'
    case 'competitive':
      return 'Competitive Battle'
    case 'trailing':
      return 'We Trail'
    case 'not-pursuing':
      return 'Not Pursuing'
    case 'committed-to-us':
      return 'Committed To Us'
    case 'committed-elsewhere':
      return 'Committed Elsewhere'
    default:
      return position
  }
}

export interface RecruitingCompetitorSummary {
  readonly programId: string
  readonly programName: string
  readonly accentColor: string
  readonly pursuitRank: number
  readonly hasActiveOffer: boolean
  readonly position: RecruitingBattlePosition
}

/**
 * The deterministic competitor list minus the controlled Program itself,
 * capped to `limit` so a crowded Board never overwhelms the card. Callers
 * that want an overflow count should compare against the un-capped total via
 * `countCompetitors`.
 */
export function deriveCompetitorSummaries(
  battle: RecruitingBattleView,
  controlledProgramId: string,
  programsById: ReadonlyMap<string, ProgramDefinition>,
  limit = 3,
): RecruitingCompetitorSummary[] {
  return battle.pursuingPrograms
    .filter(({ programId }) => programId !== controlledProgramId)
    .slice(0, limit)
    .map((entry) => {
      const program = programsById.get(entry.programId)
      return {
        programId: entry.programId,
        programName: program?.name ?? entry.programId,
        accentColor: program?.branding.primaryColor ?? '#6b7887',
        pursuitRank: entry.pursuitRank,
        hasActiveOffer: entry.hasActiveOffer,
        position: entry.position,
      }
    })
}

/** Total pursuing Programs other than the controlled Program, for overflow counts. */
export function countCompetitors(
  battle: RecruitingBattleView,
  controlledProgramId: string,
): number {
  return battle.pursuingPrograms.filter(
    ({ programId }) => programId !== controlledProgramId,
  ).length
}

export interface FocusTargetSummary {
  readonly playerId: string
  readonly playerName: string
  readonly position: Position
  readonly stars: RecruitStarRating
  readonly nationalRank: number
  readonly battle: RecruitingBattleView
}

/**
 * Up to the controlled Program's Focused Board targets, identity-joined with
 * the pure battle projection, in stable National Rank order. Never more than
 * `RECRUITING_FOCUS_LIMIT` targets exist canonically, so no separate cap is
 * applied here.
 */
export function deriveFocusTargetSummaries(
  dynasty: DynastyState,
  board: ProgramRecruitingBoard,
): FocusTargetSummary[] {
  const recruiting = dynasty.recruiting
  if (!recruiting) return []

  return board.targets
    .filter((target) => target.isFocused)
    .map((target) => {
      const recruit = getRecruit(recruiting, target.playerId)!
      return {
        playerId: target.playerId,
        playerName: `${recruit.player.firstName} ${recruit.player.lastName}`,
        position: recruit.player.position,
        stars: recruit.stars,
        nationalRank: recruit.nationalRank,
        battle: deriveRecruitingBattleView(dynasty, target.playerId),
      }
    })
    .sort((first, second) => first.nationalRank - second.nationalRank)
}

export interface CommitmentActivityDescription {
  readonly playerId: string
  readonly kind: RecruitingCommitmentActivityKind
  readonly playerName: string
  readonly position: Position
  readonly stars: RecruitStarRating
  readonly nationalRank: number
  readonly programName: string
  readonly wasFocused: boolean
}

/**
 * Joins provable commitment activity (from `deriveRecruitingCommitmentActivity`)
 * with Recruit/Program identity for display. Never fabricates standing
 * movement — only the commitment events the selector already proves.
 */
export function describeRecruitingCommitmentActivity(
  dynasty: DynastyState,
  activity: readonly RecruitingCommitmentActivity[],
  programsById: ReadonlyMap<string, ProgramDefinition>,
): CommitmentActivityDescription[] {
  const recruiting = dynasty.recruiting
  if (!recruiting) return []

  return activity
    .map((entry) => {
      const recruit = getRecruit(recruiting, entry.playerId)
      if (!recruit) return undefined
      return {
        playerId: entry.playerId,
        kind: entry.kind,
        playerName: `${recruit.player.firstName} ${recruit.player.lastName}`,
        position: recruit.player.position,
        stars: recruit.stars,
        nationalRank: recruit.nationalRank,
        programName: programsById.get(entry.programId)?.name ?? entry.programId,
        wasFocused: entry.wasFocused,
      }
    })
    .filter((entry): entry is CommitmentActivityDescription => entry !== undefined)
}

/**
 * Convenience wrapper composing the domain selector with the identity join
 * above, for callers that only have the baseline period on hand.
 */
export function deriveRecruitingActivityDescriptions(
  dynasty: DynastyState,
  sincePeriodExclusive: number,
  programsById: ReadonlyMap<string, ProgramDefinition>,
): CommitmentActivityDescription[] {
  if (!dynasty.recruiting) return []
  const activity = deriveRecruitingCommitmentActivity(dynasty, sincePeriodExclusive)
  return describeRecruitingCommitmentActivity(dynasty, activity, programsById)
}
