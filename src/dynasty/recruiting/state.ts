import type { DynastyState } from '../domain'
import { deriveProjectedRosterOutlook } from '../rosterOutlook'
import {
  buildDefaultRecruitingBoard,
  alignAiRecruitingFocus,
  manageProgramRecruitingOffers,
} from './boards'
import { RECRUITING_V0_VERSION } from './constants'
import type { RecruitingProgramState, RecruitingState } from './domain'
import { generateRecruitingClass } from './generation'

/** Starts the single national class recruiting alongside the active regular season. */
export function initializeRecruiting(
  dynasty: DynastyState,
): DynastyState {
  const season = dynasty.activeSeason
  if (!season) throw new RangeError('Recruiting requires an active Season.')
  if (dynasty.recruiting) throw new RangeError('Dynasty Recruiting is already initialized.')

  const targetSeasonNumber = season.seasonNumber + 1
  const recruits = generateRecruitingClass({
    dynastySeed: dynasty.dynastySeed,
    targetSeasonNumber,
    season,
    capacityModel: 'flexible-v1',
  })
  const programs: Record<string, RecruitingProgramState> = {}
  for (const programId of Object.keys(season.programStates).sort()) {
    const outlook = deriveProjectedRosterOutlook(season.programStates[programId]!.team)
    const returnerCounts = Object.fromEntries(
      (['PG', 'SG', 'SF', 'PF', 'C'] as const).map((position) => [
        position,
        season.programStates[programId]!.team.roster.filter(
          (player) => player.classYear !== 'SR' && player.position === position,
        ).length,
      ]),
    ) as Record<'PG' | 'SG' | 'SF' | 'PF' | 'C', number>
    const remainingScholarships = 12 - outlook.projectedReturningPlayerIds.length
    const mandatory = Object.fromEntries((['PG', 'SG', 'SF', 'PF', 'C'] as const).map(
      (position) => [position, Math.max(0, 2 - returnerCounts[position])],
    )) as Record<'PG' | 'SG' | 'SF' | 'PF' | 'C', number>
    const compatibilityOpenings = Object.fromEntries((['PG', 'SG', 'SF', 'PF', 'C'] as const).map(
      (position) => [position, Math.max(0, Math.min(
        3 - returnerCounts[position],
        remainingScholarships - (['PG', 'SG', 'SF', 'PF', 'C'] as const).reduce(
          (sum, other) => sum + (other === position ? 0 : mandatory[other]), 0,
        ),
      ))],
    )) as Record<'PG' | 'SG' | 'SF' | 'PF' | 'C', number>
    programs[programId] = {
      programId,
      capacityModel: 'flexible-v1',
      projectedReturnerCountsByPosition: returnerCounts,
      projectedReturningPlayerCount: outlook.projectedReturningPlayerIds.length,
      projectedOpeningsByPosition: compatibilityOpenings,
      board: [],
    }
  }

  let recruiting: RecruitingState = {
    id: `recruiting:${dynasty.dynastyId}:season-${targetSeasonNumber}:${RECRUITING_V0_VERSION}`,
    targetSeasonNumber,
    phase: 'regular-season',
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

  // Align the initially generated plans after offers are known. This avoids
  // advancing premium discovery ahead of the established first refresh while
  // making Board / Offer / Focus coherent from the opening screen onward.
  for (const programId of Object.keys(programs).sort()) {
    if (programId === dynasty.controlledProgramId) continue
    const program = recruiting.programs[programId]!
    recruiting = {
      ...recruiting,
      programs: {
        ...recruiting.programs,
        [programId]: alignAiRecruitingFocus(
          { ...dynasty, recruiting },
          recruiting,
          programId,
          program,
        ),
      },
    }
  }

  return { ...dynasty, recruiting }
}
