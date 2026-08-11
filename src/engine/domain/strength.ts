import {
  assertValidPlayerAttributes,
  type Player,
  type PlayerAttributes,
  type Position,
} from './player'
import { TOTAL_ROTATION_MINUTES } from './rotation'
import {
  derivePlayerMinutes,
  validateRotationInput,
  type AggregatePlayerMinutes,
  type RotationInput,
} from './rotationInput'
import type { Team } from './team'

type OffensiveAttribute =
  | 'finishing'
  | 'shooting'
  | 'playmaking'
  | 'ballHandling'
  | 'athleticism'
  | 'rebounding'

type DefensiveAttribute =
  | 'perimeterDefense'
  | 'interiorDefense'
  | 'rebounding'
  | 'athleticism'

type RatingWeights<Attribute extends keyof PlayerAttributes> = Readonly<
  Record<Attribute, number>
>

/**
 * v0.1 player offense weights. Every position sums to 1.00.
 *
 * | Pos | Fin | Sht | Ply | Hdl | Ath | Reb |
 * |-----|-----|-----|-----|-----|-----|-----|
 * | PG  | 10% | 25% | 27% | 25% | 10% |  3% |
 * | SG  | 23% | 33% | 10% | 18% | 12% |  4% |
 * | SF  | 24% | 24% | 14% | 14% | 16% |  8% |
 * | PF  | 36% | 20% |  6% |  6% | 20% | 12% |
 * | C   | 48% |  8% |  4% |  4% | 21% | 15% |
 */
const POSITION_OFFENSE_WEIGHTS = {
  PG: {
    finishing: 0.1,
    shooting: 0.25,
    playmaking: 0.27,
    ballHandling: 0.25,
    athleticism: 0.1,
    rebounding: 0.03,
  },
  SG: {
    finishing: 0.23,
    shooting: 0.33,
    playmaking: 0.1,
    ballHandling: 0.18,
    athleticism: 0.12,
    rebounding: 0.04,
  },
  SF: {
    finishing: 0.24,
    shooting: 0.24,
    playmaking: 0.14,
    ballHandling: 0.14,
    athleticism: 0.16,
    rebounding: 0.08,
  },
  PF: {
    finishing: 0.36,
    shooting: 0.2,
    playmaking: 0.06,
    ballHandling: 0.06,
    athleticism: 0.2,
    rebounding: 0.12,
  },
  C: {
    finishing: 0.48,
    shooting: 0.08,
    playmaking: 0.04,
    ballHandling: 0.04,
    athleticism: 0.21,
    rebounding: 0.15,
  },
} as const satisfies Readonly<
  Record<Position, RatingWeights<OffensiveAttribute>>
>

/**
 * v0.1 player defense weights. Every position sums to 1.00.
 *
 * | Pos | PerD | IntD | Reb | Ath |
 * |-----|------|------|-----|-----|
 * | PG  |  60% |   3% |  5% | 32% |
 * | SG  |  55% |   5% | 10% | 30% |
 * | SF  |  34% |  23% | 20% | 23% |
 * | PF  |  12% |  40% | 28% | 20% |
 * | C   |   5% |  47% | 30% | 18% |
 */
const POSITION_DEFENSE_WEIGHTS = {
  PG: {
    perimeterDefense: 0.6,
    interiorDefense: 0.03,
    rebounding: 0.05,
    athleticism: 0.32,
  },
  SG: {
    perimeterDefense: 0.55,
    interiorDefense: 0.05,
    rebounding: 0.1,
    athleticism: 0.3,
  },
  SF: {
    perimeterDefense: 0.34,
    interiorDefense: 0.23,
    rebounding: 0.2,
    athleticism: 0.23,
  },
  PF: {
    perimeterDefense: 0.12,
    interiorDefense: 0.4,
    rebounding: 0.28,
    athleticism: 0.2,
  },
  C: {
    perimeterDefense: 0.05,
    interiorDefense: 0.47,
    rebounding: 0.3,
    athleticism: 0.18,
  },
} as const satisfies Readonly<
  Record<Position, RatingWeights<DefensiveAttribute>>
>

export interface TeamStrength {
  readonly offense: number
  readonly defense: number
  readonly overall: number
}

/** Derives offensive basketball skill without potential, class, or stamina. */
export function calculatePlayerOffense(player: Player): number {
  const { attributes } = player
  const weights = POSITION_OFFENSE_WEIGHTS[player.position]

  assertValidPlayerAttributes(attributes)

  return (
    attributes.finishing * weights.finishing +
    attributes.shooting * weights.shooting +
    attributes.playmaking * weights.playmaking +
    attributes.ballHandling * weights.ballHandling +
    attributes.athleticism * weights.athleticism +
    attributes.rebounding * weights.rebounding
  )
}

/** Derives defensive basketball skill without offensive or future attributes. */
export function calculatePlayerDefense(player: Player): number {
  const { attributes } = player
  const weights = POSITION_DEFENSE_WEIGHTS[player.position]

  assertValidPlayerAttributes(attributes)

  return (
    attributes.perimeterDefense * weights.perimeterDefense +
    attributes.interiorDefense * weights.interiorDefense +
    attributes.rebounding * weights.rebounding +
    attributes.athleticism * weights.athleticism
  )
}

function assertValidStrengthRotation(
  team: Team,
  rotation: RotationInput,
): void {
  const validation = validateRotationInput(team, rotation)

  if (!validation.valid) {
    throw new RangeError(
      `Cannot calculate team strength: ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }
}

function calculateTeamRating(
  team: Team,
  playerMinutes: AggregatePlayerMinutes,
  calculatePlayerRating: (player: Player) => number,
): number {
  return (
    team.roster.reduce((total, player) => {
      const minutes = playerMinutes[player.id] ?? 0

      return minutes === 0
        ? total
        : total + calculatePlayerRating(player) * minutes
    }, 0) / TOTAL_ROTATION_MINUTES
  )
}

/** Calculates rotation-weighted team offense from exactly 200 minutes. */
export function calculateTeamOffense(
  team: Team,
  rotation: RotationInput,
): number {
  assertValidStrengthRotation(team, rotation)
  return calculateTeamRating(
    team,
    derivePlayerMinutes(rotation),
    calculatePlayerOffense,
  )
}

/** Calculates rotation-weighted team defense from exactly 200 minutes. */
export function calculateTeamDefense(
  team: Team,
  rotation: RotationInput,
): number {
  assertValidStrengthRotation(team, rotation)
  return calculateTeamRating(
    team,
    derivePlayerMinutes(rotation),
    calculatePlayerDefense,
  )
}

/** Returns primary OFF/DEF ratings and their balanced summary average. */
export function calculateTeamStrength(
  team: Team,
  rotation: RotationInput,
): TeamStrength {
  assertValidStrengthRotation(team, rotation)
  const playerMinutes = derivePlayerMinutes(rotation)

  const offense = calculateTeamRating(
    team,
    playerMinutes,
    calculatePlayerOffense,
  )
  const defense = calculateTeamRating(
    team,
    playerMinutes,
    calculatePlayerDefense,
  )

  return {
    offense,
    defense,
    overall: (offense + defense) / 2,
  }
}
