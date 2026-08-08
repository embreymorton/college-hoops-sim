import type { GameResult } from '../engine'
import type { ScheduledGameType } from '../schedule'

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

/** "W 82-68" / "L 70-74" from the controlled Program's perspective. */
export function formatControlledResultLine(
  isControlledHome: boolean,
  result: GameResult,
): string {
  const controlledScore = isControlledHome ? result.homeScore : result.awayScore
  const opponentScore = isControlledHome ? result.awayScore : result.homeScore
  const outcome = controlledScore > opponentScore ? 'W' : 'L'

  return `${outcome} ${controlledScore}-${opponentScore}`
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
