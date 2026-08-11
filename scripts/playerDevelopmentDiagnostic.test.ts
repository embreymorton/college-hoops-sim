import { describe, expect, it } from 'vitest'
import { runDevelopmentCareers } from './playerDevelopmentDiagnostic'

describe('player development career diagnostic', () => {
  it('uses deterministic production careers while preserving development invariants', () => {
    const options = { profiles: [{ overall: 55, potential: 90 }], careersPerProfile: 4 }
    const first = runDevelopmentCareers(options)
    const second = runDevelopmentCareers(options)
    expect(second).toEqual(first)
    expect(first).toHaveLength(4)
    expect(first.every((outcome) => outcome.seniorOverall <= outcome.potential)).toBe(true)
    expect(first.flatMap(({ annualGains }) => annualGains).every((gain) => gain >= 0)).toBe(true)
  })
})
