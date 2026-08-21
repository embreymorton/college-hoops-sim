import type { Player, Position, RngSeed } from '../../engine'
import type { SeasonState } from '../../season'

export type RecruitStarRating = 2 | 3 | 4 | 5
export type PositionCounts = Readonly<Record<Position, number>>

/** One future Player plus immutable facts from his national recruiting class. */
export interface Recruit {
  readonly player: Player
  readonly nationalRank: number
  readonly positionRank: number
  readonly stars: RecruitStarRating
  readonly qualityScore: number
  readonly decisionReadyPeriod: number
  readonly commitmentStandingThreshold: number
  readonly commitmentSeparationThreshold: number
}

export interface RecruitingBoardTarget {
  readonly playerId: string
  /** One of at most three active targets receiving extra relationship effort. */
  readonly isFocused?: boolean
  /** Canonical Program intent to accept this Recruit into positional capacity. */
  readonly hasActiveOffer: boolean
}

export interface RecruitingProgramState {
  readonly programId: string
  readonly projectedOpeningsByPosition: PositionCounts
  readonly board: readonly RecruitingBoardTarget[]
  /** Tooling-only coverage fact, present only for the compatible-opening experiment. */
  readonly experimentalReturningPlayersByPosition?: PositionCounts
}

export type CommitmentTiming =
  | { readonly kind: 'period'; readonly period: number }
  | { readonly kind: 'late' }

export interface RecruitingCommitment {
  readonly playerId: string
  readonly programId: string
  readonly timing: CommitmentTiming
  readonly targetSeasonNumber: number
}

export type RecruitingPhase =
  | 'regular-season'
  | 'postseason'
  | 'late'
  | 'finalized'

/** Canonical regular-season recruiting facts; current standings are derived. */
export interface RecruitingState {
  readonly id: string
  readonly targetSeasonNumber: number
  readonly phase: RecruitingPhase
  readonly lastResolvedPeriod: number
  readonly recruits: readonly Recruit[]
  readonly programs: Record<string, RecruitingProgramState>
  readonly relationshipProgressByPlayerId: Record<
    string,
    Record<string, number>
  >
  readonly commitmentsByPlayerId: Record<string, RecruitingCommitment>
  /** Tooling-only candidate; omitted/false preserves exact-position production behavior. */
  readonly experimentalRotationCompatibleOpenings?: boolean
}

/** Immutable Dynasty history for one finalized incoming recruiting class. */
export interface CompletedRecruitingClass {
  readonly targetSeasonNumber: number
  readonly recruitingState: RecruitingState
}

export interface RecruitingFinalizationResult {
  readonly dynasty: import('../domain').DynastyState
  readonly resolutionPasses: number
  readonly fallbackMatcherUsed: boolean
  readonly emergencyGeneratedRecruits: 0
}

export interface GenerateRecruitingClassOptions {
  readonly dynastySeed: RngSeed
  readonly targetSeasonNumber: number
  readonly season: SeasonState
}

export interface RecruitProgramStanding {
  readonly rank: number
  readonly programId: string
  readonly baseAttraction: number
  readonly relationshipProgress: number
  readonly standing: number
}

export type RecruitingTargetStatus =
  | 'active'
  | 'committed'
  | 'committed-elsewhere'
  | 'position-filled'

export interface ProgramRecruitingBoardEntry {
  readonly playerId: string
  readonly isFocused: boolean
  readonly hasActiveOffer: boolean
  readonly status: RecruitingTargetStatus
  readonly relationshipProgress: number
  readonly standingRank: number
}

export interface ProgramRecruitingBoard {
  readonly programId: string
  readonly projectedOpeningsByPosition: PositionCounts
  readonly remainingOpeningsByPosition: PositionCounts
  readonly activeOfferCountsByPosition: PositionCounts
  readonly availableOfferSlotsByPosition: PositionCounts
  readonly targets: readonly ProgramRecruitingBoardEntry[]
}

export interface AddRecruitingBoardTargetOptions {
  readonly dynasty: import('../domain').DynastyState
  readonly playerId: string
}

export interface RemoveRecruitingBoardTargetOptions {
  readonly dynasty: import('../domain').DynastyState
  readonly playerId: string
}

export interface UpdateRecruitingFocusOptions {
  readonly dynasty: import('../domain').DynastyState
  readonly playerId: string
  readonly isFocused: boolean
}

export interface UpdateRecruitingOfferOptions {
  readonly dynasty: import('../domain').DynastyState
  readonly playerId: string
}
