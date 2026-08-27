import { initializeSeason, simulatePendingGamesInRound, type SeasonState } from '../../season'
import { generateRegularSeasonSchedule } from '../../schedule'
import { initializeUniverse, UNIVERSE_V0 } from '../../universe'
import { initializeDynastyState } from '../dynastyState'
import type { DynastyState } from '../domain'
import { deriveProjectedRosterOutlook } from '../rosterOutlook'
import { initializeRecruiting } from './state'
import { alignAiRecruitingFocus, buildDefaultRecruitingBoard, manageProgramRecruitingOffers } from './boards'

export function createRecruitingDynasty(
  seed = 'recruiting-test-v0',
  controlledProgramId: string | null = 'charlotte-tech',
): DynastyState {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  const season = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }),
    seasonNumber: 1,
  })
  return initializeRecruiting(initializeDynastyState({
    dynastyId: `dynasty:${seed}`,
    dynastySeed: seed,
    controlledProgramId,
    universe: UNIVERSE_V0,
    activeSeason: season,
  }))
}

/** Legacy exact-opening fixture for tests that specifically exercise V0 behavior. */
export function createLegacyRecruitingDynasty(seed = 'recruiting-test-v0'): DynastyState {
  const dynasty = createRecruitingDynasty(seed)
  let recruiting = dynasty.recruiting!
  recruiting = {
    ...recruiting,
    programs: Object.fromEntries(Object.keys(recruiting.programs).map((programId) => [programId, {
        programId,
        projectedOpeningsByPosition: deriveProjectedRosterOutlook(
          dynasty.activeSeason!.programStates[programId]!.team,
        ).projectedOpeningsByPosition,
        board: [],
      }])),
  }
  for (const programId of Object.keys(recruiting.programs).sort()) {
    recruiting = { ...recruiting, programs: { ...recruiting.programs, [programId]: {
      ...recruiting.programs[programId]!,
      board: buildDefaultRecruitingBoard({ ...dynasty, recruiting }, recruiting, programId),
    } } }
  }
  for (const programId of Object.keys(recruiting.programs).sort()) {
    recruiting = { ...recruiting, programs: { ...recruiting.programs,
      [programId]: manageProgramRecruitingOffers({ ...dynasty, recruiting }, recruiting, programId),
    } }
  }
  for (const programId of Object.keys(recruiting.programs).sort()) {
    if (programId === dynasty.controlledProgramId) continue
    const program = recruiting.programs[programId]!
    recruiting = { ...recruiting, programs: { ...recruiting.programs,
      [programId]: alignAiRecruitingFocus({ ...dynasty, recruiting }, recruiting, programId, program),
    } }
  }
  return { ...dynasty, recruiting }
}

export function completeRounds(
  season: SeasonState,
  throughRound = season.schedule.roundCount,
): SeasonState {
  let current = season
  for (let round = 1; round <= throughRound; round += 1) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed: 'recruiting-test-games-v0',
    })
  }
  return current
}
