import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateOverall,
  calculateRosterAverage,
  calculateTopPlayersAverage,
  CLASS_YEARS,
  MAX_PLAYER_RATING,
  MIN_PLAYER_RATING,
  POSITIONS,
  TEAM_ROSTER_SIZE,
  type PlayerAttributes,
  type Position,
  type Team,
} from '../domain'
import { createRng } from '../random'
import { generateTeam, type GenerateTeamOptions } from './teamGenerator'

const ATTRIBUTE_NAMES = [
  'finishing',
  'shooting',
  'playmaking',
  'ballHandling',
  'perimeterDefense',
  'interiorDefense',
  'rebounding',
  'athleticism',
  'stamina',
] as const satisfies readonly (keyof PlayerAttributes)[]

const HEIGHT_RANGES: Readonly<Record<Position, readonly [number, number]>> = {
  PG: [70, 77],
  SG: [73, 79],
  SF: [76, 81],
  PF: [78, 83],
  C: [80, 86],
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  const sampleAverage = average(values)

  return Math.sqrt(
    average(values.map((value) => (value - sampleAverage) ** 2)),
  )
}

function counts<T extends string>(values: readonly T[]): Record<T, number> {
  return values.reduce(
    (result, value) => ({ ...result, [value]: (result[value] ?? 0) + 1 }),
    {} as Record<T, number>,
  )
}

function generateSample(prestige: number, count = 250): Team[] {
  const rng = createRng(`team-sample-${prestige}`)

  return Array.from({ length: count }, (_, index) =>
    generateTeam({
      name: `Sample ${prestige}-${index}`,
      abbreviation: `P${prestige}`,
      prestige,
      rng,
    }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateTeam', () => {
  it('generates the same team from the same seed and options', () => {
    const options = {
      name: 'Charlotte Tech',
      abbreviation: 'CTU',
      prestige: 75,
    } as const
    const first = generateTeam({ ...options, rng: createRng('same-team') })
    const second = generateTeam({ ...options, rng: createRng('same-team') })

    expect(first).toEqual(second)
    expect(first.id).toMatch(/^team-[0-9a-f]{16}$/)
    expect(first.name).toBe(options.name)
    expect(first.abbreviation).toBe(options.abbreviation)
    expect(first.prestige).toBe(options.prestige)
  })

  it('builds exactly 12 players with all positions and sensible redundancy', () => {
    const positionPatterns = new Set<string>()

    for (let index = 0; index < 100; index += 1) {
      const team = generateTeam({
        name: `Coverage ${index}`,
        abbreviation: 'CVR',
        prestige: 60,
        rng: createRng(`position-coverage-${index}`),
      })
      const positionCounts = counts(
        team.roster.map((player) => player.position),
      )

      expect(team.roster).toHaveLength(TEAM_ROSTER_SIZE)
      for (const position of POSITIONS) {
        expect(positionCounts[position]).toBeGreaterThanOrEqual(2)
        expect(positionCounts[position]).toBeLessThanOrEqual(3)
      }

      positionPatterns.add(
        POSITIONS.map((position) => positionCounts[position]).join('-'),
      )
    }

    expect(positionPatterns.size).toBeGreaterThan(5)
  })

  it('generates balanced but varied class-year distributions', () => {
    const classPatterns = new Set<string>()

    for (let index = 0; index < 100; index += 1) {
      const team = generateTeam({
        name: `Classes ${index}`,
        abbreviation: 'CLS',
        prestige: 60,
        rng: createRng(`class-balance-${index}`),
      })
      const classCounts = counts(
        team.roster.map((player) => player.classYear),
      )

      for (const classYear of CLASS_YEARS) {
        expect(classCounts[classYear]).toBeGreaterThanOrEqual(2)
        expect(classCounts[classYear]).toBeLessThanOrEqual(4)
      }

      classPatterns.add(
        CLASS_YEARS.map((classYear) => classCounts[classYear]).join('-'),
      )
    }

    expect(classPatterns.size).toBeGreaterThan(5)
  })

  it('creates unique player IDs within every roster', () => {
    for (const team of generateSample(60, 100)) {
      expect(new Set(team.roster.map((player) => player.id)).size).toBe(
        TEAM_ROSTER_SIZE,
      )
    }
  })

  it('preserves player rating, potential, and height invariants', () => {
    const teams = [30, 45, 60, 75, 90].flatMap((prestige) =>
      generateSample(prestige, 40),
    )

    for (const player of teams.flatMap((team) => team.roster)) {
      for (const attributeName of ATTRIBUTE_NAMES) {
        const rating = player.attributes[attributeName]

        expect(Number.isInteger(rating)).toBe(true)
        expect(rating).toBeGreaterThanOrEqual(MIN_PLAYER_RATING)
        expect(rating).toBeLessThanOrEqual(MAX_PLAYER_RATING)
      }

      const [minimumHeight, maximumHeight] = HEIGHT_RANGES[player.position]
      expect(Number.isInteger(player.height)).toBe(true)
      expect(player.height).toBeGreaterThanOrEqual(minimumHeight)
      expect(player.height).toBeLessThanOrEqual(maximumHeight)
      expect(player.potential).toBeGreaterThanOrEqual(calculateOverall(player))
      expect(player.potential).toBeLessThanOrEqual(MAX_PLAYER_RATING)
    }
  })

  it('makes higher-prestige rosters stronger at every depth measure in aggregate', () => {
    const prestigeLevels = [30, 45, 60, 75, 90]
    const metrics = prestigeLevels.map((prestige) => {
      const teams = generateSample(prestige)
      const rosterAverages = teams.map((team) =>
        calculateRosterAverage(team.roster),
      )

      return {
        rosterAverage: average(rosterAverages),
        topFiveAverage: average(
          teams.map((team) => calculateTopPlayersAverage(team.roster)),
        ),
        bestAverage: average(
          teams.map((team) =>
            Math.max(...team.roster.map(calculateOverall)),
          ),
        ),
        worstAverage: average(
          teams.map((team) =>
            Math.min(...team.roster.map(calculateOverall)),
          ),
        ),
        minimumRosterAverage: Math.min(...rosterAverages),
        maximumRosterAverage: Math.max(...rosterAverages),
      }
    })

    for (let index = 1; index < metrics.length; index += 1) {
      const lower = metrics[index - 1] as (typeof metrics)[number]
      const higher = metrics[index] as (typeof metrics)[number]

      expect(higher.rosterAverage - lower.rosterAverage).toBeGreaterThan(4)
      expect(higher.topFiveAverage - lower.topFiveAverage).toBeGreaterThan(4)
      expect(higher.bestAverage - lower.bestAverage).toBeGreaterThan(3)
      expect(higher.worstAverage - lower.worstAverage).toBeGreaterThan(3)
      expect(lower.maximumRosterAverage).toBeGreaterThan(
        higher.minimumRosterAverage,
      )
    }
  })

  it('retains meaningful player-quality variation within individual rosters', () => {
    const teams = generateSample(75)
    const spreads = teams.map((team) => {
      const overalls = team.roster.map(calculateOverall)

      return {
        range: Math.max(...overalls) - Math.min(...overalls),
        standardDeviation: standardDeviation(overalls),
      }
    })

    expect(average(spreads.map((spread) => spread.standardDeviation))).toBeGreaterThan(
      4,
    )
    expect(spreads.filter((spread) => spread.range >= 10).length).toBeGreaterThan(
      teams.length * 0.8,
    )
  })

  it('can give weak programs a standout without flattening powerhouse depth', () => {
    const weakTeams = generateSample(30, 500)
    const powerhouseTeams = generateSample(90, 500)
    const strongestWeakPlayer = Math.max(
      ...weakTeams.flatMap((team) => team.roster.map(calculateOverall)),
    )
    const weakestPowerhouseBenchPlayer = Math.min(
      ...powerhouseTeams.flatMap((team) => team.roster.map(calculateOverall)),
    )

    expect(strongestWeakPlayer).toBeGreaterThanOrEqual(72)
    expect(weakestPowerhouseBenchPlayer).toBeLessThanOrEqual(70)
  })

  it('uses only the supplied RNG', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })

    expect(() =>
      generateTeam({
        name: 'Deterministic State',
        abbreviation: 'DTS',
        prestige: 55,
        rng: createRng('injected-team-rng'),
      }),
    ).not.toThrow()
  })

  it('does not mutate options or unrelated state', () => {
    const rng = createRng('team-no-mutation')
    const options: GenerateTeamOptions = {
      name: 'Immutable College',
      abbreviation: 'IMC',
      prestige: 52,
      rng,
    }
    const optionsBefore = { ...options }
    const unrelatedState = {
      selectedSchoolId: 'school-1',
      settings: { simulationSpeed: 2 },
    }
    const unrelatedBefore = JSON.parse(JSON.stringify(unrelatedState))

    generateTeam(options)

    expect(options).toEqual(optionsBefore)
    expect(unrelatedState).toEqual(unrelatedBefore)
  })

  it('returns JSON-serializable team and player data without stored overalls', () => {
    const team = generateTeam({
      name: 'Serializable University',
      abbreviation: 'SRU',
      prestige: 68,
      rng: createRng('serializable-team'),
    })
    const roundTripped = JSON.parse(JSON.stringify(team)) as Team

    expect(roundTripped).toEqual(team)
    expect('overall' in roundTripped).toBe(false)
    expect(roundTripped.roster.every((player) => !('overall' in player))).toBe(
      true,
    )
  })

  it.each([
    ['empty name', '', 'TST', 50],
    ['blank abbreviation', 'Test State', '   ', 50],
    ['prestige below range', 'Test State', 'TST', 0],
    ['prestige above range', 'Test State', 'TST', 101],
    ['NaN prestige', 'Test State', 'TST', Number.NaN],
    ['infinite prestige', 'Test State', 'TST', Number.POSITIVE_INFINITY],
  ])(
    'rejects %s',
    (_label, name, abbreviation, prestige) => {
      expect(() =>
        generateTeam({
          name,
          abbreviation,
          prestige,
          rng: createRng('invalid-team'),
        }),
      ).toThrow(RangeError)
    },
  )
})
