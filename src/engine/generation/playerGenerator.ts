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
  readonly talentOffset: number
  readonly modifiers: AttributeModifiers
}

const FIRST_NAMES = [
  'Aaron',
  'Adrian',
  'Aiden',
  'Amir',
  'Andre',
  'Anthony',
  'Ashton',
  'Avery',
  'Brandon',
  'Bryce',
  'Caleb',
  'Cameron',
  'Carter',
  'Cedric',
  'Christian',
  'Cole',
  'Connor',
  'Darius',
  'Darren',
  'Darnell',
  'Davion',
  'DeAndre',
  'Desmond',
  'Devin',
  'Dominic',
  'Donovan',
  'Easton',
  'Elijah',
  'Emanuel',
  'Eric',
  'Evan',
  'Gavin',
  'Grant',
  'Ian',
  'Isaiah',
  'Jace',
  'Jalen',
  'Jamal',
  'James',
  'Jared',
  'Jason',
  'Jayden',
  'Jeremiah',
  'Jordan',
  'Josiah',
  'Julian',
  'Justin',
  'Kaden',
  'Kai',
  'Kameron',
  'Keenan',
  'Keith',
  'Kevin',
  'Khalil',
  'Kobe',
  'Landon',
  'Leo',
  'Liam',
  'Logan',
  'Lucas',
  'Malik',
  'Malcolm',
  'Marcus',
  'Mason',
  'Maxwell',
  'Micah',
  'Miles',
  'Nasir',
  'Nathan',
  'Noah',
  'Nolan',
  'Omari',
  'Owen',
  'Parker',
  'Paul',
  'Quentin',
  'Rashad',
  'Reece',
  'Roman',
  'Rylan',
  'Samuel',
  'Sean',
  'Seth',
  'Shawn',
  'Silas',
  'Spencer',
  'Tariq',
  'Terrence',
  'Theo',
  'Tobias',
  'Travis',
  'Trent',
  'Trey',
  'Tristan',
  'Tyler',
  'Victor',
  'Xavier',
  'Zaire',
  'Zane',
] as const

const LAST_NAMES = [
  'Adams',
  'Allen',
  'Anderson',
  'Armstrong',
  'Bailey',
  'Baker',
  'Banks',
  'Barnes',
  'Barrett',
  'Bell',
  'Bennett',
  'Bishop',
  'Black',
  'Boone',
  'Bradley',
  'Brooks',
  'Brown',
  'Bryant',
  'Burke',
  'Butler',
  'Campbell',
  'Carter',
  'Chambers',
  'Chapman',
  'Clark',
  'Clayton',
  'Coleman',
  'Collins',
  'Cook',
  'Cooper',
  'Crawford',
  'Cruz',
  'Daniels',
  'Davis',
  'Dawson',
  'Dixon',
  'Douglas',
  'Dunn',
  'Edwards',
  'Ellis',
  'Evans',
  'Fields',
  'Fisher',
  'Fleming',
  'Fletcher',
  'Ford',
  'Foster',
  'Franklin',
  'Freeman',
  'Garcia',
  'Gardner',
  'Gibson',
  'Gill',
  'Gordon',
  'Graham',
  'Grant',
  'Gray',
  'Green',
  'Griffin',
  'Hall',
  'Hamilton',
  'Harris',
  'Hart',
  'Hayes',
  'Henderson',
  'Henry',
  'Hill',
  'Hines',
  'Holland',
  'Holloway',
  'Holmes',
  'Howard',
  'Hudson',
  'Hughes',
  'Hunt',
  'Jackson',
  'Jefferson',
  'Jenkins',
  'Johnson',
  'Jones',
  'Jordan',
  'Kelley',
  'Kennedy',
  'King',
  'Knight',
  'Lane',
  'Lawson',
  'Lee',
  'Lewis',
  'Long',
  'Marshall',
  'Martin',
  'Mason',
  'Matthews',
  'McBride',
  'McDaniel',
  'Miller',
  'Mitchell',
  'Moore',
  'Morgan',
  'Morris',
  'Murphy',
  'Murray',
  'Nelson',
  'Newman',
  'Nichols',
  'Oliver',
  'Owens',
  'Palmer',
  'Parker',
  'Patterson',
  'Payne',
  'Perry',
  'Peterson',
  'Phillips',
  'Porter',
  'Powell',
  'Price',
  'Reed',
  'Reynolds',
  'Richardson',
  'Riley',
  'Rivera',
  'Roberts',
  'Robinson',
  'Rogers',
  'Ross',
  'Russell',
  'Sanders',
  'Scott',
  'Shaw',
  'Simmons',
  'Smith',
  'Spencer',
  'Stewart',
  'Stone',
  'Taylor',
  'Thomas',
  'Thompson',
  'Turner',
  'Walker',
  'Wallace',
  'Ward',
  'Warren',
  'Washington',
  'Watson',
  'Webb',
  'Wells',
  'West',
  'White',
  'Williams',
  'Wilson',
  'Woods',
  'Wright',
  'Young',
] as const

export const PLAYER_NAME_POOL_COUNTS = {
  firstNames: FIRST_NAMES.length,
  lastNames: LAST_NAMES.length,
  combinations: FIRST_NAMES.length * LAST_NAMES.length,
} as const

/** Position baselines; height values are total inches. */
const POSITION_PROFILES = {
  PG: {
    minHeight: 70,
    maxHeight: 77,
    talentOffset: -4,
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
    talentOffset: -4,
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
    talentOffset: -1,
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
    talentOffset: -4,
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
    talentOffset: -6,
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

function boundGeneratedRating(rating: number, rng: Rng): number {
  const roundedRating = Math.round(rating)

  if (roundedRating <= MIN_PLAYER_RATING) {
    return rng.int(MIN_PLAYER_RATING, MIN_PLAYER_RATING + 6)
  }

  return clampRating(roundedRating)
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
    boundGeneratedRating(
      talentLevel + modifier + attributeVariance(rng),
      rng,
    )

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

function generatePlayerId(rng: Rng): string {
  const firstPart = rng.int(0, 0xffff_ffff).toString(16).padStart(8, '0')
  const secondPart = rng.int(0, 0xffff_ffff).toString(16).padStart(8, '0')

  return `player-${firstPart}${secondPart}`
}

const POTENTIAL_UPSIDE_RANGES = {
  FR: [6, 15],
  SO: [4, 11],
  JR: [1, 7],
  SR: [0, 3],
} as const satisfies Readonly<Record<ClassYear, readonly [number, number]>>

function generatePotential(
  currentOverall: number,
  classYear: ClassYear,
  rng: Rng,
): number {
  const [minimumUpside, maximumUpside] = POTENTIAL_UPSIDE_RANGES[classYear]
  const difference = rng.int(minimumUpside, maximumUpside)

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
    attributes: generateRawAttributes(
      talentLevel + profile.talentOffset,
      profile.modifiers,
      rng,
    ),
    potential: MIN_PLAYER_RATING,
  }

  const currentOverall = calculateOverall(basePlayer)

  return {
    ...basePlayer,
    potential: generatePotential(currentOverall, classYear, rng),
  }
}
