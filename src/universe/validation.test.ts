import { describe, expect, it } from 'vitest'
import type { UniverseDefinition } from './domain'
import { UNIVERSE_V0, validateUniverseDefinition } from './index'

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/
const STATE_CODE_PATTERN = /^[A-Z]{2}$/

function mutableClone(): UniverseDefinition {
  return JSON.parse(JSON.stringify(UNIVERSE_V0)) as UniverseDefinition
}

describe('Universe V0 definition', () => {
  it('matches its explicit 32-program, four-conference V0 configuration', () => {
    expect(UNIVERSE_V0.configuration).toEqual({
      programCount: 32,
      conferenceCount: 4,
      programsPerConference: 8,
    })
    expect(UNIVERSE_V0.programs).toHaveLength(32)
    expect(UNIVERSE_V0.conferences).toHaveLength(4)

    for (const conference of UNIVERSE_V0.conferences) {
      expect(
        UNIVERSE_V0.programs.filter(
          ({ conferenceId }) => conferenceId === conference.id,
        ),
      ).toHaveLength(8)
    }
  })

  it('has unique stable program and conference identifiers', () => {
    expect(new Set(UNIVERSE_V0.conferences.map(({ id }) => id)).size).toBe(4)
    expect(new Set(UNIVERSE_V0.programs.map(({ id }) => id)).size).toBe(32)
    expect(new Set(UNIVERSE_V0.programs.map(({ name }) => name)).size).toBe(32)
    expect(
      new Set(UNIVERSE_V0.programs.map(({ abbreviation }) => abbreviation)).size,
    ).toBe(32)
  })

  it('has valid conference references, locations, prestige, branding, and identities', () => {
    const conferenceIds = new Set(
      UNIVERSE_V0.conferences.map(({ id }) => id),
    )

    for (const program of UNIVERSE_V0.programs) {
      expect(conferenceIds.has(program.conferenceId)).toBe(true)
      expect(program.location.city.trim().length).toBeGreaterThan(0)
      expect(program.location.stateCode).toMatch(STATE_CODE_PATTERN)
      expect(program.basePrestige).toBeGreaterThanOrEqual(1)
      expect(program.basePrestige).toBeLessThanOrEqual(100)
      expect(program.branding.primaryColor).toMatch(HEX_COLOR_PATTERN)
      expect(program.branding.secondaryColor).toMatch(HEX_COLOR_PATTERN)
      expect(program.branding.primaryColor).not.toBe(
        program.branding.secondaryColor,
      )
      expect(program.identity.trim().length).toBeGreaterThan(0)
    }
  })

  it('passes structured Universe validation and JSON round-trips', () => {
    expect(validateUniverseDefinition(UNIVERSE_V0)).toEqual({
      valid: true,
      issues: [],
    })
    expect(JSON.parse(JSON.stringify(UNIVERSE_V0))).toEqual(UNIVERSE_V0)
  })

  it('reports structured issues for malformed definitions', () => {
    const universe = mutableClone()
    const firstProgram = universe.programs[0]!
    const secondProgram = universe.programs[1]!
    const malformed: UniverseDefinition = {
      ...universe,
      configuration: { ...universe.configuration, programCount: 31 },
      programs: [
        {
          ...firstProgram,
          location: { city: '', stateCode: 'Rhode Island' },
          branding: {
            primaryColor: '#12345',
            secondaryColor: '#12345',
          },
          identity: '',
        },
        {
          ...secondProgram,
          id: firstProgram.id,
          name: firstProgram.name,
          abbreviation: firstProgram.abbreviation,
          conferenceId: 'missing-conference',
          basePrestige: 101,
        },
        ...universe.programs.slice(2),
      ],
    }
    const validation = validateUniverseDefinition(malformed)
    const codes = new Set(validation.issues.map(({ code }) => code))
    const expectedCodes = [
      'INVALID_CONFIGURATION',
      'INVALID_PROGRAM_COUNT',
      'DUPLICATE_PROGRAM_ID',
      'DUPLICATE_PROGRAM_NAME',
      'DUPLICATE_PROGRAM_ABBREVIATION',
      'UNKNOWN_CONFERENCE',
      'INVALID_LOCATION',
      'INVALID_PRESTIGE',
      'INVALID_BRANDING',
      'INVALID_IDENTITY',
    ] as const

    expect(validation.valid).toBe(false)
    for (const code of expectedCodes) {
      expect(codes.has(code)).toBe(true)
    }
    expect(validation.issues.every(({ message }) => message.length > 0)).toBe(
      true,
    )
    expect(JSON.parse(JSON.stringify(validation))).toEqual(validation)
  })
})
