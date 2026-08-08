import type { ScheduleConfiguration } from './domain'

export const SCHEDULE_V0_VERSION = 'v0'

/** Accepted regular-season structure for the current Universe V0. */
export const SCHEDULE_V0_CONFIGURATION = {
  conferenceFormat: 'double-round-robin',
  nonConferenceGamesPerProgram: 10,
  targetHomeGamesPerProgram: 12,
  targetAwayGamesPerProgram: 12,
} as const satisfies ScheduleConfiguration
