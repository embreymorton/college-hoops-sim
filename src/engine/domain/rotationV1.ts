import { POSITIONS, type Player, type Position } from './player'
import {
  MAX_PLAYER_MINUTES,
  MINUTES_PER_POSITION,
  TOTAL_ROTATION_MINUTES,
  validateRotation,
  type Rotation,
} from './rotation'
import type { Team } from './team'

/** Canonical V1 assignments: each Player's minutes live at one floor position. */
export interface RotationV1 {
  minutesByPosition: Record<Position, Record<string, number>>
}

export type RotationV1ValidationIssueCode =
  | 'INVALID_STRUCTURE'
  | 'INVALID_PLAYER_MINUTES'
  | 'UNKNOWN_PLAYER'
  | 'INELIGIBLE_POSITION'
  | 'INVALID_PLAYER_TOTAL'
  | 'INVALID_POSITION_TOTAL'
  | 'INVALID_TOTAL_MINUTES'

export interface RotationV1ValidationIssue {
  readonly code: RotationV1ValidationIssueCode
  readonly message: string
  readonly playerId?: string
  readonly position?: Position
  readonly actual?: number
  readonly expected?: number
}

export interface RotationV1ValidationResult {
  readonly valid: boolean
  readonly issues: RotationV1ValidationIssue[]
}

const ELIGIBLE_ROTATION_POSITIONS: Readonly<
  Record<Position, readonly Position[]>
> = {
  PG: ['PG', 'SG'],
  SG: ['SG', 'SF'],
  SF: ['SF', 'PF'],
  PF: ['PF', 'C'],
  C: ['C', 'PF'],
}

/** Derives floor-position eligibility without adding state to Player. */
export function getEligibleRotationPositions(
  player: Player,
): readonly Position[] {
  return ELIGIBLE_ROTATION_POSITIONS[player.position]
}

/** Derives one Player's aggregate minutes from canonical floor assignments. */
export function calculatePlayerMinutesV1(
  rotation: RotationV1,
  playerId: string,
): number {
  return POSITIONS.reduce(
    (total, position) =>
      total + (rotation.minutesByPosition[position]?.[playerId] ?? 0),
    0,
  )
}

/** Derives aggregate Player-minute values; zero-minute Players remain omitted. */
export function derivePlayerMinutesV1(
  rotation: RotationV1,
): Record<string, number> {
  const playerMinutes: Record<string, number> = {}

  for (const position of POSITIONS) {
    const assignments = rotation.minutesByPosition[position]

    if (!assignments || typeof assignments !== 'object') {
      continue
    }

    for (const [playerId, minutes] of Object.entries(assignments)) {
      playerMinutes[playerId] = (playerMinutes[playerId] ?? 0) + minutes
    }
  }

  return playerMinutes
}

/** Validates canonical floor assignments and returns every discovered issue. */
export function validateRotationV1(
  team: Team,
  rotation: RotationV1,
): RotationV1ValidationResult {
  const issues: RotationV1ValidationIssue[] = []
  const rosterById = new Map(
    team.roster.map((player) => [player.id, player] as const),
  )
  const playerTotals: Record<string, number> = {}
  let totalMinutes = 0

  if (
    !rotation ||
    typeof rotation !== 'object' ||
    !rotation.minutesByPosition ||
    typeof rotation.minutesByPosition !== 'object' ||
    Array.isArray(rotation.minutesByPosition)
  ) {
    return {
      valid: false,
      issues: [
        {
          code: 'INVALID_STRUCTURE',
          message: 'Rotation V1 must contain minutesByPosition assignments.',
        },
      ],
    }
  }

  for (const position of POSITIONS) {
    const assignments = rotation.minutesByPosition[position]
    let positionTotal = 0

    if (
      !assignments ||
      typeof assignments !== 'object' ||
      Array.isArray(assignments)
    ) {
      issues.push({
        code: 'INVALID_STRUCTURE',
        message: `${position} must contain a Player-minute assignment object.`,
        position,
      })
    } else {
      for (const [playerId, assignedMinutes] of Object.entries(assignments)) {
        const player = rosterById.get(playerId)

        if (!player) {
          issues.push({
            code: 'UNKNOWN_PLAYER',
            message: `Unknown player ID "${playerId}" referenced at ${position}.`,
            playerId,
            position,
          })
        } else if (!getEligibleRotationPositions(player).includes(position)) {
          issues.push({
            code: 'INELIGIBLE_POSITION',
            message:
              `Player "${playerId}" (${player.position}) is not eligible ` +
              `for ${position} minutes.`,
            playerId,
            position,
          })
        }

        if (!Number.isFinite(assignedMinutes)) {
          issues.push({
            code: 'INVALID_PLAYER_MINUTES',
            message:
              `Player "${playerId}" must have finite assigned minutes at ` +
              `${position}.`,
            playerId,
            position,
          })
          continue
        }

        positionTotal += assignedMinutes
        totalMinutes += assignedMinutes
        playerTotals[playerId] =
          (playerTotals[playerId] ?? 0) + assignedMinutes

        if (assignedMinutes < 0 || assignedMinutes > MAX_PLAYER_MINUTES) {
          issues.push({
            code: 'INVALID_PLAYER_MINUTES',
            message:
              `Player "${playerId}" has ${assignedMinutes} assigned minutes ` +
              `at ${position}; the valid range is 0–${MAX_PLAYER_MINUTES}.`,
            playerId,
            position,
            actual: assignedMinutes,
          })
        }
      }
    }

    if (positionTotal !== MINUTES_PER_POSITION) {
      issues.push({
        code: 'INVALID_POSITION_TOTAL',
        message:
          `${position} minutes total ${positionTotal} instead of ` +
          `${MINUTES_PER_POSITION}.`,
        position,
        actual: positionTotal,
        expected: MINUTES_PER_POSITION,
      })
    }
  }

  for (const [playerId, minutes] of Object.entries(playerTotals)) {
    if (minutes > MAX_PLAYER_MINUTES) {
      issues.push({
        code: 'INVALID_PLAYER_TOTAL',
        message:
          `Player "${playerId}" has ${minutes} total assigned minutes; ` +
          `the maximum is ${MAX_PLAYER_MINUTES}.`,
        playerId,
        actual: minutes,
        expected: MAX_PLAYER_MINUTES,
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

/** Converts a valid V0 Rotation into natural-position-only V1 assignments. */
export function convertRotationV0ToV1(
  team: Team,
  rotation: Rotation,
): RotationV1 {
  const validation = validateRotation(team, rotation)

  if (!validation.valid) {
    throw new RangeError(
      `Cannot convert invalid Rotation V0: ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }

  const minutesByPosition = Object.fromEntries(
    POSITIONS.map((position) => [position, {}]),
  ) as RotationV1['minutesByPosition']
  const rosterById = new Map(
    team.roster.map((player) => [player.id, player] as const),
  )

  for (const [playerId, minutes] of Object.entries(rotation.minutes)) {
    const player = rosterById.get(playerId)

    if (player) {
      minutesByPosition[player.position][playerId] = minutes
    }
  }

  return { minutesByPosition }
}
