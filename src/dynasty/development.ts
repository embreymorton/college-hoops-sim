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

const TARGET_OVR_GAIN_RANGE = {
  FR: [2, 5],
  SO: [1, 4],
  JR: [0, 3],
} as const satisfies Readonly<Record<ReturningClass, readonly [number, number]>>

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
    namespace: 'college-hoops-sim:player-development:v0',
    dynastySeed: {
      type: typeof options.dynastySeed === 'number' ? 'number' : 'string',
      value: options.dynastySeed,
    },
    completedSeasonNumber: options.completedSeasonNumber,
    programId: options.programId,
    playerId: options.playerId,
  })
}

function weightedAttribute(
  position: Position,
  attributes: PlayerAttributes,
  rng: Rng,
): AttributeName | undefined {
  const candidates = ATTRIBUTE_NAMES.flatMap((name, index) => {
    if (attributes[name] >= MAX_PLAYER_RATING) return []
    const baseWeight = POSITION_DEVELOPMENT_WEIGHTS[position][index] ?? 1
    return [{ name, weight: baseWeight * (0.75 + rng.next() * 0.5) }]
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
  const [minimumGain, maximumGain] = TARGET_OVR_GAIN_RANGE[completedClass]
  const targetOverall = Math.min(
    player.potential,
    currentOverall + rng.int(minimumGain, maximumGain),
  )
  const maximumAttempts = ATTRIBUTE_NAMES.length * MAX_PLAYER_RATING

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const overall = calculateOverall(developed)
    if (overall >= targetOverall || overall >= player.potential) break
    const attribute = weightedAttribute(
      developed.position,
      developed.attributes,
      rng,
    )
    if (!attribute) break
    const candidate = clonePlayer(developed)
    candidate.attributes[attribute] += 1
    if (calculateOverall(candidate) <= player.potential) {
      developed.attributes[attribute] += 1
    }
  }

  return developed
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
