import {
  calculatePlayerOffense,
  type Player,
  type Position,
  type Rotation,
  type Team,
} from '../domain'
import type { Rng } from '../random'

export interface PlayerGameStats {
  playerId: string
  minutes: number
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
}

/** Centralized V0 box-score tuning inputs. */
const BOX_SCORE_CONFIG = {
  overtimeTeamMinutes: 5,
  overtimePlayerCount: 5,
  scoringPerformanceStandardDeviation: 0.3,
  scoringRatingScale: 25,
  scoringWeights: {
    playerOffense: 0.45,
    shooting: 0.3,
    finishing: 0.25,
  },
  threePointShare: {
    minimum: 0.04,
    maximum: 0.48,
    base: 0.14,
    shootingRange: 0.28,
  },
  threePointPositionAdjustment: {
    PG: 0.04,
    SG: 0.06,
    SF: 0.02,
    PF: -0.04,
    C: -0.1,
  },
  freeThrowShare: {
    minimum: 0.08,
    maximum: 0.25,
    base: 0.1,
    finishingRange: 0.1,
    athleticismRange: 0.04,
  },
  scoringCompositionJitter: {
    threePointPoints: 2,
    freeThrowPoints: 1.5,
  },
  twoPointPercentage: {
    minimum: 0.35,
    maximum: 0.68,
    base: 0.4,
    finishingRange: 0.19,
    athleticismRange: 0.04,
    gameStandardDeviation: 0.025,
  },
  threePointPercentage: {
    minimum: 0.22,
    maximum: 0.48,
    base: 0.26,
    shootingRange: 0.18,
    gameStandardDeviation: 0.02,
  },
  freeThrowPercentage: {
    minimum: 0.5,
    maximum: 0.92,
    base: 0.58,
    skillRange: 0.25,
    gameStandardDeviation: 0.025,
  },
  zeroMakeMissOpportunity: {
    twoPoint: 0.35,
    threePoint: 0.3,
  },
  reboundPer40: { PG: 4, SG: 4.8, SF: 6.2, PF: 8, C: 9.5 },
  assistPer40: { PG: 6, SG: 3, SF: 2.7, PF: 1.6, C: 1.3 },
  stealPer40: { PG: 1.25, SG: 1.15, SF: 1, PF: 0.75, C: 0.55 },
  blockPer40: { PG: 0.15, SG: 0.25, SF: 0.55, PF: 1.05, C: 1.55 },
  turnoverPer40: { PG: 2.5, SG: 1.8, SF: 1.6, PF: 1.4, C: 1.5 },
} as const

interface TeamBoxScoreOptions {
  readonly team: Team
  readonly rotation: Rotation
  readonly teamScore: number
  readonly overtimePeriods: number
  readonly rng: Rng
}

interface ScoringBreakdown {
  readonly twoPointersMade: number
  readonly threePointersMade: number
  readonly freeThrowsMade: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizedRating(rating: number): number {
  return (rating - 40) / (99 - 40)
}

function nextStandardNormal(rng: Rng): number {
  const firstUniform = Math.max(rng.next(), Number.EPSILON)
  const secondUniform = rng.next()

  return (
    Math.sqrt(-2 * Math.log(firstUniform)) *
    Math.cos(2 * Math.PI * secondUniform)
  )
}

function samplePoisson(expectedValue: number, rng: Rng): number {
  if (expectedValue <= 0) {
    return 0
  }

  const threshold = Math.exp(-expectedValue)
  let draws = 0
  let product = 1

  do {
    draws += 1
    product *= rng.next()
  } while (product > threshold)

  return draws - 1
}

function comparePlayerIds(first: Player, second: Player): number {
  return first.id === second.id ? 0 : first.id < second.id ? -1 : 1
}

function allocateMinutes(
  team: Team,
  rotation: Rotation,
  overtimePeriods: number,
): Map<string, number> {
  const minutes = new Map(
    team.roster.map(
      (player) => [player.id, rotation.minutes[player.id] ?? 0] as const,
    ),
  )
  const activePlayers = team.roster
    .filter((player) => (minutes.get(player.id) ?? 0) > 0)
    .sort(
      (first, second) =>
        (minutes.get(second.id) ?? 0) - (minutes.get(first.id) ?? 0) ||
        calculatePlayerOffense(second) - calculatePlayerOffense(first) ||
        comparePlayerIds(first, second),
    )
  const overtimePlayers = activePlayers.slice(
    0,
    BOX_SCORE_CONFIG.overtimePlayerCount,
  )
  const extraMinutes =
    overtimePeriods * BOX_SCORE_CONFIG.overtimeTeamMinutes

  if (extraMinutes > 0 && overtimePlayers.length === 0) {
    throw new RangeError('Cannot allocate overtime without active players')
  }

  for (let index = 0; index < extraMinutes; index += 1) {
    const player = overtimePlayers[index % overtimePlayers.length] as Player
    minutes.set(player.id, (minutes.get(player.id) ?? 0) + 1)
  }

  return minutes
}

function scoringOpportunityWeight(
  player: Player,
  minutes: number,
  rng: Rng,
): number {
  const { attributes } = player
  const scoringRating =
    calculatePlayerOffense(player) *
      BOX_SCORE_CONFIG.scoringWeights.playerOffense +
    attributes.shooting * BOX_SCORE_CONFIG.scoringWeights.shooting +
    attributes.finishing * BOX_SCORE_CONFIG.scoringWeights.finishing
  const abilityMultiplier = Math.exp(
    (scoringRating - 70) / BOX_SCORE_CONFIG.scoringRatingScale,
  )
  const performanceMultiplier = Math.exp(
    nextStandardNormal(rng) *
      BOX_SCORE_CONFIG.scoringPerformanceStandardDeviation,
  )

  return minutes * abilityMultiplier * performanceMultiplier
}

function allocatePoints(
  team: Team,
  playerMinutes: ReadonlyMap<string, number>,
  teamScore: number,
  rng: Rng,
): Map<string, number> {
  const activePlayers = team.roster.filter(
    (player) => (playerMinutes.get(player.id) ?? 0) > 0,
  )
  const weights = activePlayers.map((player) =>
    scoringOpportunityWeight(
      player,
      playerMinutes.get(player.id) ?? 0,
      rng,
    ),
  )
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const points = new Map<string, number>(
    team.roster.map((player) => [player.id, 0] as const),
  )

  for (let point = 0; point < teamScore; point += 1) {
    let target = rng.next() * totalWeight
    let selectedIndex = activePlayers.length - 1

    for (let index = 0; index < weights.length; index += 1) {
      target -= weights[index] as number

      if (target < 0) {
        selectedIndex = index
        break
      }
    }

    const selectedPlayer = activePlayers[selectedIndex] as Player
    points.set(selectedPlayer.id, (points.get(selectedPlayer.id) ?? 0) + 1)
  }

  return points
}

function chooseScoringBreakdown(
  player: Player,
  points: number,
  rng: Rng,
): ScoringBreakdown {
  if (points === 0) {
    return {
      twoPointersMade: 0,
      threePointersMade: 0,
      freeThrowsMade: 0,
    }
  }

  const { attributes, position } = player
  const targetThreePointShare = clamp(
    BOX_SCORE_CONFIG.threePointShare.base +
      normalizedRating(attributes.shooting) *
        BOX_SCORE_CONFIG.threePointShare.shootingRange +
      BOX_SCORE_CONFIG.threePointPositionAdjustment[position],
    BOX_SCORE_CONFIG.threePointShare.minimum,
    BOX_SCORE_CONFIG.threePointShare.maximum,
  )
  const targetFreeThrowShare = clamp(
    BOX_SCORE_CONFIG.freeThrowShare.base +
      normalizedRating(attributes.finishing) *
        BOX_SCORE_CONFIG.freeThrowShare.finishingRange +
      normalizedRating(attributes.athleticism) *
        BOX_SCORE_CONFIG.freeThrowShare.athleticismRange,
    BOX_SCORE_CONFIG.freeThrowShare.minimum,
    BOX_SCORE_CONFIG.freeThrowShare.maximum,
  )
  const targetThreePointPoints =
    points * targetThreePointShare +
    nextStandardNormal(rng) *
      BOX_SCORE_CONFIG.scoringCompositionJitter.threePointPoints
  const targetFreeThrowPoints =
    points * targetFreeThrowShare +
    nextStandardNormal(rng) *
      BOX_SCORE_CONFIG.scoringCompositionJitter.freeThrowPoints
  let best: ScoringBreakdown | undefined
  let bestDistance = Number.POSITIVE_INFINITY

  for (
    let threePointersMade = 0;
    threePointersMade <= Math.floor(points / 3);
    threePointersMade += 1
  ) {
    const remainingAfterThrees = points - threePointersMade * 3

    for (
      let freeThrowsMade = 0;
      freeThrowsMade <= remainingAfterThrees;
      freeThrowsMade += 1
    ) {
      const remainingPoints = remainingAfterThrees - freeThrowsMade

      if (remainingPoints % 2 !== 0) {
        continue
      }

      const distance =
        Math.abs(threePointersMade * 3 - targetThreePointPoints) / 3 +
        Math.abs(freeThrowsMade - targetFreeThrowPoints) / 2

      if (distance < bestDistance) {
        bestDistance = distance
        best = {
          twoPointersMade: remainingPoints / 2,
          threePointersMade,
          freeThrowsMade,
        }
      }
    }
  }

  if (!best) {
    throw new RangeError(`Cannot construct a shooting line for ${points} points`)
  }

  return best
}

function shootingStats(
  player: Player,
  minutes: number,
  points: number,
  rng: Rng,
): Pick<
  PlayerGameStats,
  | 'fieldGoalsMade'
  | 'fieldGoalsAttempted'
  | 'threePointersMade'
  | 'threePointersAttempted'
  | 'freeThrowsMade'
  | 'freeThrowsAttempted'
> {
  const breakdown = chooseScoringBreakdown(player, points, rng)
  const { attributes } = player
  const twoPointPercentage = clamp(
    BOX_SCORE_CONFIG.twoPointPercentage.base +
      normalizedRating(attributes.finishing) *
        BOX_SCORE_CONFIG.twoPointPercentage.finishingRange +
      normalizedRating(attributes.athleticism) *
        BOX_SCORE_CONFIG.twoPointPercentage.athleticismRange +
      nextStandardNormal(rng) *
        BOX_SCORE_CONFIG.twoPointPercentage.gameStandardDeviation,
    BOX_SCORE_CONFIG.twoPointPercentage.minimum,
    BOX_SCORE_CONFIG.twoPointPercentage.maximum,
  )
  const threePointPercentage = clamp(
    BOX_SCORE_CONFIG.threePointPercentage.base +
      normalizedRating(attributes.shooting) *
        BOX_SCORE_CONFIG.threePointPercentage.shootingRange +
      nextStandardNormal(rng) *
        BOX_SCORE_CONFIG.threePointPercentage.gameStandardDeviation,
    BOX_SCORE_CONFIG.threePointPercentage.minimum,
    BOX_SCORE_CONFIG.threePointPercentage.maximum,
  )
  const freeThrowSkill =
    (attributes.shooting + attributes.ballHandling) / 2
  const freeThrowPercentage = clamp(
    BOX_SCORE_CONFIG.freeThrowPercentage.base +
      normalizedRating(freeThrowSkill) *
        BOX_SCORE_CONFIG.freeThrowPercentage.skillRange +
      nextStandardNormal(rng) *
        BOX_SCORE_CONFIG.freeThrowPercentage.gameStandardDeviation,
    BOX_SCORE_CONFIG.freeThrowPercentage.minimum,
    BOX_SCORE_CONFIG.freeThrowPercentage.maximum,
  )
  const minuteShare = minutes / 40
  const twoPointMisses = samplePoisson(
    breakdown.twoPointersMade *
      ((1 - twoPointPercentage) / twoPointPercentage) +
      minuteShare * BOX_SCORE_CONFIG.zeroMakeMissOpportunity.twoPoint,
    rng,
  )
  const threePointMisses = samplePoisson(
    breakdown.threePointersMade *
      ((1 - threePointPercentage) / threePointPercentage) +
      minuteShare *
        BOX_SCORE_CONFIG.zeroMakeMissOpportunity.threePoint *
        (0.5 + normalizedRating(attributes.shooting)),
    rng,
  )
  const freeThrowMisses = samplePoisson(
    breakdown.freeThrowsMade *
      ((1 - freeThrowPercentage) / freeThrowPercentage),
    rng,
  )
  const fieldGoalsMade =
    breakdown.twoPointersMade + breakdown.threePointersMade

  return {
    fieldGoalsMade,
    fieldGoalsAttempted:
      fieldGoalsMade + twoPointMisses + threePointMisses,
    threePointersMade: breakdown.threePointersMade,
    threePointersAttempted:
      breakdown.threePointersMade + threePointMisses,
    freeThrowsMade: breakdown.freeThrowsMade,
    freeThrowsAttempted: breakdown.freeThrowsMade + freeThrowMisses,
  }
}

function ratingFactor(
  primaryRating: number,
  secondaryRating: number,
  primaryCoefficient: number,
  secondaryCoefficient: number,
): number {
  return clamp(
    1 +
      (primaryRating - 70) * primaryCoefficient +
      (secondaryRating - 70) * secondaryCoefficient,
    0.35,
    1.75,
  )
}

function positionRate(
  rates: Readonly<Record<Position, number>>,
  position: Position,
): number {
  return rates[position]
}

function generateCountingStats(
  player: Player,
  minutes: number,
  points: number,
  teamScore: number,
  rng: Rng,
): Pick<
  PlayerGameStats,
  'rebounds' | 'assists' | 'steals' | 'blocks' | 'turnovers'
> {
  const { attributes, position } = player
  const minuteScale = minutes / 40
  const rebounds = samplePoisson(
    positionRate(BOX_SCORE_CONFIG.reboundPer40, position) *
      minuteScale *
      ratingFactor(attributes.rebounding, attributes.athleticism, 0.012, 0.003),
    rng,
  )
  const assists = samplePoisson(
    positionRate(BOX_SCORE_CONFIG.assistPer40, position) *
      minuteScale *
      ratingFactor(attributes.playmaking, attributes.ballHandling, 0.013, 0.004),
    rng,
  )
  const steals = samplePoisson(
    positionRate(BOX_SCORE_CONFIG.stealPer40, position) *
      minuteScale *
      ratingFactor(
        attributes.perimeterDefense,
        attributes.athleticism,
        0.01,
        0.004,
      ),
    rng,
  )
  const heightFactor = clamp(1 + (player.height - 78) * 0.04, 0.65, 1.4)
  const blocks = samplePoisson(
    positionRate(BOX_SCORE_CONFIG.blockPer40, position) *
      minuteScale *
      heightFactor *
      ratingFactor(
        attributes.interiorDefense,
        attributes.athleticism,
        0.012,
        0.003,
      ),
    rng,
  )
  const minuteShare = minutes / Math.max(1, 200)
  const scoringShare = points / Math.max(1, teamScore)
  const involvementFactor = clamp(
    0.75 + 0.25 * (scoringShare / Math.max(minuteShare, 0.01)),
    0.65,
    1.4,
  )
  const turnoverSkillFactor = clamp(
    1 +
      (70 - attributes.ballHandling) * 0.01 +
      (attributes.playmaking - 70) * 0.003,
    0.55,
    1.55,
  )
  const turnovers = samplePoisson(
    positionRate(BOX_SCORE_CONFIG.turnoverPer40, position) *
      minuteScale *
      involvementFactor *
      turnoverSkillFactor,
    rng,
  )

  return { rebounds, assists, steals, blocks, turnovers }
}

function zeroStats(playerId: string): PlayerGameStats {
  return {
    playerId,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  }
}

/** Allocates one authoritative Team score into deterministic full-roster rows. */
export function generateTeamPlayerStats({
  team,
  rotation,
  teamScore,
  overtimePeriods,
  rng,
}: TeamBoxScoreOptions): PlayerGameStats[] {
  const playerMinutes = allocateMinutes(team, rotation, overtimePeriods)
  const playerPoints = allocatePoints(team, playerMinutes, teamScore, rng)

  return team.roster.map((player) => {
    const minutes = playerMinutes.get(player.id) ?? 0

    if (minutes === 0) {
      return zeroStats(player.id)
    }

    const points = playerPoints.get(player.id) ?? 0

    return {
      playerId: player.id,
      minutes,
      points,
      ...generateCountingStats(player, minutes, points, teamScore, rng),
      ...shootingStats(player, minutes, points, rng),
    }
  })
}
