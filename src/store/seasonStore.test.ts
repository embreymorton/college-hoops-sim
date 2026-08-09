import { beforeEach, describe, expect, it } from 'vitest'
import { getPlayersByMinutes, simulateGame, validateRotation } from '../engine'
import {
  deriveProgramRecord,
  getCompletedGamesForProgram,
  getCurrentRound,
  getNextGameForProgram,
  getPendingGamesForRound,
  isRegularSeasonComplete,
  validateSeasonState,
} from '../season'
import { UNIVERSE_V0 } from '../universe'
import { MIDSEASON_ROUND, useSeasonStore } from './seasonStore'

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

describe('seasonStore Dashboard Quick Sim', () => {
  it('uses the canonical current Season Rotation, matching a reproduction from the committed Team/Rotation', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const { season } = useSeasonStore.getState()
    const game = getNextGameForProgram(season!, 'charlotte-tech')!
    const home = season!.programStates[game.homeProgramId]!
    const away = season!.programStates[game.awayProgramId]!

    useSeasonStore.getState().simulateNextGame()

    const state = useSeasonStore.getState()
    expect(state.view).toBe('postgame')
    expect(state.lastPlayedGameId).toBe(game.id)

    const recorded = state.season!.resultsByGameId[game.id]
    expect(recorded).toBeDefined()

    const independent = simulateGame({
      homeTeam: home.team,
      awayTeam: away.team,
      homeRotation: home.rotation,
      awayRotation: away.rotation,
      seed: recorded!.seed,
    })
    expect(recorded).toEqual(independent)
  })

  it('is not blocked by a stale, invalid Rotation draft left over from Game Prep', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const { season } = useSeasonStore.getState()
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const [firstPlayer] = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    )
    const game = getNextGameForProgram(season!, 'charlotte-tech')!

    // Leave an invalid edit in the draft without committing or fixing it.
    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)
    expect(
      validateRotation(controlledTeam, useSeasonStore.getState().draftRotation!)
        .valid,
    ).toBe(false)

    useSeasonStore.getState().simulateNextGame()

    const state = useSeasonStore.getState()
    expect(state.view).toBe('postgame')
    expect(state.lastPlayedGameId).toBe(game.id)
    expect(state.season!.resultsByGameId[game.id]).toBeDefined()
  })

  it('resets a stale invalid draft back to the canonical Rotation when Game Prep is (re-)entered', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const { season } = useSeasonStore.getState()
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const canonicalRotation =
      season!.programStates['charlotte-tech']!.rotation
    const [firstPlayer] = getPlayersByMinutes(controlledTeam, canonicalRotation)

    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)
    useSeasonStore.getState().goToHub()

    useSeasonStore.getState().goToGamePrep()

    const state = useSeasonStore.getState()
    expect(validateRotation(controlledTeam, state.draftRotation!).valid).toBe(
      true,
    )
    expect(state.draftRotation).toEqual(canonicalRotation)
  })
})

describe('seasonStore historical game viewing', () => {
  it('opens a completed ScheduledGame for historical review without resimulating it', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().playScheduledGame()
    const { lastPlayedGameId, season: seasonAfterGame } =
      useSeasonStore.getState()
    const resultBeforeViewing = seasonAfterGame!.resultsByGameId[
      lastPlayedGameId!
    ]
    useSeasonStore.getState().goToHub()

    useSeasonStore.getState().viewCompletedGame(lastPlayedGameId!)

    const state = useSeasonStore.getState()
    expect(state.view).toBe('gameHistory')
    expect(state.viewedGameId).toBe(lastPlayedGameId)
    expect(state.season!.resultsByGameId[lastPlayedGameId!]).toEqual(
      resultBeforeViewing,
    )
  })

  it('is a no-op for a ScheduledGame that has not been played yet', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const pendingGame = getNextGameForProgram(
      useSeasonStore.getState().season!,
      'charlotte-tech',
    )!

    useSeasonStore.getState().viewCompletedGame(pendingGame.id)

    const state = useSeasonStore.getState()
    expect(state.view).toBe('hub')
    expect(state.viewedGameId).toBeNull()
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

describe('seasonStore Super Sim', () => {
  it('requests Midseason with throughRound = 12 and does not touch Season state', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const before = useSeasonStore.getState().season

    useSeasonStore.getState().requestSuperSim('midseason')

    const state = useSeasonStore.getState()
    expect(state.pendingSuperSim).toEqual({
      kind: 'midseason',
      throughRound: MIDSEASON_ROUND,
    })
    expect(state.season).toBe(before)
  })

  it('requests End of Regular Season with throughRound = the Schedule round count', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    useSeasonStore.getState().requestSuperSim('endOfRegularSeason')

    const state = useSeasonStore.getState()
    expect(state.pendingSuperSim).toEqual({
      kind: 'endOfRegularSeason',
      throughRound: state.season!.schedule.roundCount,
    })
  })

  it('cancelSuperSim clears the pending request without simulating anything', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const before = useSeasonStore.getState().season
    useSeasonStore.getState().requestSuperSim('midseason')

    useSeasonStore.getState().cancelSuperSim()

    const state = useSeasonStore.getState()
    expect(state.pendingSuperSim).toBeNull()
    expect(state.season).toBe(before)
  })

  it('confirmSuperSim completes every pending game through Round 12 and derives the segment record', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().requestSuperSim('midseason')

    useSeasonStore.getState().confirmSuperSim()

    const state = useSeasonStore.getState()
    expect(getCurrentRound(state.season!)).toBe(13)
    for (let round = 1; round <= 12; round += 1) {
      expect(getPendingGamesForRound(state.season!, round)).toHaveLength(0)
    }
    expect(state.pendingSuperSim).toBeNull()

    const finalRecord = deriveProgramRecord(state.season!, 'charlotte-tech')
    // A fresh Season starts 0-0, so the segment record equals the final record.
    expect(state.superSimSummary).toEqual({
      kind: 'midseason',
      throughRound: MIDSEASON_ROUND,
      segmentWins: finalRecord.wins,
      segmentLosses: finalRecord.losses,
    })
    expect(finalRecord.wins + finalRecord.losses).toBe(12)
  })

  it('confirmSuperSim through End of Regular Season completes all 384 games', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().requestSuperSim('endOfRegularSeason')

    useSeasonStore.getState().confirmSuperSim()

    const state = useSeasonStore.getState()
    expect(isRegularSeasonComplete(state.season!)).toBe(true)
    expect(Object.keys(state.season!.resultsByGameId)).toHaveLength(384)
    expect(getCurrentRound(state.season!)).toBeUndefined()
    expect(state.superSimSummary!.kind).toBe('endOfRegularSeason')
    expect(
      state.superSimSummary!.segmentWins + state.superSimSummary!.segmentLosses,
    ).toBe(24)
  })

  it('preserves an already in-progress segment record (before/after, not from a fresh 0-0 Season)', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    // Play a few rounds by hand first, establishing a non-zero "before" record.
    for (let round = 0; round < 3; round += 1) {
      useSeasonStore.getState().simulateNextGame()
      useSeasonStore.getState().simulateRestOfRound()
    }
    const before = deriveProgramRecord(
      useSeasonStore.getState().season!,
      'charlotte-tech',
    )

    useSeasonStore.getState().requestSuperSim('midseason')
    useSeasonStore.getState().confirmSuperSim()

    const after = deriveProgramRecord(
      useSeasonStore.getState().season!,
      'charlotte-tech',
    )
    const summary = useSeasonStore.getState().superSimSummary!
    expect(summary.segmentWins).toBe(after.wins - before.wins)
    expect(summary.segmentLosses).toBe(after.losses - before.losses)
  })

  it('dismissSuperSimSummary clears the feedback without altering Season state', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().requestSuperSim('midseason')
    useSeasonStore.getState().confirmSuperSim()
    const seasonAfterSim = useSeasonStore.getState().season

    useSeasonStore.getState().dismissSuperSimSummary()

    const state = useSeasonStore.getState()
    expect(state.superSimSummary).toBeNull()
    expect(state.season).toBe(seasonAfterSim)
  })

  it("uses each Program's current committed Rotation, unaffected by a stale invalid Game Prep draft", () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const { season } = useSeasonStore.getState()
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const canonicalRotation = season!.programStates['charlotte-tech']!.rotation
    const [firstPlayer] = getPlayersByMinutes(controlledTeam, canonicalRotation)

    // Leave an invalid draft behind, exactly like the Dashboard Quick Sim boundary test.
    useSeasonStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)
    expect(
      validateRotation(controlledTeam, useSeasonStore.getState().draftRotation!)
        .valid,
    ).toBe(false)

    useSeasonStore.getState().requestSuperSim('midseason')
    useSeasonStore.getState().confirmSuperSim()

    const state = useSeasonStore.getState()
    expect(getCurrentRound(state.season!)).toBe(13)
    // The canonical committed Rotation — never the invalid draft — was used.
    expect(state.season!.programStates['charlotte-tech']!.rotation).toEqual(
      canonicalRotation,
    )
  })

  it('preserves a custom, legally committed Rotation across the entire bulk simulation', () => {
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
    const customRotation = useSeasonStore.getState().draftRotation!

    useSeasonStore.getState().requestSuperSim('midseason')
    useSeasonStore.getState().confirmSuperSim()

    const state = useSeasonStore.getState()
    expect(state.season!.programStates['charlotte-tech']!.rotation).toEqual(
      customRotation,
    )
  })

  it('preserves already-completed results exactly when Super Sim runs from a partial Season', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().simulateNextGame()
    useSeasonStore.getState().simulateRestOfRound()
    const round1Results = { ...useSeasonStore.getState().season!.resultsByGameId }

    useSeasonStore.getState().requestSuperSim('midseason')
    useSeasonStore.getState().confirmSuperSim()

    const state = useSeasonStore.getState()
    for (const [gameId, result] of Object.entries(round1Results)) {
      expect(state.season!.resultsByGameId[gameId]).toEqual(result)
    }
  })

  it('produces full PlayerGameStats, still available as historical results', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().requestSuperSim('midseason')
    useSeasonStore.getState().confirmSuperSim()

    const { season, controlledProgramId } = useSeasonStore.getState()
    const completedGames = getCompletedGamesForProgram(
      season!,
      controlledProgramId!,
    )
    expect(completedGames.length).toBeGreaterThan(0)

    for (const { game, result } of completedGames) {
      const homeTeam = season!.programStates[game.homeProgramId]!.team
      const awayTeam = season!.programStates[game.awayProgramId]!.team
      expect(result.homePlayerStats).toHaveLength(homeTeam.roster.length)
      expect(result.awayPlayerStats).toHaveLength(awayTeam.roster.length)
    }

    // Every completed game — including ones Super Sim simulated for the
    // controlled Program itself — opens the same historical viewer.
    const anyGameId = Object.keys(season!.resultsByGameId)[0]!
    useSeasonStore.getState().viewCompletedGame(anyGameId)
    expect(useSeasonStore.getState().view).toBe('gameHistory')
  })
})

describe('seasonStore League & Player exploration navigation', () => {
  const NON_CONTROLLED_PROGRAM_ID = 'northbridge'

  it('opens League from the Hub and records the Hub as the return step', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().goToLeague()

    const state = useSeasonStore.getState()
    expect(state.view).toBe('league')
    expect(state.explorationViewHistory).toEqual(['hub'])
  })

  it('opens Team Details for any Program, controlled or not', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().openTeamDetails(NON_CONTROLLED_PROGRAM_ID)

    const state = useSeasonStore.getState()
    expect(state.view).toBe('teamDetails')
    expect(state.selectedTeamProgramId).toBe(NON_CONTROLLED_PROGRAM_ID)
  })

  it('opens Player Details for a Player on any Program', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    const roster =
      useSeasonStore.getState().season!.programStates[NON_CONTROLLED_PROGRAM_ID]!
        .team.roster
    const playerId = roster[0]!.id

    useSeasonStore.getState().openPlayerDetails(NON_CONTROLLED_PROGRAM_ID, playerId)

    const state = useSeasonStore.getState()
    expect(state.view).toBe('playerDetails')
    expect(state.selectedPlayerProgramId).toBe(NON_CONTROLLED_PROGRAM_ID)
    expect(state.selectedPlayerId).toBe(playerId)
  })

  it('unwinds a multi-hop trip (Hub → League → Team → Player) one step at a time', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().goToLeague()
    useSeasonStore.getState().openTeamDetails(NON_CONTROLLED_PROGRAM_ID)
    const playerId =
      useSeasonStore.getState().season!.programStates[NON_CONTROLLED_PROGRAM_ID]!
        .team.roster[0]!.id
    useSeasonStore.getState().openPlayerDetails(NON_CONTROLLED_PROGRAM_ID, playerId)

    expect(useSeasonStore.getState().view).toBe('playerDetails')

    useSeasonStore.getState().goBackFromExploration()
    expect(useSeasonStore.getState().view).toBe('teamDetails')
    // The Program the Player screen was opened from is still available for the Team screen.
    expect(useSeasonStore.getState().selectedTeamProgramId).toBe(
      NON_CONTROLLED_PROGRAM_ID,
    )

    useSeasonStore.getState().goBackFromExploration()
    expect(useSeasonStore.getState().view).toBe('league')

    useSeasonStore.getState().goBackFromExploration()
    expect(useSeasonStore.getState().view).toBe('hub')
    expect(useSeasonStore.getState().explorationViewHistory).toEqual([])
  })

  it('returns Standings → Team Details directly back to the Hub in one step', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().openTeamDetails(NON_CONTROLLED_PROGRAM_ID)

    expect(useSeasonStore.getState().explorationViewHistory).toEqual(['hub'])

    useSeasonStore.getState().goBackFromExploration()
    expect(useSeasonStore.getState().view).toBe('hub')
  })

  it('remains reachable from the Postseason Hub and returns there', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    for (let round = 0; round < 30; round += 1) {
      if (isRegularSeasonComplete(useSeasonStore.getState().season!)) break
      useSeasonStore.getState().simulateNextGame()
      useSeasonStore.getState().simulateRestOfRound()
    }
    useSeasonStore.getState().enterPostseason()

    useSeasonStore.getState().goToLeague()
    expect(useSeasonStore.getState().view).toBe('league')
    expect(useSeasonStore.getState().explorationViewHistory).toEqual([
      'postseasonHub',
    ])

    useSeasonStore.getState().goBackFromExploration()
    expect(useSeasonStore.getState().view).toBe('postseasonHub')
  })

  it('resets exploration navigation state when a new Program is selected', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().openTeamDetails(NON_CONTROLLED_PROGRAM_ID)

    useSeasonStore.getState().selectProgram('northbridge')

    const state = useSeasonStore.getState()
    expect(state.view).toBe('hub')
    expect(state.explorationViewHistory).toEqual([])
    expect(state.selectedTeamProgramId).toBeNull()
    expect(state.selectedPlayerProgramId).toBeNull()
    expect(state.selectedPlayerId).toBeNull()
  })
})
