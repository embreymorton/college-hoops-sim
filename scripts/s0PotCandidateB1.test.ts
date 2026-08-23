import { describe, expect, it } from 'vitest'
import { B1_TIERS, b1TierIndex, b1TierProbabilities, fitS0PotCandidateB1, generateS0PotCandidateB1, S0_POT_CANDIDATE_B1, type B1Observation } from './s0PotCandidateB1'

const observations: B1Observation[] = Array.from({ length: 240 }, (_, index) => {
  const stage = index % 4; const overall = 60 + (index % 31); const minimum = Math.max(overall, 60)
  return { stage, overall, potential: Math.min(99, minimum + ((index * 7 + stage) % (100 - minimum))) }
})

describe('S0 POT Candidate B1', () => {
  it('classifies the six semantic tiers including the High/Very High split', () => {
    expect([60, 74, 75, 84, 85, 89, 90, 94, 95, 96, 97, 99].map(b1TierIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })

  it('fits deterministically from only the supplied observations', () => {
    expect(fitS0PotCandidateB1(observations, 80)).toEqual(fitS0PotCandidateB1(observations, 80))
  })

  it('masks illegal tiers and normalizes positive legal probabilities', () => {
    const model = fitS0PotCandidateB1(observations, 100)
    for (const overall of [60, 74, 85, 92, 98, 99]) {
      const probabilities = b1TierProbabilities(overall, 3, model)
      expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12)
      probabilities.forEach((probability, tier) => {
        if (B1_TIERS[tier]!.maximum < overall) expect(probability).toBe(0)
        else expect(Number.isFinite(probability)).toBe(true)
      })
      expect(probabilities.every((probability, tier) => B1_TIERS[tier]!.maximum < overall || probability > 0)).toBe(true)
    }
  })

  it('uses shared within-tier weights and produces deterministic legal Player-local draws without class caps', () => {
    const model = fitS0PotCandidateB1(observations, 100)
    expect(model.withinTierWeights).toHaveLength(6)
    expect(model.withinTierWeights[2]).toHaveLength(5); expect(model.withinTierWeights[3]).toHaveLength(5)
    for (const classYear of ['FR', 'SO', 'JR', 'SR'] as const) for (const overall of [60, 72, 90, 99]) {
      const input = { overall, classYear, universeSeed: 'b1-test', programId: 'p', playerId: `${classYear}-${overall}` }
      const potential = generateS0PotCandidateB1(input, model)
      expect(generateS0PotCandidateB1(input, model)).toBe(potential)
      expect(potential).toBeGreaterThanOrEqual(overall); expect(potential).toBeLessThanOrEqual(99)
    }
    expect(S0_POT_CANDIDATE_B1.namespace).toContain('candidate-b1:v1')
  })

  it('keeps fit and holdout inputs separable by construction', () => {
    const fit = observations.slice(0, 120); const holdout = observations.slice(120)
    const model = fitS0PotCandidateB1(fit, 20); const snapshot = structuredClone(model)
    holdout.forEach((row) => b1TierProbabilities(row.overall, row.stage, model))
    expect(model).toEqual(snapshot)
  })
})
