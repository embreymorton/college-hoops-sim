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

function generateTalentLevel(rng: ReturnType<typeof createRng>): number {
  // Most freshmen are developmental; the long upper tail creates rare impact talent.
  return Math.min(88, Math.max(52, Math.round(56 + 31 * rng.next() ** 1.55)))
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
      const rng = createRng(seedNamespace(dynastySeed, targetSeasonNumber, stream))
      const generated = generatePlayer({
        position,
        talentLevel: generateTalentLevel(rng),
        classYear: 'FR',
        rng,
      })
      const player = {
        ...generated,
        id: `recruit-${targetSeasonNumber}-${position.toLowerCase()}-${String(index + 1).padStart(3, '0')}-${generated.id.slice(-8)}`,
      }
      const overall = calculateOverall(player)

      unranked.push({
        player,
        qualityScore: Number((overall * 0.72 + player.potential * 0.28).toFixed(2)),
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
