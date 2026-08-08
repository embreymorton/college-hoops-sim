import type { RegularSeasonSchedule, ScheduledGame } from './domain'

/** Returns a Program's games in canonical schedule order. */
export function getGamesForProgram(
  schedule: RegularSeasonSchedule,
  programId: string,
): ScheduledGame[] {
  return schedule.games.filter(
    ({ homeProgramId, awayProgramId }) =>
      homeProgramId === programId || awayProgramId === programId,
  )
}
