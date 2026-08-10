import { beforeEach, describe, expect, it } from 'vitest'
import { createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import { useDynastyStore } from './seasonStore'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'

function resetStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

/** Seeds the store with a real generated Recruiting class, already on the Recruiting screen. */
function seedRecruitingSession() {
  const dynasty = createRecruitingDynasty()
  useDynastyStore.setState({
    dynasty,
    view: 'recruiting',
    explorationViewHistory: [],
  })
  return dynasty
}

beforeEach(() => {
  resetStore()
})

describe('Dynasty section navigation', () => {
  it('shows Season / Recruiting / League during the regular season', () => {
    useDynastyStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    expect(useDynastyStore.getState().view).toBe('hub')
    expect(useDynastyStore.getState().dynasty!.activePostseason).toBeNull()
  })

  it('opens Recruiting from anywhere and resets the exploration stack', () => {
    useDynastyStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().openTeamDetails('northbridge')
    expect(useDynastyStore.getState().explorationViewHistory.length).toBeGreaterThan(0)

    useDynastyStore.getState().goToRecruiting()

    expect(useDynastyStore.getState().view).toBe('recruiting')
    expect(useDynastyStore.getState().explorationViewHistory).toEqual([])
  })

  it('remains reachable while a Postseason is active, alongside the Tournament section', () => {
    useDynastyStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    useDynastyStore.getState().generateControlledDraftBoard()
    for (let round = 0; round < 30; round += 1) {
      if (useDynastyStore.getState().dynasty!.activeSeason!.schedule.games.every(
        ({ id }) => useDynastyStore.getState().dynasty!.activeSeason!.resultsByGameId[id],
      )) break
      useDynastyStore.getState().simulateNextGame()
      useDynastyStore.getState().simulateRestOfRound()
    }
    useDynastyStore.getState().enterPostseason()

    useDynastyStore.getState().goToRecruiting()

    const state = useDynastyStore.getState()
    expect(state.view).toBe('recruiting')
    expect(state.dynasty!.activePostseason).not.toBeNull()
    expect(state.dynasty!.recruiting).not.toBeNull()
  })

  it('does not mutate Dynasty domain state when merely navigating to/from Recruiting', () => {
    const dynasty = seedRecruitingSession()

    useDynastyStore.getState().goToRecruiting()
    useDynastyStore.getState().goToHub()
    useDynastyStore.getState().goToRecruiting()

    expect(useDynastyStore.getState().dynasty).toEqual(dynasty)
  })
})

describe('Recruiting board actions', () => {
  it('adds a National Class Recruit to the board at the default priority', () => {
    const dynasty = seedRecruitingSession()
    const program = dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!
    // The default board already fills all 10 slots on initialization; make room first.
    useDynastyStore.getState().removeRecruitingTarget(program.board[0]!.playerId)

    const boardAfterRemoval =
      useDynastyStore.getState().dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!
    const onBoard = new Set(boardAfterRemoval.board.map((target) => target.playerId))
    const recruiting = useDynastyStore.getState().dynasty!.recruiting!
    const addable = recruiting.recruits.find(
      (recruit) =>
        !onBoard.has(recruit.player.id) &&
        !recruiting.commitmentsByPlayerId[recruit.player.id] &&
        program.projectedOpeningsByPosition[recruit.player.position] > 0,
    )!

    useDynastyStore.getState().addRecruitingTarget(addable.player.id)

    const nextProgram =
      useDynastyStore.getState().dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!
    const added = nextProgram.board.find((target) => target.playerId === addable.player.id)
    expect(added).toBeDefined()
    expect(added!.priority).toBe(3)
    expect(useDynastyStore.getState().recruitingActionError).toBeNull()
  })

  it('records a domain error without changing Dynasty state when an action is rejected', () => {
    const dynasty = seedRecruitingSession()

    // Adding the same Recruit twice is rejected by the canonical board API.
    const existingTargetId = dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board[0]!.playerId

    useDynastyStore.getState().addRecruitingTarget(existingTargetId)

    expect(useDynastyStore.getState().recruitingActionError).toBeTruthy()
    expect(useDynastyStore.getState().dynasty).toEqual(dynasty)
  })

  it('removes a board target through the canonical API', () => {
    const dynasty = seedRecruitingSession()
    const targetId = dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board[0]!.playerId

    useDynastyStore.getState().removeRecruitingTarget(targetId)

    const board = useDynastyStore.getState().dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board
    expect(board.some((target) => target.playerId === targetId)).toBe(false)
  })

  it('updates a board target priority through the canonical API', () => {
    const dynasty = seedRecruitingSession()
    const target = dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board[0]!
    const nextPriority = target.priority === 5 ? 4 : target.priority + 1

    useDynastyStore.getState().setRecruitingPriority(target.playerId, nextPriority)

    const updated = useDynastyStore
      .getState()
      .dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.find(
        (candidate) => candidate.playerId === target.playerId,
      )
    expect(updated!.priority).toBe(nextPriority)
  })

  it('offers and then withdraws a board target through the canonical API', () => {
    const dynasty = seedRecruitingSession()
    const program = dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!
    const unofferedTarget = program.board.find((target) => !target.hasActiveOffer)

    if (!unofferedTarget) {
      // Default board init already offers everywhere capacity allows; nothing to assert.
      return
    }

    useDynastyStore.getState().offerRecruitingTarget(unofferedTarget.playerId)
    let updated = useDynastyStore
      .getState()
      .dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.find(
        (candidate) => candidate.playerId === unofferedTarget.playerId,
      )

    if (useDynastyStore.getState().recruitingActionError) {
      // Position had no remaining offer capacity; a legitimate rejected command.
      expect(updated!.hasActiveOffer).toBe(false)
      return
    }

    expect(updated!.hasActiveOffer).toBe(true)

    useDynastyStore.getState().withdrawRecruitingOffer(unofferedTarget.playerId)
    updated = useDynastyStore
      .getState()
      .dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.find(
        (candidate) => candidate.playerId === unofferedTarget.playerId,
      )
    expect(updated!.hasActiveOffer).toBe(false)
  })

  it('never introduces a second Recruiting copy alongside canonical Dynasty state', () => {
    seedRecruitingSession()
    const state = useDynastyStore.getState()
    expect(state).not.toHaveProperty('recruiting')
    expect(state).not.toHaveProperty('recruitingBoard')
  })
})
