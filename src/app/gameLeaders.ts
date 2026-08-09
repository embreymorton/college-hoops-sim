import type { GameResult, PlayerGameStats, Team } from '../engine'

export interface GameStatLeader {
  readonly playerId: string
  readonly playerName: string
  readonly programId: string
  readonly programName: string
  readonly programAbbreviation: string
  readonly value: number
}

export interface GameLeaders {
  readonly points: GameStatLeader | null
  readonly rebounds: GameStatLeader | null
  readonly assists: GameStatLeader | null
}

type LeaderStat = 'points' | 'rebounds' | 'assists'

interface PlayerStatCandidate {
  readonly stats: PlayerGameStats
  readonly team: Team
}

/**
 * Derives whole-game PTS/REB/AST leaders from one stored GameResult.
 * Ties resolve by minutes, then stable Player ID. A zero-high category has no
 * leader so the Hub can show a restrained empty state instead of a random name.
 */
export function deriveGameLeaders(
  result: GameResult,
  homeTeam: Team,
  awayTeam: Team,
): GameLeaders {
  assertResultTeams(result, homeTeam, awayTeam)

  const candidates: PlayerStatCandidate[] = [
    ...result.homePlayerStats.map((stats) => ({ stats, team: homeTeam })),
    ...result.awayPlayerStats.map((stats) => ({ stats, team: awayTeam })),
  ]

  const deriveLeader = (stat: LeaderStat): GameStatLeader | null => {
    const leader = candidates
      .filter(({ stats, team }) =>
        team.roster.some((player) => player.id === stats.playerId),
      )
      .sort(
        (first, second) =>
          second.stats[stat] - first.stats[stat] ||
          second.stats.minutes - first.stats.minutes ||
          first.stats.playerId.localeCompare(second.stats.playerId),
      )[0]

    if (!leader || leader.stats[stat] <= 0) {
      return null
    }

    const player = leader.team.roster.find(
      (candidate) => candidate.id === leader.stats.playerId,
    )!

    return {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      programId: leader.team.id,
      programName: leader.team.name,
      programAbbreviation: leader.team.abbreviation,
      value: leader.stats[stat],
    }
  }

  return {
    points: deriveLeader('points'),
    rebounds: deriveLeader('rebounds'),
    assists: deriveLeader('assists'),
  }
}

/** A controlled Program's canonical final-score margin in compact prose. */
export function formatControlledMargin(
  result: GameResult,
  controlledProgramId: string,
): string {
  const controlledScore =
    result.homeTeamId === controlledProgramId
      ? result.homeScore
      : result.awayTeamId === controlledProgramId
        ? result.awayScore
        : undefined

  if (controlledScore === undefined) {
    throw new RangeError(
      `Program "${controlledProgramId}" did not participate in this game`,
    )
  }

  const opponentScore =
    result.homeTeamId === controlledProgramId
      ? result.awayScore
      : result.homeScore
  const margin = Math.abs(controlledScore - opponentScore)

  return controlledScore > opponentScore
    ? `${margin}-Point Victory`
    : `${margin}-Point Defeat`
}

function assertResultTeams(
  result: GameResult,
  homeTeam: Team,
  awayTeam: Team,
): void {
  if (
    result.homeTeamId !== homeTeam.id ||
    result.awayTeamId !== awayTeam.id
  ) {
    throw new RangeError('Team arguments must match the GameResult orientation')
  }
}
