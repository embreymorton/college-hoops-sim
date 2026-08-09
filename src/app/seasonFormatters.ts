import type { GameResult } from '../engine'
import type { ScheduledGameType } from '../schedule'
import type { SeasonSessionView } from '../store'

/**
 * Season-presentation formatting helpers. These format existing Season query
 * output (records, ScheduledGames, GameResults) for display — they never
 * derive new basketball facts, records, or standings themselves.
 */

export function formatRecord(wins: number, losses: number): string {
  return `${wins}-${losses}`
}

/** "vs Opponent" when the controlled Program hosts, otherwise "@ Opponent". */
export function formatOpponentLine(
  isControlledHome: boolean,
  opponentName: string,
): string {
  return isControlledHome ? `vs ${opponentName}` : `@ ${opponentName}`
}

/** "82-68" from the controlled Program's perspective (controlled score first). */
export function formatControlledScoreLine(
  isControlledHome: boolean,
  result: GameResult,
): string {
  const controlledScore = isControlledHome ? result.homeScore : result.awayScore
  const opponentScore = isControlledHome ? result.awayScore : result.homeScore

  return `${controlledScore}-${opponentScore}`
}

/** "W" / "L" from the controlled Program's perspective. */
export function formatControlledOutcome(
  isControlledHome: boolean,
  result: GameResult,
): 'W' | 'L' {
  const controlledScore = isControlledHome ? result.homeScore : result.awayScore
  const opponentScore = isControlledHome ? result.awayScore : result.homeScore

  return controlledScore > opponentScore ? 'W' : 'L'
}

/** "W 82-68" / "L 70-74" from the controlled Program's perspective. */
export function formatControlledResultLine(
  isControlledHome: boolean,
  result: GameResult,
): string {
  return `${formatControlledOutcome(isControlledHome, result)} ${formatControlledScoreLine(isControlledHome, result)}`
}

export function formatGameTypeTag(type: ScheduledGameType): string {
  return type === 'conference' ? 'Conf' : 'Non-Conf'
}

export function describeRoundProgress(
  completedGames: number,
  totalGames: number,
): string {
  return `${completedGames} of ${totalGames} games complete`
}

/** "Season" / "Tournament" / "League" / "Team" / "Player" — the screen one exploration back-step returns to. */
export function formatBackDestinationLabel(view: SeasonSessionView): string {
  switch (view) {
    case 'postseasonHub':
      return 'Tournament'
    case 'league':
      return 'League'
    case 'teamDetails':
      return 'Team'
    case 'playerDetails':
      return 'Player'
    case 'recruiting':
      return 'Recruiting'
    default:
      return 'Season'
  }
}

/** "1st", "2nd", "3rd", "4th", "11th", "21st" — for a 1-based Conference standing. */
export function formatOrdinal(position: number): string {
  const remainder100 = position % 100

  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${position}th`
  }

  switch (position % 10) {
    case 1:
      return `${position}st`
    case 2:
      return `${position}nd`
    case 3:
      return `${position}rd`
    default:
      return `${position}th`
  }
}
