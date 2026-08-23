import { describe, expect, it } from 'vitest'
import { candidatePotWeight } from './s0PotCandidateA'
import { candidateA2PotWeight, generateS0PotCandidateA2, realizedFraction, S0_POT_CANDIDATE_A2 } from './s0PotCandidateA2'

describe('S0 POT Candidate A2', () => {
  it('uses the rating-floor-normalized realization fraction', () => {
    expect(realizedFraction(70, 80)).toBe(.75)
    expect(realizedFraction(89, 99)).toBeCloseTo(49 / 59)
    expect(realizedFraction(40, 99)).toBe(0)
    expect(realizedFraction(99, 99)).toBe(1)
  })

  it('inherits A1 exactly and adds only the preregistered realization tilt', () => {
    for (const classYear of ['FR', 'SO', 'JR', 'SR'] as const) {
      for (const [overall, potential] of [[55, 95], [70, 80], [89, 99], [94, 95]] as const) {
        const expected = candidatePotWeight(overall, classYear, potential)
          * Math.exp(S0_POT_CANDIDATE_A2.realizationLambda[classYear] * realizedFraction(overall, potential))
        expect(candidateA2PotWeight(overall, classYear, potential)).toBeCloseTo(expected, 12)
      }
    }
  })

  it('is deterministic, legal, and gives every legal ceiling positive support', () => {
    for (const classYear of ['FR', 'SO', 'JR', 'SR'] as const) for (const overall of [40, 60, 72, 90, 99]) {
      const input = { overall, classYear, universeSeed: 'candidate-a2-test', programId: 'p', playerId: `${classYear}-${overall}` }
      const first = generateS0PotCandidateA2(input)
      expect(generateS0PotCandidateA2(input)).toBe(first)
      expect(first).toBeGreaterThanOrEqual(overall)
      expect(first).toBeLessThanOrEqual(99)
      for (let potential = Math.max(60, overall); potential <= 99; potential += 1) {
        expect(candidateA2PotWeight(overall, classYear, potential)).toBeGreaterThan(0)
      }
    }
  })
})
