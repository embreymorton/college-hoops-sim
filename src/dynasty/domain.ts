import type { Player, Position, RngSeed } from '../engine'
import type { PostseasonState } from '../postseason'
import type { SeasonState } from '../season'
import type { UniverseDefinition } from '../universe'
import type {
  CompletedRecruitingClass,
  RecruitingState,
} from './recruiting/domain'

/** Canonical source facts for one fully completed competitive year. */
export interface CompletedSeasonArchive {
  readonly seasonNumber: number
  readonly season: SeasonState
  readonly postseason: PostseasonState
}

/** Temporary, intentionally incomplete roster state between competitive years. */
export interface OffseasonProgramState {
  readonly programId: string
  readonly prestige: number
  readonly returningPlayers: readonly Player[]
}

export interface OffseasonState {
  readonly completedSeasonNumber: number
  readonly targetSeasonNumber: number
  readonly programs: Record<string, OffseasonProgramState>
}

/** One immutable, roster-only input for the next competitive Season. */
export interface NextSeasonProgramRoster {
  readonly programId: string
  readonly players: readonly Player[]
}

/** Serializable roster assembly output; Team/Rotation/Season construction is separate. */
export interface NextSeasonRosterAssembly {
  readonly targetSeasonNumber: number
  readonly programs: Record<string, NextSeasonProgramRoster>
}

export interface AssembleNextSeasonRostersOptions {
  readonly universe: UniverseDefinition
  readonly offseason: OffseasonState
  readonly completedRecruitingClass: CompletedRecruitingClass
  readonly completedSeasonArchive: CompletedSeasonArchive
}

export type NextSeasonRosterValidationIssueCode =
  | 'INCOMPATIBLE_SEASON'
  | 'INVALID_UNIVERSE_PROGRAMS'
  | 'INVALID_RECRUITING_CLASS'
  | 'INVALID_PROGRAM'
  | 'INVALID_ROSTER_SIZE'
  | 'INVALID_PLAYER'
  | 'DUPLICATE_PLAYER_ID'
  | 'INVALID_IDENTITY_CONTINUITY'
  | 'INVALID_COMMITMENT_ENROLLMENT'
  | 'INVALID_POSITIONAL_COMPOSITION'
  | 'GRADUATE_ENROLLED'

export interface NextSeasonRosterValidationIssue {
  readonly code: NextSeasonRosterValidationIssueCode
  readonly message: string
  readonly programId?: string
  readonly playerId?: string
}

export interface NextSeasonRosterValidationResult {
  readonly valid: boolean
  readonly issues: readonly NextSeasonRosterValidationIssue[]
}

/** Serializable owner of cross-season identity and lifecycle state. */
export interface DynastyState {
  readonly dynastyId: string
  readonly dynastySeed: RngSeed
  readonly controlledProgramId: string
  readonly universe: UniverseDefinition
  readonly activeSeason: SeasonState | null
  readonly activePostseason: PostseasonState | null
  readonly recruiting: RecruitingState | null
  readonly history: readonly CompletedSeasonArchive[]
  readonly completedRecruitingHistory: readonly CompletedRecruitingClass[]
  readonly offseason: OffseasonState | null
}

export interface InitializeDynastyOptions {
  readonly dynastyId: string
  readonly dynastySeed: RngSeed
  readonly controlledProgramId: string
  readonly universe: UniverseDefinition
  readonly activeSeason: SeasonState
  readonly activePostseason?: PostseasonState | null
}

export interface ProjectedRosterOutlook {
  readonly programId: string
  readonly currentRosterSize: number
  readonly projectedDepartingPlayerIds: readonly string[]
  readonly projectedReturningPlayerIds: readonly string[]
  readonly projectedOpenings: number
  readonly projectedOpeningsByPosition: Readonly<Record<Position, number>>
}

export interface OffseasonRosterOutlook {
  readonly programId: string
  readonly returningPlayerIds: readonly string[]
  readonly openRosterSpots: number
}

export interface DevelopReturningPlayerOptions {
  readonly player: Player
  readonly dynastySeed: RngSeed
  readonly completedSeasonNumber: number
  readonly programId: string
}

export interface PlayerDevelopmentSummary {
  readonly programId: string
  readonly playerId: string
  readonly completedClass: 'FR' | 'SO' | 'JR'
  readonly nextClass: 'SO' | 'JR' | 'SR'
  readonly previousOverall: number
  readonly currentOverall: number
  readonly overallChange: number
  /** Potential minus OVR before this offseason's development. */
  readonly potentialHeadroom: number
}

export interface PlayerAttributeDevelopmentGain {
  readonly attribute: keyof Player['attributes']
  readonly change: number
}
