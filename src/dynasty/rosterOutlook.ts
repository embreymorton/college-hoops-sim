import { POSITIONS, TEAM_ROSTER_SIZE, type Team } from '../engine'
import type {
  OffseasonProgramState,
  OffseasonRosterOutlook,
  ProjectedRosterOutlook,
} from './domain'

/** Projects V0 senior departures directly from a current Team roster. */
export function deriveProjectedRosterOutlook(
  team: Team,
): ProjectedRosterOutlook {
  const projectedDepartingPlayerIds = team.roster
    .filter(({ classYear }) => classYear === 'SR')
    .map(({ id }) => id)
  const projectedReturningPlayerIds = team.roster
    .filter(({ classYear }) => classYear !== 'SR')
    .map(({ id }) => id)
  const projectedDepartingIds = new Set(projectedDepartingPlayerIds)
  const projectedOpeningsByPosition = Object.fromEntries(
    POSITIONS.map((position) => [
      position,
      team.roster.filter(
        (player) =>
          player.position === position && projectedDepartingIds.has(player.id),
      ).length,
    ]),
  ) as ProjectedRosterOutlook['projectedOpeningsByPosition']

  return {
    programId: team.id,
    currentRosterSize: team.roster.length,
    projectedDepartingPlayerIds,
    projectedReturningPlayerIds,
    projectedOpenings:
      TEAM_ROSTER_SIZE - projectedReturningPlayerIds.length,
    projectedOpeningsByPosition,
  }
}

/** Derives enrollment capacity from temporary offseason roster facts. */
export function deriveOffseasonRosterOutlook(
  program: OffseasonProgramState,
): OffseasonRosterOutlook {
  return {
    programId: program.programId,
    returningPlayerIds: program.returningPlayers.map(({ id }) => id),
    openRosterSpots: TEAM_ROSTER_SIZE - program.returningPlayers.length,
  }
}
