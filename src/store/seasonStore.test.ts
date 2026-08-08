import { beforeEach, describe, expect, it } from 'vitest'
import { getPlayersByMinutes, simulateGame, validateRotation } from '../engine'
import {
  deriveProgramRecord,
  getCurrentRound,
  getNextGameForProgram,
  getPendingGamesForRound,
  isRegularSeasonComplete,
  validateSeasonState,
} from '../season'
import { UNIVERSE_V0 } from '../universe'
import { useSeasonStore } from './seasonStore'

function resetStore() {
  useSeasonStore.setState(useSeasonStore.getInitialState())
}

/** Drives the current Season to completion; capped so a real bug fails fast. */
function driveSeasonToCompletion(): void {
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const season = useSeasonStore.getState().season!

    if (isRegularSeasonComplete(season)) {
      return
    }

    useSeasonStore.getState().playScheduledGame()
    useSeasonStore.getState().simulateRestOfRound()
  }

  throw new Error('Season did not complete within the expected round budget.')
}

beforeEach(() => {
  resetStore()
})

describe('seasonStore initialization', () => {
  it('starts with no controlled Program and no Season', () => {
    const state = useSeasonStore.getState()
    expect(state.controlledProgramId).toBeNull()
    expect(state.season).toBeNull()
    expect(state.view).toBe('programSelect')
  })

  it('initializes a structurally valid Season for the 32-Program Universe V0', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const state = useSeasonStore.getState()
    expect(state.season).not.toBeNull()
    expect(Object.keys(state.season!.programStates)).toHaveLength(32)
    expect(state.season!.schedule.games).toHaveLength(384)
    expect(state.season!.schedule.roundCount).toBe(24)
    expect(validateSeasonState(UNIVERSE_V0, state.season!).valid).toBe(true)
  })

  it('stores controlled Program ownership outside SeasonState', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const state = useSeasonStore.getState()
    expect(state.controlledProgramId).toBe('charlotte-tech')
    expect(state.season).not.toHaveProperty('controlledProgramId')
    expect(
      Object.prototype.hasOwnProperty.call(
        state.season!.programStates['charlotte-tech'] ?? {},
        'controlledProgramId',
      ),
    ).toBe(false)
  })

  it('navigates to the Season Hub after selecting a Program', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    expect(useSeasonStore.getState().view).toBe('hub')
  })

  it('shows 0-0 initial overall and Conference records for the controlled Program', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const state = useSeasonStore.getState()
    const record = deriveProgramRecord(state.season!, 'charlotte-tech')
    expect(record).toEqual({ wins: 0, losses: 0 })
  })

  it('starts at Round 1', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const state = useSeasonStore.getState()
    expect(getCurrentRound(state.season!)).toBe(1)
  })

  it('produces a deterministic Season for a given Program across store instances', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const first = useSeasonStore.getState().season

    resetStore()
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const second = useSeasonStore.getState().season

    expect(second).toEqual(first)
  })

  it('does not duplicate record, standings, or current-round state alongside SeasonState', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const stateKeys = Object.keys(useSeasonStore.getState())
    for (const forbidden of [
      'record',
      'overallRecord',
      'conferenceRecord',
      'standings',
      'currentRound',
      'isSeasonComplete',
      'nextOpponent',
    ]) {
      expect(stateKeys).not.toContain(forbidden)
    }
  })
})

describe('seasonStore next opponent', () => {
  it('matches the Schedule query for the controlled Program', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const state = useSeasonStore.getState()
    const expectedGame = getNextGameForProgram(state.season!, 'charlotte-tech')
    expect(expectedGame).toBeDefined()
    expect(expectedGame!.round).toBe(1)
  })
})

describe('seasonStore Rotation editing', () => {
  it('reflects the current Season Rotation in Team Strength once legally edited', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const { season } = useSeasonStore.getState()
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const pointGuards = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    ).filter(({ player }) => player.position === 'PG')

    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(pointGuards[0]!.player.id, pointGuards[0]!.minutes - 2)
    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(pointGuards[1]!.player.id, pointGuards[1]!.minutes + 2)

    const state = useSeasonStore.getState()
    expect(validateRotation(controlledTeam, state.draftRotation!).valid).toBe(true)
    expect(state.draftRotation).not.toEqual(season!.programStates['charlotte-tech']!.rotation)
  })

  it('persists a legal Rotation edit into SeasonState', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const { season } = useSeasonStore.getState()
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const forwards = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    ).filter(({ player }) => player.position === 'SF')

    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(forwards[0]!.player.id, forwards[0]!.minutes - 3)
    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(forwards[1]!.player.id, forwards[1]!.minutes + 3)

    const editedRotation = useSeasonStore.getState().draftRotation
    const persisted =
      useSeasonStore.getState().season!.programStates['charlotte-tech']!.rotation

    expect(persisted).toEqual(editedRotation)
  })

  it('does not persist a temporarily invalid draft into SeasonState', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const originalRotation =
      useSeasonStore.getState().season!.programStates['charlotte-tech']!.rotation
    const { season } = useSeasonStore.getState()
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const [firstPlayer] = getPlayersByMinutes(controlledTeam, originalRotation)

    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)

    const state = useSeasonStore.getState()
    expect(validateRotation(controlledTeam, state.draftRotation!).valid).toBe(false)
    expect(state.season!.programStates['charlotte-tech']!.rotation).toEqual(
      originalRotation,
    )
  })

  it('preserves a custom Rotation into future rounds', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    const { season } = useSeasonStore.getState()
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const centers = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    ).filter(({ player }) => player.position === 'C')

    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(centers[0]!.player.id, centers[0]!.minutes - 1)
    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(centers[1]!.player.id, centers[1]!.minutes + 1)
    const editedRotation = useSeasonStore.getState().draftRotation

    useSeasonStore.getState().playScheduledGame()
    useSeasonStore.getState().simulateRestOfRound()
    useSeasonStore.getState().goToHub()

    const state = useSeasonStore.getState()
    expect(getCurrentRound(state.season!)).toBe(2)
    expect(getNextGameForProgram(state.season!, 'charlotte-tech')!.round).toBe(2)
    expect(state.draftRotation).toEqual(editedRotation)
    expect(
      state.season!.programStates['charlotte-tech']!.rotation,
    ).toEqual(editedRotation)
  })
})

describe('seasonStore game simulation', () => {
  it('records the actual ScheduledGame result using the current Team/Rotation', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const { season } = useSeasonStore.getState()
    const game = getNextGameForProgram(season!, 'charlotte-tech')!
    const home = season!.programStates[game.homeProgramId]!
    const away = season!.programStates[game.awayProgramId]!

    useSeasonStore.getState().playScheduledGame()

    const state = useSeasonStore.getState()
    expect(state.view).toBe('postgame')
    expect(state.lastPlayedGameId).toBe(game.id)

    const recorded = state.season!.resultsByGameId[game.id]
    expect(recorded).toBeDefined()
    expect(recorded!.homeTeamId).toBe(game.homeProgramId)
    expect(recorded!.awayTeamId).toBe(game.awayProgramId)

    // The result must be reproducible from the same current Team/Rotation and seed family.
    const independent = simulateGame({
      homeTeam: home.team,
      awayTeam: away.team,
      homeRotation: home.rotation,
      awayRotation: away.rotation,
      seed: recorded!.seed,
    })
    expect(recorded).toEqual(independent)
  })

  it('does not simulate while the controlled draft Rotation is invalid', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const { season } = useSeasonStore.getState()
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const [firstPlayer] = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    )

    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)
    useSeasonStore.getState().playScheduledGame()

    const state = useSeasonStore.getState()
    expect(state.view).toBe('hub')
    expect(state.lastPlayedGameId).toBeNull()
  })
})

describe('seasonStore rest-of-round simulation', () => {
  it('preserves the controlled Program result and completes remaining Round 1 games', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().playScheduledGame()
    const userResult =
      useSeasonStore.getState().season!.resultsByGameId[
        useSeasonStore.getState().lastPlayedGameId!
      ]

    useSeasonStore.getState().simulateRestOfRound()

    const state = useSeasonStore.getState()
    const round1Games = state.season!.schedule.games.filter(
      (game) => game.round === 1,
    )
    expect(
      round1Games.every((game) => state.season!.resultsByGameId[game.id]),
    ).toBe(true)
    expect(
      state.season!.resultsByGameId[state.lastPlayedGameId!],
    ).toEqual(userResult)
    expect(getCurrentRound(state.season!)).toBe(2)
  })

  it('never simulates the controlled Program pending game as a safety boundary', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const controlledGameId = getNextGameForProgram(
      useSeasonStore.getState().season!,
      'charlotte-tech',
    )!.id

    // Simulate rest of round WITHOUT playing the controlled Program's own game first.
    useSeasonStore.getState().simulateRestOfRound()

    const state = useSeasonStore.getState()
    expect(state.season!.resultsByGameId[controlledGameId]).toBeUndefined()
    const pendingRound1 = getPendingGamesForRound(state.season!, 1)
    expect(pendingRound1).toHaveLength(1)
    expect(pendingRound1[0]!.id).toBe(controlledGameId)
  })
})

describe('seasonStore backlog catch-up', () => {
  it('resolves fully-past rounds when preparing for a later game, without ever calling Simulate Rest of Round', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    // Play three rounds back to back; never touch simulateRestOfRound().
    for (let round = 0; round < 3; round += 1) {
      useSeasonStore.getState().goToGamePrep()
      useSeasonStore.getState().playScheduledGame()
    }

    const state = useSeasonStore.getState()
    const gamesInRound = (round: number) =>
      state.season!.schedule.games.filter((game) => game.round === round)
    const isComplete = (round: number) =>
      gamesInRound(round).every(
        (game) => state.season!.resultsByGameId[game.id] !== undefined,
      )

    // Rounds strictly before the round currently in progress are fully caught up.
    expect(isComplete(1)).toBe(true)
    expect(isComplete(2)).toBe(true)

    // Round 3 (the round just played) only has the controlled Program's own
    // result so far — catch-up never simulates the round currently in play.
    const completedRound3 = gamesInRound(3).filter(
      (game) => state.season!.resultsByGameId[game.id] !== undefined,
    )
    expect(completedRound3).toHaveLength(1)
    expect(
      completedRound3[0]!.homeProgramId === 'charlotte-tech' ||
        completedRound3[0]!.awayProgramId === 'charlotte-tech',
    ).toBe(true)
  })

  it('catches up Round 1 when entering game prep for Round 2, without disturbing the recorded Round 1 result or pre-simulating Round 2', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().goToGamePrep()
    useSeasonStore.getState().playScheduledGame()
    const round1GameId = useSeasonStore.getState().lastPlayedGameId!
    const round1Result =
      useSeasonStore.getState().season!.resultsByGameId[round1GameId]

    // Go straight back into game prep for Round 2 — never call
    // simulateRestOfRound() manually.
    useSeasonStore.getState().goToHub()
    useSeasonStore.getState().goToGamePrep()

    const state = useSeasonStore.getState()
    expect(getCurrentRound(state.season!)).toBe(2)
    expect(state.season!.resultsByGameId[round1GameId]).toEqual(round1Result)
    expect(
      getNextGameForProgram(state.season!, 'charlotte-tech')?.round,
    ).toBe(2)
  })
})

describe('seasonStore regular-season completion', () => {
  it(
    'reaches Regular Season Complete after all 384 games finish',
    () => {
      useSeasonStore.getState().selectProgram('pine-valley')

      driveSeasonToCompletion()

      const state = useSeasonStore.getState()
      expect(isRegularSeasonComplete(state.season!)).toBe(true)
      expect(Object.keys(state.season!.resultsByGameId)).toHaveLength(384)
      expect(getCurrentRound(state.season!)).toBeUndefined()
      expect(validateSeasonState(UNIVERSE_V0, state.season!).valid).toBe(true)
    },
    20000,
  )
})
