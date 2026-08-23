import { beforeAll, describe, expect, it } from 'vitest'
import { initializePostseason, simulatePendingGamesInTournamentRound, TOURNAMENT_ROUNDS } from '../postseason'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  prepareLateRecruiting,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from '../dynasty'
import { completeRounds, createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import {
  deriveOffseasonExperience,
  type OffseasonPresentationCursor,
} from './offseasonExperience'

let postseasonComplete: DynastyState
let late: DynastyState
let finalized: DynastyState
let offseason: DynastyState

beforeAll(() => {
  const source = createRecruitingDynasty('offseason-experience-projection')
  const season = completeRounds(source.activeSeason!)
  const dynasty = syncRecruitingThroughCompletedRounds({ ...source, activeSeason: season })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: 'offseason-experience-projection-postseason',
    })
  }
  postseasonComplete = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  late = prepareLateRecruiting(postseasonComplete)
  finalized = autoFinalizeRecruiting(late).dynasty
  offseason = beginOffseason(finalized)
})

describe('deriveOffseasonExperience', () => {
  it('derives Late Recruiting and finalized Recruiting Class boundaries', () => {
    const lateView = deriveOffseasonExperience(late, null)!
    expect(lateView.viewedStage).toBe('late-recruiting')
    expect(lateView.progressionAction.kind).toBe('finalize-recruiting-class')
    expect(lateView.stages.map(({ status }) => status)).toEqual([
      'active', 'locked', 'locked', 'locked', 'locked', 'locked',
    ])

    const classView = deriveOffseasonExperience(finalized, null)!
    expect(classView.viewedStage).toBe('recruiting-class')
    expect(classView.progressionAction.kind).toBe('begin-dynasty-offseason')
    expect(classView.stages[0]).toMatchObject({ status: 'completed', isRevisitable: false })
  })

  it('normalizes stale cursors and derives canonical presentation facts without mutation', () => {
    const before = structuredClone(offseason)
    const stale: OffseasonPresentationCursor = {
      offseasonKey: 'old-season',
      furthestStage: 'ready-for-season',
      viewedStage: 'development',
    }
    const view = deriveOffseasonExperience(offseason, stale)!

    expect(view.normalizedCursor).toEqual({
      offseasonKey: view.offseasonKey,
      furthestStage: 'departures',
      viewedStage: 'departures',
    })
    expect(view.facts).toMatchObject({ rosterCount: 12 })
    expect(offseason).toEqual(before)
  })

  it('keeps furthest progression distinct from an earlier reviewed stage', () => {
    const key = deriveOffseasonExperience(offseason, null)!.offseasonKey
    const cursor: OffseasonPresentationCursor = {
      offseasonKey: key,
      furthestStage: 'roster-review',
      viewedStage: 'departures',
    }
    const first = deriveOffseasonExperience(offseason, cursor)!
    const second = deriveOffseasonExperience(offseason, structuredClone(cursor))!

    expect(first).toEqual(second)
    expect(first.viewedStage).toBe('departures')
    expect(first.furthestUnlockedStage).toBe('roster-review')
    expect(first.progressionAction).toMatchObject({
      kind: 'advance-presentation',
      target: 'ready-for-season',
    })
    expect(first.stages.find(({ id }) => id === 'departures')).toMatchObject({
      status: 'completed',
      isViewed: true,
    })
    expect(first.stages.find(({ id }) => id === 'roster-review')).toMatchObject({
      status: 'active',
      isFurthestUnlocked: true,
    })
  })

  it('clamps a viewed future stage and exposes rollover only at Ready', () => {
    const key = deriveOffseasonExperience(offseason, null)!.offseasonKey
    const clamped = deriveOffseasonExperience(offseason, {
      offseasonKey: key,
      furthestStage: 'development',
      viewedStage: 'ready-for-season',
    })!
    expect(clamped.viewedStage).toBe('development')

    const ready = deriveOffseasonExperience(offseason, {
      offseasonKey: key,
      furthestStage: 'ready-for-season',
      viewedStage: 'development',
    })!
    expect(ready.progressionAction).toEqual({
      kind: 'begin-next-season',
      label: `Start Season ${offseason.offseason!.targetSeasonNumber}`,
    })
  })
})
