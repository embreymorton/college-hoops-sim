import { cloneRotationV1, type GameResult, type Player, type Team } from '../engine'
import type { PostseasonState } from '../postseason'
import type { SeasonState } from '../season'

export function clonePlayer(player: Player): Player {
  return { ...player, attributes: { ...player.attributes } }
}

function cloneTeam(team: Team): Team {
  return { ...team, roster: team.roster.map(clonePlayer) }
}

function cloneResults(
  results: Record<string, GameResult>,
): Record<string, GameResult> {
  return Object.fromEntries(
    Object.entries(results).map(([id, result]) => [
      id,
      {
        ...result,
        homePlayerStats: result.homePlayerStats.map((stats) => ({ ...stats })),
        awayPlayerStats: result.awayPlayerStats.map((stats) => ({ ...stats })),
      },
    ]),
  )
}

export function cloneSeason(season: SeasonState): SeasonState {
  return {
    ...season,
    schedule: {
      ...season.schedule,
      configuration: { ...season.schedule.configuration },
      games: season.schedule.games.map((game) => ({ ...game })),
    },
    programStates: Object.fromEntries(
      Object.entries(season.programStates).map(([programId, state]) => [
        programId,
        {
          team: cloneTeam(state.team),
          rotation: cloneRotationV1(state.rotation),
        },
      ]),
    ),
    resultsByGameId: cloneResults(season.resultsByGameId),
  }
}

export function clonePostseason(postseason: PostseasonState): PostseasonState {
  return {
    ...postseason,
    field: postseason.field.map((entry) => ({ ...entry })),
    bracket: {
      ...postseason.bracket,
      games: postseason.bracket.games.map((game) => ({
        ...game,
        participantSources: [
          { ...game.participantSources[0] },
          { ...game.participantSources[1] },
        ],
      })),
    },
    programStates: Object.fromEntries(
      Object.entries(postseason.programStates).map(([programId, state]) => [
        programId,
        {
          team: cloneTeam(state.team),
          rotation: cloneRotationV1(state.rotation),
        },
      ]),
    ),
    resultsByGameId: cloneResults(postseason.resultsByGameId),
  }
}
