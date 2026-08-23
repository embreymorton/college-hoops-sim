import { describe, expect, it } from 'vitest'
import {
  classifyS0CeilingTier,
  deriveLegalWithinTierProbabilities,
  deriveS0PotentialFeatures,
  deriveS0TierProbabilities,
  generateS0Potential,
  S0_CEILING_TIERS,
  S0_POTENTIAL_MODEL,
} from './s0Potential'

describe('production S0 conditional-tier Potential', () => {
  it.each([
    [60, 'Limited'], [74, 'Limited'], [75, 'Normal'], [84, 'Normal'],
    [85, 'High'], [89, 'High'], [90, 'Very High'], [94, 'Very High'],
    [95, 'Elite'], [96, 'Elite'], [97, 'Exceptional'], [99, 'Exceptional'],
  ] as const)('classifies POT %i as %s', (potential, tier) => {
    expect(classifyS0CeilingTier(potential)).toBe(tier)
  })

  it('calculates the validated centered OVR and ordered-stage features', () => {
    const features = deriveS0PotentialFeatures(S0_POTENTIAL_MODEL.overallMean, 'FR')
    expect(features).toEqual([1, 0, -1, -1, -0])
    const senior = deriveS0PotentialFeatures(S0_POTENTIAL_MODEL.overallMean + S0_POTENTIAL_MODEL.overallScale, 'SR')
    expect(senior[0]).toBe(1); expect(senior[1]).toBeCloseTo(1, 12); expect(senior[2]).toBeCloseTo(0, 12)
    expect(senior[3]).toBe(1); expect(senior[4]).toBeCloseTo(1, 12)
  })

  it('calculates stable representative logits and normalized probabilities', () => {
    const probabilities = deriveS0TierProbabilities(80, 'JR')
    expect(probabilities).toHaveLength(6)
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12)
    expect(probabilities).toEqual([
      0,
      expect.closeTo(0.772551, 5),
      expect.closeTo(0.118844, 5),
      expect.closeTo(0.075084, 5),
      expect.closeTo(0.026082, 5),
      expect.closeTo(0.007438, 5),
    ])
  })

  it('masks tiers without legal POT values', () => {
    expect(deriveS0TierProbabilities(92, 'SR').slice(0, 3)).toEqual([0, 0, 0])
    expect(deriveS0TierProbabilities(95, 'JR').slice(0, 4)).toEqual([0, 0, 0, 0])
    expect(deriveS0TierProbabilities(99, 'FR')).toEqual([0, 0, 0, 0, 0, 1])
    for (let tier = 0; tier < S0_CEILING_TIERS.length; tier += 1) {
      const probabilities = deriveS0TierProbabilities(60, 'FR')
      expect(probabilities[tier]).toBeGreaterThan(0)
    }
  })

  it('truncates and renormalizes shared within-tier weights once', () => {
    const exceptional = deriveLegalWithinTierProbabilities(98, 5)
    expect(exceptional.potentials).toEqual([98, 99])
    expect(exceptional.probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12)
    expect(exceptional.probabilities[0]).toBeCloseTo(0.494085, 5)
    expect(deriveLegalWithinTierProbabilities(99, 5)).toEqual({ potentials: [99], probabilities: [1] })
  })

  it('is deterministic, Player-local, order-independent, and always legal', () => {
    const inputs = ['a', 'b', 'c'].map((playerId) => ({ overall: 72, classYear: 'SR' as const, universeSeed: 'production-s0-pot', programId: 'program', playerId }))
    const forward = inputs.map((input) => generateS0Potential(input))
    const reverse = [...inputs].reverse().map((input) => generateS0Potential(input)).reverse()
    expect(reverse).toEqual(forward)
    expect(inputs.map((input) => generateS0Potential(input))).toEqual(forward)
    expect(forward.every((potential) => potential >= 72 && potential <= 99)).toBe(true)
    expect(generateS0Potential({ ...inputs[0]!, overall: 99 })).toBe(99)
  })
})
