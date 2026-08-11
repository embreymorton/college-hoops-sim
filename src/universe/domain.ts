import type { RotationV1, Team } from '../engine'

export interface UniverseConfiguration {
  readonly programCount: number
  readonly conferenceCount: number
  readonly programsPerConference: number
}

export interface ConferenceDefinition {
  readonly id: string
  readonly name: string
  readonly identity: string
}

export interface ProgramLocation {
  readonly city: string
  readonly stateCode: string
}

export interface ProgramBranding {
  readonly primaryColor: string
  readonly secondaryColor: string
}

export interface ProgramDefinition {
  /** Permanent program identity across Teams, results, and future seasons. */
  readonly id: string
  readonly name: string
  readonly abbreviation: string
  readonly conferenceId: string
  readonly location: ProgramLocation
  /** Immutable starting prestige copied into current Team state at initialization. */
  readonly basePrestige: number
  readonly branding: ProgramBranding
  readonly identity: string
}

/** A versioned, serializable description of one playable basketball world. */
export interface UniverseDefinition {
  readonly id: string
  readonly version: string
  readonly configuration: UniverseConfiguration
  readonly rosterGenerationVersion: string
  readonly conferences: readonly ConferenceDefinition[]
  readonly programs: readonly ProgramDefinition[]
}

export type UniverseValidationIssueCode =
  | 'INVALID_UNIVERSE_ID'
  | 'INVALID_UNIVERSE_VERSION'
  | 'INVALID_ROSTER_GENERATION_VERSION'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_CONFERENCE_COUNT'
  | 'DUPLICATE_CONFERENCE_ID'
  | 'INVALID_CONFERENCE'
  | 'INVALID_PROGRAM_COUNT'
  | 'INVALID_PROGRAMS_PER_CONFERENCE'
  | 'DUPLICATE_PROGRAM_ID'
  | 'DUPLICATE_PROGRAM_NAME'
  | 'DUPLICATE_PROGRAM_ABBREVIATION'
  | 'INVALID_PROGRAM_ID'
  | 'INVALID_PROGRAM_NAME'
  | 'INVALID_PROGRAM_ABBREVIATION'
  | 'UNKNOWN_CONFERENCE'
  | 'INVALID_LOCATION'
  | 'INVALID_PRESTIGE'
  | 'INVALID_BRANDING'
  | 'INVALID_IDENTITY'

export interface UniverseValidationIssue {
  readonly code: UniverseValidationIssueCode
  readonly message: string
  readonly path?: string
  readonly expected?: string | number
  readonly actual?: string | number
}

export interface UniverseValidationResult {
  readonly valid: boolean
  readonly issues: UniverseValidationIssue[]
}

/** Static identity paired with the current generated basketball state. */
export interface InitializedProgram {
  readonly program: ProgramDefinition
  readonly team: Team
  readonly rotation: RotationV1
}

export interface InitializedUniverse {
  readonly universeId: string
  readonly universeVersion: string
  readonly rosterGenerationVersion: string
  readonly programs: InitializedProgram[]
}
