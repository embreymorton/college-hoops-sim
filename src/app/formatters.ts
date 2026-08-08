/**
 * Presentation-only formatting helpers. These format existing engine output
 * fields (height inches, made/attempted pairs, derived ratings, overtime
 * counts) for display — they never derive new basketball values.
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
