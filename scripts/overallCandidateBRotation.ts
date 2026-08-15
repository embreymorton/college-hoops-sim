import { MAX_PLAYER_MINUTES, MINUTES_PER_POSITION, POSITIONS, type Player, type Rotation, type Team } from '../src/engine'

const CONFIG = { temperature: 5, maxWithBackup: MAX_PLAYER_MINUTES - 4, maxOutsideTopThree: MAX_PLAYER_MINUTES - 8, minimumShare: 5 } as const

/** Experimental copy of the natural-position allocator with an injected value function. */
export function generateOverallCandidateBRotation(team: Team, value: (player: Player) => number): Rotation {
  const topThree = new Set(team.roster.slice().sort((a, b) => value(b) - value(a) || a.id.localeCompare(b.id)).slice(0, 3).map((player) => player.id))
  const entries = POSITIONS.flatMap((position) => {
    const ranked = team.roster.filter((player) => player.position === position).map((player) => ({ player, overall: value(player) })).sort((a, b) => b.overall - a.overall || a.player.id.localeCompare(b.player.id))
    if (ranked.length === 0) throw new RangeError(`Missing ${position}`)
    if (ranked.length === 1) return [[ranked[0]!.player.id, MINUTES_PER_POSITION] as const]
    const best = ranked[0]!.overall
    const initial = ranked.map((row) => Math.exp((row.overall - best) / CONFIG.temperature))
    const total = initial.reduce((sum, weight) => sum + weight, 0)
    const rows = ranked.filter((_, index) => index < 2 || initial[index]! / total * MINUTES_PER_POSITION >= CONFIG.minimumShare).map((row) => ({ ...row, weight: Math.exp((row.overall - best) / CONFIG.temperature), maximum: topThree.has(row.player.id) ? CONFIG.maxWithBackup : CONFIG.maxOutsideTopThree, raw: 0, minutes: 0 }))
    let remaining = MINUTES_PER_POSITION
    let open = [...rows]
    while (open.length) {
      const weight = open.reduce((sum, row) => sum + row.weight, 0)
      const capped = open.filter((row) => row.weight / weight * remaining > row.maximum)
      if (!capped.length) { for (const row of open) { row.raw = row.weight / weight * remaining; row.minutes = Math.floor(row.raw) }; break }
      for (const row of capped) { row.raw = row.maximum; row.minutes = row.maximum; remaining -= row.maximum }
      open = open.filter((row) => !capped.includes(row))
    }
    let unassigned = MINUTES_PER_POSITION - rows.reduce((sum, row) => sum + row.minutes, 0)
    while (unassigned > 0) {
      const row = rows.filter((item) => item.minutes < item.maximum).sort((a, b) => b.raw - b.minutes - (a.raw - a.minutes) || b.overall - a.overall || a.player.id.localeCompare(b.player.id))[0]!
      row.minutes += 1; unassigned -= 1
    }
    return rows.filter((row) => row.minutes > 0).map((row) => [row.player.id, row.minutes] as const)
  })
  return { minutes: Object.fromEntries(entries) }
}
