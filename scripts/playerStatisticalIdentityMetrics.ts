export interface NumericSummary {
  readonly count: number
  readonly mean: number
  readonly minimum: number
  readonly p10: number
  readonly p25: number
  readonly median: number
  readonly p75: number
  readonly p90: number
  readonly maximum: number
}

export interface LeaderSeparation {
  readonly leader: number
  readonly second: number
  readonly topFiveAverage: number
  readonly topTenAverage: number
  readonly leaderMinusSecond: number
  readonly leaderMinusTopFiveAverage: number
  readonly leaderMinusTopTenAverage: number
  readonly leaderToTopTenAverage: number
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length
}

export function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return 0
  if (!Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
    throw new RangeError('quantile must be between 0 and 1')
  }

  const sorted = values.slice().sort((first, second) => first - second)
  const index = (sorted.length - 1) * quantile
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)
  const lower = sorted[lowerIndex]!
  const upper = sorted[upperIndex]!

  return lower + (upper - lower) * (index - lowerIndex)
}

export function summarize(values: readonly number[]): NumericSummary {
  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      minimum: 0,
      p10: 0,
      p25: 0,
      median: 0,
      p75: 0,
      p90: 0,
      maximum: 0,
    }
  }

  return {
    count: values.length,
    mean: average(values),
    minimum: Math.min(...values),
    p10: percentile(values, 0.1),
    p25: percentile(values, 0.25),
    median: percentile(values, 0.5),
    p75: percentile(values, 0.75),
    p90: percentile(values, 0.9),
    maximum: Math.max(...values),
  }
}

export function deriveLeaderSeparation(
  rankedValues: readonly number[],
): LeaderSeparation {
  if (rankedValues.length < 10) {
    throw new RangeError('leader separation requires at least 10 ranked values')
  }

  const ranked = rankedValues.slice().sort((first, second) => second - first)
  const leader = ranked[0]!
  const second = ranked[1]!
  const topFiveAverage = average(ranked.slice(0, 5))
  const topTenAverage = average(ranked.slice(0, 10))

  return {
    leader,
    second,
    topFiveAverage,
    topTenAverage,
    leaderMinusSecond: leader - second,
    leaderMinusTopFiveAverage: leader - topFiveAverage,
    leaderMinusTopTenAverage: leader - topTenAverage,
    leaderToTopTenAverage:
      topTenAverage === 0 ? 0 : leader / topTenAverage,
  }
}

export function per40(total: number, minutes: number): number {
  return minutes <= 0 ? 0 : (total / minutes) * 40
}

export function pearsonCorrelation(
  first: readonly number[],
  second: readonly number[],
): number {
  if (first.length !== second.length) {
    throw new RangeError('correlation inputs must have equal length')
  }
  if (first.length < 2) return 0

  const firstMean = average(first)
  const secondMean = average(second)
  let covariance = 0
  let firstVariance = 0
  let secondVariance = 0

  for (let index = 0; index < first.length; index += 1) {
    const firstDelta = first[index]! - firstMean
    const secondDelta = second[index]! - secondMean
    covariance += firstDelta * secondDelta
    firstVariance += firstDelta ** 2
    secondVariance += secondDelta ** 2
  }

  const denominator = Math.sqrt(firstVariance * secondVariance)
  return denominator === 0 ? 0 : covariance / denominator
}
