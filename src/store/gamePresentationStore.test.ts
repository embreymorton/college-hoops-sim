import { beforeEach, describe, expect, it } from 'vitest'
import {
  generateDefaultRotationV1,
  getPlayersByMinutesV1,
  simulateGame,
  validateRotationV1,
} from '../engine'
import { DEMO_PROGRAMS, getDemoProgram } from '../demo/demoPrograms'
import { buildGameSeed, useGamePresentationStore } from './gamePresentationStore'

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

describe('gamePresentationStore home Rotation editing', () => {
  it('starts with the home Rotation equal to the generated default', () => {
    const { homeSetup, homeRotation } = useGamePresentationStore.getState()
    expect(homeRotation).toEqual(homeSetup.rotation)
    expect(homeSetup.rotation).toEqual(generateDefaultRotationV1(homeSetup.team))
  })

  it('updates a single Player minutes without discarding the rest of the Rotation', () => {
    const { homeSetup } = useGamePresentationStore.getState()
    const [firstPlayer] = getPlayersByMinutesV1(homeSetup.team, homeSetup.rotation)

    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(firstPlayer!.player.id, firstPlayer!.player.position, 12)

    const { homeRotation } = useGamePresentationStore.getState()
    expect(homeRotation.minutesByPosition[firstPlayer!.player.position][firstPlayer!.player.id]).toBe(12)
  })

  it('omits a Player from the Rotation at zero minutes, preserving the canonical shape', () => {
    const { homeSetup } = useGamePresentationStore.getState()
    const [firstPlayer] = getPlayersByMinutesV1(homeSetup.team, homeSetup.rotation)

    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(firstPlayer!.player.id, firstPlayer!.player.position, 0)

    const { homeRotation } = useGamePresentationStore.getState()
    expect(
      Object.prototype.hasOwnProperty.call(
        homeRotation.minutesByPosition[firstPlayer!.player.position],
        firstPlayer!.player.id,
      ),
    ).toBe(false)
  })

  it('allows a temporarily invalid Rotation while editing', () => {
    const { homeSetup } = useGamePresentationStore.getState()
    const [firstPlayer] = getPlayersByMinutesV1(homeSetup.team, homeSetup.rotation)

    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(firstPlayer!.player.id, firstPlayer!.player.position, firstPlayer!.minutes + 5)

    const { homeSetup: currentSetup, homeRotation } =
      useGamePresentationStore.getState()
    expect(validateRotationV1(currentSetup.team, homeRotation).valid).toBe(
      false,
    )
  })

  it('does not simulate while the home Rotation is invalid', () => {
    const { homeSetup } = useGamePresentationStore.getState()
    const [firstPlayer] = getPlayersByMinutesV1(homeSetup.team, homeSetup.rotation)
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(firstPlayer!.player.id, firstPlayer!.player.position, firstPlayer!.minutes + 5)

    useGamePresentationStore.getState().simulate()

    const state = useGamePresentationStore.getState()
    expect(state.result).toBeNull()
    expect(state.phase).toBe('pregame')
    expect(state.simulationSequence).toBe(0)
  })

  it('simulates once the Rotation returns to a legal total', () => {
    const { homeSetup } = useGamePresentationStore.getState()
    const [firstPlayer] = getPlayersByMinutesV1(homeSetup.team, homeSetup.rotation)
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(firstPlayer!.player.id, firstPlayer!.player.position, firstPlayer!.minutes + 5)
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(firstPlayer!.player.id, firstPlayer!.player.position, firstPlayer!.minutes)

    useGamePresentationStore.getState().simulate()

    const state = useGamePresentationStore.getState()
    expect(state.result).not.toBeNull()
    expect(state.phase).toBe('postgame')
    expect(state.simulationSequence).toBe(1)
  })

  it('uses the actual edited home Rotation and the away Team default Rotation when simulating', () => {
    const { homeSetup, awaySetup, homeProgramId, awayProgramId } =
      useGamePresentationStore.getState()
    const pointGuards = getPlayersByMinutesV1(
      homeSetup.team,
      homeSetup.rotation,
    ).filter(({ player }) => player.position === 'PG')
    const donor = pointGuards[0]!
    const recipient = pointGuards[1]!

    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(donor.player.id, 'PG', donor.minutes - 2)
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(recipient.player.id, 'PG', recipient.minutes + 2)

    const editedRotation = useGamePresentationStore.getState().homeRotation
    expect(validateRotationV1(homeSetup.team, editedRotation).valid).toBe(true)
    expect(editedRotation).not.toEqual(homeSetup.rotation)

    useGamePresentationStore.getState().simulate()

    const expectedSeed = buildGameSeed(
      getDemoProgram(homeProgramId).abbreviation,
      getDemoProgram(awayProgramId).abbreviation,
      1,
    )
    const expectedResult = simulateGame({
      homeTeam: homeSetup.team,
      awayTeam: awaySetup.team,
      homeRotation: editedRotation,
      awayRotation: awaySetup.rotation,
      seed: expectedSeed,
    })

    expect(useGamePresentationStore.getState().result).toEqual(expectedResult)
  })

  it('restores the generated default Rotation on resetHomeRotation', () => {
    const { homeSetup } = useGamePresentationStore.getState()
    const [firstPlayer] = getPlayersByMinutesV1(homeSetup.team, homeSetup.rotation)
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(firstPlayer!.player.id, firstPlayer!.player.position, firstPlayer!.minutes + 3)
    expect(useGamePresentationStore.getState().homeRotation).not.toEqual(
      homeSetup.rotation,
    )

    useGamePresentationStore.getState().resetHomeRotation()

    expect(useGamePresentationStore.getState().homeRotation).toEqual(
      homeSetup.rotation,
    )
  })

  it('preserves the custom home Rotation when returning from postgame to the matchup screen', () => {
    const { homeSetup } = useGamePresentationStore.getState()
    const shootingGuards = getPlayersByMinutesV1(
      homeSetup.team,
      homeSetup.rotation,
    ).filter(({ player }) => player.position === 'SG')
    const donor = shootingGuards[0]!
    const recipient = shootingGuards[1]!
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(donor.player.id, 'SG', donor.minutes - 3)
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(recipient.player.id, 'SG', recipient.minutes + 3)
    const editedRotation = useGamePresentationStore.getState().homeRotation

    useGamePresentationStore.getState().simulate()
    expect(useGamePresentationStore.getState().phase).toBe('postgame')

    useGamePresentationStore.getState().changeMatchup()

    const state = useGamePresentationStore.getState()
    expect(state.phase).toBe('pregame')
    expect(state.homeRotation).toEqual(editedRotation)
  })

  it('preserves the custom Rotation and advances the deterministic seed sequence on Simulate Again', () => {
    const { homeSetup } = useGamePresentationStore.getState()
    const forwards = getPlayersByMinutesV1(
      homeSetup.team,
      homeSetup.rotation,
    ).filter(({ player }) => player.position === 'SF')
    const donor = forwards[0]!
    const recipient = forwards[1]!
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(donor.player.id, 'SF', donor.minutes - 1)
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(recipient.player.id, 'SF', recipient.minutes + 1)
    const editedRotation = useGamePresentationStore.getState().homeRotation

    useGamePresentationStore.getState().simulate()
    const firstResult = useGamePresentationStore.getState().result
    expect(useGamePresentationStore.getState().simulationSequence).toBe(1)

    useGamePresentationStore.getState().simulate()

    const state = useGamePresentationStore.getState()
    expect(state.homeRotation).toEqual(editedRotation)
    expect(state.simulationSequence).toBe(2)
    expect(state.result).not.toBeNull()
    expect(state.result!.seed).not.toBe(firstResult!.seed)
  })

  it('replaces the custom Rotation with the new Team default when the home program changes', () => {
    const initial = useGamePresentationStore.getState()
    const [firstPlayer] = getPlayersByMinutesV1(
      initial.homeSetup.team,
      initial.homeSetup.rotation,
    )
    useGamePresentationStore
      .getState()
      .setHomePlayerPositionMinutes(firstPlayer!.player.id, firstPlayer!.player.position, firstPlayer!.minutes + 2)
    expect(useGamePresentationStore.getState().homeRotation).not.toEqual(
      initial.homeSetup.rotation,
    )

    const thirdProgram = DEMO_PROGRAMS.find(
      (program) =>
        program.id !== initial.homeProgramId &&
        program.id !== initial.awayProgramId,
    )!
    useGamePresentationStore.getState().setHomeProgram(thirdProgram.id)

    const state = useGamePresentationStore.getState()
    expect(state.homeRotation).toEqual(state.homeSetup.rotation)
    expect(state.homeSetup.team.name).toBe(thirdProgram.name)
  })
})
