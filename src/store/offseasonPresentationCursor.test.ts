import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializePostseason, simulatePendingGamesInTournamentRound, TOURNAMENT_ROUNDS } from '../postseason'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from '../dynasty'
import { completeRounds, createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import { useDynastyStore } from './seasonStore'

let prepared: DynastyState

beforeAll(() => {
  const source = createRecruitingDynasty('offseason-cursor-store')
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({ ...source, activeSeason: season })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: 'offseason-cursor-store-postseason',
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  prepared = beginOffseason(autoFinalizeRecruiting(dynasty).dynasty)
})

beforeEach(() => {
  useDynastyStore.setState(useDynastyStore.getInitialState())
  const offseason = prepared.offseason!
  useDynastyStore.setState({
    dynasty: prepared,
    view: 'offseason',
    offseasonPresentationCursor: {
      offseasonKey: `${offseason.completedSeasonNumber}:${offseason.targetSeasonNumber}`,
      furthestStage: 'departures',
      viewedStage: 'departures',
    },
  })
})

describe('transient offseason presentation cursor', () => {
  it('advances sequentially and reviewing an earlier stage never regresses progression', () => {
    const before = structuredClone(prepared)
    useDynastyStore.getState().advanceOffseasonPresentation('development')
    useDynastyStore.getState().advanceOffseasonPresentation('roster-review')
    useDynastyStore.getState().viewOffseasonStage('recruiting-class')

    expect(useDynastyStore.getState().offseasonPresentationCursor).toMatchObject({
      furthestStage: 'roster-review',
      viewedStage: 'recruiting-class',
    })
    expect(useDynastyStore.getState().dynasty).toEqual(before)

    useDynastyStore.getState().advanceOffseasonPresentation('ready-for-season')
    expect(useDynastyStore.getState().offseasonPresentationCursor).toMatchObject({
      furthestStage: 'ready-for-season',
      viewedStage: 'ready-for-season',
    })
  })

  it('rejects skipped/future reviews and survives exploration navigation', () => {
    useDynastyStore.getState().viewOffseasonStage('roster-review')
    expect(useDynastyStore.getState().offseasonPresentationCursor?.viewedStage).toBe('departures')

    useDynastyStore.getState().openHistory()
    expect(useDynastyStore.getState().view).toBe('history')
    useDynastyStore.getState().goBackFromExploration()
    expect(useDynastyStore.getState()).toMatchObject({
      view: 'offseason',
      offseasonPresentationCursor: {
        furthestStage: 'departures',
        viewedStage: 'departures',
      },
    })
  })

  it('resets after canonical rollover', () => {
    useDynastyStore.getState().advanceOffseasonPresentation('development')
    useDynastyStore.getState().advanceOffseasonPresentation('roster-review')
    useDynastyStore.getState().advanceOffseasonPresentation('ready-for-season')
    useDynastyStore.getState().beginNextSeason()

    expect(useDynastyStore.getState().offseasonPresentationCursor).toBeNull()
    expect(useDynastyStore.getState().view).toBe('hub')
  })
})
