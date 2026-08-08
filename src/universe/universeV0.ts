import type { UniverseDefinition } from './domain'
import { UNIVERSE_V0_CONFERENCES } from './conferences'
import { UNIVERSE_V0_PROGRAMS } from './programs'

/** Stable fictional US basketball world. Counts are V0 data constraints only. */
export const UNIVERSE_V0 = {
  id: 'fictional-us-v0',
  version: 'v0',
  configuration: {
    programCount: 32,
    conferenceCount: 4,
    programsPerConference: 8,
  },
  rosterGenerationVersion: 'v1',
  conferences: UNIVERSE_V0_CONFERENCES,
  programs: UNIVERSE_V0_PROGRAMS,
} as const satisfies UniverseDefinition
