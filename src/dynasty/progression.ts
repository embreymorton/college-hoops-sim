import { isTournamentComplete } from '../postseason'
import type { DynastyState } from './domain'
import {
  FINAL_RECRUITING_PERIOD,
  REGULAR_SEASON_RECRUITING_PERIODS,
} from './recruiting/constants'

export type DynastyProgressionAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'enter-late-recruiting' }

/**
 * One route-independent answer for mandatory Dynasty progression at the
 * Tournament → Late Recruiting boundary. A completed Tournament may validly
 * be ahead of Recruiting because the command can synchronize missing
 * postseason periods deterministically before entering Late Recruiting.
 */
export function deriveDynastyProgressionAction(
  dynasty: DynastyState,
): DynastyProgressionAction {
  const postseason = dynasty.activePostseason
  const recruiting = dynasty.recruiting
  const season = dynasty.activeSeason
  if (!postseason || !recruiting || !season || !isTournamentComplete(postseason)) {
    return { kind: 'none' }
  }
  if (recruiting.targetSeasonNumber !== season.seasonNumber + 1) {
    return { kind: 'none' }
  }
  if (recruiting.phase !== 'regular-season' && recruiting.phase !== 'postseason') {
    return { kind: 'none' }
  }
  const earliestRecoverablePeriod = REGULAR_SEASON_RECRUITING_PERIODS
  if (
    recruiting.lastResolvedPeriod < earliestRecoverablePeriod ||
    recruiting.lastResolvedPeriod > FINAL_RECRUITING_PERIOD ||
    (recruiting.phase === 'regular-season' &&
      recruiting.lastResolvedPeriod !== earliestRecoverablePeriod)
  ) {
    return { kind: 'none' }
  }
  return { kind: 'enter-late-recruiting' }
}
