import {
  CLASS_YEARS,
  MAX_PLAYER_RATING,
  MAX_TEAM_PRESTIGE,
  MIN_PLAYER_RATING,
  MIN_TEAM_PRESTIGE,
  POSITIONS,
  TEAM_ROSTER_SIZE,
  type ClassYear,
  type Player,
  type Position,
  type Team,
} from '../domain'
import type { Rng } from '../random'
import type { CareerStageAssignmentContext } from './careerStageAssignment'
import { assignS0CareerStageClassYears } from './careerStageAssignment'
import { generatePlayer } from './playerGenerator'

export interface GenerateTeamOptions {
  name: string
  abbreviation: string
  prestige: number
  rng: Rng
  /** Canonical S0 initialization context; omitted by context-free generation callers. */
  careerStageContext?: CareerStageAssignmentContext
}

const ROSTER_TALENT_CONFIG = {
  baseTalent: 42,
  prestigeMultiplier: 0.42,
  teamVariance: [-3, 3],
  playerVariance: [-3, 3],
  rosterSlotOffsets: [9, 6, 4, 3, 2, 1, 0, -1, -2, -3, -5, -7],
  standoutChance: 0.12,
  standoutBoost: [4, 9],
} as const

function shuffle<T>(values: readonly T[], rng: Rng): T[] {
  const shuffled = [...values]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = rng.int(0, index)
    const value = shuffled[index] as T
    shuffled[index] = shuffled[otherIndex] as T
    shuffled[otherIndex] = value
  }

  return shuffled
}

function generatePositions(rng: Rng): Position[] {
  const basePositions = POSITIONS.flatMap((position) => [position, position])
  const extraPositions = shuffle(POSITIONS, rng).slice(0, 2)

  return shuffle([...basePositions, ...extraPositions], rng)
}

function generateClassYears(rng: Rng): ClassYear[] {
  const baseClassYears = CLASS_YEARS.flatMap((classYear) => [
    classYear,
    classYear,
  ])
  const extraClassYears = shuffle(
    [...CLASS_YEARS, ...CLASS_YEARS],
    rng,
  ).slice(0, 4)

  return shuffle([...baseClassYears, ...extraClassYears], rng)
}

function clampTalentLevel(talentLevel: number): number {
  return Math.min(
    MAX_PLAYER_RATING,
    Math.max(MIN_PLAYER_RATING, talentLevel),
  )
}

function generateTalentLevels(prestige: number, rng: Rng): number[] {
  const teamAdjustment = rng.int(...ROSTER_TALENT_CONFIG.teamVariance)
  const programBaseline =
    ROSTER_TALENT_CONFIG.baseTalent +
    prestige * ROSTER_TALENT_CONFIG.prestigeMultiplier +
    teamAdjustment

  return ROSTER_TALENT_CONFIG.rosterSlotOffsets.map((slotOffset, index) => {
    const playerAdjustment = rng.int(...ROSTER_TALENT_CONFIG.playerVariance)
    const standoutBoost =
      index === 0 && rng.chance(ROSTER_TALENT_CONFIG.standoutChance)
        ? rng.int(...ROSTER_TALENT_CONFIG.standoutBoost)
        : 0

    return clampTalentLevel(
      Math.round(
        programBaseline + slotOffset + playerAdjustment + standoutBoost,
      ),
    )
  })
}

function generateTeamId(rng: Rng): string {
  const firstPart = rng.int(0, 0xffff_ffff).toString(16).padStart(8, '0')
  const secondPart = rng.int(0, 0xffff_ffff).toString(16).padStart(8, '0')

  return `team-${firstPart}${secondPart}`
}

function generateUniquePlayer(
  position: Position,
  classYear: ClassYear,
  talentLevel: number,
  playerIds: Set<string>,
  rng: Rng,
): Player {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const player = generatePlayer({ position, classYear, talentLevel, rng })

    if (!playerIds.has(player.id)) {
      playerIds.add(player.id)
      return player
    }
  }

  throw new Error('Could not generate a unique player ID for the roster')
}

function assertTeamOptions({
  name,
  abbreviation,
  prestige,
}: Omit<GenerateTeamOptions, 'rng'>): void {
  if (name.trim().length === 0) {
    throw new RangeError('Team name cannot be empty')
  }

  if (abbreviation.trim().length === 0) {
    throw new RangeError('Team abbreviation cannot be empty')
  }

  if (
    !Number.isFinite(prestige) ||
    prestige < MIN_TEAM_PRESTIGE ||
    prestige > MAX_TEAM_PRESTIGE
  ) {
    throw new RangeError(
      `prestige must be between ${MIN_TEAM_PRESTIGE} and ${MAX_TEAM_PRESTIGE}`,
    )
  }
}

/** Generates one team with a deterministic, balanced 12-player roster. */
export function generateTeam(options: GenerateTeamOptions): Team {
  assertTeamOptions(options)

  const { name, abbreviation, prestige, rng, careerStageContext } = options
  const positions = generatePositions(rng)
  const generatedClassYears = generateClassYears(rng)
  const classYears = careerStageContext
    ? assignS0CareerStageClassYears(generatedClassYears, careerStageContext)
    : generatedClassYears
  const talentLevels = generateTalentLevels(prestige, rng)
  const playerIds = new Set<string>()
  const roster = Array.from({ length: TEAM_ROSTER_SIZE }, (_, index) =>
    generateUniquePlayer(
      positions[index] as Position,
      classYears[index] as ClassYear,
      talentLevels[index] as number,
      playerIds,
      rng,
    ),
  )

  return {
    id: generateTeamId(rng),
    name,
    abbreviation,
    prestige,
    roster,
  }
}
