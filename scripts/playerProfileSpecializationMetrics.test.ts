import { describe, expect, it } from 'vitest'
import type { Player, PlayerAttributes } from '../src/engine'
import {
  countWeaknesses,
  deriveProfileShape,
  standardDeviation,
  withAttributeConstraints,
} from './playerProfileSpecializationMetrics'

const attributes: PlayerAttributes = {
  finishing: 40,
  shooting: 50,
  playmaking: 60,
  ballHandling: 70,
  perimeterDefense: 80,
  interiorDefense: 90,
  rebounding: 95,
  athleticism: 85,
  stamina: 75,
}

const player: Player = {
  id: 'diagnostic-player',
  firstName: 'Test',
  lastName: 'Player',
  position: 'SG',
  classYear: 'SR',
  height: 77,
  attributes,
  potential: 99,
}

describe('player profile specialization metrics', () => {
  it('summarizes weakness counts using strict thresholds', () => {
    expect(countWeaknesses([49, 50, 59, 60, 69, 70])).toEqual({
      below50: 1,
      below60: 3,
      below70: 5,
    })
  })

  it('derives spread and top-to-bottom separation', () => {
    const shape = deriveProfileShape(attributes)

    expect(shape.spread).toBe(55)
    expect(shape.topTwoMinusBottomTwo).toBe(47.5)
    expect(shape.standardDeviation).toBeCloseTo(17.48, 2)
    expect(shape.weaknesses.below60).toBe(2)
  })

  it('can limit shape analysis to position-relevant attributes', () => {
    const shape = deriveProfileShape(attributes, [
      'finishing',
      'shooting',
      'ballHandling',
      'perimeterDefense',
    ])

    expect(shape.spread).toBe(40)
    expect(shape.weaknesses.below70).toBe(2)
  })

  it('applies diagnostic constraints without mutating the source Player', () => {
    const constrained = withAttributeConstraints(player, {
      perimeterDefense: 60,
      rebounding: 50,
    })

    expect(constrained.attributes.perimeterDefense).toBe(60)
    expect(constrained.attributes.rebounding).toBe(50)
    expect(constrained.attributes.shooting).toBe(50)
    expect(player.attributes.perimeterDefense).toBe(80)
  })

  it('handles empty standard-deviation input safely', () => {
    expect(standardDeviation([])).toBe(0)
  })
})
