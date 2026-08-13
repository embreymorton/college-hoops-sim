import type {
  Player,
  Position,
  ProjectedStartingFive,
  RotationV1,
  RotationV1ValidationResult,
  SimpleRotationIntentIssue,
  Team,
} from '../engine'
import { areRotationsV1Equal, derivePlayerMinutesV1, POSITIONS } from '../engine'

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

/** A 0–1 ratio as a one-decimal percentage, e.g. 0.359 → "35.9%". */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
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
  _team: Team,
  first: RotationV1,
  second: RotationV1,
): boolean {
  return areRotationsV1Equal(first, second)
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
  validation: RotationV1ValidationResult,
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

/** Every current roster Player's aggregate MPG, including explicit zeroes for Reserves. */
export function deriveSimplePlayerMinutes(
  team: Team,
  rotation: RotationV1,
): Record<string, number> {
  const assignedMinutes = derivePlayerMinutesV1(rotation)

  return Object.fromEntries(
    team.roster.map((player) => [player.id, assignedMinutes[player.id] ?? 0]),
  )
}

/**
 * "Assign N more minutes" / "Remove N minutes" for the Simple Rotation
 * minutes budget, or null once the draft totals exactly `targetTotal`.
 */
export function describeMinutesBudgetHint(
  actualTotal: number,
  targetTotal: number,
): string | null {
  const remaining = targetTotal - actualTotal

  if (remaining === 0) {
    return null
  }

  const magnitude = Math.abs(remaining)
  const unit = magnitude === 1 ? 'minute' : 'minutes'

  return remaining > 0
    ? `Assign ${magnitude} more ${unit}`
    : `Remove ${magnitude} ${unit}`
}

/**
 * Translates structured Simple Rotation compiler issues into concise,
 * coaching-language messages — never the raw issue codes.
 */
export function describeSimpleRotationIssues(
  issues: readonly SimpleRotationIntentIssue[],
): string[] {
  if (issues.length === 0) {
    return []
  }

  const messages: string[] = []

  const positionIssues = issues.filter(
    (issue) => issue.code === 'INFEASIBLE_POSITION_COVERAGE',
  )

  if (positionIssues.length > 0) {
    const positions = positionIssues
      .map((issue) => issue.position)
      .filter((position): position is Position => Boolean(position))
      .join(', ')

    messages.push(
      `This minute distribution can't cover every position` +
        `${positions ? ` (${positions})` : ''}. Adjust the Players in your ` +
        `rotation or use Advanced for exact positional control.`,
    )
  }

  if (issues.some((issue) => issue.code === 'INVALID_TOTAL_MINUTES')) {
    messages.push('Assign exactly 200 total minutes before applying.')
  }

  const hasUnexpectedIssue = issues.some(
    (issue) =>
      issue.code === 'UNKNOWN_PLAYER' ||
      issue.code === 'INVALID_PLAYER_MINUTES' ||
      issue.code === 'INVALID_COMPILED_ROTATION',
  )

  if (hasUnexpectedIssue && messages.length === 0) {
    messages.push(
      "This rotation can't be applied yet. Try Advanced for exact control.",
    )
  }

  return messages
}

/** One Starting Five row: a canonical position paired with its projected Player. */
export interface SimpleRotationStarter {
  readonly position: Position
  readonly player: Player
}

/**
 * Simple Rotation's Starting Five / Bench / Reserves view model. `starters`
 * is empty and `bench` includes every positive-minute Player whenever no
 * Starting Five projection is available — the defensive fallback reads as
 * the prior flat Rotation Players / Reserves grouping.
 */
export interface SimpleRotationSections {
  readonly starters: readonly SimpleRotationStarter[]
  readonly bench: readonly Player[]
  readonly reserves: readonly Player[]
  readonly hasProjectedStartingFive: boolean
}

/**
 * Groups the current roster for the Simple Rotation screen. Starting Five
 * always reflects the last committed canonical Rotation (`startingFive`
 * param); Bench/Reserves split on the current, possibly-uncommitted MPG
 * draft, so a Player can move between them before Apply while Starting Five
 * itself stays stable. Bench sorts by descending draft MPG, using roster
 * order as a stable tie-break; Reserves keeps roster order.
 */
export function deriveSimpleRotationSections(
  team: Team,
  minutesByPlayerId: Readonly<Record<string, number>>,
  startingFive: ProjectedStartingFive | null,
): SimpleRotationSections {
  const rosterById = new Map(
    team.roster.map((player) => [player.id, player] as const),
  )
  const starterIds = new Set(startingFive ? Object.values(startingFive) : [])

  const starters: SimpleRotationStarter[] = startingFive
    ? POSITIONS.map((position) => ({
        position,
        player: rosterById.get(startingFive[position])!,
      }))
    : []

  const nonStarters = team.roster
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => !starterIds.has(player.id))

  const bench = nonStarters
    .filter(({ player }) => (minutesByPlayerId[player.id] ?? 0) > 0)
    .sort((first, second) => {
      const minutesDiff =
        (minutesByPlayerId[second.player.id] ?? 0) -
        (minutesByPlayerId[first.player.id] ?? 0)
      return minutesDiff !== 0 ? minutesDiff : first.index - second.index
    })
    .map(({ player }) => player)

  const reserves = nonStarters
    .filter(({ player }) => (minutesByPlayerId[player.id] ?? 0) === 0)
    .map(({ player }) => player)

  return {
    starters,
    bench,
    reserves,
    hasProjectedStartingFive: startingFive !== null,
  }
}
