import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TEAM_ROSTER_SIZE,
  validateRotation,
  type Team,
} from '../engine'
import {
  initializeUniverse,
  UNIVERSE_V0,
  type InitializedProgram,
  type UniverseDefinition,
} from './index'

function byProgramId(
  programs: readonly InitializedProgram[],
): Map<string, InitializedProgram> {
  return new Map(programs.map((program) => [program.program.id, program]))
}

function cloneUniverse(): UniverseDefinition {
  return JSON.parse(JSON.stringify(UNIVERSE_V0)) as UniverseDefinition
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('initializeUniverse', () => {
  it('reproduces deeply equal initialized state from the same seed', () => {
    const first = initializeUniverse(UNIVERSE_V0, 'same-dynasty')
    const second = initializeUniverse(UNIVERSE_V0, 'same-dynasty')

    expect(first).toEqual(second)
  })

  it('preserves the numeric-versus-string seed distinction', () => {
    const numeric = initializeUniverse(UNIVERSE_V0, 1)
    const textual = initializeUniverse(UNIVERSE_V0, '1')

    expect(numeric.programs[0]!.team.roster).not.toEqual(
      textual.programs[0]!.team.roster,
    )
  })

  it('produces meaningful roster variation from different dynasty seeds', () => {
    const first = byProgramId(
      initializeUniverse(UNIVERSE_V0, 'dynasty-alpha').programs,
    )
    const second = byProgramId(
      initializeUniverse(UNIVERSE_V0, 'dynasty-beta').programs,
    )
    const changedRosters = UNIVERSE_V0.programs.filter(
      ({ id }) =>
        JSON.stringify(first.get(id)!.team.roster) !==
        JSON.stringify(second.get(id)!.team.roster),
    )

    expect(changedRosters.length).toBeGreaterThan(16)
  })

  it('keeps every program result stable when program order changes', () => {
    const reversedDefinition: UniverseDefinition = {
      ...UNIVERSE_V0,
      programs: [...UNIVERSE_V0.programs].reverse(),
    }
    const original = byProgramId(
      initializeUniverse(UNIVERSE_V0, 'order-independent').programs,
    )
    const reversed = byProgramId(
      initializeUniverse(reversedDefinition, 'order-independent').programs,
    )

    for (const { id } of UNIVERSE_V0.programs) {
      expect(reversed.get(id)).toEqual(original.get(id))
    }
  })

  it('does not perturb a program when unrelated definitions are added', () => {
    const [atlantic, lakes] = UNIVERSE_V0.conferences
    const northbridge = UNIVERSE_V0.programs.find(
      ({ id }) => id === 'northbridge',
    )!
    const greatLakes = UNIVERSE_V0.programs.find(
      ({ id }) => id === 'great-lakes',
    )!
    const baseDefinition: UniverseDefinition = {
      id: 'isolation-fixture',
      version: 'v0',
      rosterGenerationVersion: 'v1',
      configuration: {
        programCount: 1,
        conferenceCount: 1,
        programsPerConference: 1,
      },
      conferences: [atlantic!],
      programs: [northbridge],
    }
    const extendedDefinition: UniverseDefinition = {
      ...baseDefinition,
      configuration: {
        programCount: 2,
        conferenceCount: 2,
        programsPerConference: 1,
      },
      conferences: [atlantic!, lakes!],
      programs: [greatLakes, northbridge],
    }
    const base = initializeUniverse(baseDefinition, 'isolated-program')
    const extended = byProgramId(
      initializeUniverse(extendedDefinition, 'isolated-program').programs,
    )

    expect(extended.get(northbridge.id)).toEqual(base.programs[0])
  })

  it('maps stable identity and base prestige into legal current Team state', () => {
    const initialized = initializeUniverse(UNIVERSE_V0, 'state-mapping')

    expect(initialized.programs).toHaveLength(32)
    for (const { program, team, rotation } of initialized.programs) {
      expect(team.id).toBe(program.id)
      expect(team.name).toBe(program.name)
      expect(team.abbreviation).toBe(program.abbreviation)
      expect(team.prestige).toBe(program.basePrestige)
      expect(team.roster).toHaveLength(TEAM_ROSTER_SIZE)
      expect(validateRotation(team, rotation)).toEqual({
        valid: true,
        issues: [],
      })
    }
  })

  it('returns serializable output without mutating its Universe input', () => {
    const universe = cloneUniverse()
    const before = JSON.parse(JSON.stringify(universe)) as UniverseDefinition
    const initialized = initializeUniverse(universe, 'serializable-universe')
    const roundTripped = JSON.parse(
      JSON.stringify(initialized),
    ) as typeof initialized

    expect(roundTripped).toEqual(initialized)
    expect(universe).toEqual(before)
  })

  it('uses no ambient Math.random path', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })

    expect(() => initializeUniverse(UNIVERSE_V0, 'seeded-only')).not.toThrow()
  })

  it('rejects invalid definitions and non-finite numeric seeds', () => {
    const invalid: UniverseDefinition = {
      ...UNIVERSE_V0,
      programs: UNIVERSE_V0.programs.slice(1),
    }

    expect(() => initializeUniverse(invalid, 'invalid-definition')).toThrow(
      RangeError,
    )
    expect(() => initializeUniverse(UNIVERSE_V0, Number.NaN)).toThrow(
      RangeError,
    )
  })

  it('keeps Team state independently mutable from immutable base prestige', () => {
    const initialized = initializeUniverse(UNIVERSE_V0, 'prestige-semantics')
    const first = initialized.programs[0]!
    const changedTeam: Team = { ...first.team, prestige: first.team.prestige + 1 }

    expect(changedTeam.prestige).toBe(first.program.basePrestige + 1)
    expect(first.program.basePrestige).toBe(UNIVERSE_V0.programs[0]!.basePrestige)
  })
})
