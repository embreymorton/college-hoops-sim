import { describe, expect, it } from 'vitest'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'
import { deriveDynastyProgressionAction } from './progression'
import { syncRecruitingThroughCompletedRounds } from './recruiting/simulation'

function tournamentState(complete: boolean) {
  let dynasty = createRecruitingDynasty(`progression:${complete}`)
  const season = completeRounds(dynasty.activeSeason!)
  dynasty = syncRecruitingThroughCompletedRounds({ ...dynasty, activeSeason: season })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  if (complete) {
    for (const round of TOURNAMENT_ROUNDS) {
      postseason = simulatePendingGamesInTournamentRound({
        postseason,
        round,
        simulationSeed: 'progression:postseason',
      })
    }
  }
  return { ...dynasty, activePostseason: postseason }
}

describe('Dynasty progression projection', () => {
  it('does not expose Late Recruiting during the regular Season or active Tournament', () => {
    const regularSeason = createRecruitingDynasty('progression:regular')
    expect(deriveDynastyProgressionAction(regularSeason)).toEqual({ kind: 'none' })
    expect(deriveDynastyProgressionAction(tournamentState(false))).toEqual({ kind: 'none' })
  })

  it.each([
    ['earliest recoverable boundary', 'regular-season', 24],
    ['first postseason period', 'postseason', 25],
    ['one period behind', 'postseason', 27],
    ['fully synchronized', 'postseason', 28],
  ] as const)('exposes Late Recruiting at the %s', (_, phase, lastResolvedPeriod) => {
    const complete = tournamentState(true)
    const dynasty = {
      ...complete,
      recruiting: { ...complete.recruiting!, phase, lastResolvedPeriod },
    }
    expect(deriveDynastyProgressionAction(dynasty)).toEqual({
      kind: 'enter-late-recruiting',
    })
  })

  it.each(['late', 'finalized'] as const)(
    'does not regress Recruiting from the %s phase',
    (phase) => {
      const complete = tournamentState(true)
      const dynasty = { ...complete, recruiting: { ...complete.recruiting!, phase } }
      expect(deriveDynastyProgressionAction(dynasty)).toEqual({ kind: 'none' })
    },
  )

  it('rejects impossible lifecycle combinations', () => {
    const complete = tournamentState(true)
    expect(deriveDynastyProgressionAction({
      ...complete,
      recruiting: { ...complete.recruiting!, phase: 'regular-season', lastResolvedPeriod: 23 },
    })).toEqual({ kind: 'none' })
    expect(deriveDynastyProgressionAction({
      ...complete,
      recruiting: { ...complete.recruiting!, phase: 'regular-season', lastResolvedPeriod: 25 },
    })).toEqual({ kind: 'none' })
  })

  it('is deterministic and mutation-free', () => {
    const dynasty = tournamentState(true)
    const before = structuredClone(dynasty)
    expect(deriveDynastyProgressionAction(dynasty)).toEqual(
      deriveDynastyProgressionAction(dynasty),
    )
    expect(dynasty).toEqual(before)
  })
})
