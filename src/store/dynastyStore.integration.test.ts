import { beforeEach, describe, expect, it } from 'vitest'
import {
  deriveNationalChampion,
  isTournamentComplete,
} from '../postseason'
import {
  getNextGameForProgram,
  simulateScheduledGame,
} from '../season'
import {
  DEFAULT_INTERACTIVE_TEST_SEED,
  useDynastyStore,
} from './seasonStore'

const PROGRAM_ID = 'charlotte-tech'
const TEST_SIMULATION_SEED =
  'college-hoops-sim:season-presentation:v0:season-1:simulation'

function resetAndSelectProgram(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
  useDynastyStore
    .getState()
    .selectProgram(PROGRAM_ID, DEFAULT_INTERACTIVE_TEST_SEED)
  useDynastyStore.getState().generateControlledDraftBoard()
}

function finishRegularSeasonManually(): void {
  for (let round = 1; round <= 24; round += 1) {
    useDynastyStore.getState().simulateNextGame()
    useDynastyStore.getState().simulateRestOfRound()
  }
}

function finishRegularSeasonWithSuperSim(): void {
  useDynastyStore.getState().requestSuperSim('endOfRegularSeason')
  useDynastyStore.getState().confirmSuperSim()
}

function finishTournamentStepwise(): void {
  useDynastyStore.getState().enterPostseason()
  while (!isTournamentComplete(useDynastyStore.getState().dynasty!.activePostseason!)) {
    useDynastyStore.getState().simulateNextPostseasonGame()
    useDynastyStore.getState().simulateRestOfCurrentTournamentRound()
  }
}

beforeEach(() => {
  resetAndSelectProgram()
})

describe('Dynasty application state integration', () => {
  it('initializes Season 1 and Recruiting for Season 2 under one canonical Dynasty', () => {
    const state = useDynastyStore.getState()
    const dynasty = state.dynasty!

    expect(dynasty.controlledProgramId).toBe(PROGRAM_ID)
    expect(dynasty.activeSeason?.seasonNumber).toBe(1)
    expect(dynasty.activePostseason).toBeNull()
    expect(dynasty.recruiting?.targetSeasonNumber).toBe(2)
    expect(dynasty.recruiting?.lastResolvedPeriod).toBe(0)
    expect(dynasty.offseason).toBeNull()
    expect(dynasty.history).toEqual([])
    expect(dynasty.completedRecruitingHistory).toEqual([])
    expect(dynasty.activeSeason?.programStates[PROGRAM_ID]).toBeDefined()
  })

  it('waits for global round completion, resolves its Recruiting period once, and is idempotent', () => {
    useDynastyStore.getState().simulateNextGame()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(0)

    useDynastyStore.getState().simulateRestOfRound()
    const afterRound = useDynastyStore.getState().dynasty!
    expect(afterRound.recruiting!.lastResolvedPeriod).toBe(1)

    useDynastyStore.getState().simulateRestOfRound()
    expect(useDynastyStore.getState().dynasty!.recruiting).toEqual(
      afterRound.recruiting,
    )
  })

  it('synchronizes when detailed game completion is the final pending game in a round', () => {
    useDynastyStore.getState().simulateRestOfRound()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(0)

    useDynastyStore.getState().goToGamePrep()
    useDynastyStore.getState().playScheduledGame()

    expect(useDynastyStore.getState().view).toBe('postgame')
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(1)
  })

  it('synchronizes every missing period when Game Prep catches up multiple past rounds', () => {
    const initial = useDynastyStore.getState().dynasty!
    let season = initial.activeSeason!

    for (let round = 1; round <= 3; round += 1) {
      const game = getNextGameForProgram(season, PROGRAM_ID)!
      expect(game.round).toBe(round)
      season = simulateScheduledGame({
        season,
        scheduledGameId: game.id,
        simulationSeed: TEST_SIMULATION_SEED,
      })
    }

    useDynastyStore.setState({ dynasty: { ...initial, activeSeason: season } })
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(0)

    useDynastyStore.getState().goToGamePrep()

    const caughtUp = useDynastyStore.getState().dynasty!
    expect(caughtUp.recruiting!.lastResolvedPeriod).toBe(3)
    expect(caughtUp.activeSeason!.resultsByGameId).toHaveProperty(
      getNextGameForProgram(initial.activeSeason!, PROGRAM_ID)!.id,
    )
  })

  it('keeps manual and Super Sim basketball and Recruiting outcomes identical', () => {
    finishRegularSeasonManually()
    const manual = useDynastyStore.getState().dynasty!

    resetAndSelectProgram()
    finishRegularSeasonWithSuperSim()
    const superSim = useDynastyStore.getState().dynasty!

    expect(superSim.activeSeason!.resultsByGameId).toEqual(
      manual.activeSeason!.resultsByGameId,
    )
    expect(superSim.recruiting!.relationshipProgressByPlayerId).toEqual(
      manual.recruiting!.relationshipProgressByPlayerId,
    )
    expect(superSim.recruiting!.commitmentsByPlayerId).toEqual(
      manual.recruiting!.commitmentsByPlayerId,
    )
    expect(superSim.recruiting!.programs).toEqual(manual.recruiting!.programs)
    expect(superSim.recruiting!.lastResolvedPeriod).toBe(24)
  })

  it('resolves global Postseason Periods 25–28 and stops at the Late Recruiting boundary', () => {
    finishRegularSeasonWithSuperSim()
    useDynastyStore.getState().enterPostseason()

    // AI-only completion leaves the controlled game pending and the global
    // Recruiting clock at 24; Quick Sim completes the round and resolves 25.
    useDynastyStore.getState().simulateRestOfCurrentTournamentRound()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(24)
    useDynastyStore.getState().simulateNextPostseasonGame()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(25)

    // The detailed Tournament path shares the same synchronization boundary.
    useDynastyStore.getState().simulateRestOfCurrentTournamentRound()
    useDynastyStore.getState().goToPostseasonGamePrep()
    useDynastyStore.getState().playPostseasonScheduledGame()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(26)

    // Charlotte Tech is eliminated by the fixed simulation at this point;
    // the global Tournament clock and every Program's Recruiting still move.
    useDynastyStore.getState().simulateRestOfCurrentTournamentRound()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(27)
    useDynastyStore.getState().simulateRestOfCurrentTournamentRound()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(28)

    const dynasty = useDynastyStore.getState().dynasty!
    expect(isTournamentComplete(dynasty.activePostseason!)).toBe(true)
    expect(dynasty.recruiting!.lastResolvedPeriod).toBe(28)
    expect(dynasty.recruiting!.phase).toBe('postseason')
    expect(dynasty.offseason).toBeNull()
    expect(dynasty.activeSeason).not.toBeNull()
    expect(dynasty.activePostseason).not.toBeNull()
    expect(dynasty.history).toEqual([])
    expect(dynasty.completedRecruitingHistory).toEqual([])

    useDynastyStore.getState().simulateRestOfCurrentTournamentRound()
    expect(useDynastyStore.getState().dynasty!.recruiting).toEqual(
      dynasty.recruiting,
    )
  })

  it('Super Sim reaches Season Complete from an early Season and stops before Late Recruiting', () => {
    useDynastyStore.getState().requestSuperSim('seasonComplete')
    useDynastyStore.getState().confirmSuperSim()

    const state = useDynastyStore.getState()
    const dynasty = state.dynasty!
    expect(Object.keys(dynasty.activeSeason!.resultsByGameId)).toHaveLength(384)
    expect(isTournamentComplete(dynasty.activePostseason!)).toBe(true)
    expect(dynasty.recruiting!.lastResolvedPeriod).toBe(28)
    expect(dynasty.recruiting!.phase).toBe('postseason')
    expect(dynasty.offseason).toBeNull()
    expect(dynasty.history).toEqual([])
    expect(state.view).toBe('postseasonHub')
  })

  it('matches stepwise production progression through the canonical Season Complete checkpoint', () => {
    finishRegularSeasonManually()
    finishTournamentStepwise()
    const manual = useDynastyStore.getState().dynasty!

    resetAndSelectProgram()
    useDynastyStore.getState().requestSuperSim('seasonComplete')
    useDynastyStore.getState().confirmSuperSim()
    const superSim = useDynastyStore.getState().dynasty!

    expect(superSim.activeSeason!.resultsByGameId).toEqual(
      manual.activeSeason!.resultsByGameId,
    )
    expect(superSim.activePostseason!.field).toEqual(manual.activePostseason!.field)
    expect(superSim.activePostseason!.bracket).toEqual(
      manual.activePostseason!.bracket,
    )
    expect(superSim.activePostseason!.resultsByGameId).toEqual(
      manual.activePostseason!.resultsByGameId,
    )
    expect(deriveNationalChampion(superSim.activePostseason!)).toBe(
      deriveNationalChampion(manual.activePostseason!),
    )
    expect(superSim.recruiting).toEqual(manual.recruiting)
    expect(superSim.offseason).toBeNull()
    expect(superSim.history).toEqual([])
  }, 30000)

  it('completes an active Tournament after the controlled Program is eliminated', () => {
    finishRegularSeasonWithSuperSim()
    useDynastyStore.getState().enterPostseason()
    useDynastyStore.getState().simulateNextPostseasonGame()
    useDynastyStore.getState().simulateRestOfCurrentTournamentRound()
    const active = useDynastyStore.getState().dynasty!
    const completedGame = Object.values(
      active.activePostseason!.resultsByGameId,
    ).find((result) => result !== undefined)!
    const guaranteedEliminatedId =
      completedGame.winnerId === completedGame.homeTeamId
        ? completedGame.awayTeamId
        : completedGame.homeTeamId
    useDynastyStore.setState({
      dynasty: { ...active, controlledProgramId: guaranteedEliminatedId },
    })

    useDynastyStore.getState().requestSuperSim('seasonComplete')
    useDynastyStore.getState().confirmSuperSim()

    const dynasty = useDynastyStore.getState().dynasty!
    expect(isTournamentComplete(dynasty.activePostseason!)).toBe(true)
    expect(dynasty.recruiting!.lastResolvedPeriod).toBe(28)
  })

  it('completes the Tournament when the controlled Program did not qualify', () => {
    finishRegularSeasonWithSuperSim()
    useDynastyStore.getState().enterPostseason()
    const dynasty = useDynastyStore.getState().dynasty!
    const nonQualifier = Object.keys(dynasty.activeSeason!.programStates).find(
      (programId) =>
        !dynasty.activePostseason!.field.some(
          (entry) => entry.programId === programId,
        ),
    )!
    useDynastyStore.setState({
      dynasty: { ...dynasty, controlledProgramId: nonQualifier },
    })

    useDynastyStore.getState().requestSuperSim('seasonComplete')
    useDynastyStore.getState().confirmSuperSim()

    const completed = useDynastyStore.getState().dynasty!
    expect(isTournamentComplete(completed.activePostseason!)).toBe(true)
    expect(completed.recruiting!.lastResolvedPeriod).toBe(28)
  })

  it('treats an already-complete Season target as unavailable and never enters Late Recruiting', () => {
    useDynastyStore.getState().requestSuperSim('seasonComplete')
    useDynastyStore.getState().confirmSuperSim()
    const before = useDynastyStore.getState().dynasty!

    useDynastyStore.getState().requestSuperSim('seasonComplete')

    expect(useDynastyStore.getState().pendingSuperSim).toBeNull()
    expect(useDynastyStore.getState().dynasty).toBe(before)
    expect(before.recruiting!.phase).toBe('postseason')
  })

  it('does not expose independent canonical Season/Postseason/Recruiting/Offseason values', () => {
    const state = useDynastyStore.getState()
    expect(state).not.toHaveProperty('season')
    expect(state).not.toHaveProperty('postseason')
    expect(state).not.toHaveProperty('recruiting')
    expect(state).not.toHaveProperty('offseason')
    expect(state).not.toHaveProperty('controlledProgramId')
    expect(state.dynasty).not.toBeNull()
  })
})
