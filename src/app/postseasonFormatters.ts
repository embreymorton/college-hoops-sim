import type {
  TournamentBidType,
  TournamentEntry,
  TournamentRound,
} from '../postseason'

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

/** Slightly fuller label used in count-based round-progression copy. */
export function formatTournamentProgressRoundName(
  round: TournamentRound,
): string {
  return round === 'championship'
    ? 'National Championship'
    : formatTournamentRoundName(round)
}

export function describeRemainingTournamentGames(
  round: TournamentRound,
  remainingGames: number,
): string {
  if (remainingGames === 1) {
    const singular: Record<TournamentRound, string> = {
      'round-of-16': 'Round of 16 game',
      quarterfinals: 'quarterfinal',
      semifinals: 'semifinal',
      championship: 'championship game',
    }

    return `Advance will simulate the remaining ${singular[round]}.`
  }

  const plural: Record<TournamentRound, string> = {
    'round-of-16': 'Round of 16 games',
    quarterfinals: 'quarterfinals',
    semifinals: 'semifinals',
    championship: 'championship games',
  }

  return `Advance will simulate the remaining ${remainingGames} ${plural[round]}.`
}

export function formatTournamentQuickResult(
  programName: string,
  round: TournamentRound,
  outcome: 'advanced' | 'eliminated' | 'champion',
): string {
  if (outcome === 'champion') {
    return 'National Champions'
  }

  if (outcome === 'eliminated') {
    return 'Tournament Run Ends'
  }

  return round === 'semifinals'
    ? `${programName} Advances to the National Championship`
    : `${programName} Advances`
}

export function formatSeedLabel(seed: number): string {
  return `#${seed}`
}

export function formatBidType(bidType: TournamentBidType): string {
  return bidType === 'automatic' ? 'Auto' : 'At-Large'
}

/** Completion-card wording for the controlled Program's canonical selection result. */
export function formatTournamentQualification(
  entry: TournamentEntry | undefined,
): string {
  if (!entry) {
    return 'Did Not Qualify'
  }

  const bidLabel =
    entry.bidType === 'automatic' ? 'Automatic Bid' : 'At-Large'
  return `${formatSeedLabel(entry.seed)} Seed · ${bidLabel}`
}

/** Concise Super Sim summary wording for the same canonical selection result. */
export function formatCompactTournamentQualification(
  entry: TournamentEntry | undefined,
): string {
  if (!entry) {
    return 'Did Not Qualify'
  }

  return `${formatSeedLabel(entry.seed)} · ${formatBidType(entry.bidType)}`
}

/** True when the winning seed number is higher (weaker) than the losing seed's. */
export function isUpset(winnerSeed: number, loserSeed: number): boolean {
  return winnerSeed > loserSeed
}
