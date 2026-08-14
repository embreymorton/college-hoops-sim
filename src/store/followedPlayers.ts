import type { Player, Team } from '../engine'
import type { SeasonState } from '../season'
import type { ProgramDefinition, UniverseDefinition } from '../universe'

/** Current-world projection of one stable followed Player ID. */
export interface FollowedPlayerResolution {
  readonly playerId: string
  readonly player: Player | null
  readonly program: ProgramDefinition | null
  readonly team: Team | null
  readonly resolves: boolean
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
