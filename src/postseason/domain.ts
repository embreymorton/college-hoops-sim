import type { GameResult, RngSeed, RotationV1, Team } from '../engine'
import type { SeasonState } from '../season'
import type { UniverseDefinition } from '../universe'

export const POSTSEASON_V0_VERSION = 'v0'

/** Universe V0 tournament facts. These are not generic engine assumptions. */
export const POSTSEASON_V0_CONFIGURATION = {
  fieldSize: 16,
  firstFourOutSize: 4,
  totalGames: 15,
} as const

export const TOURNAMENT_ROUNDS = [
  'round-of-16',
  'quarterfinals',
  'semifinals',
  'championship',
] as const

export type TournamentRound = (typeof TOURNAMENT_ROUNDS)[number]
export type TournamentBidType = 'automatic' | 'at-large'

export interface TournamentEntry {
  readonly programId: string
  readonly seed: number
  readonly bidType: TournamentBidType
}

export type TournamentParticipantSource =
  | { readonly type: 'seed'; readonly seed: number }
  | { readonly type: 'winner'; readonly gameId: string }

export interface TournamentGame {
  readonly id: string
  readonly index: number
  readonly round: TournamentRound
  readonly participantSources: readonly [
    TournamentParticipantSource,
    TournamentParticipantSource,
  ]
}

export interface NationalTournamentBracket {
  readonly version: typeof POSTSEASON_V0_VERSION
  readonly games: readonly TournamentGame[]
}

export interface PostseasonProgramState {
  readonly team: Team
  readonly rotation: RotationV1
}

/** Canonical tournament facts. Advancement and champion are projections. */
export interface PostseasonState {
  readonly id: string
  readonly seasonId: string
  readonly universeId: string
  readonly universeVersion: string
  readonly field: readonly TournamentEntry[]
  readonly bracket: NationalTournamentBracket
  readonly programStates: Record<string, PostseasonProgramState>
  readonly resultsByGameId: Record<string, GameResult>
}

export interface TournamentSelectionResult {
  readonly field: readonly TournamentEntry[]
  readonly firstFourOutProgramIds: readonly string[]
}

export interface InitializePostseasonOptions {
  readonly universe: UniverseDefinition
  readonly season: SeasonState
}

export interface ResolvedTournamentParticipants {
  readonly homeProgramId: string
  readonly awayProgramId: string
}

export interface CompletedTournamentGame {
  readonly game: TournamentGame
  readonly result: GameResult
}

export interface SimulateTournamentGameOptions {
  readonly postseason: PostseasonState
  readonly tournamentGameId: string
  readonly simulationSeed: RngSeed
}

export interface SimulatePendingTournamentRoundOptions {
  readonly postseason: PostseasonState
  readonly round: TournamentRound
  readonly simulationSeed: RngSeed
  readonly excludedProgramIds?: readonly string[]
}

export interface SimulatePendingCurrentTournamentRoundOptions {
  readonly postseason: PostseasonState
  readonly simulationSeed: RngSeed
  readonly excludedProgramIds?: readonly string[]
}

export type PostseasonValidationIssueCode =
  | 'INCOMPLETE_REGULAR_SEASON'
  | 'POSTSEASON_UNIVERSE_MISMATCH'
  | 'INVALID_FIELD_SIZE'
  | 'UNKNOWN_FIELD_PROGRAM'
  | 'DUPLICATE_FIELD_PROGRAM'
  | 'INVALID_SEED'
  | 'DUPLICATE_SEED'
  | 'INVALID_BID_TYPE'
  | 'INVALID_AUTOMATIC_BID'
  | 'INVALID_AT_LARGE_BID'
  | 'INVALID_BRACKET'
  | 'DUPLICATE_GAME_ID'
  | 'INVALID_PROGRAM_STATE'
  | 'TEAM_ID_MISMATCH'
  | 'INVALID_ROTATION'
  | 'UNKNOWN_RESULT_GAME'
  | 'UNRESOLVED_RESULT_PARTICIPANTS'
  | 'RESULT_PARTICIPANT_MISMATCH'
  | 'INVALID_GAME_RESULT'
  | 'NOT_SERIALIZABLE'

export interface PostseasonValidationIssue {
  readonly code: PostseasonValidationIssueCode
  readonly message: string
  readonly path?: string
  readonly programId?: string
  readonly tournamentGameId?: string
  readonly expected?: string | number
  readonly actual?: string | number
}

export interface PostseasonValidationResult {
  readonly valid: boolean
  readonly issues: PostseasonValidationIssue[]
}
