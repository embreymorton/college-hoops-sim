import { describe, expect, it } from 'vitest'
import { finalizeRecruitPotential } from './potential'

function find(overall: number, predicate: (potential: number) => boolean) {
  for (let index = 0; index < 1000; index += 1) {
    const result = finalizeRecruitPotential({
      overall,
      rawCeiling: overall - 1,
      dynastySeed: 'production-potential-fixture',
      targetSeasonNumber: 2,
      playerId: `recruit-${index}`,
    })
    if (predicate(result.potential)) return result
  }
  throw new Error('Expected deterministic fixture outcome was not found.')
}

describe('production Recruit POT finalization', () => {
  it('preserves a natural ceiling above OVR and the legacy floor below OVR 78', () => {
    expect(finalizeRecruitPotential({ overall: 82, rawCeiling: 91, dynastySeed: 'x', targetSeasonNumber: 2, playerId: 'natural' }).potential).toBe(91)
    expect(finalizeRecruitPotential({ overall: 77, rawCeiling: 60, dynastySeed: 'x', targetSeasonNumber: 2, playerId: 'low' }).potential).toBe(77)
  })

  it('produces both accepted preserve-zero and runway outcomes', () => {
    expect(find(82, (potential) => potential === 82).preservedZero).toBe(true)
    expect(find(82, (potential) => potential > 82).grantedRunway).toBeGreaterThan(0)
  })

  it.each([[78, 2, 6], [84, 2, 6], [85, 2, 5], [89, 2, 5], [90, 1, 3]])(
    'keeps OVR %i grants inside +%i..+%i',
    (overall, minimum, maximum) => {
      const grants = Array.from({ length: 500 }, (_, index) => finalizeRecruitPotential({
        overall,
        rawCeiling: overall - 1,
        dynastySeed: 'production-range',
        targetSeasonNumber: 2,
        playerId: `recruit-${index}`,
      })).filter((result) => result.grantedRunway > 0).map((result) => result.grantedRunway)
      expect(Math.min(...grants)).toBe(minimum)
      expect(Math.max(...grants)).toBe(maximum)
    },
  )

  it('caps at 99, preserves POT invariants, and replays deterministically', () => {
    const input = { overall: 99, rawCeiling: 70, dynastySeed: 'cap', targetSeasonNumber: 2, playerId: 'cap-player' } as const
    const first = finalizeRecruitPotential(input)
    expect(finalizeRecruitPotential(input)).toEqual(first)
    expect(first.potential).toBe(99)
    expect(first.potential).toBeGreaterThanOrEqual(input.overall)
    expect(first.potential).toBeLessThanOrEqual(99)
  })
})
