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
  readonly priority: number
}

export interface RecruitingProgramState {
  readonly programId: string
  readonly projectedOpeningsByPosition: PositionCounts
  readonly board: readonly RecruitingBoardTarget[]
}

export interface RecruitingCommitment {
  readonly playerId: string
  readonly programId: string
  readonly period: number
  readonly targetSeasonNumber: number
}

/** Canonical regular-season recruiting facts; current standings are derived. */
export interface RecruitingState {
  readonly id: string
  readonly targetSeasonNumber: number
  readonly lastResolvedPeriod: number
  readonly recruits: readonly Recruit[]
  readonly programs: Record<string, RecruitingProgramState>
  readonly relationshipProgressByPlayerId: Record<
    string,
    Record<string, number>
  >
  readonly commitmentsByPlayerId: Record<string, RecruitingCommitment>
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
  readonly priority: number
  readonly status: RecruitingTargetStatus
  readonly relationshipProgress: number
  readonly standingRank: number
}

export interface ProgramRecruitingBoard {
  readonly programId: string
  readonly projectedOpeningsByPosition: PositionCounts
  readonly remainingOpeningsByPosition: PositionCounts
  readonly targets: readonly ProgramRecruitingBoardEntry[]
}

export interface AddRecruitingBoardTargetOptions {
  readonly dynasty: import('../domain').DynastyState
  readonly playerId: string
  readonly priority: number
}

export interface RemoveRecruitingBoardTargetOptions {
  readonly dynasty: import('../domain').DynastyState
  readonly playerId: string
}

export interface UpdateRecruitingBoardPriorityOptions {
  readonly dynasty: import('../domain').DynastyState
  readonly playerId: string
  readonly priority: number
}
