import { initializeSeason, simulatePendingGamesInRound, type SeasonState } from '../../season'
import { generateRegularSeasonSchedule } from '../../schedule'
import { initializeUniverse, UNIVERSE_V0 } from '../../universe'
import { initializeDynastyState } from '../dynastyState'
import type { DynastyState } from '../domain'
import { initializeRecruiting } from './state'

export function createRecruitingDynasty(seed = 'recruiting-test-v0'): DynastyState {
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
    controlledProgramId: 'charlotte-tech',
    universe: UNIVERSE_V0,
    activeSeason: season,
  }))
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
