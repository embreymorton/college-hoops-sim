import { describe, expect, it } from 'vitest'
import {
  deriveLeaderSeparation,
  pearsonCorrelation,
  per40,
  percentile,
  summarize,
} from './playerStatisticalIdentityMetrics'

describe('player statistical identity metrics', () => {
  it('summarizes values with interpolated percentiles', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.25)).toBe(2)
    expect(summarize([1, 2, 3, 4, 5])).toEqual({
      count: 5,
      mean: 3,
      minimum: 1,
      p10: 1.4,
      p25: 2,
      median: 3,
      p75: 4,
      p90: 4.6,
      maximum: 5,
    })
    expect(summarize([]).count).toBe(0)
  })

  it('derives stable leader gaps from ranked or unordered inputs', () => {
    const result = deriveLeaderSeparation([1, 10, 2, 9, 3, 8, 4, 7, 5, 6])

    expect(result.leader).toBe(10)
    expect(result.second).toBe(9)
    expect(result.topFiveAverage).toBe(8)
    expect(result.topTenAverage).toBe(5.5)
    expect(result.leaderMinusTopFiveAverage).toBe(2)
    expect(result.leaderToTopTenAverage).toBeCloseTo(10 / 5.5)
  })

  it('derives opportunity-adjusted rates safely', () => {
    expect(per40(12, 30)).toBe(16)
    expect(per40(12, 0)).toBe(0)
  })

  it('calculates correlations and guards invalid input', () => {
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(pearsonCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1)
    expect(pearsonCorrelation([1], [2])).toBe(0)
    expect(() => pearsonCorrelation([1], [1, 2])).toThrow(RangeError)
  })
})
