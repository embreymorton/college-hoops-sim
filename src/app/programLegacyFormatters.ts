import type { HistoricalTournamentOutcome } from '../dynasty'
import { formatTournamentRoundName } from './postseasonFormatters'

export function formatHistoricalTournamentOutcome(
  outcome: HistoricalTournamentOutcome,
): string {
  switch (outcome.status) {
    case 'did-not-qualify': return 'Did Not Qualify'
    case 'national-champion': return 'National Champion'
    case 'runner-up': return 'Runner-Up'
    case 'eliminated': return formatTournamentRoundName(outcome.round)
  }
}
