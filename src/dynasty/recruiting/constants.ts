import type { Position } from '../../engine'
import type { RecruitStarRating } from './domain'

export const RECRUITING_V0_VERSION = 'v0'
export const REGULAR_SEASON_RECRUITING_PERIODS = 24
export const POSTSEASON_RECRUITING_PERIODS = 4
export const FINAL_RECRUITING_PERIOD =
  REGULAR_SEASON_RECRUITING_PERIODS + POSTSEASON_RECRUITING_PERIODS
export const RECRUITING_BOARD_LIMIT = 10
export const MIN_RECRUITING_PRIORITY = 1
export const MAX_RECRUITING_PRIORITY = 5
export const RECRUITING_EFFORT_PER_PERIOD = 18
export const MIN_MEANINGFUL_RELATIONSHIP = 8

export const RECRUIT_SUPPLY_MULTIPLIER = 1.65
export const MIN_RECRUITS_PER_POSITION = 18

export const DECISION_READY_PERIOD_RANGES = {
  2: [4, 15],
  3: [7, 18],
  4: [10, 22],
  5: [11, 24],
} as const satisfies Readonly<
  Record<RecruitStarRating, readonly [number, number]>
>

export const COMMITMENT_STANDING_RANGES = {
  2: [42, 58],
  3: [56, 75],
  4: [74, 96],
  5: [64, 92],
} as const satisfies Readonly<
  Record<RecruitStarRating, readonly [number, number]>
>

export const COMMITMENT_SEPARATION_RANGES = {
  2: [2, 7],
  3: [4, 9],
  4: [6, 12],
  5: [4, 9],
} as const satisfies Readonly<
  Record<RecruitStarRating, readonly [number, number]>
>

export const PRESTIGE_SENSITIVITY = {
  2: 0.1,
  3: 0.18,
  4: 0.29,
  5: 0.3,
} as const satisfies Readonly<Record<RecruitStarRating, number>>

export const EMPTY_POSITION_COUNTS = {
  PG: 0,
  SG: 0,
  SF: 0,
  PF: 0,
  C: 0,
} as const satisfies Readonly<Record<Position, number>>
