import { describe, expect, it } from 'vitest'
import { collectS0TalentContinuity } from './inspectS0TalentContinuity'

describe('S0 talent continuity diagnostic', () => {
  it('is deterministic and leaves production-derived invariants intact', () => {
    const first = collectS0TalentContinuity(2, 's0-continuity-test')
    const second = collectS0TalentContinuity(2, 's0-continuity-test')
    expect(second).toEqual(first)
    expect(first.s0.FR.length).toBeGreaterThan(0)
    expect(first.recruitStages).toHaveLength(4)
    expect([...Object.values(first.s0).flat(), ...first.recruitStages.flat()].every((row) => row.potential >= row.overall && row.potential <= 99)).toBe(true)
  })
})
