import { summarizeDistribution } from './dynastyLongRunMetrics'

export type PotGapCohortKey = 'all' | 'fiveStar' | 'fourStar' | 'ovr80' | 'ovr85' | 'ovr90'
export type PotGapBucketKey = '0' | '1-3' | '4-7' | '8-12' | '13+'

export interface RecruitTalentObservation {
  readonly stars: 2 | 3 | 4 | 5
  readonly overall: number
  readonly potential: number
}

export interface PotGapBucketSummary {
  readonly count: number
  readonly rate: number
}

export interface PotGapCohortSummary {
  readonly key: PotGapCohortKey
  readonly label: string
  readonly count: number
  readonly buckets: Readonly<Record<PotGapBucketKey, PotGapBucketSummary>>
  readonly mean: number
  readonly median: number
  readonly minimum: number
  readonly maximum: number
  readonly p25: number
  readonly p75: number
}

const BUCKET_KEYS: readonly PotGapBucketKey[] = ['0', '1-3', '4-7', '8-12', '13+']

export function potGapBucket(gap: number): PotGapBucketKey {
  if (gap < 0) throw new RangeError(`POT gap must not be negative; received ${gap}.`)
  if (gap === 0) return '0'
  if (gap <= 3) return '1-3'
  if (gap <= 7) return '4-7'
  if (gap <= 12) return '8-12'
  return '13+'
}

const COHORTS: readonly {
  readonly key: PotGapCohortKey
  readonly label: string
  readonly includes: (row: RecruitTalentObservation) => boolean
}[] = [
  { key: 'all', label: 'All', includes: () => true },
  { key: 'fiveStar', label: '5★', includes: ({ stars }) => stars === 5 },
  { key: 'fourStar', label: '4★', includes: ({ stars }) => stars === 4 },
  { key: 'ovr80', label: 'OVR 80+', includes: ({ overall }) => overall >= 80 },
  { key: 'ovr85', label: 'OVR 85+', includes: ({ overall }) => overall >= 85 },
  { key: 'ovr90', label: 'OVR 90+', includes: ({ overall }) => overall >= 90 },
]

/** Pure aggregation for the production Recruit diagnostic. Rates use each cohort's n. */
export function summarizeRecruitPotGaps(
  observations: readonly RecruitTalentObservation[],
): readonly PotGapCohortSummary[] {
  const rows = observations.map((row) => {
    const gap = row.potential - row.overall
    potGapBucket(gap)
    return { ...row, gap }
  })

  return COHORTS.map((cohort) => {
    const cohortRows = rows.filter(cohort.includes)
    const gaps = cohortRows.map(({ gap }) => gap)
    const distribution = summarizeDistribution(gaps)
    const buckets = Object.fromEntries(
      BUCKET_KEYS.map((key) => {
        const count = gaps.filter((gap) => potGapBucket(gap) === key).length
        return [key, { count, rate: gaps.length === 0 ? 0 : count / gaps.length }]
      }),
    ) as Record<PotGapBucketKey, PotGapBucketSummary>

    return {
      key: cohort.key,
      label: cohort.label,
      count: gaps.length,
      buckets,
      mean: distribution.average,
      median: distribution.median,
      minimum: distribution.minimum,
      maximum: distribution.maximum,
      p25: distribution.p25,
      p75: distribution.p75,
    }
  })
}
