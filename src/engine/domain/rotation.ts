import { calculateOverall } from './overall'
import { POSITIONS, type Player, type Position } from './player'
import type { Team } from './team'

export const MINUTES_PER_POSITION = 40
export const TOTAL_ROTATION_MINUTES =
  POSITIONS.length * MINUTES_PER_POSITION
export const MAX_PLAYER_MINUTES = 40

/**
 * A compact, JSON-serializable assignment of player IDs to minutes.
 * Missing player IDs are treated as zero minutes.
 */
export interface Rotation {
  minutes: Record<string, number>
}

export type RotationValidationIssueCode =
  | 'INVALID_PLAYER_MINUTES'
  | 'UNKNOWN_PLAYER'
  | 'INVALID_POSITION_TOTAL'
  | 'INVALID_TOTAL_MINUTES'

export interface RotationValidationIssue {
  code: RotationValidationIssueCode
  message: string
  playerId?: string
  position?: Position
  actual?: number
  expected?: number
}

export interface RotationValidationResult {
  valid: boolean
  issues: RotationValidationIssue[]
}

export interface PlayerRotationMinutes {
  player: Player
  minutes: number
}

/** Returns the sum of every explicitly assigned value. */
export function calculateTotalMinutes(rotation: Rotation): number {
  return Object.values(rotation.minutes).reduce(
    (total, minutes) => total + minutes,
    0,
  )
}

/**
 * Returns minutes assigned to players at one natural position. Unknown IDs do
 * not count toward a position and are reported separately by validation.
 */
export function calculatePositionMinutes(
  team: Team,
  rotation: Rotation,
  position: Position,
): number {
  return team.roster
    .filter((player) => player.position === position)
    .reduce(
      (total, player) => total + (rotation.minutes[player.id] ?? 0),
      0,
    )
}

/** Returns the full roster ordered by assigned minutes, including zeroes. */
export function getPlayersByMinutes(
  team: Team,
  rotation: Rotation,
): PlayerRotationMinutes[] {
  return team.roster
    .map((player) => ({
      player,
      minutes: rotation.minutes[player.id] ?? 0,
    }))
    .sort(
      (first, second) =>
        second.minutes - first.minutes ||
        calculateOverall(second.player) - calculateOverall(first.player) ||
        first.player.id.localeCompare(second.player.id),
    )
}

/** Validates a v0.1 natural-position rotation and returns every found issue. */
export function validateRotation(
  team: Team,
  rotation: Rotation,
): RotationValidationResult {
  const rosterById = new Map(
    team.roster.map((player) => [player.id, player] as const),
  )
  const positionTotals = Object.fromEntries(
    POSITIONS.map((position) => [position, 0]),
  ) as Record<Position, number>
  const issues: RotationValidationIssue[] = []
  let totalMinutes = 0

  for (const [playerId, assignedMinutes] of Object.entries(
    rotation.minutes,
  )) {
    const player = rosterById.get(playerId)

    if (!player) {
      issues.push({
        code: 'UNKNOWN_PLAYER',
        message: `Unknown player ID "${playerId}" referenced.`,
        playerId,
      })
    }

    if (!Number.isFinite(assignedMinutes)) {
      issues.push({
        code: 'INVALID_PLAYER_MINUTES',
        message: `Player "${playerId}" must have finite assigned minutes.`,
        playerId,
      })
      continue
    }

    totalMinutes += assignedMinutes

    if (assignedMinutes < 0 || assignedMinutes > MAX_PLAYER_MINUTES) {
      issues.push({
        code: 'INVALID_PLAYER_MINUTES',
        message:
          `Player "${playerId}" has ${assignedMinutes} assigned minutes; ` +
          `the valid range is 0–${MAX_PLAYER_MINUTES}.`,
        playerId,
        actual: assignedMinutes,
      })
    }

    if (player) {
      positionTotals[player.position] += assignedMinutes
    }
  }

  for (const position of POSITIONS) {
    const actual = positionTotals[position]

    if (actual !== MINUTES_PER_POSITION) {
      issues.push({
        code: 'INVALID_POSITION_TOTAL',
        message:
          `${position} minutes total ${actual} instead of ` +
          `${MINUTES_PER_POSITION}.`,
        position,
        actual,
        expected: MINUTES_PER_POSITION,
      })
    }
  }

  if (totalMinutes !== TOTAL_ROTATION_MINUTES) {
    issues.push({
      code: 'INVALID_TOTAL_MINUTES',
      message:
        `Total minutes are ${totalMinutes} instead of ` +
        `${TOTAL_ROTATION_MINUTES}.`,
      actual: totalMinutes,
      expected: TOTAL_ROTATION_MINUTES,
    })
  }

  return { valid: issues.length === 0, issues }
}
