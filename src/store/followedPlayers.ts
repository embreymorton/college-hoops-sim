import { calculateOverall, type Player, type Team } from '../engine'
import { derivePlayerSeasonStats, type SeasonState } from '../season'
import type { ProgramDefinition, UniverseDefinition } from '../universe'

/** Current-world projection of one stable followed Player ID. */
export interface FollowedPlayerResolution {
  readonly playerId: string
  readonly player: Player | null
  readonly program: ProgramDefinition | null
  readonly team: Team | null
  readonly resolves: boolean
}

export interface FollowingPlayerSeasonSummary {
  readonly gamesPlayed: number
  readonly pointsPerGame: number
  readonly reboundsPerGame: number
  readonly assistsPerGame: number
}

/** One active row for the future League → Following presentation. */
export interface FollowingViewPlayer {
  readonly playerId: string
  readonly player: Player
  readonly program: ProgramDefinition
  readonly team: Team
  readonly overall: number
  readonly seasonStats: FollowingPlayerSeasonSummary
}

/**
 * Keeps active rows separate from unresolved intent so presentation can
 * distinguish "nothing followed" from "nothing currently active."
 */
export interface FollowingViewProjection {
  readonly totalFollowed: number
  readonly activePlayers: readonly FollowingViewPlayer[]
  readonly unresolvedPlayerIds: readonly string[]
}

/**
 * Resolves user follow intent against current Season facts without retaining
 * stale Player or Program snapshots when a roster changes.
 */
export function deriveFollowedPlayers(
  followedPlayerIds: readonly string[],
  season: SeasonState | null,
  universe: UniverseDefinition,
): FollowedPlayerResolution[] {
  const programsById = new Map(
    universe.programs.map((program) => [program.id, program] as const),
  )

  return followedPlayerIds.map((playerId) => {
    if (season) {
      for (const [programId, programState] of Object.entries(
        season.programStates,
      )) {
        const player = programState.team.roster.find(
          (candidate) => candidate.id === playerId,
        )

        if (player) {
          const program = programsById.get(programId) ?? null
          return {
            playerId,
            player,
            program,
            team: programState.team,
            resolves: program !== null,
          }
        }
      }
    }

    return {
      playerId,
      player: null,
      program: null,
      team: null,
      resolves: false,
    }
  })
}

/**
 * Derives the first Following destination's current-season scan. Active rows
 * preserve first-followed order; no presentation sort preference is stored.
 */
export function deriveFollowingView(
  followedPlayerIds: readonly string[],
  season: SeasonState | null,
  universe: UniverseDefinition,
): FollowingViewProjection {
  const uniquePlayerIds = [...new Set(followedPlayerIds)]
  const resolutions = deriveFollowedPlayers(uniquePlayerIds, season, universe)
  const activePlayers: FollowingViewPlayer[] = []
  const unresolvedPlayerIds: string[] = []

  for (const resolution of resolutions) {
    if (
      !season ||
      !resolution.resolves ||
      !resolution.player ||
      !resolution.program ||
      !resolution.team
    ) {
      unresolvedPlayerIds.push(resolution.playerId)
      continue
    }

    const stats = derivePlayerSeasonStats(
      season,
      resolution.program.id,
      resolution.playerId,
    )
    activePlayers.push({
      playerId: resolution.playerId,
      player: resolution.player,
      program: resolution.program,
      team: resolution.team,
      overall: calculateOverall(resolution.player),
      seasonStats: {
        gamesPlayed: stats.gamesPlayed,
        pointsPerGame: stats.pointsPerGame,
        reboundsPerGame: stats.reboundsPerGame,
        assistsPerGame: stats.assistsPerGame,
      },
    })
  }

  return {
    totalFollowed: uniquePlayerIds.length,
    activePlayers,
    unresolvedPlayerIds,
  }
}
