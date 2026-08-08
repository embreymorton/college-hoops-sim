import { describe, expect, it } from 'vitest'
import {
  calculateOverall,
  CLASS_YEARS,
  MAX_PLAYER_RATING,
  MIN_PLAYER_RATING,
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
} from './index'

function attributesAt(rating: number): PlayerAttributes {
  return {
    finishing: rating,
    shooting: rating,
    playmaking: rating,
    ballHandling: rating,
    perimeterDefense: rating,
    interiorDefense: rating,
    rebounding: rating,
    athleticism: rating,
    stamina: rating,
  }
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player-1',
    firstName: 'Jordan',
    lastName: 'Ellis',
    position: 'SF',
    classYear: 'SO',
    height: 78,
    attributes: attributesAt(70),
    potential: 85,
    ...overrides,
  }
}

describe('Player domain model', () => {
  it('defines the supported positions and class years', () => {
    expect(POSITIONS).toEqual(['PG', 'SG', 'SF', 'PF', 'C'])
    expect(CLASS_YEARS).toEqual(['FR', 'SO', 'JR', 'SR'])
  })

  it('uses the expected inclusive rating scale', () => {
    expect(MIN_PLAYER_RATING).toBe(40)
    expect(MAX_PLAYER_RATING).toBe(99)
  })

  it('is JSON serializable and does not store an overall field', () => {
    const player = makePlayer()
    const roundTripped = JSON.parse(JSON.stringify(player)) as Player

    expect(roundTripped).toEqual(player)
    expect(roundTripped.height).toBe(78)
    expect('overall' in roundTripped).toBe(false)
    expect(calculateOverall(roundTripped)).toBe(calculateOverall(player))
  })
})

describe('calculateOverall', () => {
  it.each(POSITIONS)('preserves the minimum extreme for %s', (position) => {
    expect(
      calculateOverall(
        makePlayer({ position, attributes: attributesAt(MIN_PLAYER_RATING) }),
      ),
    ).toBe(MIN_PLAYER_RATING)
  })

  it.each(POSITIONS)('preserves the maximum extreme for %s', (position) => {
    expect(
      calculateOverall(
        makePlayer({ position, attributes: attributesAt(MAX_PLAYER_RATING) }),
      ),
    ).toBe(MAX_PLAYER_RATING)
  })

  it.each(POSITIONS)(
    'keeps a uniform profile unchanged for %s',
    (position) => {
      expect(
        calculateOverall(
          makePlayer({ position, attributes: attributesAt(75) }),
        ),
      ).toBe(75)
    },
  )

  it('rounds the weighted rating to the nearest integer', () => {
    expect(
      calculateOverall(makePlayer({ attributes: attributesAt(70.5) })),
    ).toBe(71)
  })

  it('materially values a perimeter creator differently by position', () => {
    const attributes: PlayerAttributes = {
      finishing: 70,
      shooting: 92,
      playmaking: 95,
      ballHandling: 94,
      perimeterDefense: 88,
      interiorDefense: 45,
      rebounding: 48,
      athleticism: 80,
      stamina: 82,
    }

    const overalls = Object.fromEntries(
      POSITIONS.map((position) => [
        position,
        calculateOverall(makePlayer({ position, attributes })),
      ]),
    ) as Record<Position, number>

    expect(overalls).toEqual({ PG: 87, SG: 83, SF: 77, PF: 69, C: 65 })
    expect(overalls.PG - overalls.C).toBeGreaterThanOrEqual(20)
  })

  it('materially values an interior player differently by position', () => {
    const attributes: PlayerAttributes = {
      finishing: 94,
      shooting: 45,
      playmaking: 50,
      ballHandling: 48,
      perimeterDefense: 55,
      interiorDefense: 96,
      rebounding: 97,
      athleticism: 88,
      stamina: 82,
    }

    const overalls = Object.fromEntries(
      POSITIONS.map((position) => [
        position,
        calculateOverall(makePlayer({ position, attributes })),
      ]),
    ) as Record<Position, number>

    expect(overalls).toEqual({ PG: 59, SG: 64, SF: 72, PF: 83, C: 87 })
    expect(overalls.C - overalls.PG).toBeGreaterThanOrEqual(20)
  })

  it('gives a balanced wing similar ratings across adjacent positions', () => {
    const attributes: PlayerAttributes = {
      finishing: 82,
      shooting: 81,
      playmaking: 76,
      ballHandling: 78,
      perimeterDefense: 84,
      interiorDefense: 72,
      rebounding: 75,
      athleticism: 86,
      stamina: 79,
    }

    expect(
      POSITIONS.map((position) =>
        calculateOverall(makePlayer({ position, attributes })),
      ),
    ).toEqual([80, 81, 80, 79, 78])
  })

  it('does not include potential in current overall', () => {
    const attributes = attributesAt(80)
    const lowPotential = makePlayer({ attributes, potential: 40 })
    const highPotential = makePlayer({ attributes, potential: 99 })

    expect(calculateOverall(lowPotential)).toBe(80)
    expect(calculateOverall(highPotential)).toBe(80)
  })

  it('does not mutate the player or its attributes', () => {
    const player = makePlayer({
      attributes: {
        ...attributesAt(70),
        shooting: 90,
      },
    })
    const before = JSON.parse(JSON.stringify(player)) as Player

    calculateOverall(player)

    expect(player).toEqual(before)
  })

  it.each([
    ['below the scale', 39.99],
    ['above the scale', 99.01],
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
  ])('rejects an attribute %s', (_label, invalidRating) => {
    const player = makePlayer({
      attributes: {
        ...attributesAt(70),
        shooting: invalidRating,
      },
    })

    expect(() => calculateOverall(player)).toThrow(RangeError)
  })
})

