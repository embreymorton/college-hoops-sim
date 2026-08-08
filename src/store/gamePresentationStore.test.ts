import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_PROGRAMS } from '../demo/demoPrograms'
import { useGamePresentationStore } from './gamePresentationStore'

function resetStore() {
  useGamePresentationStore.setState(useGamePresentationStore.getInitialState())
}

beforeEach(() => {
  resetStore()
})

describe('gamePresentationStore matchup invariant', () => {
  it('never starts with the same program on both sides', () => {
    const state = useGamePresentationStore.getState()
    expect(state.homeProgramId).not.toBe(state.awayProgramId)
  })

  it('ignores setHomeProgram when it would match the current away program', () => {
    useGamePresentationStore.getState().simulate()
    const beforeAttempt = useGamePresentationStore.getState()

    useGamePresentationStore.getState().setHomeProgram(beforeAttempt.awayProgramId)

    const afterAttempt = useGamePresentationStore.getState()
    expect(afterAttempt.homeProgramId).toBe(beforeAttempt.homeProgramId)
    expect(afterAttempt.homeProgramId).not.toBe(afterAttempt.awayProgramId)
    expect(afterAttempt.phase).toBe(beforeAttempt.phase)
    expect(afterAttempt.simulationSequence).toBe(beforeAttempt.simulationSequence)
    expect(afterAttempt.result).toBe(beforeAttempt.result)
  })

  it('ignores setAwayProgram when it would match the current home program', () => {
    useGamePresentationStore.getState().simulate()
    const beforeAttempt = useGamePresentationStore.getState()

    useGamePresentationStore.getState().setAwayProgram(beforeAttempt.homeProgramId)

    const afterAttempt = useGamePresentationStore.getState()
    expect(afterAttempt.awayProgramId).toBe(beforeAttempt.awayProgramId)
    expect(afterAttempt.awayProgramId).not.toBe(afterAttempt.homeProgramId)
    expect(afterAttempt.phase).toBe(beforeAttempt.phase)
    expect(afterAttempt.simulationSequence).toBe(beforeAttempt.simulationSequence)
    expect(afterAttempt.result).toBe(beforeAttempt.result)
  })

  it('still applies a valid, distinct program selection', () => {
    const initial = useGamePresentationStore.getState()
    const thirdProgram = DEMO_PROGRAMS.find(
      (program) =>
        program.id !== initial.homeProgramId &&
        program.id !== initial.awayProgramId,
    )!

    useGamePresentationStore.getState().simulate()
    useGamePresentationStore.getState().setHomeProgram(thirdProgram.id)

    const state = useGamePresentationStore.getState()
    expect(state.homeProgramId).toBe(thirdProgram.id)
    expect(state.homeSetup.team.name).toBe(thirdProgram.name)
    expect(state.homeProgramId).not.toBe(state.awayProgramId)
    expect(state.phase).toBe('pregame')
    expect(state.result).toBeNull()
    expect(state.simulationSequence).toBe(0)
  })
})
