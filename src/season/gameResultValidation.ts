import type { GameResult } from '../engine'
import type { ScheduledGame } from '../schedule'

export function getGameResultParticipantProblem(
  game: ScheduledGame,
  result: GameResult,
): string | undefined {
  if (
    result.homeTeamId !== game.homeProgramId ||
    result.awayTeamId !== game.awayProgramId
  ) {
    return (
      `Result participants ${result.homeTeamId} vs ${result.awayTeamId} ` +
      `do not match scheduled orientation ${game.homeProgramId} vs ${game.awayProgramId}.`
    )
  }

  return undefined
}

/** Checks the shallow authoritative invariants Season needs before storage. */
export function getGameResultStructureProblems(
  result: GameResult,
): string[] {
  const problems: string[] = []

  if (
    !Number.isSafeInteger(result.homeScore) ||
    result.homeScore < 0 ||
    !Number.isSafeInteger(result.awayScore) ||
    result.awayScore < 0
  ) {
    problems.push('GameResult scores must be non-negative safe integers.')
  }

  if (result.homeScore === result.awayScore) {
    problems.push('GameResult must contain a winner, not a tied final score.')
  }

  const expectedWinnerId =
    result.homeScore > result.awayScore
      ? result.homeTeamId
      : result.awayTeamId

  if (result.winnerId !== expectedWinnerId) {
    problems.push(
      `GameResult winner "${result.winnerId}" does not match its final score.`,
    )
  }

  if (
    !Number.isSafeInteger(result.overtimePeriods) ||
    result.overtimePeriods < 0
  ) {
    problems.push(
      'GameResult overtimePeriods must be a non-negative safe integer.',
    )
  }

  if (typeof result.seed === 'number' && !Number.isFinite(result.seed)) {
    problems.push('GameResult numeric seed must be finite.')
  }

  if (
    !Array.isArray(result.homePlayerStats) ||
    !Array.isArray(result.awayPlayerStats)
  ) {
    problems.push('GameResult must retain home and away Player stat arrays.')
    return problems
  }

  const homePlayerPoints = result.homePlayerStats.reduce(
    (total, stats) => total + stats.points,
    0,
  )
  const awayPlayerPoints = result.awayPlayerStats.reduce(
    (total, stats) => total + stats.points,
    0,
  )

  if (homePlayerPoints !== result.homeScore) {
    problems.push('Home Player points must equal the home final score.')
  }

  if (awayPlayerPoints !== result.awayScore) {
    problems.push('Away Player points must equal the away final score.')
  }

  return problems
}
