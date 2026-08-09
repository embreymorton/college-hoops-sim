import type {
  GameResult,
  PlayerGameStats,
  RngSeed,
  Rotation,
  Team,
} from '../engine'
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

/** Serializable Player totals and derived rates projected from Season results. */
export interface PlayerSeasonStats {
  readonly programId: string
  readonly playerId: string
  readonly gamesPlayed: number
  readonly minutes: number
  readonly points: number
  readonly rebounds: number
  readonly assists: number
  readonly steals: number
  readonly blocks: number
  readonly turnovers: number
  readonly fieldGoalsMade: number
  readonly fieldGoalsAttempted: number
  readonly threePointersMade: number
  readonly threePointersAttempted: number
  readonly freeThrowsMade: number
  readonly freeThrowsAttempted: number
  readonly minutesPerGame: number
  readonly pointsPerGame: number
  readonly reboundsPerGame: number
  readonly assistsPerGame: number
  readonly stealsPerGame: number
  readonly blocksPerGame: number
  readonly turnoversPerGame: number
  readonly fieldGoalPercentage: number
  readonly threePointPercentage: number
  readonly freeThrowPercentage: number
}

export type PlayerGameLocation = 'home' | 'away'
export type PlayerGameOutcome = 'W' | 'L'

/** One completed scheduled Team game projected for a rostered Player. */
export interface PlayerGameLogEntry {
  readonly scheduledGameId: string
  readonly round: number
  readonly opponentProgramId: string
  readonly location: PlayerGameLocation
  readonly teamScore: number
  readonly opponentScore: number
  readonly result: PlayerGameOutcome
  readonly didPlay: boolean
  readonly stats: PlayerGameStats
}

export interface SimulateScheduledGameOptions {
  readonly season: SeasonState
  readonly scheduledGameId: string
  readonly simulationSeed: RngSeed
}

export interface SimulatePendingGamesInRoundOptions {
  readonly season: SeasonState
  readonly round: number
  readonly simulationSeed: RngSeed
  readonly excludedProgramIds?: readonly string[]
}

export interface SimulatePendingGamesInCurrentRoundOptions {
  readonly season: SeasonState
  readonly simulationSeed: RngSeed
  readonly excludedProgramIds?: readonly string[]
}

/**
 * Bulk-progression checkpoint: simulate every pending ScheduledGame from the
 * current round through (and including) `throughRound`, with no Program
 * exclusions. A pacing convenience over the same per-game pipeline — not a
 * distinct simulation model.
 */
export interface SimulatePendingGamesThroughRoundOptions {
  readonly season: SeasonState
  readonly throughRound: number
  readonly simulationSeed: RngSeed
}

export type NationalLeaderCategory =
  | 'points'
  | 'rebounds'
  | 'assists'
  | 'steals'
  | 'blocks'

/** One qualified Player's rank and per-game rate in a national leader category. */
export interface NationalLeaderEntry {
  readonly rank: number
  readonly programId: string
  readonly playerId: string
  readonly value: number
  readonly gamesPlayed: number
}

export type NationalLeaderboards = Readonly<
  Record<NationalLeaderCategory, readonly NationalLeaderEntry[]>
>

export interface TeamLeaderEntry {
  readonly playerId: string
  readonly value: number
}

/** A Program's top qualified Player in each of points/rebounds/assists per game. */
export interface TeamPlayerLeaders {
  readonly points: TeamLeaderEntry | undefined
  readonly rebounds: TeamLeaderEntry | undefined
  readonly assists: TeamLeaderEntry | undefined
}

/** Serializable derived conference-standing projection; never Season state. */
export interface StandingRow {
  readonly programId: string
  readonly wins: number
  readonly losses: number
  readonly conferenceWins: number
  readonly conferenceLosses: number
  readonly winPercentage: number
  readonly conferenceWinPercentage: number
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
