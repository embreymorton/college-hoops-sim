import type { GameResult, Rotation, Team } from '../engine'

export function cloneTeam(team: Team): Team {
  return {
    ...team,
    roster: team.roster.map((player) => ({
      ...player,
      attributes: { ...player.attributes },
    })),
  }
}

export function cloneRotation(rotation: Rotation): Rotation {
  return { minutes: { ...rotation.minutes } }
}

export function cloneGameResult(result: GameResult): GameResult {
  return {
    ...result,
    homePlayerStats: result.homePlayerStats.map((stats) => ({ ...stats })),
    awayPlayerStats: result.awayPlayerStats.map((stats) => ({ ...stats })),
  }
}
