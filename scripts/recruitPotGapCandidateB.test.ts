import { describe, expect, it } from 'vitest'
import { finalizeRecruitPotential } from '../src/dynasty/recruiting/potential'

function outcomes(overall: number, count = 400) {
  return Array.from({ length: count }, (_, index) => finalizeRecruitPotential({
    overall,
    rawCeiling: overall,
    dynastySeed: 'candidate-b-test',
    targetSeasonNumber: 2,
    playerId: `player-${index}`,
  }))
}

describe('Recruit POT-gap Candidate B', () => {
  it('leaves ineligible recruits unchanged', () => {
    expect(finalizeRecruitPotential({ overall: 77, rawCeiling: 70, dynastySeed: 'x', targetSeasonNumber: 2, playerId: 'a' }).potential).toBe(77)
    expect(finalizeRecruitPotential({ overall: 82, rawCeiling: 90, dynastySeed: 'x', targetSeasonNumber: 2, playerId: 'b' }).potential).toBe(90)
  })

  it.each([[78, 2, 6], [84, 2, 6], [85, 2, 5], [89, 2, 5], [90, 1, 3], [97, 1, 2]])(
    'uses the precommitted runway at OVR %i',
    (overall, minimum, maximum) => {
      const granted = outcomes(overall).filter((row) => !row.preservedZero).map((row) => row.grantedRunway)
      expect(Math.min(...granted)).toBe(minimum)
      expect(Math.max(...granted)).toBe(maximum)
      expect(granted.every((gap) => gap >= minimum && gap <= maximum)).toBe(true)
    },
  )

  it('preserves both zero-gap and granted outcomes deterministically', () => {
    const first = outcomes(82)
    expect(first.some((row) => row.preservedZero)).toBe(true)
    expect(first.some((row) => row.grantedRunway > 0)).toBe(true)
    expect(outcomes(82)).toEqual(first)
  })

  it('caps POT at 99 and never lowers it below OVR', () => {
    for (const overall of [98, 99]) {
      for (const result of outcomes(overall)) {
        expect(result.potential).toBeGreaterThanOrEqual(overall)
        expect(result.potential).toBeLessThanOrEqual(99)
      }
    }
    expect(outcomes(99).some((row) => row.cappedAt99)).toBe(true)
  })

  it('accepts raw ceilings below OVR as eligible inputs', () => {
    expect(finalizeRecruitPotential({ overall: 80, rawCeiling: 60, dynastySeed: 'x', targetSeasonNumber: 2, playerId: 'x' }).potential).toBeGreaterThanOrEqual(80)
  })
})
