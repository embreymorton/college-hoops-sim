import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  UNIVERSE_V0,
  type ProgramDefinition,
  type UniverseDefinition,
} from '../universe'
import {
  generateRegularSeasonSchedule,
  getGamesForProgram,
  SCHEDULE_V0_CONFIGURATION,
  validateRegularSeasonSchedule,
  type RegularSeasonSchedule,
} from './index'

const TEST_SEED = 'schedule-v0-tests'

function cloneUniverse(): UniverseDefinition {
  return JSON.parse(JSON.stringify(UNIVERSE_V0)) as UniverseDefinition
}

function pairKey(firstProgramId: string, secondProgramId: string): string {
  return [firstProgramId, secondProgramId].sort().join('/')
}

function nonConferenceSignature(schedule: RegularSeasonSchedule): string {
  return schedule.games
    .filter(({ type }) => type === 'nonconference')
    .map(
      ({ homeProgramId, awayProgramId, round }) =>
        `${round}:${homeProgramId}:${awayProgramId}`,
    )
    .join('|')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Schedule Generation V0', () => {
  it('creates reciprocal double round-robin games for every conference pair', () => {
    const schedule = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
    })

    for (const conference of UNIVERSE_V0.conferences) {
      const members = UNIVERSE_V0.programs.filter(
        ({ conferenceId }) => conferenceId === conference.id,
      )

      for (let firstIndex = 0; firstIndex < members.length; firstIndex += 1) {
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < members.length;
          secondIndex += 1
        ) {
          const first = members[firstIndex] as ProgramDefinition
          const second = members[secondIndex] as ProgramDefinition
          const games = schedule.games.filter(
            ({ homeProgramId, awayProgramId, type }) =>
              type === 'conference' &&
              pairKey(homeProgramId, awayProgramId) ===
                pairKey(first.id, second.id),
          )

          expect(games).toHaveLength(2)
          expect(games).toContainEqual(
            expect.objectContaining({
              homeProgramId: first.id,
              awayProgramId: second.id,
            }),
          )
          expect(games).toContainEqual(
            expect.objectContaining({
              homeProgramId: second.id,
              awayProgramId: first.id,
            }),
          )
        }
      }
    }
  })

  it('gives every V0 Program 14 conference games split 7 home and 7 away', () => {
    const schedule = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
    })

    for (const program of UNIVERSE_V0.programs) {
      const games = getGamesForProgram(schedule, program.id).filter(
        ({ type }) => type === 'conference',
      )

      expect(games).toHaveLength(14)
      expect(
        games.filter(({ homeProgramId }) => homeProgramId === program.id),
      ).toHaveLength(7)
      expect(
        games.filter(({ awayProgramId }) => awayProgramId === program.id),
      ).toHaveLength(7)
    }
  })

  it('gives every V0 Program ten distinct cross-conference opponents', () => {
    const schedule = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
    })
    const conferenceByProgram = new Map<string, string>(
      UNIVERSE_V0.programs.map(({ id, conferenceId }) => [id, conferenceId]),
    )
    const pairingCounts = new Map<string, number>()

    for (const game of schedule.games.filter(
      ({ type }) => type === 'nonconference',
    )) {
      expect(conferenceByProgram.get(game.homeProgramId)).not.toBe(
        conferenceByProgram.get(game.awayProgramId),
      )
      const key = pairKey(game.homeProgramId, game.awayProgramId)
      pairingCounts.set(key, (pairingCounts.get(key) ?? 0) + 1)
    }

    expect([...pairingCounts.values()].every((count) => count === 1)).toBe(
      true,
    )

    for (const program of UNIVERSE_V0.programs) {
      const games = getGamesForProgram(schedule, program.id).filter(
        ({ type }) => type === 'nonconference',
      )
      const opponents = new Set(
        games.map(({ homeProgramId, awayProgramId }) =>
          homeProgramId === program.id ? awayProgramId : homeProgramId,
        ),
      )

      expect(games).toHaveLength(10)
      expect(opponents.size).toBe(10)
      expect(
        games.filter(({ homeProgramId }) => homeProgramId === program.id),
      ).toHaveLength(5)
      expect(
        games.filter(({ awayProgramId }) => awayProgramId === program.id),
      ).toHaveLength(5)
    }
  })

  it('creates 384 games and exact 24-game, 12-home, 12-away Team schedules', () => {
    const schedule = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
    })

    expect(schedule.games).toHaveLength(384)
    expect(new Set(schedule.games.map(({ id }) => id)).size).toBe(384)
    expect(
      schedule.games.every(
        ({ homeProgramId, awayProgramId }) =>
          homeProgramId !== awayProgramId &&
          UNIVERSE_V0.programs.some(({ id }) => id === homeProgramId) &&
          UNIVERSE_V0.programs.some(({ id }) => id === awayProgramId),
      ),
    ).toBe(true)

    for (const program of UNIVERSE_V0.programs) {
      const games = getGamesForProgram(schedule, program.id)

      expect(games).toHaveLength(24)
      expect(
        games.filter(({ homeProgramId }) => homeProgramId === program.id),
      ).toHaveLength(12)
      expect(
        games.filter(({ awayProgramId }) => awayProgramId === program.id),
      ).toHaveLength(12)
    }
  })

  it('uses 24 complete rounds with every Program appearing exactly once', () => {
    const schedule = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
    })

    expect(schedule.roundCount).toBe(24)
    expect(new Set(schedule.games.map(({ round }) => round)).size).toBe(24)

    for (let round = 1; round <= schedule.roundCount; round += 1) {
      const games = schedule.games.filter((game) => game.round === round)
      const participants = games.flatMap(
        ({ homeProgramId, awayProgramId }) => [
          homeProgramId,
          awayProgramId,
        ],
      )

      expect(games).toHaveLength(16)
      expect(participants).toHaveLength(32)
      expect(new Set(participants).size).toBe(32)
    }
  })

  it('mixes conference and non-conference rounds through the season', () => {
    const schedule = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
    })
    const roundTypes = Array.from(
      { length: schedule.roundCount },
      (_, index) =>
        schedule.games.find(({ round }) => round === index + 1)?.type,
    )

    expect(roundTypes.slice(0, 12)).toContain('conference')
    expect(roundTypes.slice(0, 12)).toContain('nonconference')
    expect(roundTypes.slice(12)).toContain('conference')
    expect(roundTypes.slice(12)).toContain('nonconference')
    expect(roundTypes.join(',')).not.toContain(
      'conference,conference,conference,conference',
    )
  })

  it('reproduces deeply equal schedules from identical inputs and seed', () => {
    const first = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
    })
    const second = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
    })

    expect(second).toEqual(first)
  })

  it('optionally namespaces game IDs without changing schedule structure', () => {
    const first = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
      gameIdNamespace: 'season-1',
    })
    const second = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
      gameIdNamespace: 'season-2',
    })
    expect(first.games.map(({ id }) => id)).not.toEqual(
      second.games.map(({ id }) => id),
    )
    const structure = (schedule: RegularSeasonSchedule) => schedule.games.map(
      ({ index, round, homeProgramId, awayProgramId, type }) => ({
        index,
        round,
        homeProgramId,
        awayProgramId,
        type,
      }),
    )
    expect(structure(first)).toEqual(structure(second))
    expect(second.games.some(({ id }) => first.games.some(
      ({ id: firstId }) => firstId === id,
    ))).toBe(false)
    expect(() => generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: TEST_SEED,
      gameIdNamespace: '  ',
    })).toThrow(/namespace/)
  })

  it('uses different seeds to produce different legal non-conference schedules', () => {
    const first = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: 'schedule-alpha',
    })
    const second = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: 'schedule-beta',
    })

    expect(nonConferenceSignature(second)).not.toBe(
      nonConferenceSignature(first),
    )
    expect(validateRegularSeasonSchedule(UNIVERSE_V0, first).valid).toBe(true)
    expect(validateRegularSeasonSchedule(UNIVERSE_V0, second).valid).toBe(true)
  })

  it('is independent of Program definition array order', () => {
    const original = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: 'definition-order',
    })
    const reversedPrograms: UniverseDefinition = {
      ...UNIVERSE_V0,
      programs: [...UNIVERSE_V0.programs].reverse(),
    }

    expect(
      generateRegularSeasonSchedule({
        universe: reversedPrograms,
        seed: 'definition-order',
      }),
    ).toEqual(original)
  })

  it('is independent of Conference definition array order', () => {
    const original = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: 'conference-definition-order',
    })
    const reversedConferences: UniverseDefinition = {
      ...UNIVERSE_V0,
      conferences: [...UNIVERSE_V0.conferences].reverse(),
    }

    expect(
      generateRegularSeasonSchedule({
        universe: reversedConferences,
        seed: 'conference-definition-order',
      }),
    ).toEqual(original)
  })

  it('derives conference scheduling from supplied membership rather than V0 counts', () => {
    const programs = UNIVERSE_V0.conferences.flatMap((conference) =>
      UNIVERSE_V0.programs
        .filter(({ conferenceId }) => conferenceId === conference.id)
        .slice(0, 4),
    )
    const smallerUniverse: UniverseDefinition = {
      ...UNIVERSE_V0,
      id: 'four-by-four-fixture',
      configuration: {
        programCount: 16,
        conferenceCount: 4,
        programsPerConference: 4,
      },
      programs,
    }
    const schedule = generateRegularSeasonSchedule({
      universe: smallerUniverse,
      seed: 'derived-membership',
      configuration: {
        conferenceFormat: 'double-round-robin',
        nonConferenceGamesPerProgram: 4,
        targetHomeGamesPerProgram: 5,
        targetAwayGamesPerProgram: 5,
      },
    })

    expect(schedule.roundCount).toBe(10)
    expect(schedule.games).toHaveLength(80)
    expect(validateRegularSeasonSchedule(smallerUniverse, schedule)).toEqual({
      valid: true,
      issues: [],
    })
    for (const program of smallerUniverse.programs) {
      const games = getGamesForProgram(schedule, program.id)

      expect(games.filter(({ type }) => type === 'conference')).toHaveLength(6)
      expect(games.filter(({ type }) => type === 'nonconference')).toHaveLength(
        4,
      )
    }
  })

  it('does not use prestige, Team strength, or geography for scheduling', () => {
    const original = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: 'identity-independent',
    })
    const changedMetadata: UniverseDefinition = {
      ...UNIVERSE_V0,
      programs: UNIVERSE_V0.programs.map((program, index) => ({
        ...program,
        basePrestige: index % 2 === 0 ? 1 : 100,
        location: { city: `Changed City ${index}`, stateCode: 'ZZ' },
      })),
    }

    expect(
      generateRegularSeasonSchedule({
        universe: changedMetadata,
        seed: 'identity-independent',
      }),
    ).toEqual(original)
  })

  it('round-trips through JSON and does not mutate its inputs', () => {
    const universe = cloneUniverse()
    const universeBefore = cloneUniverse()
    const configuration = { ...SCHEDULE_V0_CONFIGURATION }
    const configurationBefore = { ...configuration }
    const schedule = generateRegularSeasonSchedule({
      universe,
      seed: TEST_SEED,
      configuration,
    })

    expect(JSON.parse(JSON.stringify(schedule))).toEqual(schedule)
    expect(universe).toEqual(universeBefore)
    expect(configuration).toEqual(configurationBefore)
  })

  it('uses no ambient Math.random path', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })

    expect(() =>
      generateRegularSeasonSchedule({
        universe: UNIVERSE_V0,
        seed: 'seeded-schedule-only',
      }),
    ).not.toThrow()
  })

  it('produces valid schedules for 100 deterministic seeds', () => {
    const signatures = new Set<string>()

    for (let seedIndex = 0; seedIndex < 100; seedIndex += 1) {
      const schedule = generateRegularSeasonSchedule({
        universe: UNIVERSE_V0,
        seed: `structural-sample-${seedIndex}`,
      })

      expect(validateRegularSeasonSchedule(UNIVERSE_V0, schedule)).toEqual({
        valid: true,
        issues: [],
      })
      signatures.add(nonConferenceSignature(schedule))
    }

    expect(signatures.size).toBeGreaterThan(1)
  })

  it('fails clearly for impossible or unsupported configurations', () => {
    expect(() =>
      generateRegularSeasonSchedule({
        universe: UNIVERSE_V0,
        seed: TEST_SEED,
        configuration: {
          ...SCHEDULE_V0_CONFIGURATION,
          nonConferenceGamesPerProgram: 25,
          targetHomeGamesPerProgram: 19,
          targetAwayGamesPerProgram: 20,
        },
      }),
    ).toThrow(/only 24 are available/)

    expect(() =>
      generateRegularSeasonSchedule({
        universe: UNIVERSE_V0,
        seed: TEST_SEED,
        configuration: {
          ...SCHEDULE_V0_CONFIGURATION,
          nonConferenceGamesPerProgram: 9,
          targetHomeGamesPerProgram: 12,
          targetAwayGamesPerProgram: 11,
        },
      }),
    ).toThrow(/even, equally split/)
  })
})
