import { calculateOverall, type Player, type Team } from '../engine'
import {
  derivePlayerCareerSummary,
  resolveDynastyPlayer,
  type DynastyState,
} from '../dynasty'
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

export interface FollowingFormerPlayer {
  readonly playerId: string
  readonly player: Player
  readonly program: ProgramDefinition
  readonly firstSeasonNumber: number
  readonly lastSeasonNumber: number
  readonly finalOverall: number
  readonly careerPointsPerGame: number
}

/**
 * Keeps active rows separate from unresolved intent so presentation can
 * distinguish "nothing followed" from "nothing currently active."
 */
export interface FollowingViewProjection {
  readonly totalFollowed: number
  readonly activePlayers: readonly FollowingViewPlayer[]
  readonly formerPlayers: readonly FollowingFormerPlayer[]
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
  dynasty: DynastyState,
): FollowingViewProjection {
  const uniquePlayerIds = [...new Set(followedPlayerIds)]
  const programsById = new Map(
    dynasty.universe.programs.map((program) => [program.id, program] as const),
  )
  const activePlayers: FollowingViewPlayer[] = []
  const formerPlayers: FollowingFormerPlayer[] = []
  const unresolvedPlayerIds: string[] = []

  for (const playerId of uniquePlayerIds) {
    const resolution = resolveDynastyPlayer(dynasty, playerId)
    if (resolution.status === 'unknown') {
      unresolvedPlayerIds.push(resolution.playerId)
      continue
    }

    const program = programsById.get(resolution.programId)
    if (!program) {
      unresolvedPlayerIds.push(resolution.playerId)
      continue
    }

    if (resolution.status === 'former') {
      const summary = derivePlayerCareerSummary(resolution.careerHistory)
      formerPlayers.push({
        playerId: resolution.playerId,
        player: resolution.player,
        program,
        firstSeasonNumber: summary.firstSeasonNumber,
        lastSeasonNumber: summary.lastSeasonNumber,
        finalOverall: summary.finalOverall,
        careerPointsPerGame: summary.pointsPerGame,
      })
      continue
    }

    const season = dynasty.activeSeason!
    const team = season.programStates[resolution.programId]?.team
    if (!team) {
      unresolvedPlayerIds.push(resolution.playerId)
      continue
    }
    const stats = derivePlayerSeasonStats(season, resolution.programId, playerId)
    activePlayers.push({
      playerId,
      player: resolution.player,
      program,
      team,
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
    formerPlayers,
    unresolvedPlayerIds,
  }
}
