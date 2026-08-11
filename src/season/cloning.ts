import { cloneRotationV1, type GameResult, type RotationV1, type Team } from '../engine'

export function cloneTeam(team: Team): Team {
  return {
    ...team,
    roster: team.roster.map((player) => ({
      ...player,
      attributes: { ...player.attributes },
    })),
  }
}

export function cloneRotation(rotation: RotationV1): RotationV1 {
  return cloneRotationV1(rotation)
}

export function cloneGameResult(result: GameResult): GameResult {
  return {
    ...result,
    homePlayerStats: result.homePlayerStats.map((stats) => ({ ...stats })),
    awayPlayerStats: result.awayPlayerStats.map((stats) => ({ ...stats })),
  }
}
