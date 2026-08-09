import type { RngSeed } from '../engine'
import type { UniverseDefinition } from '../universe'

export type ScheduledGameType = 'conference' | 'nonconference'

export interface ScheduleConfiguration {
  readonly conferenceFormat: 'double-round-robin'
  readonly nonConferenceGamesPerProgram: number
  readonly targetHomeGamesPerProgram: number
  readonly targetAwayGamesPerProgram: number
}

/** One unplayed game identified only by stable Program IDs. */
export interface ScheduledGame {
  readonly id: string
  /** Zero-based position in the canonical schedule-wide game list. */
  readonly index: number
  /** One-based abstract season round. */
  readonly round: number
  readonly homeProgramId: string
  readonly awayProgramId: string
  readonly type: ScheduledGameType
}

/** A serializable regular-season structure with no results or progression. */
export interface RegularSeasonSchedule {
  readonly version: string
  readonly universeId: string
  readonly universeVersion: string
  readonly seed: RngSeed
  readonly configuration: ScheduleConfiguration
  readonly roundCount: number
  readonly games: ScheduledGame[]
}

export type ScheduleValidationIssueCode =
  | 'INVALID_UNIVERSE'
  | 'UNSUPPORTED_CONFIGURATION'
  | 'SCHEDULE_UNIVERSE_MISMATCH'
  | 'INVALID_GAME_COUNT'
  | 'INVALID_GAME_ID'
  | 'DUPLICATE_GAME_ID'
  | 'INVALID_GAME_INDEX'
  | 'INVALID_ROUND_COUNT'
  | 'INVALID_ROUND'
  | 'UNKNOWN_PROGRAM'
  | 'SELF_MATCHUP'
  | 'INVALID_GAME_TYPE'
  | 'INVALID_GAME_CLASSIFICATION'
  | 'DUPLICATE_NONCONFERENCE_MATCHUP'
  | 'INVALID_CONFERENCE_PAIRING'
  | 'INVALID_PROGRAM_GAME_COUNT'
  | 'INVALID_PROGRAM_CONFERENCE_COUNT'
  | 'INVALID_PROGRAM_NONCONFERENCE_COUNT'
  | 'INVALID_PROGRAM_HOME_COUNT'
  | 'INVALID_PROGRAM_AWAY_COUNT'
  | 'INVALID_ROUND_PARTICIPATION'

export interface ScheduleValidationIssue {
  readonly code: ScheduleValidationIssueCode
  readonly message: string
  readonly path?: string
  readonly programId?: string
  readonly gameId?: string
  readonly expected?: string | number
  readonly actual?: string | number
}

export interface ScheduleValidationResult {
  readonly valid: boolean
  readonly issues: ScheduleValidationIssue[]
}

export interface GenerateRegularSeasonScheduleOptions {
  readonly universe: UniverseDefinition
  readonly seed: RngSeed
  readonly configuration?: ScheduleConfiguration
  /** Optional lifecycle namespace preventing otherwise-valid cross-season ID reuse. */
  readonly gameIdNamespace?: string
}
