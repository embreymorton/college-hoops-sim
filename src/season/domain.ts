import type { GameResult, Rotation, Team } from '../engine'
import type { RegularSeasonSchedule, ScheduledGame } from '../schedule'
import type { InitializedUniverse, UniverseDefinition } from '../universe'

export interface SeasonProgramState {
  readonly team: Team
  readonly rotation: Rotation
}

/** Canonical mutable basketball facts for one regular season. */
export interface SeasonState {
  readonly id: string
  readonly seasonNumber: number
  readonly universeId: string
  readonly universeVersion: string
  readonly schedule: RegularSeasonSchedule
  readonly programStates: Record<string, SeasonProgramState>
  readonly resultsByGameId: Record<string, GameResult>
}

export interface InitializeSeasonOptions {
  readonly universe: UniverseDefinition
  readonly initializedUniverse: InitializedUniverse
  readonly schedule: RegularSeasonSchedule
  readonly seasonNumber: number
}

export interface CompletedSeasonGame {
  readonly game: ScheduledGame
  readonly result: GameResult
}

export interface ProgramRecord {
  readonly wins: number
  readonly losses: number
}

export type SeasonValidationIssueCode =
  | 'INVALID_SEASON_ID'
  | 'INVALID_SEASON_NUMBER'
  | 'SEASON_UNIVERSE_MISMATCH'
  | 'INVALID_SCHEDULE'
  | 'MISSING_PROGRAM_STATE'
  | 'UNKNOWN_PROGRAM_STATE'
  | 'TEAM_ID_MISMATCH'
  | 'INVALID_ROTATION'
  | 'UNKNOWN_RESULT_GAME'
  | 'RESULT_PARTICIPANT_MISMATCH'
  | 'INVALID_GAME_RESULT'
  | 'NOT_SERIALIZABLE'

export interface SeasonValidationIssue {
  readonly code: SeasonValidationIssueCode
  readonly message: string
  readonly path?: string
  readonly programId?: string
  readonly scheduledGameId?: string
  readonly expected?: string | number
  readonly actual?: string | number
}

export interface SeasonValidationResult {
  readonly valid: boolean
  readonly issues: SeasonValidationIssue[]
}
