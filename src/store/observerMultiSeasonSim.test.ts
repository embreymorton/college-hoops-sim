import { beforeEach, describe, expect, it } from 'vitest'
import {
  regularSeasonSimulationSeed,
  syncRecruitingThroughCompletedRounds,
} from '../dynasty'
import { simulatePendingGamesThroughRound } from '../season'
import { useDynastyStore } from './seasonStore'

function startObserver(viewedProgramId = 'charlotte-tech', seed = 'observer-multi-season-store') {
  useDynastyStore.getState().startObserverDynasty(viewedProgramId, seed)
}

async function run(horizon: 1 | 5 | 10) {
  useDynastyStore.getState().requestObserverMultiSeasonSim()
  useDynastyStore.getState().setObserverMultiSeasonHorizon(horizon)
  await useDynastyStore.getState().confirmObserverMultiSeasonSim()
  return useDynastyStore.getState()
}

describe('Observer multi-Season store orchestration', () => {
  beforeEach(() => {
    useDynastyStore.setState({ dynasty: null, observerMultiSeasonSim: null })
  })

  it.each([1, 5, 10] as const)('completes exactly %i canonical rollover(s)', async (horizon) => {
    startObserver('charlotte-tech', `observer-horizon-${horizon}`)
    const startingSeason = useDynastyStore.getState().dynasty!.activeSeason!.seasonNumber
    const state = await run(horizon)
    expect(state.dynasty!.activeSeason!.seasonNumber).toBe(startingSeason + horizon)
    expect(state.dynasty!.history).toHaveLength(horizon)
    expect(state.dynasty!.activeSeason!.resultsByGameId).toEqual({})
    expect(state.dynasty!.recruiting!.lastResolvedPeriod).toBe(0)
    expect(state.dynasty!.activePostseason).toBeNull()
    expect(state.dynasty!.offseason).toBeNull()
    expect(state.view).toBe('hub')
    expect(state.observerMultiSeasonSim).toMatchObject({
      status: 'complete', requestedSeasons: horizon, completedSeasons: horizon,
    })
  }, 35_000)

  it('counts the current partial Season as the first rollover', async () => {
    startObserver('charlotte-tech', 'observer-mid-season-count')
    const dynasty = useDynastyStore.getState().dynasty!
    const season = simulatePendingGamesThroughRound({
      season: dynasty.activeSeason!,
      throughRound: 8,
      simulationSeed: regularSeasonSimulationSeed(dynasty.dynastySeed, 1),
    })
    useDynastyStore.setState({
      dynasty: syncRecruitingThroughCompletedRounds({ ...dynasty, activeSeason: season }),
    })
    const state = await run(1)
    expect(state.dynasty!.history.map(({ seasonNumber }) => seasonNumber)).toEqual([1])
    expect(state.dynasty!.activeSeason!.seasonNumber).toBe(2)
  }, 15_000)

  it('keeps canonical output independent of Viewed Program and binds the summary snapshot', async () => {
    startObserver('charlotte-tech', 'observer-viewed-independent')
    const first = await run(1)
    const canonical = structuredClone(first.dynasty)
    expect(first.observerMultiSeasonSim?.viewedProgramId).toBe('charlotte-tech')

    startObserver('pine-valley', 'observer-viewed-independent')
    const second = await run(1)
    expect(second.dynasty).toEqual(canonical)
    expect(second.observerMultiSeasonSim?.viewedProgramId).toBe('pine-valley')
    useDynastyStore.getState().setViewedProgram('charlotte-tech')
    expect(useDynastyStore.getState().observerMultiSeasonSim?.viewedProgramId).toBe('pine-valley')
  }, 20_000)

  it('transfers a followed Recruit to the followed Player list at rollover', async () => {
    startObserver('charlotte-tech', 'observer-follow-transfer')
    const recruitId = useDynastyStore.getState().dynasty!.recruiting!.recruits[0]!.player.id
    useDynastyStore.getState().followRecruit(recruitId)
    const state = await run(1)
    expect(state.followedRecruitIds).not.toContain(recruitId)
    expect(state.followedPlayerIds).toContain(recruitId)
  }, 15_000)

  it('rejects Coach Mode, invalid horizons, conflicting requests, and unsupported lifecycle states', () => {
    useDynastyStore.getState().selectProgram('charlotte-tech', 'coach-multi-season-guard')
    useDynastyStore.getState().requestObserverMultiSeasonSim()
    expect(useDynastyStore.getState().observerMultiSeasonSim).toBeNull()

    startObserver()
    useDynastyStore.getState().requestObserverMultiSeasonSim()
    const request = useDynastyStore.getState().observerMultiSeasonSim
    useDynastyStore.getState().setObserverMultiSeasonHorizon(20 as never)
    useDynastyStore.getState().requestObserverMultiSeasonSim()
    expect(useDynastyStore.getState().observerMultiSeasonSim).toEqual(request)

    useDynastyStore.getState().cancelObserverMultiSeasonSim()
    const dynasty = useDynastyStore.getState().dynasty!
    useDynastyStore.setState({ dynasty: { ...dynasty, offseason: {} as never } })
    useDynastyStore.getState().requestObserverMultiSeasonSim()
    expect(useDynastyStore.getState().observerMultiSeasonSim).toBeNull()
  })

  it('stops on an invariant failure without fabricating a summary', async () => {
    startObserver('charlotte-tech', 'observer-failure')
    useDynastyStore.getState().requestObserverMultiSeasonSim()
    const dynasty = useDynastyStore.getState().dynasty!
    useDynastyStore.setState({ dynasty: { ...dynasty, recruiting: null } })
    await useDynastyStore.getState().confirmObserverMultiSeasonSim()
    expect(useDynastyStore.getState().observerMultiSeasonSim).toMatchObject({
      status: 'error', completedSeasons: 0, errorSeasonNumber: 1, summary: null,
    })
    expect(useDynastyStore.getState().dynasty!.history).toHaveLength(0)
  })
})
