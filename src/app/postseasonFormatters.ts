import type { TournamentBidType, TournamentRound } from '../postseason'

/**
 * Postseason-presentation formatting helpers. These format existing
 * Postseason query output (rounds, seeds, bid types, GameResults) for
 * display — they never derive new bracket facts, advancement, or a champion
 * themselves.
 */

const TOURNAMENT_ROUND_NAMES: Record<TournamentRound, string> = {
  'round-of-16': 'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals: 'Semifinals',
  championship: 'Championship',
}

export function formatTournamentRoundName(round: TournamentRound): string {
  return TOURNAMENT_ROUND_NAMES[round]
}

export function formatSeedLabel(seed: number): string {
  return `#${seed}`
}

export function formatBidType(bidType: TournamentBidType): string {
  return bidType === 'automatic' ? 'Auto' : 'At-Large'
}

/** True when the winning seed number is higher (weaker) than the losing seed's. */
export function isUpset(winnerSeed: number, loserSeed: number): boolean {
  return winnerSeed > loserSeed
}
