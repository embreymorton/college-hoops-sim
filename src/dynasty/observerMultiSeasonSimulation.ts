import type { RngSeed } from '../engine'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { simulatePendingGamesThroughRound } from '../season'
import type { DynastyState } from './domain'
import { beginOffseason } from './dynastyState'
import { autoFinalizeRecruiting } from './recruiting/finalization'
import {
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
} from './recruiting/simulation'
import { rolloverDynastyToNextSeason } from './rollover'

export type ObserverSeasonAdvancePhase =
  | 'regular-season'
  | 'tournament'
  | 'late-recruiting'
  | 'offseason'
  | 'rollover'

export class ObserverSeasonAdvanceError extends Error {
  constructor(
    readonly seasonNumber: number,
    readonly phase: ObserverSeasonAdvancePhase,
    cause: unknown,
  ) {
    super(
      `Season ${seasonNumber} ${phase} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    )
    this.name = 'ObserverSeasonAdvanceError'
  }
}

function seedValue(seed: RngSeed): string {
  return typeof seed === 'string' ? seed : String(seed)
}

/** Existing production namespace used by normal Season Super Sim. */
export function regularSeasonSimulationSeed(
  dynastySeed: RngSeed,
  seasonNumber: number,
): string {
  return `${seedValue(dynastySeed)}:season-${seasonNumber}:simulation`
}

/** Existing production namespace used by normal Tournament progression. */
export function postseasonSimulationSeed(
  dynastySeed: RngSeed,
  seasonNumber: number,
): string {
  return `${seedValue(dynastySeed)}:season-${seasonNumber}:postseason:simulation`
}

/**
 * Completes the active regular Season and Tournament through the same pure
 * operations and Recruiting synchronization boundaries used by normal play.
 */
export function simulateDynastyToSeasonComplete(
  dynasty: DynastyState,
): DynastyState {
  const season = dynasty.activeSeason
  if (!season) return dynasty

  const completedSeason = simulatePendingGamesThroughRound({
    season,
    throughRound: season.schedule.roundCount,
    simulationSeed: regularSeasonSimulationSeed(
      dynasty.dynastySeed,
      season.seasonNumber,
    ),
  })
  let current = syncRecruitingThroughCompletedRounds({
    ...dynasty,
    activeSeason: completedSeason,
  })
  let postseason = current.activePostseason ?? initializePostseason({
    universe: dynasty.universe,
    season: completedSeason,
  })

  current = { ...current, activePostseason: postseason }
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: postseasonSimulationSeed(
        current.dynastySeed,
        completedSeason.seasonNumber,
      ),
    })
    current = syncRecruitingThroughCompletedPostseasonRounds({
      ...current,
      activePostseason: postseason,
    })
  }

  return current
}

/** Advances an Observer Dynasty through exactly one complete canonical rollover. */
export function advanceObserverDynastyOneSeason(
  dynasty: DynastyState,
): DynastyState {
  const seasonNumber = dynasty.activeSeason?.seasonNumber ?? 0
  if (dynasty.controlledProgramId !== null) {
    throw new RangeError('Multi-Season simulation requires an Observer Dynasty.')
  }
  if (!dynasty.activeSeason || dynasty.activePostseason || dynasty.offseason) {
    throw new RangeError('Multi-Season simulation requires an active regular Season.')
  }

  let current: DynastyState
  try {
    current = simulateDynastyToSeasonComplete(dynasty)
  } catch (error) {
    throw new ObserverSeasonAdvanceError(seasonNumber, 'regular-season', error)
  }
  try {
    current = autoFinalizeRecruiting(current).dynasty
  } catch (error) {
    throw new ObserverSeasonAdvanceError(seasonNumber, 'late-recruiting', error)
  }
  try {
    current = beginOffseason(current)
  } catch (error) {
    throw new ObserverSeasonAdvanceError(seasonNumber, 'offseason', error)
  }
  try {
    return rolloverDynastyToNextSeason(current)
  } catch (error) {
    throw new ObserverSeasonAdvanceError(seasonNumber, 'rollover', error)
  }
}
