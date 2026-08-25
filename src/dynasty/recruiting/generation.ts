import {
  POSITIONS,
  calculateOverall,
  createRng,
  generatePlayer,
  type Position,
  type RngSeed,
} from '../../engine'
import { deriveProjectedRosterOutlook } from '../rosterOutlook'
import {
  COMMITMENT_SEPARATION_RANGES,
  COMMITMENT_STANDING_RANGES,
  DECISION_READY_PERIOD_RANGES,
  MIN_RECRUITS_PER_POSITION,
  RECRUIT_SUPPLY_MULTIPLIER,
} from './constants'
import type {
  GenerateRecruitingClassOptions,
  PositionCounts,
  Recruit,
  RecruitStarRating,
} from './domain'
import { finalizeRecruitPotential } from './potential'
import type { RecruitPotentialIntervention } from './potential'

function seedNamespace(
  dynastySeed: RngSeed,
  targetSeasonNumber: number,
  stream: string,
): string {
  return JSON.stringify({
    recruitingVersion: 'v0',
    dynastySeed: { type: typeof dynastySeed, value: dynastySeed },
    targetSeasonNumber,
    stream,
  })
}

export function deriveNationalPositionDemand(
  season: GenerateRecruitingClassOptions['season'],
): PositionCounts {
  return Object.fromEntries(
    POSITIONS.map((position) => [
      position,
      Object.keys(season.programStates)
        .sort()
        .reduce(
          (total, programId) =>
            total +
            deriveProjectedRosterOutlook(
              season.programStates[programId]!.team,
            ).projectedOpeningsByPosition[position],
          0,
        ),
    ]),
  ) as PositionCounts
}

export function deriveRecruitSupplyByPosition(
  demand: PositionCounts,
): PositionCounts {
  return Object.fromEntries(
    POSITIONS.map((position) => [
      position,
      Math.max(
        MIN_RECRUITS_PER_POSITION,
        Math.ceil(demand[position] * RECRUIT_SUPPLY_MULTIPLIER),
      ),
    ]),
  ) as PositionCounts
}

export function deriveMandatoryPositionDemand(
  season: GenerateRecruitingClassOptions['season'],
): PositionCounts {
  return Object.fromEntries(POSITIONS.map((position) => [position,
    Object.keys(season.programStates).sort().reduce((total, programId) => {
      const returners = season.programStates[programId]!.team.roster.filter(
        (player) => player.classYear !== 'SR' && player.position === position,
      ).length
      return total + Math.max(0, 2 - returners)
    }, 0),
  ])) as PositionCounts
}

/** Keeps V0's exact total class size while balancing B2's flexible market. */
export function deriveFlexibleRecruitSupplyByPosition(
  season: GenerateRecruitingClassOptions['season'],
): PositionCounts {
  const legacySupply = deriveRecruitSupplyByPosition(deriveNationalPositionDemand(season))
  const totalClassSize = POSITIONS.reduce((sum, position) => sum + legacySupply[position], 0)
  const mandatory = deriveMandatoryPositionDemand(season)
  const supply = Object.fromEntries(POSITIONS.map((position) => [
    position,
    Math.max(MIN_RECRUITS_PER_POSITION, mandatory[position]),
  ])) as Record<Position, number>
  let remaining = totalClassSize - POSITIONS.reduce((sum, position) => sum + supply[position], 0)
  if (remaining < 0) throw new RangeError('B2 mandatory supply exceeds the preserved Recruit class size.')
  while (remaining > 0) {
    const position = [...POSITIONS].sort((first, second) =>
      supply[first] - supply[second] || POSITIONS.indexOf(first) - POSITIONS.indexOf(second),
    )[0]!
    supply[position] += 1
    remaining -= 1
  }
  return supply
}

interface RecruitTalentProfile {
  readonly readiness: number
  readonly ceiling: number
}

export type RecruitReadinessTier = 'raw/depth' | 'developmental' | 'good' | 'ready-now' | 'exceptional'
export type RecruitCeilingTier = 'limited' | 'normal' | 'high' | 'elite' | 'exceptional'

const RECRUIT_CEILING_WEIGHTS: Readonly<Record<RecruitReadinessTier, readonly number[]>> = {
  'raw/depth': [370, 506, 100, 18, 6],
  developmental: [340, 524, 110, 20, 6],
  good: [300, 560, 110, 25, 5],
  'ready-now': [240, 575, 140, 35, 10],
  exceptional: [190, 550, 190, 50, 20],
}

const RECRUIT_CEILING_RANGES: Readonly<Record<RecruitCeilingTier, readonly [number, number]>> = {
  limited: [60, 74], normal: [75, 84], high: [85, 94], elite: [95, 96], exceptional: [97, 99],
}
const RECRUIT_CEILING_TIERS = ['limited', 'normal', 'high', 'elite', 'exceptional'] as const

export function classifyRecruitReadinessTier(readiness: number): RecruitReadinessTier {
  if (readiness >= 86) return 'exceptional'
  if (readiness >= 78) return 'ready-now'
  if (readiness >= 71) return 'good'
  if (readiness >= 60) return 'developmental'
  return 'raw/depth'
}

/** Pure production V2 threshold selection, exported for exact boundary coverage. */
export function selectRecruitCeilingTier(readinessTier: RecruitReadinessTier, roll: number): RecruitCeilingTier {
  if (roll < 0 || roll >= 1) throw new RangeError('Recruit ceiling roll must be in [0, 1).')
  const weights = RECRUIT_CEILING_WEIGHTS[readinessTier]
  const scaledRoll = roll * 1000
  let cumulative = 0
  for (let index = 0; index < RECRUIT_CEILING_TIERS.length; index += 1) {
    cumulative += weights[index]!
    if (scaledRoll < cumulative) return RECRUIT_CEILING_TIERS[index]!
  }
  return 'exceptional'
}

export function recruitCeilingRange(tier: RecruitCeilingTier): readonly [number, number] {
  return RECRUIT_CEILING_RANGES[tier]
}

/** Read-only intermediate facts exposed for deterministic diagnostic tooling. */
export interface RecruitTalentTrace extends RecruitPotentialIntervention {
  readonly playerId: string
  readonly position: Position
  readonly readiness: number
  readonly startingOverall: number
  readonly rawCeiling: number
  readonly finalPotential: number
}

export interface RecruitingClassTalentTrace {
  readonly recruits: readonly Recruit[]
  readonly traces: readonly RecruitTalentTrace[]
}

/**
 * V2 keeps accepted readiness generation and makes raw ceiling softly
 * conditional on the realized readiness tier. Every tier retains all five
 * ceiling outcomes, so the relationship stays positive but non-deterministic.
 */
function generateRecruitTalentProfile(
  rng: ReturnType<typeof createRng>,
): RecruitTalentProfile {
  const readinessRoll = rng.next()
  const readiness = readinessRoll < 0.003
    ? rng.int(86, 92) // extremely rare immediate impact prospect
    : readinessRoll < 0.085
      ? rng.int(78, 86) // ready-now blue chip
      : readinessRoll < 0.30
        ? rng.int(71, 79) // good college player
        : readinessRoll < 0.76
          ? rng.int(60, 72) // normal developmental freshman
          : rng.int(47, 61) // raw project / depth prospect

  const readinessTier = classifyRecruitReadinessTier(readiness)
  const ceilingTier = selectRecruitCeilingTier(readinessTier, rng.next())
  const [minimum, maximum] = RECRUIT_CEILING_RANGES[ceilingTier]
  const ceiling = rng.int(minimum, maximum)

  return { readiness, ceiling }
}

function starsForRank(rank: number, classSize: number): RecruitStarRating {
  if (rank <= Math.ceil(classSize * 0.06)) return 5
  if (rank <= Math.ceil(classSize * 0.26)) return 4
  if (rank <= Math.ceil(classSize * 0.72)) return 3
  return 2
}

function rangeValue(
  seed: string,
  range: readonly [number, number],
): number {
  return createRng(seed).int(range[0], range[1])
}

interface UnrankedRecruit {
  readonly player: Recruit['player']
  readonly qualityScore: number
}

function compareUnranked(first: UnrankedRecruit, second: UnrankedRecruit): number {
  return (
    second.qualityScore - first.qualityScore ||
    calculateOverall(second.player) - calculateOverall(first.player) ||
    second.player.potential - first.player.potential ||
    first.player.id.localeCompare(second.player.id)
  )
}

/** Generates one shared, demand-aware national class independent of Program order. */
export function generateRecruitingClass({
  dynastySeed,
  targetSeasonNumber,
  season,
}: GenerateRecruitingClassOptions): Recruit[] {
  return generateRecruitingClassWithPotentialFinalizer({
    dynastySeed,
    targetSeasonNumber,
    season,
  }, ({ overall, rawCeiling, playerId }) => finalizeRecruitPotential({
    overall,
    rawCeiling,
    dynastySeed,
    targetSeasonNumber,
    playerId,
  }).potential)
}

/** Runs the production generator while retaining otherwise-discarded talent intermediates. */
export function generateRecruitingClassWithTalentTrace(
  options: GenerateRecruitingClassOptions,
): RecruitingClassTalentTrace {
  const traces: RecruitTalentTrace[] = []
  const recruits = generateRecruitingClassWithPotentialFinalizer(
    options,
    ({ overall, rawCeiling, playerId }) => finalizeRecruitPotential({
      overall,
      rawCeiling,
      dynastySeed: options.dynastySeed,
      targetSeasonNumber: options.targetSeasonNumber,
      playerId,
    }).potential,
    ({ profile, playerId, position, startingOverall, finalPotential }) => {
      const result = finalizeRecruitPotential({
        overall: startingOverall,
        rawCeiling: profile.ceiling,
        dynastySeed: options.dynastySeed,
        targetSeasonNumber: options.targetSeasonNumber,
        playerId,
      })
      traces.push({
        playerId,
        position,
        readiness: profile.readiness,
        startingOverall,
        rawCeiling: profile.ceiling,
        finalPotential,
        eligible: result.eligible,
        preservedZero: result.preservedZero,
        grantedRunway: result.grantedRunway,
        cappedAt99: result.cappedAt99,
      })
    },
  )
  return { recruits, traces }
}

interface RecruitPotentialFinalizerInput {
  readonly overall: number
  readonly rawCeiling: number
  readonly playerId: string
}

type RecruitPotentialFinalizer = (input: RecruitPotentialFinalizerInput) => number
type RecruitTalentObserver = (input: {
  readonly profile: RecruitTalentProfile
  readonly playerId: string
  readonly position: Position
  readonly startingOverall: number
  readonly finalPotential: number
}) => void

function generateRecruitingClassWithPotentialFinalizer(
  { dynastySeed, targetSeasonNumber, season, capacityModel = 'flexible-v1' }: GenerateRecruitingClassOptions,
  finalizePotential: RecruitPotentialFinalizer,
  observeTalent?: RecruitTalentObserver,
): Recruit[] {
  if (!Number.isSafeInteger(targetSeasonNumber) || targetSeasonNumber < 2) {
    throw new RangeError('Recruiting target season must be at least 2.')
  }

  const supply = capacityModel === 'exact-v0'
    ? deriveRecruitSupplyByPosition(deriveNationalPositionDemand(season))
    : deriveFlexibleRecruitSupplyByPosition(season)
  const unranked: UnrankedRecruit[] = []

  for (const position of POSITIONS) {
    for (let index = 0; index < supply[position]; index += 1) {
      const stream = `class:${position}:${index}`
      const profile = generateRecruitTalentProfile(createRng(
        seedNamespace(dynastySeed, targetSeasonNumber, `${stream}:profile`),
      ))
      const generated = generatePlayer({
        position,
        talentLevel: profile.readiness,
        classYear: 'FR',
        rng: createRng(seedNamespace(dynastySeed, targetSeasonNumber, `${stream}:player`)),
      })
      const currentOverall = calculateOverall(generated)
      const playerId = `recruit-${targetSeasonNumber}-${position.toLowerCase()}-${String(index + 1).padStart(3, '0')}-${generated.id.slice(-8)}`
      const finalPotential = finalizePotential({ overall: currentOverall, rawCeiling: profile.ceiling, playerId })
      const player = {
        ...generated,
        id: playerId,
        potential: finalPotential,
      }
      observeTalent?.({ profile, playerId, position, startingOverall: currentOverall, finalPotential })
      const overall = calculateOverall(player)

      unranked.push({
        player,
        qualityScore: Number((overall * 0.56 + player.potential * 0.44).toFixed(2)),
      })
    }
  }

  const ranked = [...unranked].sort(compareUnranked)
  const positionRanks = Object.fromEntries(POSITIONS.map((position) => [position, 0])) as Record<Position, number>

  return ranked.map((candidate, index) => {
    const nationalRank = index + 1
    const position = candidate.player.position
    const positionRank = (positionRanks[position] += 1)
    const stars = starsForRank(nationalRank, ranked.length)
    const decisionSeed = seedNamespace(
      dynastySeed,
      targetSeasonNumber,
      `decision:${candidate.player.id}`,
    )

    return {
      ...candidate,
      nationalRank,
      positionRank,
      stars,
      decisionReadyPeriod: rangeValue(
        `${decisionSeed}:ready`,
        DECISION_READY_PERIOD_RANGES[stars],
      ),
      commitmentStandingThreshold: rangeValue(
        `${decisionSeed}:standing`,
        COMMITMENT_STANDING_RANGES[stars],
      ),
      commitmentSeparationThreshold: rangeValue(
        `${decisionSeed}:separation`,
        COMMITMENT_SEPARATION_RANGES[stars],
      ),
    }
  })
}

/** Historical V1 floor retained only for paired calibration/equivalence diagnostics. */
export function generateLegacyRecruitingClass(
  options: GenerateRecruitingClassOptions,
): Recruit[] {
  return generateRecruitingClassWithPotentialFinalizer(
    options,
    ({ overall, rawCeiling }) => Math.max(overall, rawCeiling),
  )
}
