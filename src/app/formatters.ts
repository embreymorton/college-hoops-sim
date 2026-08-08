import type {
  Position,
  Rotation,
  RotationValidationResult,
  Team,
} from '../engine'

/**
 * Presentation-only formatting helpers. These format existing engine output
 * fields (height inches, made/attempted pairs, derived ratings, overtime
 * counts, Rotation validation issues) for display — they never derive new
 * basketball values or re-decide Rotation legality themselves.
 */

export function formatHeight(totalInches: number): string {
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12

  return `${feet}'${inches}"`
}

export function formatShootingLine(made: number, attempted: number): string {
  return `${made}-${attempted}`
}

export function formatRating(value: number): string {
  return value.toFixed(1)
}

/** Returns null for regulation games, otherwise "OT", "2OT", "3OT", etc. */
export function formatOvertimeTag(overtimePeriods: number): string | null {
  if (overtimePeriods <= 0) {
    return null
  }

  return overtimePeriods === 1 ? 'OT' : `${overtimePeriods}OT`
}

/** Sign-prefixed one-decimal delta, e.g. "+1.8", "−1.0", or "0.0". */
export function formatSignedRating(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(1)}`
  }

  if (value < 0) {
    return `−${Math.abs(value).toFixed(1)}`
  }

  return '0.0'
}

/**
 * True when two Rotations assign identical minutes to every rostered Player.
 * A pure value comparison, not a legality judgment.
 */
export function areRotationsEqual(
  team: Team,
  first: Rotation,
  second: Rotation,
): boolean {
  return team.roster.every(
    (player) =>
      (first.minutes[player.id] ?? 0) === (second.minutes[player.id] ?? 0),
  )
}

/** "Valid", "N minutes remaining", or "N minutes over" for one position group. */
export function describePositionMinutes(
  actualMinutes: number,
  expectedMinutes: number,
): string {
  const difference = expectedMinutes - actualMinutes

  if (difference === 0) {
    return 'Valid'
  }

  const magnitude = Math.abs(difference)
  const unit = magnitude === 1 ? 'minute' : 'minutes'

  return difference > 0
    ? `${magnitude} ${unit} remaining`
    : `${magnitude} ${unit} over`
}

/**
 * A concise, coaching-oriented reason the current Rotation cannot be
 * simulated, prioritized by scope (Team total, then position, then Player).
 * Every number quoted here comes directly from the engine's own validation
 * issues — this only chooses which issue to describe and how to phrase it.
 */
export function describeRotationBlockingReason(
  validation: RotationValidationResult,
): string {
  const totalIssue = validation.issues.find(
    (issue) => issue.code === 'INVALID_TOTAL_MINUTES',
  )

  if (
    totalIssue &&
    totalIssue.actual !== undefined &&
    totalIssue.expected !== undefined
  ) {
    const remaining = totalIssue.expected - totalIssue.actual

    return remaining > 0
      ? `Assign ${remaining} more minute${remaining === 1 ? '' : 's'} to simulate.`
      : `Remove ${-remaining} minute${remaining === -1 ? '' : 's'} to simulate.`
  }

  const positionIssues = validation.issues.filter(
    (issue) => issue.code === 'INVALID_POSITION_TOTAL',
  )

  if (positionIssues.length > 0) {
    const positions = positionIssues
      .map((issue) => issue.position)
      .filter((position): position is Position => Boolean(position))
      .join(', ')

    return `Fix the ${positions} rotation to simulate.`
  }

  const hasPlayerIssue = validation.issues.some(
    (issue) => issue.code === 'INVALID_PLAYER_MINUTES',
  )

  if (hasPlayerIssue) {
    return 'Fix player minutes to simulate.'
  }

  return 'Fix Rotation issues to simulate.'
}
