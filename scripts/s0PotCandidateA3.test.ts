import { describe, expect, it } from 'vitest'
import { deriveA3Normalizers, evaluateA3Normalizer } from './deriveS0PotCandidateA3Normalizers'
import { candidateA3PotWeight, candidateA3RealizationTilt, generateS0PotCandidateA3, S0_POT_CANDIDATE_A3 } from './s0PotCandidateA3'

describe('S0 POT Candidate A3', () => {
  it('has deterministic frozen smooth normalizers', () => {
    const first = deriveA3Normalizers(8, 'candidate-a3-normalizer-test')
    const second = deriveA3Normalizers(8, 'candidate-a3-normalizer-test')
    expect(second).toEqual(first)
    for (const year of ['FR', 'SO', 'JR', 'SR'] as const) {
      for (const potential of [60, 75, 90, 95, 99]) expect(Number.isFinite(evaluateA3Normalizer(S0_POT_CANDIDATE_A3.normalizerCoefficients[year], potential))).toBe(true)
    }
  })

  it('keeps the smooth normalizer close to the exact baseline and approximately unit mean', () => {
    const { exact } = deriveA3Normalizers()
    for (const year of ['FR', 'SO', 'JR', 'SR'] as const) for (let potential = 60; potential <= 99; potential += 1) {
      const smooth = evaluateA3Normalizer(S0_POT_CANDIDATE_A3.normalizerCoefficients[year], potential)
      expect(Math.exp(exact[year][potential - 60]! - exact[year][potential - 60]!)).toBe(1)
      expect(Math.abs(smooth - exact[year][potential - 60]!)).toBeLessThan(.07)
      expect(Math.exp(exact[year][potential - 60]! - smooth)).toBeGreaterThan(.93)
      expect(Math.exp(exact[year][potential - 60]! - smooth)).toBeLessThan(1.08)
    }
  })

  it('is positive, deterministic, and legal with full intended support', () => {
    for (const classYear of ['FR', 'SO', 'JR', 'SR'] as const) for (const overall of [40, 60, 72, 90, 99]) {
      const input = { overall, classYear, universeSeed: 'candidate-a3-test', programId: 'p', playerId: `${classYear}-${overall}` }
      const first = generateS0PotCandidateA3(input)
      expect(generateS0PotCandidateA3(input)).toBe(first)
      expect(first).toBeGreaterThanOrEqual(overall)
      expect(first).toBeLessThanOrEqual(99)
      for (let potential = Math.max(60, overall); potential <= 99; potential += 1) {
        expect(candidateA3RealizationTilt(overall, classYear, potential)).toBeGreaterThan(0)
        expect(candidateA3PotWeight(overall, classYear, potential)).toBeGreaterThan(0)
      }
    }
  })
})
