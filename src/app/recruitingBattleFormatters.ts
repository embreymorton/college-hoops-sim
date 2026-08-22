import { calculateOverall, type Position } from '../engine'
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
  type RecruitingTargetStatus,
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
    case 'not-deciding':
      return 'Not Yet Deciding'
    case 'decision-soon':
      return 'Decision Soon'
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

/**
 * Compact controlled-Program label for a Battles row: identity, its existing
 * `pursuitRank` among the Recruit's current `pursuingPrograms` (never
 * recomputed), then Focused/Offered when applicable. Omits the rank entirely
 * when the controlled Program is not currently pursuing this Recruit.
 */
export function formatControlledPursuitLabel(
  battle: RecruitingBattleView,
  controlledProgramId: string,
  isFocused: boolean,
  hasActiveOffer: boolean,
): string {
  const controlledEntry = battle.pursuingPrograms.find(
    (entry) => entry.programId === controlledProgramId,
  )
  const rankLabel = controlledEntry
    ? `#${controlledEntry.pursuitRank} of ${battle.pursuingPrograms.length}`
    : undefined

  return ['YOU', rankLabel, isFocused && 'Focused', hasActiveOffer && 'Offered']
    .filter((tag): tag is string => Boolean(tag))
    .join(' · ')
}

export interface BattleGroupRow {
  readonly programId: string
  readonly programName: string
  readonly accentColor: string
  readonly hasActiveOffer: boolean
  readonly isControlled: boolean
}

export interface BattleGroup {
  readonly position: RecruitingBattlePosition
  readonly rows: readonly BattleGroupRow[]
}

const BATTLE_POSITION_ORDER: readonly RecruitingBattlePosition[] = [
  'leading',
  'competitive',
  'trailing',
]

/**
 * Every pursuing Program — including the controlled Program itself —
 * grouped by its actual categorical standing (`leading` / `competitive` /
 * `trailing`), in the domain's existing deterministic order. The controlled
 * Program is never pinned to a fixed row: it appears inside whichever group
 * its own standing places it in, marked `isControlled`, and is exempt from
 * the competitor cap so it can never be pushed into the overflow count.
 * Groups with no rows are omitted entirely.
 */
export function deriveBattleGroups(
  battle: RecruitingBattleView,
  controlledProgram: ProgramDefinition,
  programsById: ReadonlyMap<string, ProgramDefinition>,
  competitorLimit = 3,
): { readonly groups: readonly BattleGroup[]; readonly overflowCount: number } {
  const rowsByPosition = new Map<RecruitingBattlePosition, BattleGroupRow[]>()
  let shownCompetitors = 0
  let overflowCount = 0

  for (const entry of battle.pursuingPrograms) {
    const isControlled = entry.programId === controlledProgram.id
    if (!isControlled) {
      if (shownCompetitors >= competitorLimit) {
        overflowCount += 1
        continue
      }
      shownCompetitors += 1
    }

    const program = isControlled ? controlledProgram : programsById.get(entry.programId)
    const rows = rowsByPosition.get(entry.position) ?? []
    rows.push({
      programId: entry.programId,
      programName: program?.name ?? entry.programId,
      accentColor: program?.branding.primaryColor ?? '#6b7887',
      hasActiveOffer: entry.hasActiveOffer,
      isControlled,
    })
    rowsByPosition.set(entry.position, rows)
  }

  const groups = BATTLE_POSITION_ORDER.map((position) => ({
    position,
    rows: rowsByPosition.get(position) ?? [],
  })).filter((group) => group.rows.length > 0)

  return { groups, overflowCount }
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
 * applied here. Only `active` targets qualify — once a Recruit resolves
 * (committed to us, committed elsewhere, or position-filled) he is no longer
 * an unresolved Focus target; a controlled-Program commitment instead
 * surfaces through `deriveHubCommitSummaries`.
 */
export function deriveFocusTargetSummaries(
  dynasty: DynastyState,
  board: ProgramRecruitingBoard,
): FocusTargetSummary[] {
  const recruiting = dynasty.recruiting
  if (!recruiting) return []

  return board.targets
    .filter((target) => target.isFocused && target.status === 'active')
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

export interface RecruitingHubCommitSummary {
  readonly playerId: string
  readonly playerName: string
  readonly position: Position
  readonly stars: RecruitStarRating
  readonly nationalRank: number
}

/**
 * Every Board target already committed to the controlled Program, identity-
 * joined for display, in stable National Rank order. The Hub's stable
 * status home for signed Recruits — distinct from the still-unresolved
 * Focus Targets above.
 */
export function deriveHubCommitSummaries(
  dynasty: DynastyState,
  board: ProgramRecruitingBoard,
): RecruitingHubCommitSummary[] {
  const recruiting = dynasty.recruiting
  if (!recruiting) return []

  return board.targets
    .filter((target) => target.status === 'committed')
    .map((target) => {
      const recruit = getRecruit(recruiting, target.playerId)!
      return {
        playerId: target.playerId,
        playerName: `${recruit.player.firstName} ${recruit.player.lastName}`,
        position: recruit.player.position,
        stars: recruit.stars,
        nationalRank: recruit.nationalRank,
      }
    })
    .sort((first, second) => first.nationalRank - second.nationalRank)
}

export interface BattleCardSummary {
  readonly playerId: string
  readonly playerName: string
  readonly position: Position
  readonly stars: RecruitStarRating
  readonly nationalRank: number
  readonly ovr: number
  readonly pot: number
  readonly isFocused: boolean
  readonly hasActiveOffer: boolean
  readonly status: RecruitingTargetStatus
  readonly battle: RecruitingBattleView
}

/**
 * One card per Board Recruit, identity-joined with the pure battle
 * projection, in stable National Rank order — the Battles tab's only data
 * source. Never recomputes readiness/standing itself.
 */
export function deriveBattleCardSummaries(
  dynasty: DynastyState,
  board: ProgramRecruitingBoard,
): BattleCardSummary[] {
  const recruiting = dynasty.recruiting
  if (!recruiting) return []

  return board.targets
    .map((target) => {
      const recruit = getRecruit(recruiting, target.playerId)!
      return {
        playerId: target.playerId,
        playerName: `${recruit.player.firstName} ${recruit.player.lastName}`,
        position: recruit.player.position,
        stars: recruit.stars,
        nationalRank: recruit.nationalRank,
        ovr: calculateOverall(recruit.player),
        pot: recruit.player.potential,
        isFocused: target.isFocused,
        hasActiveOffer: target.hasActiveOffer,
        status: target.status,
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
