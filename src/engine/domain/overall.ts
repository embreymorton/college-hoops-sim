import {
  assertValidPlayerAttributes,
  type Player,
  type PlayerAttributes,
  type Position,
} from './player'

type AttributeWeights = Readonly<Record<keyof PlayerAttributes, number>>

/**
 * Position weights used by calculateOverall. Values sum to 1.00 per position.
 *
 * | Pos | Fin | Sht | Ply | Hdl | PerD | IntD | Reb | Ath | Sta |
 * |-----|-----|-----|-----|-----|------|------|-----|-----|-----|
 * | PG  |  8% | 18% | 22% | 22% |  14% |   2% |  3% |  6% |  5% |
 * | SG  | 18% | 24% |  8% | 15% |  17% |   3% |  4% |  7% |  4% |
 * | SF  | 14% | 14% | 10% | 10% |  13% |  10% | 11% | 11% |  7% |
 * | PF  | 20% |  7% |  5% |  5% |   7% |  17% | 19% | 14% |  6% |
 * | C   | 19% |  3% |  4% |  3% |   5% |  23% | 23% | 14% |  6% |
 */
const POSITION_WEIGHTS = {
  PG: {
    finishing: 0.08,
    shooting: 0.18,
    playmaking: 0.22,
    ballHandling: 0.22,
    perimeterDefense: 0.14,
    interiorDefense: 0.02,
    rebounding: 0.03,
    athleticism: 0.06,
    stamina: 0.05,
  },
  SG: {
    finishing: 0.18,
    shooting: 0.24,
    playmaking: 0.08,
    ballHandling: 0.15,
    perimeterDefense: 0.17,
    interiorDefense: 0.03,
    rebounding: 0.04,
    athleticism: 0.07,
    stamina: 0.04,
  },
  SF: {
    finishing: 0.14,
    shooting: 0.14,
    playmaking: 0.1,
    ballHandling: 0.1,
    perimeterDefense: 0.13,
    interiorDefense: 0.1,
    rebounding: 0.11,
    athleticism: 0.11,
    stamina: 0.07,
  },
  PF: {
    finishing: 0.2,
    shooting: 0.07,
    playmaking: 0.05,
    ballHandling: 0.05,
    perimeterDefense: 0.07,
    interiorDefense: 0.17,
    rebounding: 0.19,
    athleticism: 0.14,
    stamina: 0.06,
  },
  C: {
    finishing: 0.19,
    shooting: 0.03,
    playmaking: 0.04,
    ballHandling: 0.03,
    perimeterDefense: 0.05,
    interiorDefense: 0.23,
    rebounding: 0.23,
    athleticism: 0.14,
    stamina: 0.06,
  },
} as const satisfies Readonly<Record<Position, AttributeWeights>>

/** Calculates current ability; potential deliberately has no effect. */
export function calculateOverall(player: Player): number {
  const { attributes } = player
  const weights = POSITION_WEIGHTS[player.position]

  assertValidPlayerAttributes(attributes)

  const weightedRating =
    attributes.finishing * weights.finishing +
    attributes.shooting * weights.shooting +
    attributes.playmaking * weights.playmaking +
    attributes.ballHandling * weights.ballHandling +
    attributes.perimeterDefense * weights.perimeterDefense +
    attributes.interiorDefense * weights.interiorDefense +
    attributes.rebounding * weights.rebounding +
    attributes.athleticism * weights.athleticism +
    attributes.stamina * weights.stamina

  return Math.round(weightedRating)
}
