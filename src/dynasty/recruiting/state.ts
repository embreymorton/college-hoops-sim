import type { DynastyState } from '../domain'
import { deriveProjectedRosterOutlook } from '../rosterOutlook'
import {
  buildDefaultRecruitingBoard,
  manageProgramRecruitingOffers,
} from './boards'
import { RECRUITING_V0_VERSION } from './constants'
import type { RecruitingProgramState, RecruitingState } from './domain'
import { generateRecruitingClass } from './generation'

/** Starts the single national class recruiting alongside the active regular season. */
export function initializeRecruiting(dynasty: DynastyState): DynastyState {
  const season = dynasty.activeSeason
  if (!season) throw new RangeError('Recruiting requires an active Season.')
  if (dynasty.recruiting) throw new RangeError('Dynasty Recruiting is already initialized.')

  const targetSeasonNumber = season.seasonNumber + 1
  const recruits = generateRecruitingClass({
    dynastySeed: dynasty.dynastySeed,
    targetSeasonNumber,
    season,
  })
  const programs: Record<string, RecruitingProgramState> = {}
  for (const programId of Object.keys(season.programStates).sort()) {
    programs[programId] = {
      programId,
      projectedOpeningsByPosition: deriveProjectedRosterOutlook(
        season.programStates[programId]!.team,
      ).projectedOpeningsByPosition,
      board: [],
    }
  }

  let recruiting: RecruitingState = {
    id: `recruiting:${dynasty.dynastyId}:season-${targetSeasonNumber}:${RECRUITING_V0_VERSION}`,
    targetSeasonNumber,
    lastResolvedPeriod: 0,
    recruits,
    programs,
    relationshipProgressByPlayerId: {},
    commitmentsByPlayerId: {},
  }
  const context: DynastyState = { ...dynasty, recruiting }
  for (const programId of Object.keys(programs).sort()) {
    recruiting = {
      ...recruiting,
      programs: {
        ...recruiting.programs,
        [programId]: {
          ...recruiting.programs[programId]!,
          board: buildDefaultRecruitingBoard(
            { ...context, recruiting },
            recruiting,
            programId,
          ),
        },
      },
    }
  }

  for (const programId of Object.keys(programs).sort()) {
    recruiting = {
      ...recruiting,
      programs: {
        ...recruiting.programs,
        [programId]: manageProgramRecruitingOffers(
          { ...context, recruiting },
          recruiting,
          programId,
        ),
      },
    }
  }

  return { ...dynasty, recruiting }
}
