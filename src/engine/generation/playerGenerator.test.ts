import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateOverall,
  MAX_PLAYER_RATING,
  MIN_PLAYER_RATING,
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
} from '../domain'
import { createRng } from '../random'
import { generatePlayer, type GeneratePlayerOptions } from './playerGenerator'

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

    expect(first).toEqual({
      id: 'player-dea09f73445cf739',
      firstName: 'Jalen',
      lastName: 'Bennett',
      position: 'PG',
      classYear: 'SO',
      height: 77,
      attributes: {
        finishing: 67,
        shooting: 71,
        playmaking: 78,
        ballHandling: 78,
        perimeterDefense: 81,
        interiorDefense: 52,
        rebounding: 65,
        athleticism: 76,
        stamina: 63,
      },
      potential: 86,
    })
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

  it('produces players compatible with calculateOverall near their talent level', () => {
    for (const position of POSITIONS) {
      for (const talentLevel of [55, 75, 90]) {
        const rng = createRng(`overall-${position}-${talentLevel}`)

        for (let index = 0; index < 100; index += 1) {
          const player = generatePlayer({
            position,
            talentLevel,
            classYear: 'JR',
            rng,
          })
          const overall = calculateOverall(player)

          expect(Number.isInteger(overall)).toBe(true)
          expect(Math.abs(overall - talentLevel)).toBeLessThanOrEqual(2)
        }
      }
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

  it('generates potential above, near, and occasionally below current overall', () => {
    const rng = createRng('potential-distribution')
    const players = Array.from({ length: 1_000 }, () =>
      generatePlayer({
        position: 'SF',
        talentLevel: 70,
        classYear: 'SO',
        rng,
      }),
    )
    const differences = players.map(
      (player) => player.potential - calculateOverall(player),
    )

    expect(differences.some((difference) => difference < 0)).toBe(true)
    expect(differences.some((difference) => difference === 0)).toBe(true)
    expect(differences.some((difference) => difference > 0)).toBe(true)
    expect(
      differences.filter((difference) => difference < 0).length,
    ).toBeLessThan(200)
    expect(
      differences.filter((difference) => difference > 0).length,
    ).toBeGreaterThan(600)
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
