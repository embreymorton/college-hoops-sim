import { calculateOverall } from './overall'
import type { Player } from './player'

export const MIN_TEAM_PRESTIGE = 1
export const MAX_TEAM_PRESTIGE = 100
export const TEAM_ROSTER_SIZE = 12

/** A JSON-serializable college program and its current player roster. */
export interface Team {
  id: string
  name: string
  abbreviation: string
  /** Long-term program quality and reputation on an inclusive 1–100 scale. */
  prestige: number
  roster: Player[]
}

export function calculateRosterAverage(roster: readonly Player[]): number {
  if (roster.length === 0) {
    throw new RangeError('Cannot calculate an average for an empty roster')
  }

  return (
    roster.reduce((sum, player) => sum + calculateOverall(player), 0) /
    roster.length
  )
}

export function calculateTopPlayersAverage(
  roster: readonly Player[],
  playerCount = 5,
): number {
  if (
    !Number.isSafeInteger(playerCount) ||
    playerCount < 1 ||
    playerCount > roster.length
  ) {
    throw new RangeError('playerCount must be between 1 and the roster size')
  }

  const topOveralls = roster
    .map(calculateOverall)
    .sort((first, second) => second - first)
    .slice(0, playerCount)

  return topOveralls.reduce((sum, overall) => sum + overall, 0) / playerCount
}

