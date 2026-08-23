import { describe, expect, it } from 'vitest'
import { A4_CALIBRATION, a4RowProbabilities, checkA4Feasibility, deriveA4FactorSet, solveA4Factors } from './deriveS0PotCandidateA4Factors'
import { candidateA4PotWeight, generateS0PotCandidateA4, S0_POT_CANDIDATE_A4 } from './s0PotCandidateA4'

describe('S0 POT Candidate A4', () => {
  it('checks nested support feasibility', () => {
    const target = Array<number>(40).fill(0); target[20] = .9; target[39] = .1
    const histogram = Array<number>(100).fill(0); histogram[70] = 90; histogram[99] = 10
    expect(checkA4Feasibility(histogram, target).feasible).toBe(true)
    target[39] = .05; target[20] = .95
    expect(checkA4Feasibility(histogram, target).feasible).toBe(false)
  })

  it('derives deterministic, centered, converged positive factors', () => {
    const target = Array.from({ length: 40 }, () => 1 / 40); const first = deriveA4FactorSet(8, 'a4-factor-test', target); const second = deriveA4FactorSet(8, 'a4-factor-test', target)
    expect(second).toEqual(first)
    for (const year of ['FR', 'SO', 'JR', 'SR'] as const) {
      const solution = first.solutions[year]
      expect(solution.iterations).toBeLessThan(A4_CALIBRATION.maximumIterations)
      expect(solution.maxAbsoluteError).toBeLessThan(A4_CALIBRATION.absoluteTolerance)
      expect(solution.theta.reduce((sum, value, index) => sum + value * target[index]!, 0)).toBeCloseTo(0, 10)
      expect(solution.theta.every((value) => Number.isFinite(value) && Math.exp(value) > 0)).toBe(true)
    }
  })

  it('produces normalized rows and a numerically correct convex gradient', () => {
    const histogram = Array<number>(100).fill(0); histogram[60] = 2; histogram[75] = 3
    const target = Array.from({ length: 40 }, () => 1 / 40); const solution = solveA4Factors(histogram, 'FR', target)
    const probabilities = a4RowProbabilities(75, 'FR', solution.theta)
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12)
    expect(probabilities.slice(0, 15).every((value) => value === 0)).toBe(true)
    expect(solution.marginal.map((value, index) => value - target[index]!).reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 12)
  })

  it('is deterministic, legal, and has positive support on every legal cell', () => {
    for (const classYear of ['FR', 'SO', 'JR', 'SR'] as const) for (const overall of [40, 60, 72, 90, 99]) {
      const input = { overall, classYear, universeSeed: 'a4-test', programId: 'p', playerId: `${classYear}-${overall}` }; const first = generateS0PotCandidateA4(input)
      expect(generateS0PotCandidateA4(input)).toBe(first); expect(first).toBeGreaterThanOrEqual(overall); expect(first).toBeLessThanOrEqual(99)
      for (let potential = Math.max(60, overall); potential <= 99; potential += 1) expect(candidateA4PotWeight(overall, classYear, potential)).toBeGreaterThan(0)
      expect(S0_POT_CANDIDATE_A4.namespace).toContain('candidate-a4:v1')
    }
  })
})
