import {
  calculateOverall,
  createRng,
  MAX_PLAYER_RATING,
  type ClassYear,
  type Player,
  type PlayerAttributes,
  type Position,
  type Rng,
} from '../engine'
import { clonePlayer } from './cloning'
import type {
  DevelopReturningPlayerOptions,
  PlayerAttributeDevelopmentGain,
  PlayerDevelopmentSummary,
  OffseasonDevelopmentExplosion,
} from './domain'

type ReturningClass = Exclude<ClassYear, 'SR'>
type AttributeName = keyof PlayerAttributes

const ATTRIBUTE_NAMES: readonly AttributeName[] = [
  'finishing',
  'shooting',
  'playmaking',
  'ballHandling',
  'perimeterDefense',
  'interiorDefense',
  'rebounding',
  'athleticism',
  'stamina',
]

const NEXT_CLASS = {
  FR: 'SO',
  SO: 'JR',
  JR: 'SR',
} as const satisfies Readonly<Record<ReturningClass, ClassYear>>

const CLASS_BASE_GAIN_RANGE = {
  FR: [1, 4],
  SO: [1, 3],
  JR: [0, 2],
} as const satisfies Readonly<Record<ReturningClass, readonly [number, number]>>

const HEADROOM_OPPORTUNITY_MULTIPLIER = {
  FR: 1.2,
  SO: 0.9,
  JR: 0.65,
} as const satisfies Readonly<Record<ReturningClass, number>>

const BREAKOUT_CHANCE = {
  FR: 0.05,
  SO: 0.03,
  JR: 0.01,
} as const satisfies Readonly<Record<ReturningClass, number>>

export const EXPLOSION_ELIGIBILITY_HEADROOM = 12
export const EXPLOSION_CHANCE = 0.045
export const ORDINARY_DEVELOPMENT_CAP = {
  FR: 12,
  SO: 10,
  JR: 8,
} as const satisfies Readonly<Record<ReturningClass, number>>
export const EXPLOSION_TOTAL_GAIN_CAP = {
  FR: 20,
  SO: 18,
  JR: 16,
} as const satisfies Readonly<Record<ReturningClass, number>>

export type DevelopmentTendency = 'weak' | 'steady' | 'strong'

interface TendencyProfile {
  readonly band: DevelopmentTendency
  readonly opportunityMultiplier: number
  readonly baselineAdjustment: number
  readonly breakoutMultiplier: number
}

const TENDENCY_PROFILES: Readonly<Record<DevelopmentTendency, TendencyProfile>> = {
  weak: { band: 'weak', opportunityMultiplier: 0.4, baselineAdjustment: -1, breakoutMultiplier: 0.3 },
  steady: { band: 'steady', opportunityMultiplier: 1, baselineAdjustment: 0, breakoutMultiplier: 1 },
  strong: { band: 'strong', opportunityMultiplier: 2.1, baselineAdjustment: 2, breakoutMultiplier: 2 },
}

/** Relative opportunity only; all nine attributes always retain non-zero weight. */
const POSITION_DEVELOPMENT_WEIGHTS = {
  PG: [2, 5, 6, 6, 4, 1, 1, 3, 2],
  SG: [5, 6, 2, 4, 5, 1, 1, 3, 2],
  SF: [4, 4, 3, 3, 4, 3, 3, 4, 2],
  PF: [6, 2, 1, 1, 2, 5, 6, 5, 3],
  C: [5, 1, 1, 1, 1, 7, 7, 5, 3],
} as const satisfies Readonly<Record<Position, readonly number[]>>

function assertSeed(seed: number | string): void {
  if (typeof seed === 'number' && !Number.isFinite(seed)) {
    throw new RangeError('Dynasty seed must be a finite number or a string.')
  }
}

function developmentSeed(
  options: Omit<DevelopReturningPlayerOptions, 'player'> & { playerId: string },
): string {
  assertSeed(options.dynastySeed)
  return JSON.stringify({
    namespace: 'college-hoops-sim:player-development:v1',
    dynastySeed: {
      type: typeof options.dynastySeed === 'number' ? 'number' : 'string',
      value: options.dynastySeed,
    },
    completedSeasonNumber: options.completedSeasonNumber,
    programId: options.programId,
    playerId: options.playerId,
  })
}

function explosionSeed(
  options: Omit<DevelopReturningPlayerOptions, 'player'> & { playerId: string },
  namespace: 'roll' | 'magnitude' | 'allocation',
): string {
  assertSeed(options.dynastySeed)
  return JSON.stringify({
    namespace: `college-hoops-sim:player-development-explosion:${namespace}:v1`,
    dynastySeed: {
      type: typeof options.dynastySeed === 'number' ? 'number' : 'string',
      value: options.dynastySeed,
    },
    completedSeasonNumber: options.completedSeasonNumber,
    programId: options.programId,
    playerId: options.playerId,
  })
}

function tendencySeed(dynastySeed: number | string, playerId: string): string {
  return JSON.stringify({
    namespace: 'college-hoops-sim:player-development-tendency:v1',
    dynastySeed: {
      type: typeof dynastySeed === 'number' ? 'number' : 'string',
      value: dynastySeed,
    },
    playerId,
  })
}

/** Stable hidden career tendency; it shifts opportunity without guaranteeing outcomes. */
export function deriveDevelopmentTendency(
  player: Pick<Player, 'id'>,
  dynastySeed: number | string,
): DevelopmentTendency {
  assertSeed(dynastySeed)
  const roll = createRng(tendencySeed(dynastySeed, player.id)).next()
  return roll < 0.3 ? 'weak' : roll < 0.8 ? 'steady' : 'strong'
}

/** Accepted high-POT realization opportunity; headroom keeps POT aspirational. */
export function deriveHighPotentialDevelopmentOpportunity(
  potential: number,
  headroom: number,
): number {
  if (potential < 85 || headroom < 8) return 0
  return potential >= 90 && headroom >= 12 ? 2 : 1
}

function weightedAttribute(
  position: Position,
  attributes: PlayerAttributes,
  gains: Readonly<Record<AttributeName, number>>,
  rng: Rng,
): AttributeName | undefined {
  const candidates = ATTRIBUTE_NAMES.flatMap((name, index) => {
    if (attributes[name] >= MAX_PLAYER_RATING) return []
    const baseWeight = POSITION_DEVELOPMENT_WEIGHTS[position][index] ?? 1
    return [{
      name,
      // Preserve positional identity while making large development more broadly plausible.
      weight: (baseWeight * (0.75 + rng.next() * 0.5)) / (1 + gains[name] * 0.35),
    }]
  })
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  if (total === 0) return undefined
  let draw = rng.next() * total
  for (const candidate of candidates) {
    draw -= candidate.weight
    if (draw < 0) return candidate.name
  }
  return candidates.at(-1)?.name
}

function allocateDevelopmentToOverall(
  source: Player,
  targetOverall: number,
  rng: Rng,
): Player {
  const developed = clonePlayer(source)
  const attributeGains = Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, 0])) as Record<AttributeName, number>
  const maximumAttempts = ATTRIBUTE_NAMES.length * MAX_PLAYER_RATING
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const overall = calculateOverall(developed)
    if (overall >= targetOverall || overall >= source.potential) break
    const attribute = weightedAttribute(developed.position, developed.attributes, attributeGains, rng)
    if (!attribute) break
    const candidate = clonePlayer(developed)
    candidate.attributes[attribute] += 1
    if (calculateOverall(candidate) <= source.potential) {
      developed.attributes[attribute] += 1
      attributeGains[attribute] += 1
    }
  }
  return developed
}

/** Pure D3-M2 mapping, exposed so the legendary +20 path can be locked by tests. */
export function deriveExplosionTargetTotalGain(
  tierRoll: number,
  magnitudeRoll: number,
): number {
  if (tierRoll < 0 || tierRoll >= 1 || magnitudeRoll < 0 || magnitudeRoll >= 1) {
    throw new RangeError('Explosion rolls must be in [0, 1).')
  }
  const inclusive = (minimum: number, maximum: number) =>
    minimum + Math.floor(magnitudeRoll * (maximum - minimum + 1))
  if (tierRoll < 0.58) return inclusive(8, 11)
  if (tierRoll < 0.92) return inclusive(12, 15)
  return inclusive(16, 20)
}

export interface ReturningPlayerExplosionResult {
  readonly player: Player
  readonly ordinaryPlayer: Player
  readonly explosion: OffseasonDevelopmentExplosion | null
}

export function deriveOffseasonExplosionRoll(options: DevelopReturningPlayerOptions): boolean {
  return createRng(explosionSeed({ ...options, playerId: options.player.id }, 'roll')).chance(EXPLOSION_CHANCE)
}

/** Applies an isolated rare event after byte-stable ordinary Development V1. */
export function developReturningPlayerWithExplosion(
  options: DevelopReturningPlayerOptions,
): ReturningPlayerExplosionResult {
  const ordinaryPlayer = developReturningPlayer(options)
  const before = options.player
  const completedClass = before.classYear
  if (completedClass === 'SR') {
    // developReturningPlayer owns the canonical error message for this case.
    return { player: ordinaryPlayer, ordinaryPlayer, explosion: null }
  }
  const previousOverall = calculateOverall(before)
  const ordinaryOverall = calculateOverall(ordinaryPlayer)
  const headroom = before.potential - previousOverall
  const ordinaryCap = ORDINARY_DEVELOPMENT_CAP[completedClass]
  if (headroom < EXPLOSION_ELIGIBILITY_HEADROOM || headroom <= ordinaryCap) {
    return { player: ordinaryPlayer, ordinaryPlayer, explosion: null }
  }
  const seedOptions = { ...options, playerId: before.id }
  if (!deriveOffseasonExplosionRoll(options)) {
    return { player: ordinaryPlayer, ordinaryPlayer, explosion: null }
  }
  const magnitudeRng = createRng(explosionSeed(seedOptions, 'magnitude'))
  const targetTotalGain = deriveExplosionTargetTotalGain(magnitudeRng.next(), magnitudeRng.next())
  const boundedTotalGain = Math.min(
    targetTotalGain,
    EXPLOSION_TOTAL_GAIN_CAP[completedClass],
    headroom,
  )
  if (boundedTotalGain <= ordinaryCap || previousOverall + boundedTotalGain <= ordinaryOverall) {
    return { player: ordinaryPlayer, ordinaryPlayer, explosion: null }
  }
  const player = allocateDevelopmentToOverall(
    ordinaryPlayer,
    previousOverall + boundedTotalGain,
    createRng(explosionSeed(seedOptions, 'allocation')),
  )
  const currentOverall = calculateOverall(player)
  const totalGain = currentOverall - previousOverall
  if (totalGain <= ordinaryCap) {
    return { player: ordinaryPlayer, ordinaryPlayer, explosion: null }
  }
  return {
    player,
    ordinaryPlayer,
    explosion: {
      completedSeasonNumber: options.completedSeasonNumber,
      programId: options.programId,
      playerId: before.id,
      completedClass,
      nextClass: player.classYear as 'SO' | 'JR' | 'SR',
      previousOverall,
      ordinaryOverall,
      currentOverall,
      ordinaryGain: ordinaryOverall - previousOverall,
      explosionContribution: currentOverall - ordinaryOverall,
      totalGain,
      potential: before.potential,
      targetTotalGain,
      potentialTruncation: Math.max(0, targetTotalGain - headroom),
    },
  }
}

/** Develops one non-senior through an independent, identity-namespaced RNG. */
export function developReturningPlayer({
  player,
  dynastySeed,
  completedSeasonNumber,
  programId,
}: DevelopReturningPlayerOptions): Player {
  if (player.classYear === 'SR') {
    throw new RangeError('Seniors graduate and cannot be developed as returners.')
  }
  if (!Number.isSafeInteger(completedSeasonNumber) || completedSeasonNumber < 1) {
    throw new RangeError('Completed season number must be a positive safe integer.')
  }

  const completedClass = player.classYear
  const currentOverall = calculateOverall(player)
  const developed = clonePlayer(player)
  developed.classYear = NEXT_CLASS[completedClass]

  if (currentOverall >= player.potential) return developed

  const rng = createRng(
    developmentSeed({
      dynastySeed,
      completedSeasonNumber,
      programId,
      playerId: player.id,
    }),
  )
  const tendency = TENDENCY_PROFILES[deriveDevelopmentTendency(player, dynastySeed)]
  const headroom = player.potential - currentOverall
  const [minimumGain, maximumGain] = CLASS_BASE_GAIN_RANGE[completedClass]
  const headroomOpportunity = Math.floor(
    (headroom / 8) * HEADROOM_OPPORTUNITY_MULTIPLIER[completedClass] *
      tendency.opportunityMultiplier,
  )
  const seasonalVariance = rng.int(-1, 1)
  const breakoutChance = BREAKOUT_CHANCE[completedClass] *
    Math.min(2, headroom / 20) * tendency.breakoutMultiplier
  const breakoutGain = headroom >= 8 && rng.chance(breakoutChance)
    ? rng.int(3, 6)
    : 0
  const highPotentialOpportunity = deriveHighPotentialDevelopmentOpportunity(
    player.potential,
    headroom,
  )
  const targetOverall = Math.min(
    player.potential,
    currentOverall + Math.max(
      0,
      Math.min(
        completedClass === 'FR' ? 12 : completedClass === 'SO' ? 10 : 8,
        rng.int(minimumGain, maximumGain) + tendency.baselineAdjustment +
        headroomOpportunity + seasonalVariance + breakoutGain +
        highPotentialOpportunity,
      ),
    ),
  )
  return allocateDevelopmentToOverall(developed, targetOverall, rng)
}

export function deriveDevelopmentSummary(
  programId: string,
  before: Player,
  after: Player,
): PlayerDevelopmentSummary {
  if (before.id !== after.id || before.classYear === 'SR') {
    throw new RangeError('Development summaries require one returning Player identity.')
  }
  const previousOverall = calculateOverall(before)
  const currentOverall = calculateOverall(after)
  return {
    programId,
    playerId: before.id,
    completedClass: before.classYear,
    nextClass: after.classYear as 'SO' | 'JR' | 'SR',
    previousOverall,
    currentOverall,
    overallChange: currentOverall - previousOverall,
    potentialHeadroom: before.potential - previousOverall,
  }
}

/** Positive attribute changes, ordered by gain then stable attribute order. */
export function deriveAttributeDevelopmentGains(
  before: Player,
  after: Player,
): PlayerAttributeDevelopmentGain[] {
  if (before.id !== after.id) {
    throw new RangeError('Attribute gains require one stable Player identity.')
  }

  return ATTRIBUTE_NAMES.map((attribute, index) => ({
    attribute,
    change: after.attributes[attribute] - before.attributes[attribute],
    index,
  }))
    .filter(({ change }) => change > 0)
    .sort(
      (first, second) =>
        second.change - first.change || first.index - second.index,
    )
    .map(({ attribute, change }) => ({ attribute, change }))
}
