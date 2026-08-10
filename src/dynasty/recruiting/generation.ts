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

interface RecruitTalentProfile {
  readonly readiness: number
  readonly ceiling: number
}

/**
 * Readiness and ceiling are deliberately separate, deterministic qualities.
 * The buckets create a broad freshman population without storing an OVR: the
 * Player generator still creates the positional attributes and derives OVR.
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

  const ceilingRoll = rng.next()
  const ceiling = ceilingRoll < 0.025
    ? rng.int(88, 99) // high-upside prospect, independent of readiness
    : ceilingRoll < 0.175
      ? rng.int(80, 90)
      : ceilingRoll < 0.60
        ? rng.int(70, 82)
        : rng.int(60, 74)

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
  if (!Number.isSafeInteger(targetSeasonNumber) || targetSeasonNumber < 2) {
    throw new RangeError('Recruiting target season must be at least 2.')
  }

  const demand = deriveNationalPositionDemand(season)
  const supply = deriveRecruitSupplyByPosition(demand)
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
      const player = {
        ...generated,
        id: `recruit-${targetSeasonNumber}-${position.toLowerCase()}-${String(index + 1).padStart(3, '0')}-${generated.id.slice(-8)}`,
        potential: Math.max(currentOverall, profile.ceiling),
      }
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
