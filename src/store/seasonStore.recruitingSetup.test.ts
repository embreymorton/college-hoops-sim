import { beforeEach, describe, expect, it } from 'vitest'
import { POSITIONS } from '../engine'
import {
  initializeDynastyState,
  initializeRecruiting,
  RECRUITING_FOCUS_LIMIT,
  RECRUITING_BOARD_LIMIT,
} from '../dynasty'
import { createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import {
  getNextGameForProgram,
  isRoundComplete,
  simulateScheduledGame,
} from '../season'
import {
  DEFAULT_INTERACTIVE_TEST_SEED,
  useDynastyStore,
} from './seasonStore'

const PROGRAM_ID = 'charlotte-tech'
const FIXTURE_SIMULATION_SEED = 'recruiting-setup-catch-up-fixture'

function initializeInteractiveDynasty(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
  useDynastyStore
    .getState()
    .selectProgram(PROGRAM_ID, DEFAULT_INTERACTIVE_TEST_SEED)
}

function controlledBoard() {
  const dynasty = useDynastyStore.getState().dynasty!
  return dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
}

function firstEligibleRecruitId(): string {
  const dynasty = useDynastyStore.getState().dynasty!
  const recruiting = dynasty.recruiting!
  const program = recruiting.programs[dynasty.controlledProgramId]!
  return recruiting.recruits.find(
    ({ player }) => program.projectedOpeningsByPosition[player.position] > 0,
  )!.player.id
}

beforeEach(() => {
  initializeInteractiveDynasty()
})

describe('interactive Recruiting initialization', () => {
  it('empties only the controlled strategy while preserving the autonomous class and AI plans', () => {
    const interactive = useDynastyStore.getState().dynasty!
    const autonomous = initializeRecruiting(
      initializeDynastyState({
        dynastyId: interactive.dynastyId,
        dynastySeed: interactive.dynastySeed,
        controlledProgramId: interactive.controlledProgramId,
        universe: interactive.universe,
        activeSeason: interactive.activeSeason!,
      }),
    )

    expect(controlledBoard()).toEqual([])
    expect(interactive.recruiting!.recruits).toEqual(autonomous.recruiting!.recruits)
    expect(interactive.recruiting!.relationshipProgressByPlayerId).toEqual(
      autonomous.recruiting!.relationshipProgressByPlayerId,
    )
    expect(
      interactive.recruiting!.programs[PROGRAM_ID]!.projectedOpeningsByPosition,
    ).toEqual(
      autonomous.recruiting!.programs[PROGRAM_ID]!.projectedOpeningsByPosition,
    )
    for (const programId of Object.keys(interactive.recruiting!.programs)) {
      if (programId === PROGRAM_ID) continue
      expect(interactive.recruiting!.programs[programId]).toEqual(
        autonomous.recruiting!.programs[programId],
      )
    }
  })

  it('leaves autonomous/default Dynasty initialization behavior unchanged', () => {
    const autonomous = createRecruitingDynasty('autonomous-setup-regression')
    expect(
      autonomous.recruiting!.programs[autonomous.controlledProgramId]!.board
        .length,
    ).toBeGreaterThan(0)
  })
})

describe('Generate Draft Board', () => {
  it('reuses the deterministic default plan and offer manager without advancing Recruiting', () => {
    const empty = useDynastyStore.getState().dynasty!
    const recruitsBefore = empty.recruiting!.recruits
    const relationshipsBefore = empty.recruiting!.relationshipProgressByPlayerId
    const commitmentsBefore = empty.recruiting!.commitmentsByPlayerId

    useDynastyStore.getState().generateControlledDraftBoard()
    const generated = useDynastyStore.getState().dynasty!
    const board = controlledBoard()

    expect(board.length).toBeGreaterThan(0)
    expect(board.every(({ origin }) => origin === 'assistant')).toBe(true)
    expect(board.length).toBeLessThanOrEqual(RECRUITING_BOARD_LIMIT)
    expect(new Set(board.map(({ playerId }) => playerId)).size).toBe(board.length)
    expect(board.filter(({ isFocused }) => isFocused).length).toBeLessThanOrEqual(RECRUITING_FOCUS_LIMIT)
    expect(
      board.every(({ playerId }) =>
        generated.recruiting!.recruits.some(
          ({ player }) => player.id === playerId,
        ),
      ),
    ).toBe(true)
    const program = generated.recruiting!.programs[PROGRAM_ID]!
    const focused = board.filter(({ isFocused }) => isFocused)
    expect(focused).toHaveLength(RECRUITING_FOCUS_LIMIT)
    expect(focused.every(({ hasActiveOffer }) => hasActiveOffer)).toBe(true)
    for (const position of POSITIONS) {
      const activeOffers = board.filter(({ playerId, hasActiveOffer }) => {
        const recruit = generated.recruiting!.recruits.find(
          ({ player }) => player.id === playerId,
        )
        return hasActiveOffer && recruit?.player.position === position
      }).length
      expect(activeOffers).toBeLessThanOrEqual(
        program.projectedOpeningsByPosition[position],
      )
    }
    expect(generated.recruiting!.recruits).toEqual(recruitsBefore)
    expect(generated.recruiting!.relationshipProgressByPlayerId).toEqual(
      relationshipsBefore,
    )
    expect(generated.recruiting!.commitmentsByPlayerId).toEqual(commitmentsBefore)
    expect(generated.recruiting!.lastResolvedPeriod).toBe(0)
    expect(empty.recruiting!.programs[PROGRAM_ID]!.board).toEqual([])

    const firstPlan = program
    initializeInteractiveDynasty()
    useDynastyStore.getState().generateControlledDraftBoard()
    expect(
      useDynastyStore.getState().dynasty!.recruiting!.programs[PROGRAM_ID],
    ).toEqual(firstPlan)
  })

  it('does not overwrite or fill a non-empty manual board', () => {
    useDynastyStore.getState().addRecruitingTarget(firstEligibleRecruitId())
    const manualBoard = controlledBoard()
    expect(manualBoard).toHaveLength(1)
    expect(manualBoard[0]!.origin).toBe('manual')

    useDynastyStore.getState().generateControlledDraftBoard()

    expect(controlledBoard()).toEqual(manualBoard)
  })

  it('aligns the generated Focus set after Offers, while later manual Focus and Offer choices remain independent', () => {
    useDynastyStore.getState().generateControlledDraftBoard()
    const generated = controlledBoard()
    // This fixed seed reproduced 6E.13's old failure: the naive first three
    // Board targets are not the same coherent set selected after Offers.
    expect(generated.slice(0, 3).some(({ hasActiveOffer }) => !hasActiveOffer)).toBe(
      true,
    )
    expect(
      generated.filter(({ isFocused }) => isFocused).every(({ hasActiveOffer }) =>
        hasActiveOffer,
      ),
    ).toBe(true)

    const focusedOffered = generated.find(
      ({ isFocused, hasActiveOffer }) => isFocused && hasActiveOffer,
    )!
    useDynastyStore
      .getState()
      .withdrawRecruitingOffer(focusedOffered.playerId)
    expect(
      controlledBoard().find(({ playerId }) => playerId === focusedOffered.playerId),
    ).toMatchObject({ isFocused: true, hasActiveOffer: false })

    const offered = controlledBoard().find(({ hasActiveOffer }) => hasActiveOffer)!
    useDynastyStore.getState().setRecruitingFocus(offered.playerId, false)
    expect(
      controlledBoard().find(({ playerId }) => playerId === offered.playerId),
    ).toMatchObject({ isFocused: false, hasActiveOffer: true })

    const unoffered = controlledBoard().find(
      ({ isFocused, hasActiveOffer }) => !isFocused && !hasActiveOffer,
    )!
    useDynastyStore.getState().setRecruitingFocus(unoffered.playerId, true)
    expect(
      controlledBoard().find(({ playerId }) => playerId === unoffered.playerId),
    ).toMatchObject({ isFocused: true, hasActiveOffer: false })
  })
})

describe('first-period Recruiting setup safeguard', () => {
  it('pauses a final controlled game, then Generate & Continue completes Round 1 and Period 1 once', () => {
    useDynastyStore.getState().simulateRestOfRound()
    const before = useDynastyStore.getState().dynasty!
    expect(isRoundComplete(before.activeSeason!, 1)).toBe(false)

    useDynastyStore.getState().simulateNextGame()

    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBe(
      'quick-sim-controlled-game',
    )
    expect(useDynastyStore.getState().dynasty).toEqual(before)

    useDynastyStore.getState().generateDraftBoardAndContinue()

    const after = useDynastyStore.getState().dynasty!
    expect(controlledBoard().length).toBeGreaterThan(0)
    expect(isRoundComplete(after.activeSeason!, 1)).toBe(true)
    expect(after.recruiting!.lastResolvedPeriod).toBe(1)
    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBeNull()
  })

  it('does not prompt for a controlled game that leaves AI games pending, then protects rest-of-round', () => {
    useDynastyStore.getState().simulateNextGame()
    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBeNull()
    expect(Object.keys(useDynastyStore.getState().dynasty!.activeSeason!.resultsByGameId)).toHaveLength(1)

    const beforeRest = useDynastyStore.getState().dynasty!
    useDynastyStore.getState().simulateRestOfRound()
    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBe(
      'simulate-other-games',
    )
    expect(useDynastyStore.getState().dynasty).toEqual(beforeRest)

    useDynastyStore.getState().cancelRecruitingSetup()
    expect(useDynastyStore.getState().dynasty).toEqual(beforeRest)
    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBeNull()
  })

  it('protects detailed game completion when it would finish Round 1', () => {
    useDynastyStore.getState().simulateRestOfRound()
    useDynastyStore.getState().goToGamePrep()
    expect(useDynastyStore.getState().view).toBe('gamePrep')

    const before = useDynastyStore.getState().dynasty!
    useDynastyStore.getState().playScheduledGame()

    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBe(
      'play-scheduled-game',
    )
    expect(useDynastyStore.getState().dynasty).toEqual(before)
  })

  it('preflights multi-round Game Prep catch-up before changing basketball', () => {
    const initial = useDynastyStore.getState().dynasty!
    let season = initial.activeSeason!
    for (let round = 1; round <= 3; round += 1) {
      const game = getNextGameForProgram(season, PROGRAM_ID)!
      season = simulateScheduledGame({
        season,
        scheduledGameId: game.id,
        simulationSeed: FIXTURE_SIMULATION_SEED,
      })
    }
    useDynastyStore.setState({ dynasty: { ...initial, activeSeason: season } })
    const before = useDynastyStore.getState().dynasty!

    useDynastyStore.getState().goToGamePrep()

    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBe(
      'game-prep-catch-up',
    )
    expect(useDynastyStore.getState().dynasty).toEqual(before)

    useDynastyStore.getState().generateDraftBoardAndContinue()
    expect(useDynastyStore.getState().view).toBe('gamePrep')
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(3)
  })

  it('protects Super Sim and resumes equivalently to manual generation', () => {
    useDynastyStore.getState().requestSuperSim('midseason')
    const before = useDynastyStore.getState().dynasty!
    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBe(
      'confirm-super-sim',
    )
    expect(before.activeSeason!.resultsByGameId).toEqual({})

    useDynastyStore.getState().generateDraftBoardAndContinue()
    const guarded = useDynastyStore.getState().dynasty!

    initializeInteractiveDynasty()
    useDynastyStore.getState().generateControlledDraftBoard()
    useDynastyStore.getState().requestSuperSim('midseason')
    useDynastyStore.getState().confirmSuperSim()
    const manual = useDynastyStore.getState().dynasty!

    expect(guarded.activeSeason!.resultsByGameId).toEqual(
      manual.activeSeason!.resultsByGameId,
    )
    expect(guarded.recruiting).toEqual(manual.recruiting)
  })

  it('Review Recruiting and Cancel leave simulation and Recruiting periods untouched', () => {
    useDynastyStore.getState().requestSuperSim('midseason')
    const before = useDynastyStore.getState().dynasty!
    useDynastyStore.getState().reviewRecruitingSetup()

    expect(useDynastyStore.getState().view).toBe('recruiting')
    expect(useDynastyStore.getState().pendingSuperSim).toBeNull()
    expect(useDynastyStore.getState().dynasty).toEqual(before)

    useDynastyStore.getState().goToHub()
    useDynastyStore.getState().requestSuperSim('midseason')
    useDynastyStore.getState().cancelRecruitingSetup()
    expect(useDynastyStore.getState().dynasty).toEqual(before)
    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBeNull()
    expect(useDynastyStore.getState().pendingSuperSim).toBeNull()
  })

  it('accepts a partial manual board without prompting or filling it', () => {
    useDynastyStore.getState().addRecruitingTarget(firstEligibleRecruitId())
    const manualBoard = controlledBoard()
    useDynastyStore.getState().simulateRestOfRound()
    useDynastyStore.getState().simulateNextGame()

    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBeNull()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(1)
    expect(controlledBoard()).toEqual(manualBoard)
  })

  it('does not re-enable onboarding when the board is emptied after Period 1', () => {
    useDynastyStore.getState().generateControlledDraftBoard()
    useDynastyStore.getState().simulateNextGame()
    useDynastyStore.getState().simulateRestOfRound()
    for (const { playerId } of [...controlledBoard()]) {
      useDynastyStore.getState().removeRecruitingTarget(playerId)
    }
    expect(controlledBoard()).toEqual([])

    useDynastyStore.getState().simulateNextGame()
    useDynastyStore.getState().simulateRestOfRound()

    expect(useDynastyStore.getState().pendingRecruitingSetupIntent).toBeNull()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(2)
    expect(controlledBoard()).toEqual([])
  })
})
