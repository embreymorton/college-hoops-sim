import type { GameResult, PlayerGameStats } from '../engine'
import type { ResolvedTournamentParticipants } from './domain'

const COUNTING_FIELDS = [
  'minutes',
  'points',
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'turnovers',
  'fieldGoalsMade',
  'fieldGoalsAttempted',
  'threePointersMade',
  'threePointersAttempted',
  'freeThrowsMade',
  'freeThrowsAttempted',
] as const satisfies readonly (keyof PlayerGameStats)[]

export function getTournamentResultProblems(
  participants: ResolvedTournamentParticipants,
  result: GameResult,
): string[] {
  const problems: string[] = []
  if (
    result.homeTeamId !== participants.homeProgramId ||
    result.awayTeamId !== participants.awayProgramId
  ) {
    problems.push(
      `Result participants ${result.homeTeamId} vs ${result.awayTeamId} do not match designated orientation ${participants.homeProgramId} vs ${participants.awayProgramId}.`,
    )
  }
  if (
    !Number.isSafeInteger(result.homeScore) ||
    result.homeScore < 0 ||
    !Number.isSafeInteger(result.awayScore) ||
    result.awayScore < 0 ||
    result.homeScore === result.awayScore
  ) {
    problems.push('GameResult must contain non-negative integer scores and a winner.')
  }
  const expectedWinner =
    result.homeScore > result.awayScore
      ? result.homeTeamId
      : result.awayTeamId
  if (result.winnerId !== expectedWinner) {
    problems.push('GameResult winner does not match its final score.')
  }
  if (
    !Number.isSafeInteger(result.overtimePeriods) ||
    result.overtimePeriods < 0
  ) {
    problems.push('GameResult overtimePeriods must be a non-negative integer.')
  }
  if (typeof result.seed === 'number' && !Number.isFinite(result.seed)) {
    problems.push('GameResult numeric seed must be finite.')
  }
  for (const [side, stats, score] of [
    ['home', result.homePlayerStats, result.homeScore],
    ['away', result.awayPlayerStats, result.awayScore],
  ] as const) {
    if (!Array.isArray(stats)) {
      problems.push(`GameResult must retain ${side} Player stat arrays.`)
      continue
    }
    for (const row of stats) {
      if (typeof row.playerId !== 'string' || row.playerId.length === 0) {
        problems.push(`${side} Player stat rows require a Player ID.`)
      }
      if (
        COUNTING_FIELDS.some(
          (field) =>
            !Number.isSafeInteger(row[field]) || (row[field] as number) < 0,
        )
      ) {
        problems.push(`${side} Player stat values must be non-negative integers.`)
        break
      }
    }
    if (stats.reduce((total, row) => total + row.points, 0) !== score) {
      problems.push(`${side} Player points must equal the final score.`)
    }
  }
  return problems
}
