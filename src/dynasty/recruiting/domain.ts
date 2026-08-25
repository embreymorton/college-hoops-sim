import type { Player, Position, RngSeed } from '../../engine'
import type { SeasonState } from '../../season'

export type RecruitStarRating = 2 | 3 | 4 | 5
export type PositionCounts = Readonly<Record<Position, number>>
export type RecruitingBoardTargetOrigin = 'manual' | 'assistant'

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
  readonly origin: RecruitingBoardTargetOrigin
  /** One of at most three active targets receiving extra relationship effort. */
  readonly isFocused?: boolean
  /** Canonical Program intent to accept this Recruit into positional capacity. */
  readonly hasActiveOffer: boolean
}

export interface LegacyRecruitingProgramState {
  readonly programId: string
  readonly projectedOpeningsByPosition: PositionCounts
  readonly board: readonly RecruitingBoardTarget[]
}

export interface FlexibleRecruitingProgramState {
  readonly programId: string
  readonly capacityModel: 'flexible-v1'
  readonly projectedReturnerCountsByPosition: PositionCounts
  readonly projectedReturningPlayerCount: number
  /** Derived compatibility view for diagnostics; legality and capacity never read this field. */
  readonly projectedOpeningsByPosition: PositionCounts
  readonly board: readonly RecruitingBoardTarget[]
}

export type RecruitingProgramState = LegacyRecruitingProgramState | FlexibleRecruitingProgramState

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
  readonly capacityModel?: 'exact-v0' | 'flexible-v1'
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
  readonly origin: RecruitingBoardTargetOrigin
  readonly isFocused: boolean
  readonly hasActiveOffer: boolean
  readonly status: RecruitingTargetStatus
  readonly relationshipProgress: number
  readonly standingRank: number
}

export interface ProgramRecruitingBoard {
  readonly programId: string
  readonly capacityModel?: 'exact-v0' | 'flexible-v1'
  /** Compatibility projection only; B2 consumers must not sum these overlapping ceilings. */
  readonly projectedOpeningsByPosition: PositionCounts
  readonly remainingOpeningsByPosition: PositionCounts
  readonly projectedCountsByPosition?: PositionCounts
  readonly mandatoryNeedsByPosition?: PositionCounts
  readonly remainingScholarships?: number
  readonly flexibleOpenings?: number
  readonly signedCommitmentCount?: number
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
