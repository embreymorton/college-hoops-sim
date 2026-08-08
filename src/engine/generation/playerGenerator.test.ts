import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateOverall,
  CLASS_YEARS,
  MAX_PLAYER_RATING,
  MIN_PLAYER_RATING,
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
} from '../domain'
import { createRng } from '../random'
import {
  generatePlayer,
  PLAYER_NAME_POOL_COUNTS,
  type GeneratePlayerOptions,
} from './playerGenerator'

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

function generateSample(position: Position, count = 600): Player[] {
  const rng = createRng(`archetype-${position}`)

  return Array.from({ length: count }, () =>
    generatePlayer({ position, talentLevel: 75, classYear: 'SO', rng }),
  )
}

function attributeAverage(
  players: readonly Player[],
  attribute: keyof PlayerAttributes,
): number {
  return (
    players.reduce((sum, player) => sum + player.attributes[attribute], 0) /
    players.length
  )
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generatePlayer', () => {
  it('generates the same player from the same seed and options', () => {
    const options = {
      position: 'PG',
      talentLevel: 75,
      classYear: 'SO',
    } as const

    const first = generatePlayer({ ...options, rng: createRng('same-player') })
    const second = generatePlayer({ ...options, rng: createRng('same-player') })

    expect(first).toEqual(second)
    expect(first.id).toMatch(/^player-[0-9a-f]{16}$/)
    expect(first.position).toBe('PG')
    expect(first.classYear).toBe('SO')
    expect(first.firstName).not.toBe('')
    expect(first.lastName).not.toBe('')
  })

  it('produces variety from different seeds', () => {
    const players = Array.from({ length: 50 }, (_, index) =>
      generatePlayer({
        position: 'SG',
        talentLevel: 72,
        classYear: 'JR',
        rng: createRng(`variety-${index}`),
      }),
    )

    expect(new Set(players.map((player) => player.id)).size).toBe(50)
    expect(
      new Set(players.map((player) => `${player.firstName} ${player.lastName}`))
        .size,
    ).toBeGreaterThan(35)
    expect(
      new Set(players.map((player) => JSON.stringify(player.attributes))).size,
    ).toBeGreaterThan(45)
  })

  it('uses expanded deterministic local name pools', () => {
    expect(PLAYER_NAME_POOL_COUNTS.firstNames).toBeGreaterThanOrEqual(75)
    expect(PLAYER_NAME_POOL_COUNTS.lastNames).toBeGreaterThanOrEqual(100)
    expect(PLAYER_NAME_POOL_COUNTS.combinations).toBeGreaterThanOrEqual(7_500)

    const names = Array.from({ length: 384 }, (_, index) => {
      const player = generatePlayer({
        position: 'SF',
        talentLevel: 70,
        classYear: 'SO',
        rng: createRng(`mvp-name-sample-${index}`),
      })

      return `${player.firstName} ${player.lastName}`
    })

    expect(new Set(names).size).toBeGreaterThan(360)
  })

  it('uses only the supplied RNG', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })

    expect(() =>
      generatePlayer({
        position: 'SF',
        talentLevel: 70,
        classYear: 'FR',
        rng: createRng('injected-rng'),
      }),
    ).not.toThrow()
  })

  it.each(POSITIONS)(
    'keeps every generated %s rating within domain bounds',
    (position) => {
      for (const talentLevel of [40, 75, 99]) {
        const rng = createRng(`bounds-${position}-${talentLevel}`)

        for (let index = 0; index < 100; index += 1) {
          const player = generatePlayer({
            position,
            talentLevel,
            classYear: 'SR',
            rng,
          })

          for (const attribute of ATTRIBUTE_NAMES) {
            expect(Number.isInteger(player.attributes[attribute])).toBe(true)
            expect(player.attributes[attribute]).toBeGreaterThanOrEqual(
              MIN_PLAYER_RATING,
            )
            expect(player.attributes[attribute]).toBeLessThanOrEqual(
              MAX_PLAYER_RATING,
            )
          }

          expect(Number.isInteger(player.potential)).toBe(true)
          expect(player.potential).toBeGreaterThanOrEqual(MIN_PLAYER_RATING)
          expect(player.potential).toBeLessThanOrEqual(MAX_PLAYER_RATING)
        }
      }
    },
  )

  it.each(POSITIONS)(
    'keeps generated %s heights inside the positional range',
    (position) => {
      const [minimum, maximum] = HEIGHT_RANGES[position]
      const rng = createRng(`height-${position}`)
      const players = Array.from({ length: 500 }, () =>
        generatePlayer({
          position,
          talentLevel: 70,
          classYear: 'FR',
          rng,
        }),
      )

      expect(players.every((player) => Number.isInteger(player.height))).toBe(
        true,
      )
      expect(players.every((player) => player.height >= minimum)).toBe(true)
      expect(players.every((player) => player.height <= maximum)).toBe(true)
      expect(players.some((player) => player.height === minimum)).toBe(true)
      expect(players.some((player) => player.height === maximum)).toBe(true)
    },
  )

  it('centers each position near requested talent with meaningful overall variance', () => {
    for (const position of POSITIONS) {
      const players = generateSample(position, 1_000)
      const overalls = players.map(calculateOverall)

      expect(Math.abs(average(overalls) - 75)).toBeLessThan(0.75)
      expect(standardDeviation(overalls)).toBeGreaterThan(1.5)
      expect(standardDeviation(overalls)).toBeLessThan(3)
      expect(Math.max(...overalls) - Math.min(...overalls)).toBeGreaterThan(8)
    }
  })

  it('keeps talent levels distinct while centering aggregate quality', () => {
    const talentLevels = [55, 65, 75, 85]
    const averages = talentLevels.map((talentLevel) => {
      const overalls = POSITIONS.flatMap((position) => {
        const rng = createRng(`talent-distribution-${position}-${talentLevel}`)

        return Array.from({ length: 400 }, () =>
          calculateOverall(
            generatePlayer({
              position,
              talentLevel,
              classYear: 'JR',
              rng,
            }),
          ),
        )
      })

      expect(Math.abs(average(overalls) - talentLevel)).toBeLessThan(1)
      expect(standardDeviation(overalls)).toBeGreaterThan(1.5)
      expect(standardDeviation(overalls)).toBeLessThan(3)

      return average(overalls)
    })

    for (let index = 1; index < averages.length; index += 1) {
      expect((averages[index] ?? 0) - (averages[index - 1] ?? 0)).toBeGreaterThan(
        9,
      )
    }
  })

  it('creates sensible PG and C archetypes across deterministic samples', () => {
    const pointGuards = generateSample('PG')
    const centers = generateSample('C')

    expect(attributeAverage(pointGuards, 'playmaking')).toBeGreaterThan(
      attributeAverage(pointGuards, 'interiorDefense') + 20,
    )
    expect(attributeAverage(pointGuards, 'ballHandling')).toBeGreaterThan(
      attributeAverage(pointGuards, 'rebounding') + 20,
    )
    expect(attributeAverage(centers, 'interiorDefense')).toBeGreaterThan(
      attributeAverage(centers, 'playmaking') + 20,
    )
    expect(attributeAverage(centers, 'rebounding')).toBeGreaterThan(
      attributeAverage(centers, 'ballHandling') + 20,
    )
    expect(attributeAverage(pointGuards, 'playmaking')).toBeGreaterThan(
      attributeAverage(centers, 'playmaking') + 15,
    )
    expect(attributeAverage(centers, 'rebounding')).toBeGreaterThan(
      attributeAverage(pointGuards, 'rebounding') + 15,
    )
  })

  it('creates sensible SG, SF, and PF archetypes across deterministic samples', () => {
    const shootingGuards = generateSample('SG')
    const smallForwards = generateSample('SF')
    const powerForwards = generateSample('PF')

    expect(attributeAverage(shootingGuards, 'shooting')).toBeGreaterThan(
      attributeAverage(shootingGuards, 'playmaking') + 8,
    )
    expect(attributeAverage(shootingGuards, 'finishing')).toBeGreaterThan(
      attributeAverage(shootingGuards, 'interiorDefense') + 10,
    )

    const smallForwardAverages = ATTRIBUTE_NAMES.map((attribute) =>
      attributeAverage(smallForwards, attribute),
    )
    expect(
      Math.max(...smallForwardAverages) - Math.min(...smallForwardAverages),
    ).toBeLessThan(5)

    expect(attributeAverage(powerForwards, 'finishing')).toBeGreaterThan(
      attributeAverage(powerForwards, 'ballHandling') + 10,
    )
    expect(attributeAverage(powerForwards, 'rebounding')).toBeGreaterThan(
      attributeAverage(powerForwards, 'shooting') + 10,
    )
    expect(attributeAverage(powerForwards, 'interiorDefense')).toBeGreaterThan(
      attributeAverage(powerForwards, 'playmaking') + 10,
    )
  })

  it('never generates potential below current overall', () => {
    for (const position of POSITIONS) {
      for (const classYear of CLASS_YEARS) {
        for (const talentLevel of [40, 70, 99]) {
          const rng = createRng(
            `potential-floor-${position}-${classYear}-${talentLevel}`,
          )

          for (let index = 0; index < 100; index += 1) {
            const player = generatePlayer({
              position,
              talentLevel,
              classYear,
              rng,
            })

            expect(player.potential).toBeGreaterThanOrEqual(
              calculateOverall(player),
            )
          }
        }
      }
    }
  })

  it('gives younger players more average development runway', () => {
    const runwayByClassYear = Object.fromEntries(
      CLASS_YEARS.map((classYear) => {
        const differences = POSITIONS.flatMap((position) => {
          const rng = createRng(`runway-${classYear}-${position}`)

          return Array.from({ length: 500 }, () => {
            const player = generatePlayer({
              position,
              talentLevel: 70,
              classYear,
              rng,
            })

            return player.potential - calculateOverall(player)
          })
        })

        return [classYear, average(differences)]
      }),
    ) as Record<(typeof CLASS_YEARS)[number], number>

    expect(runwayByClassYear.FR).toBeGreaterThan(runwayByClassYear.SO + 2)
    expect(runwayByClassYear.SO).toBeGreaterThan(runwayByClassYear.JR + 2)
    expect(runwayByClassYear.JR).toBeGreaterThan(runwayByClassYear.SR + 1)
  })

  it('avoids excessive lower-bound pileups for weak positional skills', () => {
    const lowerBoundRate = (
      position: Position,
      attribute: keyof PlayerAttributes,
    ) => {
      const players = [55, 65, 75, 85].flatMap((talentLevel) => {
        const rng = createRng(
          `clamp-health-${position}-${attribute}-${talentLevel}`,
        )

        return Array.from({ length: 250 }, () =>
          generatePlayer({
            position,
            talentLevel,
            classYear: 'SO',
            rng,
          }),
        )
      })

      return (
        players.filter(
          (player) => player.attributes[attribute] === MIN_PLAYER_RATING,
        ).length / players.length
      )
    }

    expect(lowerBoundRate('PG', 'interiorDefense')).toBeLessThan(0.1)
    expect(lowerBoundRate('PG', 'rebounding')).toBeLessThan(0.1)
    expect(lowerBoundRate('PF', 'playmaking')).toBeLessThan(0.1)
    expect(lowerBoundRate('PF', 'ballHandling')).toBeLessThan(0.1)
    expect(lowerBoundRate('C', 'shooting')).toBeLessThan(0.1)
    expect(lowerBoundRate('C', 'playmaking')).toBeLessThan(0.1)
    expect(lowerBoundRate('C', 'ballHandling')).toBeLessThan(0.1)
  })

  it('does not mutate its options or unrelated state', () => {
    const rng = createRng('no-mutation')
    const options: GeneratePlayerOptions = {
      position: 'PF',
      talentLevel: 78,
      classYear: 'JR',
      rng,
    }
    const optionsBefore = { ...options }
    const unrelatedState = {
      selectedSchoolId: 'school-1',
      settings: { simulationSpeed: 2 },
    }
    const unrelatedBefore = JSON.parse(JSON.stringify(unrelatedState))

    generatePlayer(options)

    expect(options).toEqual(optionsBefore)
    expect(unrelatedState).toEqual(unrelatedBefore)
  })

  it('returns JSON-serializable player data', () => {
    const player = generatePlayer({
      position: 'C',
      talentLevel: 82,
      classYear: 'SR',
      rng: createRng('serializable-player'),
    })

    expect(JSON.parse(JSON.stringify(player))).toEqual(player)
  })

  it.each([39.99, 99.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid talent level %s',
    (talentLevel) => {
      expect(() =>
        generatePlayer({
          position: 'PG',
          talentLevel,
          classYear: 'FR',
          rng: createRng('invalid-talent'),
        }),
      ).toThrow(RangeError)
    },
  )
})
