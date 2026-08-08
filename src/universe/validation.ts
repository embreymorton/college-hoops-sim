import { MAX_TEAM_PRESTIGE, MIN_TEAM_PRESTIGE } from '../engine'
import type {
  UniverseDefinition,
  UniverseValidationIssue,
  UniverseValidationIssueCode,
  UniverseValidationResult,
} from './domain'

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
const STATE_CODE_PATTERN = /^[A-Z]{2}$/

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function pushIssue(
  issues: UniverseValidationIssue[],
  code: UniverseValidationIssueCode,
  message: string,
  details: Omit<UniverseValidationIssue, 'code' | 'message'> = {},
): void {
  issues.push({ code, message, ...details })
}

function findDuplicates(
  values: readonly string[],
): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    const key = normalized(value)

    if (seen.has(key)) {
      duplicates.add(key)
    } else {
      seen.add(key)
    }
  }

  return duplicates
}

/** Validates a self-describing Universe without encoding V0 counts in the engine. */
export function validateUniverseDefinition(
  universe: UniverseDefinition,
): UniverseValidationResult {
  const issues: UniverseValidationIssue[] = []
  const { configuration } = universe

  if (universe.id.trim().length === 0) {
    pushIssue(issues, 'INVALID_UNIVERSE_ID', 'Universe ID cannot be empty.', {
      path: 'id',
    })
  }

  if (universe.version.trim().length === 0) {
    pushIssue(
      issues,
      'INVALID_UNIVERSE_VERSION',
      'Universe version cannot be empty.',
      { path: 'version' },
    )
  }

  if (universe.rosterGenerationVersion.trim().length === 0) {
    pushIssue(
      issues,
      'INVALID_ROSTER_GENERATION_VERSION',
      'Roster generation version cannot be empty.',
      { path: 'rosterGenerationVersion' },
    )
  }

  for (const [key, value] of Object.entries(configuration)) {
    if (!isPositiveSafeInteger(value)) {
      pushIssue(
        issues,
        'INVALID_CONFIGURATION',
        `${key} must be a positive safe integer.`,
        { path: `configuration.${key}`, actual: value },
      )
    }
  }

  if (
    isPositiveSafeInteger(configuration.programCount) &&
    isPositiveSafeInteger(configuration.conferenceCount) &&
    isPositiveSafeInteger(configuration.programsPerConference) &&
    configuration.programCount !==
      configuration.conferenceCount * configuration.programsPerConference
  ) {
    pushIssue(
      issues,
      'INVALID_CONFIGURATION',
      'programCount must equal conferenceCount × programsPerConference.',
      {
        path: 'configuration.programCount',
        expected:
          configuration.conferenceCount * configuration.programsPerConference,
        actual: configuration.programCount,
      },
    )
  }

  if (universe.conferences.length !== configuration.conferenceCount) {
    pushIssue(
      issues,
      'INVALID_CONFERENCE_COUNT',
      `Universe has ${universe.conferences.length} conferences; expected ${configuration.conferenceCount}.`,
      {
        path: 'conferences',
        expected: configuration.conferenceCount,
        actual: universe.conferences.length,
      },
    )
  }

  const duplicateConferenceIds = findDuplicates(
    universe.conferences.map(({ id }) => id),
  )
  const conferenceIds = new Set(
    universe.conferences.map(({ id }) => normalized(id)),
  )

  universe.conferences.forEach((conference, index) => {
    const path = `conferences[${index}]`

    if (
      conference.id.trim().length === 0 ||
      conference.name.trim().length === 0 ||
      conference.identity.trim().length === 0
    ) {
      pushIssue(
        issues,
        'INVALID_CONFERENCE',
        'Conference ID, name, and identity must be non-empty.',
        { path },
      )
    }

    if (duplicateConferenceIds.has(normalized(conference.id))) {
      pushIssue(
        issues,
        'DUPLICATE_CONFERENCE_ID',
        `Conference ID "${conference.id}" is not unique.`,
        { path: `${path}.id`, actual: conference.id },
      )
    }
  })

  if (universe.programs.length !== configuration.programCount) {
    pushIssue(
      issues,
      'INVALID_PROGRAM_COUNT',
      `Universe has ${universe.programs.length} programs; expected ${configuration.programCount}.`,
      {
        path: 'programs',
        expected: configuration.programCount,
        actual: universe.programs.length,
      },
    )
  }

  const duplicateProgramIds = findDuplicates(
    universe.programs.map(({ id }) => id),
  )
  const duplicateProgramNames = findDuplicates(
    universe.programs.map(({ name }) => name),
  )
  const duplicateAbbreviations = findDuplicates(
    universe.programs.map(({ abbreviation }) => abbreviation),
  )
  const programsByConference = new Map<string, number>(
    universe.conferences.map(({ id }) => [normalized(id), 0]),
  )

  universe.programs.forEach((program, index) => {
    const path = `programs[${index}]`
    const normalizedConferenceId = normalized(program.conferenceId)

    if (program.id.trim().length === 0) {
      pushIssue(issues, 'INVALID_PROGRAM_ID', 'Program ID cannot be empty.', {
        path: `${path}.id`,
      })
    }

    if (program.name.trim().length === 0) {
      pushIssue(
        issues,
        'INVALID_PROGRAM_NAME',
        'Program name cannot be empty.',
        { path: `${path}.name` },
      )
    }

    if (program.abbreviation.trim().length === 0) {
      pushIssue(
        issues,
        'INVALID_PROGRAM_ABBREVIATION',
        'Program abbreviation cannot be empty.',
        { path: `${path}.abbreviation` },
      )
    }

    if (duplicateProgramIds.has(normalized(program.id))) {
      pushIssue(
        issues,
        'DUPLICATE_PROGRAM_ID',
        `Program ID "${program.id}" is not unique.`,
        { path: `${path}.id`, actual: program.id },
      )
    }

    if (duplicateProgramNames.has(normalized(program.name))) {
      pushIssue(
        issues,
        'DUPLICATE_PROGRAM_NAME',
        `Program name "${program.name}" is not unique.`,
        { path: `${path}.name`, actual: program.name },
      )
    }

    if (duplicateAbbreviations.has(normalized(program.abbreviation))) {
      pushIssue(
        issues,
        'DUPLICATE_PROGRAM_ABBREVIATION',
        `Program abbreviation "${program.abbreviation}" is not unique.`,
        { path: `${path}.abbreviation`, actual: program.abbreviation },
      )
    }

    if (!conferenceIds.has(normalizedConferenceId)) {
      pushIssue(
        issues,
        'UNKNOWN_CONFERENCE',
        `Program "${program.id}" references unknown conference "${program.conferenceId}".`,
        { path: `${path}.conferenceId`, actual: program.conferenceId },
      )
    } else {
      programsByConference.set(
        normalizedConferenceId,
        (programsByConference.get(normalizedConferenceId) ?? 0) + 1,
      )
    }

    if (
      program.location.city.trim().length === 0 ||
      !STATE_CODE_PATTERN.test(program.location.stateCode)
    ) {
      pushIssue(
        issues,
        'INVALID_LOCATION',
        `Program "${program.id}" must have a city and uppercase two-letter state code.`,
        { path: `${path}.location` },
      )
    }

    if (
      !Number.isFinite(program.basePrestige) ||
      program.basePrestige < MIN_TEAM_PRESTIGE ||
      program.basePrestige > MAX_TEAM_PRESTIGE
    ) {
      pushIssue(
        issues,
        'INVALID_PRESTIGE',
        `Program "${program.id}" prestige must be between ${MIN_TEAM_PRESTIGE} and ${MAX_TEAM_PRESTIGE}.`,
        { path: `${path}.basePrestige`, actual: program.basePrestige },
      )
    }

    const { primaryColor, secondaryColor } = program.branding

    if (
      !HEX_COLOR_PATTERN.test(primaryColor) ||
      !HEX_COLOR_PATTERN.test(secondaryColor) ||
      primaryColor.toLocaleLowerCase('en-US') ===
        secondaryColor.toLocaleLowerCase('en-US')
    ) {
      pushIssue(
        issues,
        'INVALID_BRANDING',
        `Program "${program.id}" must have two distinct six-digit hexadecimal colors.`,
        { path: `${path}.branding` },
      )
    }

    if (program.identity.trim().length === 0) {
      pushIssue(
        issues,
        'INVALID_IDENTITY',
        `Program "${program.id}" identity cannot be empty.`,
        { path: `${path}.identity` },
      )
    }
  })

  for (const conference of universe.conferences) {
    const actual = programsByConference.get(normalized(conference.id)) ?? 0

    if (actual !== configuration.programsPerConference) {
      pushIssue(
        issues,
        'INVALID_PROGRAMS_PER_CONFERENCE',
        `Conference "${conference.id}" has ${actual} programs; expected ${configuration.programsPerConference}.`,
        {
          path: `conferences.${conference.id}`,
          expected: configuration.programsPerConference,
          actual,
        },
      )
    }
  }

  return { valid: issues.length === 0, issues }
}
