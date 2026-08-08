import {
  calculateOverall,
  MAX_PLAYER_RATING,
  MIN_PLAYER_RATING,
  type ClassYear,
  type Player,
  type PlayerAttributes,
  type Position,
} from '../domain'
import type { Rng } from '../random'

export interface GeneratePlayerOptions {
  position: Position
  talentLevel: number
  classYear: ClassYear
  rng: Rng
}

type AttributeModifiers = Readonly<Record<keyof PlayerAttributes, number>>

interface PositionGenerationProfile {
  readonly minHeight: number
  readonly maxHeight: number
  readonly modifiers: AttributeModifiers
}

const FIRST_NAMES = [
  'Andre',
  'Caleb',
  'Cameron',
  'Darius',
  'Devin',
  'Elijah',
  'Isaiah',
  'Jalen',
  'Jordan',
  'Josiah',
  'Malcolm',
  'Marcus',
  'Micah',
  'Miles',
  'Noah',
  'Quentin',
  'Terrence',
  'Trey',
] as const

const LAST_NAMES = [
  'Banks',
  'Bennett',
  'Brooks',
  'Carter',
  'Coleman',
  'Davis',
  'Ellis',
  'Foster',
  'Grant',
  'Hayes',
  'Holloway',
  'Jefferson',
  'Lawson',
  'Mitchell',
  'Reed',
  'Robinson',
  'Turner',
  'Warren',
] as const

/** Position baselines; height values are total inches. */
const POSITION_PROFILES = {
  PG: {
    minHeight: 70,
    maxHeight: 77,
    modifiers: {
      finishing: -2,
      shooting: 4,
      playmaking: 8,
      ballHandling: 10,
      perimeterDefense: 2,
      interiorDefense: -18,
      rebounding: -14,
      athleticism: 2,
      stamina: 0,
    },
  },
  SG: {
    minHeight: 73,
    maxHeight: 79,
    modifiers: {
      finishing: 6,
      shooting: 9,
      playmaking: -3,
      ballHandling: 3,
      perimeterDefense: 3,
      interiorDefense: -12,
      rebounding: -7,
      athleticism: 2,
      stamina: 0,
    },
  },
  SF: {
    minHeight: 76,
    maxHeight: 81,
    modifiers: {
      finishing: 2,
      shooting: 2,
      playmaking: 0,
      ballHandling: 0,
      perimeterDefense: 2,
      interiorDefense: 0,
      rebounding: 0,
      athleticism: 3,
      stamina: 0,
    },
  },
  PF: {
    minHeight: 78,
    maxHeight: 83,
    modifiers: {
      finishing: 8,
      shooting: -6,
      playmaking: -10,
      ballHandling: -10,
      perimeterDefense: -3,
      interiorDefense: 8,
      rebounding: 9,
      athleticism: 4,
      stamina: 0,
    },
  },
  C: {
    minHeight: 80,
    maxHeight: 86,
    modifiers: {
      finishing: 8,
      shooting: -16,
      playmaking: -16,
      ballHandling: -18,
      perimeterDefense: -6,
      interiorDefense: 12,
      rebounding: 13,
      athleticism: 3,
      stamina: 0,
    },
  },
} as const satisfies Readonly<Record<Position, PositionGenerationProfile>>

function clampRating(rating: number): number {
  return Math.min(MAX_PLAYER_RATING, Math.max(MIN_PLAYER_RATING, rating))
}

function attributeVariance(rng: Rng): number {
  return rng.int(-8, 8) + rng.int(-4, 4)
}

function generateRawAttributes(
  talentLevel: number,
  modifiers: AttributeModifiers,
  rng: Rng,
): PlayerAttributes {
  const generateRating = (modifier: number) =>
    clampRating(Math.round(talentLevel + modifier + attributeVariance(rng)))

  return {
    finishing: generateRating(modifiers.finishing),
    shooting: generateRating(modifiers.shooting),
    playmaking: generateRating(modifiers.playmaking),
    ballHandling: generateRating(modifiers.ballHandling),
    perimeterDefense: generateRating(modifiers.perimeterDefense),
    interiorDefense: generateRating(modifiers.interiorDefense),
    rebounding: generateRating(modifiers.rebounding),
    athleticism: generateRating(modifiers.athleticism),
    stamina: generateRating(modifiers.stamina),
  }
}

function shiftAttributes(
  attributes: PlayerAttributes,
  adjustment: number,
): PlayerAttributes {
  return {
    finishing: clampRating(attributes.finishing + adjustment),
    shooting: clampRating(attributes.shooting + adjustment),
    playmaking: clampRating(attributes.playmaking + adjustment),
    ballHandling: clampRating(attributes.ballHandling + adjustment),
    perimeterDefense: clampRating(attributes.perimeterDefense + adjustment),
    interiorDefense: clampRating(attributes.interiorDefense + adjustment),
    rebounding: clampRating(attributes.rebounding + adjustment),
    athleticism: clampRating(attributes.athleticism + adjustment),
    stamina: clampRating(attributes.stamina + adjustment),
  }
}

function generatePlayerId(rng: Rng): string {
  const firstPart = rng.int(0, 0xffff_ffff).toString(16).padStart(8, '0')
  const secondPart = rng.int(0, 0xffff_ffff).toString(16).padStart(8, '0')

  return `player-${firstPart}${secondPart}`
}

function generatePotential(currentOverall: number, rng: Rng): number {
  const difference = rng.chance(0.15) ? -rng.int(1, 6) : rng.int(0, 12)

  return clampRating(currentOverall + difference)
}

function assertTalentLevel(talentLevel: number): void {
  if (
    !Number.isFinite(talentLevel) ||
    talentLevel < MIN_PLAYER_RATING ||
    talentLevel > MAX_PLAYER_RATING
  ) {
    throw new RangeError(
      `talentLevel must be between ${MIN_PLAYER_RATING} and ${MAX_PLAYER_RATING}`,
    )
  }
}

/** Generates one fictional player while advancing only the supplied RNG. */
export function generatePlayer({
  position,
  talentLevel,
  classYear,
  rng,
}: GeneratePlayerOptions): Player {
  assertTalentLevel(talentLevel)

  const profile = POSITION_PROFILES[position]
  const basePlayer: Player = {
    id: generatePlayerId(rng),
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    position,
    classYear,
    height: rng.int(profile.minHeight, profile.maxHeight),
    attributes: generateRawAttributes(talentLevel, profile.modifiers, rng),
    potential: MIN_PLAYER_RATING,
  }

  const targetOverall = Math.round(talentLevel)
  const overallAdjustment = targetOverall - calculateOverall(basePlayer)
  const attributes = shiftAttributes(basePlayer.attributes, overallAdjustment)
  const currentOverall = calculateOverall({ ...basePlayer, attributes })

  return {
    ...basePlayer,
    attributes,
    potential: generatePotential(currentOverall, rng),
  }
}

