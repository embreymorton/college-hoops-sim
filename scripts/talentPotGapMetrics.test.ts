import { describe, expect, it } from 'vitest'
import {
  potGapBucket,
  summarizeRecruitPotGaps,
  type RecruitTalentObservation,
} from './talentPotGapMetrics'

describe('Recruit POT-gap metrics', () => {
  it.each([
    [0, '0'],
    [1, '1-3'],
    [3, '1-3'],
    [4, '4-7'],
    [7, '4-7'],
    [8, '8-12'],
    [12, '8-12'],
    [13, '13+'],
  ] as const)('buckets gap %s as %s', (gap, bucket) => {
    expect(potGapBucket(gap)).toBe(bucket)
  })

  it('rejects negative gaps instead of hiding an invariant failure', () => {
    expect(() => potGapBucket(-1)).toThrow(/negative/i)
  })

  it('uses canonical stars and OVR thresholds with cohort denominators', () => {
    const rows: RecruitTalentObservation[] = [
      { stars: 5, overall: 90, potential: 90 },
      { stars: 5, overall: 86, potential: 89 },
      { stars: 4, overall: 80, potential: 87 },
      { stars: 4, overall: 79, potential: 92 },
    ]
    const summaries = summarizeRecruitPotGaps(rows)
    const all = summaries.find(({ key }) => key === 'all')!
    const fiveStar = summaries.find(({ key }) => key === 'fiveStar')!
    const ovr85 = summaries.find(({ key }) => key === 'ovr85')!
    const ovr90 = summaries.find(({ key }) => key === 'ovr90')!

    expect(all).toMatchObject({ count: 4, mean: 5.75, median: 5 })
    expect(all.buckets['0']).toEqual({ count: 1, rate: 0.25 })
    expect(all.buckets['13+']).toEqual({ count: 1, rate: 0.25 })
    expect(fiveStar).toMatchObject({ count: 2, minimum: 0, maximum: 3 })
    expect(ovr85.count).toBe(2)
    expect(ovr90.count).toBe(1)
  })

  it('returns safe zero summaries for an empty cohort and deterministic output', () => {
    const rows: RecruitTalentObservation[] = [
      { stars: 3, overall: 70, potential: 78 },
    ]
    const first = summarizeRecruitPotGaps(rows)
    const second = summarizeRecruitPotGaps(rows)
    const fiveStar = first.find(({ key }) => key === 'fiveStar')!

    expect(second).toEqual(first)
    expect(fiveStar).toMatchObject({
      count: 0,
      mean: 0,
      median: 0,
      minimum: 0,
      maximum: 0,
    })
    expect(Object.values(fiveStar.buckets)).toEqual(
      Array.from({ length: 5 }, () => ({ count: 0, rate: 0 })),
    )
  })
})
