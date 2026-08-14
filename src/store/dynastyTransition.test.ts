import { beforeEach, describe, expect, it } from 'vitest'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import {
  completeRounds,
  createRecruitingDynasty,
} from '../dynasty/recruiting/testSupport'
import {
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
} from '../dynasty'
import { useDynastyStore } from './seasonStore'
import { deriveFollowedPlayers } from './followedPlayers'
import { UNIVERSE_V0 } from '../universe'

function resetStore(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function championshipBoundary() {
  let dynasty = createRecruitingDynasty('store-transition-v0')
  const season = completeRounds(dynasty.activeSeason!)
  dynasty = syncRecruitingThroughCompletedRounds({ ...dynasty, activeSeason: season })

  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: 'store-transition-v0:postseason',
    })
  }
  return syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
}

beforeEach(resetStore)

describe('Dynasty transition orchestration', () => {
  it('keeps the championship boundary explicit, then finalizes Recruiting exactly once', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    const history = boundary.history

    useDynastyStore.getState().enterLateRecruiting()
    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('late')
    expect(useDynastyStore.getState().dynasty!.history).toEqual(history)
    expect(useDynastyStore.getState().dynasty!.offseason).toBeNull()
    useDynastyStore.getState().finalizeRecruitingClass()
    const finalized = useDynastyStore.getState().dynasty!
    expect(finalized.recruiting!.phase).toBe('finalized')
    expect(finalized.completedRecruitingHistory).toHaveLength(1)
    expect(finalized.offseason).toBeNull()

    useDynastyStore.getState().finalizeRecruitingClass()
    expect(useDynastyStore.getState().dynasty).toBe(finalized)
  })

  it('rejects invalid transition ordering without mutating the Dynasty', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary })

    useDynastyStore.getState().beginDynastyOffseason()

    expect(useDynastyStore.getState().dynasty).toBe(boundary)
    expect(useDynastyStore.getState().recruitingActionError).toMatch(/finalized/i)
  })

  it('atomically rolls over and clears stale season presentation state', () => {
    useDynastyStore.setState({ dynasty: championshipBoundary() })
    useDynastyStore.getState().enterLateRecruiting()
    useDynastyStore.getState().finalizeRecruitingClass()
    useDynastyStore.getState().beginDynastyOffseason()
    const prepared = useDynastyStore.getState().dynasty!

    useDynastyStore.setState({
      view: 'postseasonGameHistory',
      lastPlayedGameId: 'season-1-g1',
      viewedGameId: 'season-1-g1',
      pendingSuperSim: { kind: 'midseason', throughRound: 12 },
      superSimSummary: { kind: 'midseason', throughRound: 12, segmentWins: 8, segmentLosses: 4 },
      lastPlayedTournamentGameId: 'national-final',
      viewedTournamentGameId: 'national-final',
      postseasonDraftRotation: {
        minutesByPosition: {
          PG: { 'retired-player': 40 },
          SG: {}, SF: {}, PF: {}, C: {},
        },
      },
      coachingSimpleMinutesByPlayerId: { 'retired-player': 40 },
      coachingSimpleRotationIssues: [{
        code: 'INVALID_TOTAL_MINUTES',
        message: 'stale issue',
      }],
      explorationViewHistory: ['league'],
      selectedTeamProgramId: 'northbridge',
      selectedPlayerProgramId: 'northbridge',
      selectedPlayerId: 'retired-player',
      pendingRecruitingSetupIntent: 'simulate-other-games',
    })

    useDynastyStore.getState().beginNextSeason()
    const state = useDynastyStore.getState()
    const next = state.dynasty!
    const controlledRotation = next.activeSeason!.programStates[next.controlledProgramId]!.rotation

    expect(next.activeSeason!.seasonNumber).toBe(2)
    expect(next.activeSeason!.resultsByGameId).toEqual({})
    expect(next.activePostseason).toBeNull()
    expect(next.offseason).toBeNull()
    expect(next.history).toEqual(prepared.history)
    expect(next.controlledProgramId).toBe(prepared.controlledProgramId)
    expect(next.recruiting).toMatchObject({ targetSeasonNumber: 3, lastResolvedPeriod: 0 })
    expect(next.recruiting!.programs[next.controlledProgramId]!.board).toEqual([])
    expect(state.controlledProgramDefaultRotation).toEqual(controlledRotation)
    expect(state.draftRotation).toEqual(controlledRotation)
    expect(state).toMatchObject({
      view: 'hub',
      lastPlayedGameId: null,
      viewedGameId: null,
      pendingSuperSim: null,
      superSimSummary: null,
      lastPlayedTournamentGameId: null,
      viewedTournamentGameId: null,
      postseasonControlledDefaultRotation: null,
      postseasonDraftRotation: null,
      coachingSimpleMinutesByPlayerId: null,
      coachingSimpleRotationIssues: [],
      explorationViewHistory: [],
      selectedTeamProgramId: null,
      selectedPlayerProgramId: null,
      selectedPlayerId: null,
      pendingRecruitingSetupIntent: null,
    })
  })

  it('preserves follow intent across rollover and resolves current roster facts', () => {
    useDynastyStore.setState({ dynasty: championshipBoundary() })
    const beforeSeason = useDynastyStore.getState().dynasty!.activeSeason!
    const returningPlayer = Object.values(beforeSeason.programStates)
      .flatMap((programState) => programState.team.roster)
      .find((player) => player.classYear === 'FR')!
    const beforePlayer = returningPlayer

    useDynastyStore.getState().followPlayer(returningPlayer.id)
    useDynastyStore.getState().enterLateRecruiting()
    useDynastyStore.getState().finalizeRecruitingClass()
    useDynastyStore.getState().beginDynastyOffseason()
    useDynastyStore.getState().beginNextSeason()

    const state = useDynastyStore.getState()
    const resolution = deriveFollowedPlayers(
      state.followedPlayerIds,
      state.dynasty!.activeSeason,
      UNIVERSE_V0,
    )[0]!

    expect(state.followedPlayerIds).toEqual([returningPlayer.id])
    expect(resolution.resolves).toBe(true)
    expect(resolution.player).not.toBe(beforePlayer)
    expect(resolution.player?.id).toBe(returningPlayer.id)
    expect(resolution.player?.classYear).toBe('SO')
    expect(resolution.team?.roster).toContain(resolution.player)
    expect(resolution.program?.id).toBe(resolution.team?.id)
  })

  it('reuses the empty-board first-period safeguard in Season 2', () => {
    useDynastyStore.setState({ dynasty: championshipBoundary() })
    useDynastyStore.getState().enterLateRecruiting()
    useDynastyStore.getState().finalizeRecruitingClass()
    useDynastyStore.getState().beginDynastyOffseason()
    useDynastyStore.getState().beginNextSeason()

    useDynastyStore.getState().simulateRestOfRound()
    useDynastyStore.getState().simulateNextGame()

    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBe(
      'quick-sim-controlled-game',
    )
  })
})
