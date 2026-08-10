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
import {
  DEFAULT_INTERACTIVE_TEST_SEED,
  MIDSEASON_ROUND,
  useDynastyStore,
} from './seasonStore'

function resetStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function selectProgram(programId = 'charlotte-tech'): void {
  useDynastyStore
    .getState()
    .selectProgram(programId, DEFAULT_INTERACTIVE_TEST_SEED)
  useDynastyStore.getState().generateControlledDraftBoard()
}

/** Drives the current Season to completion; capped so a real bug fails fast. */
function driveSeasonToCompletion(): void {
  useDynastyStore.getState().generateControlledDraftBoard()
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const season = useDynastyStore.getState().dynasty!.activeSeason!

    if (isRegularSeasonComplete(season)) {
      return
    }

    useDynastyStore.getState().playScheduledGame()
    useDynastyStore.getState().simulateRestOfRound()
  }

  throw new Error('Season did not complete within the expected round budget.')
}

beforeEach(() => {
  resetStore()
})

describe('seasonStore initialization', () => {
  it('starts with no controlled Program and no Season', () => {
    const state = useDynastyStore.getState()
    expect(state.dynasty).toBeNull()
    expect(state.view).toBe('programSelect')
  })

  it('initializes a structurally valid Season for the 32-Program Universe V0', () => {
    selectProgram()

    const state = useDynastyStore.getState()
    expect(state.dynasty!.activeSeason).not.toBeNull()
    expect(Object.keys(state.dynasty!.activeSeason!.programStates)).toHaveLength(32)
    expect(state.dynasty!.activeSeason!.schedule.games).toHaveLength(384)
    expect(state.dynasty!.activeSeason!.schedule.roundCount).toBe(24)
    expect(validateSeasonState(UNIVERSE_V0, state.dynasty!.activeSeason!).valid).toBe(true)
  })

  it('stores controlled Program ownership outside SeasonState', () => {
    selectProgram()

    const state = useDynastyStore.getState()
    expect(state.dynasty!.controlledProgramId).toBe('charlotte-tech')
    expect(state.dynasty!.activeSeason).not.toHaveProperty('controlledProgramId')
    expect(
      Object.prototype.hasOwnProperty.call(
        state.dynasty!.activeSeason!.programStates['charlotte-tech'] ?? {},
        'controlledProgramId',
      ),
    ).toBe(false)
  })

  it('navigates to the Season Hub after selecting a Program', () => {
    selectProgram()
    expect(useDynastyStore.getState().view).toBe('hub')
  })

  it('shows 0-0 initial overall and Conference records for the controlled Program', () => {
    selectProgram()

    const state = useDynastyStore.getState()
    const record = deriveProgramRecord(state.dynasty!.activeSeason!, 'charlotte-tech')
    expect(record).toEqual({ wins: 0, losses: 0 })
  })

  it('starts at Round 1', () => {
    selectProgram()

    const state = useDynastyStore.getState()
    expect(getCurrentRound(state.dynasty!.activeSeason!)).toBe(1)
  })

  it('produces a deterministic Season for a given Program across store instances', () => {
    selectProgram()
    const first = useDynastyStore.getState().dynasty!.activeSeason

    resetStore()
    selectProgram()
    const second = useDynastyStore.getState().dynasty!.activeSeason

    expect(second).toEqual(first)
  })

  it('does not duplicate record, standings, or current-round state alongside SeasonState', () => {
    selectProgram()

    const stateKeys = Object.keys(useDynastyStore.getState())
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
    selectProgram()

    const state = useDynastyStore.getState()
    const expectedGame = getNextGameForProgram(state.dynasty!.activeSeason!, 'charlotte-tech')
    expect(expectedGame).toBeDefined()
    expect(expectedGame!.round).toBe(1)
  })
})

describe('seasonStore Rotation editing', () => {
  it('reflects the current Season Rotation in Team Strength once legally edited', () => {
    selectProgram()

    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const pointGuards = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    ).filter(({ player }) => player.position === 'PG')

    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(pointGuards[0]!.player.id, pointGuards[0]!.minutes - 2)
    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(pointGuards[1]!.player.id, pointGuards[1]!.minutes + 2)

    const state = useDynastyStore.getState()
    expect(validateRotation(controlledTeam, state.draftRotation!).valid).toBe(true)
    expect(state.draftRotation).not.toEqual(season!.programStates['charlotte-tech']!.rotation)
  })

  it('persists a legal Rotation edit into SeasonState', () => {
    selectProgram()

    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const forwards = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    ).filter(({ player }) => player.position === 'SF')

    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(forwards[0]!.player.id, forwards[0]!.minutes - 3)
    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(forwards[1]!.player.id, forwards[1]!.minutes + 3)

    const editedRotation = useDynastyStore.getState().draftRotation
    const persisted =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates['charlotte-tech']!.rotation

    expect(persisted).toEqual(editedRotation)
  })

  it('does not persist a temporarily invalid draft into SeasonState', () => {
    selectProgram()

    const originalRotation =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates['charlotte-tech']!.rotation
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const [firstPlayer] = getPlayersByMinutes(controlledTeam, originalRotation)

    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)

    const state = useDynastyStore.getState()
    expect(validateRotation(controlledTeam, state.draftRotation!).valid).toBe(false)
    expect(state.dynasty!.activeSeason!.programStates['charlotte-tech']!.rotation).toEqual(
      originalRotation,
    )
  })

  it('preserves a custom Rotation into future rounds', () => {
    selectProgram()

    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const centers = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    ).filter(({ player }) => player.position === 'C')

    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(centers[0]!.player.id, centers[0]!.minutes - 1)
    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(centers[1]!.player.id, centers[1]!.minutes + 1)
    const editedRotation = useDynastyStore.getState().draftRotation

    useDynastyStore.getState().playScheduledGame()
    useDynastyStore.getState().simulateRestOfRound()
    useDynastyStore.getState().goToHub()

    const state = useDynastyStore.getState()
    expect(getCurrentRound(state.dynasty!.activeSeason!)).toBe(2)
    expect(getNextGameForProgram(state.dynasty!.activeSeason!, 'charlotte-tech')!.round).toBe(2)
    expect(state.draftRotation).toEqual(editedRotation)
    expect(
      state.dynasty!.activeSeason!.programStates['charlotte-tech']!.rotation,
    ).toEqual(editedRotation)
  })
})

describe('seasonStore game simulation', () => {
  it('records the actual ScheduledGame result using the current Team/Rotation', () => {
    selectProgram()
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const game = getNextGameForProgram(season!, 'charlotte-tech')!
    const home = season!.programStates[game.homeProgramId]!
    const away = season!.programStates[game.awayProgramId]!

    useDynastyStore.getState().playScheduledGame()

    const state = useDynastyStore.getState()
    expect(state.view).toBe('postgame')
    expect(state.lastPlayedGameId).toBe(game.id)

    const recorded = state.dynasty!.activeSeason!.resultsByGameId[game.id]
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
    selectProgram()
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const [firstPlayer] = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    )

    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)
    useDynastyStore.getState().playScheduledGame()

    const state = useDynastyStore.getState()
    expect(state.view).toBe('hub')
    expect(state.lastPlayedGameId).toBeNull()
  })
})

describe('seasonStore Dashboard Quick Sim', () => {
  it('uses the canonical current Season Rotation, matching a reproduction from the committed Team/Rotation', () => {
    selectProgram()
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const game = getNextGameForProgram(season!, 'charlotte-tech')!
    const home = season!.programStates[game.homeProgramId]!
    const away = season!.programStates[game.awayProgramId]!

    useDynastyStore.getState().simulateNextGame()

    const state = useDynastyStore.getState()
    expect(state.view).toBe('hub')
    expect(state.lastPlayedGameId).toBe(game.id)

    const recorded = state.dynasty!.activeSeason!.resultsByGameId[game.id]
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
    selectProgram()
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const [firstPlayer] = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    )
    const game = getNextGameForProgram(season!, 'charlotte-tech')!

    // Leave an invalid edit in the draft without committing or fixing it.
    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)
    expect(
      validateRotation(controlledTeam, useDynastyStore.getState().draftRotation!)
        .valid,
    ).toBe(false)

    useDynastyStore.getState().simulateNextGame()

    const state = useDynastyStore.getState()
    expect(state.view).toBe('hub')
    expect(state.lastPlayedGameId).toBe(game.id)
    expect(state.dynasty!.activeSeason!.resultsByGameId[game.id]).toBeDefined()
  })

  it('resets a stale invalid draft back to the canonical Rotation when Game Prep is (re-)entered', () => {
    selectProgram()
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const canonicalRotation =
      season!.programStates['charlotte-tech']!.rotation
    const [firstPlayer] = getPlayersByMinutes(controlledTeam, canonicalRotation)

    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)
    useDynastyStore.getState().goToHub()

    useDynastyStore.getState().goToGamePrep()

    const state = useDynastyStore.getState()
    expect(validateRotation(controlledTeam, state.draftRotation!).valid).toBe(
      true,
    )
    expect(state.draftRotation).toEqual(canonicalRotation)
  })
})

describe('seasonStore historical game viewing', () => {
  it('opens a completed ScheduledGame for historical review without resimulating it', () => {
    selectProgram()
    useDynastyStore.getState().playScheduledGame()
    const { lastPlayedGameId } = useDynastyStore.getState()
    const seasonAfterGame = useDynastyStore.getState().dynasty!.activeSeason
    const resultBeforeViewing = seasonAfterGame!.resultsByGameId[
      lastPlayedGameId!
    ]
    useDynastyStore.getState().goToHub()

    useDynastyStore.getState().viewCompletedGame(lastPlayedGameId!)

    const state = useDynastyStore.getState()
    expect(state.view).toBe('gameHistory')
    expect(state.viewedGameId).toBe(lastPlayedGameId)
    expect(state.dynasty!.activeSeason!.resultsByGameId[lastPlayedGameId!]).toEqual(
      resultBeforeViewing,
    )
  })

  it('is a no-op for a ScheduledGame that has not been played yet', () => {
    selectProgram()
    const pendingGame = getNextGameForProgram(
      useDynastyStore.getState().dynasty!.activeSeason!,
      'charlotte-tech',
    )!

    useDynastyStore.getState().viewCompletedGame(pendingGame.id)

    const state = useDynastyStore.getState()
    expect(state.view).toBe('hub')
    expect(state.viewedGameId).toBeNull()
  })
})

describe('seasonStore rest-of-round simulation', () => {
  it('preserves the controlled Program result and completes remaining Round 1 games', () => {
    selectProgram()
    useDynastyStore.getState().playScheduledGame()
    const userResult =
      useDynastyStore.getState().dynasty!.activeSeason!.resultsByGameId[
        useDynastyStore.getState().lastPlayedGameId!
      ]

    useDynastyStore.getState().simulateRestOfRound()

    const state = useDynastyStore.getState()
    const round1Games = state.dynasty!.activeSeason!.schedule.games.filter(
      (game) => game.round === 1,
    )
    expect(
      round1Games.every((game) => state.dynasty!.activeSeason!.resultsByGameId[game.id]),
    ).toBe(true)
    expect(
      state.dynasty!.activeSeason!.resultsByGameId[state.lastPlayedGameId!],
    ).toEqual(userResult)
    expect(getCurrentRound(state.dynasty!.activeSeason!)).toBe(2)
  })

  it('never simulates the controlled Program pending game as a safety boundary', () => {
    selectProgram()
    const controlledGameId = getNextGameForProgram(
      useDynastyStore.getState().dynasty!.activeSeason!,
      'charlotte-tech',
    )!.id

    // Simulate rest of round WITHOUT playing the controlled Program's own game first.
    useDynastyStore.getState().simulateRestOfRound()

    const state = useDynastyStore.getState()
    expect(state.dynasty!.activeSeason!.resultsByGameId[controlledGameId]).toBeUndefined()
    const pendingRound1 = getPendingGamesForRound(state.dynasty!.activeSeason!, 1)
    expect(pendingRound1).toHaveLength(1)
    expect(pendingRound1[0]!.id).toBe(controlledGameId)
  })
})

describe('seasonStore backlog catch-up', () => {
  it('resolves fully-past rounds when preparing for a later game, without ever calling Simulate Rest of Round', () => {
    selectProgram()

    // Play three rounds back to back; never touch simulateRestOfRound().
    for (let round = 0; round < 3; round += 1) {
      useDynastyStore.getState().goToGamePrep()
      useDynastyStore.getState().playScheduledGame()
    }

    const state = useDynastyStore.getState()
    const gamesInRound = (round: number) =>
      state.dynasty!.activeSeason!.schedule.games.filter((game) => game.round === round)
    const isComplete = (round: number) =>
      gamesInRound(round).every(
        (game) => state.dynasty!.activeSeason!.resultsByGameId[game.id] !== undefined,
      )

    // Rounds strictly before the round currently in progress are fully caught up.
    expect(isComplete(1)).toBe(true)
    expect(isComplete(2)).toBe(true)

    // Round 3 (the round just played) only has the controlled Program's own
    // result so far — catch-up never simulates the round currently in play.
    const completedRound3 = gamesInRound(3).filter(
      (game) => state.dynasty!.activeSeason!.resultsByGameId[game.id] !== undefined,
    )
    expect(completedRound3).toHaveLength(1)
    expect(
      completedRound3[0]!.homeProgramId === 'charlotte-tech' ||
        completedRound3[0]!.awayProgramId === 'charlotte-tech',
    ).toBe(true)
  })

  it('catches up Round 1 when entering game prep for Round 2, without disturbing the recorded Round 1 result or pre-simulating Round 2', () => {
    selectProgram()
    useDynastyStore.getState().goToGamePrep()
    useDynastyStore.getState().playScheduledGame()
    const round1GameId = useDynastyStore.getState().lastPlayedGameId!
    const round1Result =
      useDynastyStore.getState().dynasty!.activeSeason!.resultsByGameId[round1GameId]

    // Go straight back into game prep for Round 2 — never call
    // simulateRestOfRound() manually.
    useDynastyStore.getState().goToHub()
    useDynastyStore.getState().goToGamePrep()

    const state = useDynastyStore.getState()
    expect(getCurrentRound(state.dynasty!.activeSeason!)).toBe(2)
    expect(state.dynasty!.activeSeason!.resultsByGameId[round1GameId]).toEqual(round1Result)
    expect(
      getNextGameForProgram(state.dynasty!.activeSeason!, 'charlotte-tech')?.round,
    ).toBe(2)
  })
})

describe('seasonStore regular-season completion', () => {
  it(
    'reaches Regular Season Complete after all 384 games finish',
    () => {
      selectProgram('pine-valley')

      driveSeasonToCompletion()

      const state = useDynastyStore.getState()
      expect(isRegularSeasonComplete(state.dynasty!.activeSeason!)).toBe(true)
      expect(Object.keys(state.dynasty!.activeSeason!.resultsByGameId)).toHaveLength(384)
      expect(getCurrentRound(state.dynasty!.activeSeason!)).toBeUndefined()
      expect(validateSeasonState(UNIVERSE_V0, state.dynasty!.activeSeason!).valid).toBe(true)
    },
    20000,
  )
})

describe('seasonStore Super Sim', () => {
  it('requests Midseason with throughRound = 12 and does not touch Season state', () => {
    selectProgram()
    const before = useDynastyStore.getState().dynasty!.activeSeason

    useDynastyStore.getState().requestSuperSim('midseason')

    const state = useDynastyStore.getState()
    expect(state.pendingSuperSim).toEqual({
      kind: 'midseason',
      throughRound: MIDSEASON_ROUND,
    })
    expect(state.dynasty!.activeSeason).toBe(before)
  })

  it('requests End of Regular Season with throughRound = the Schedule round count', () => {
    selectProgram()

    useDynastyStore.getState().requestSuperSim('endOfRegularSeason')

    const state = useDynastyStore.getState()
    expect(state.pendingSuperSim).toEqual({
      kind: 'endOfRegularSeason',
      throughRound: state.dynasty!.activeSeason!.schedule.roundCount,
    })
  })

  it('cancelSuperSim clears the pending request without simulating anything', () => {
    selectProgram()
    const before = useDynastyStore.getState().dynasty!.activeSeason
    useDynastyStore.getState().requestSuperSim('midseason')

    useDynastyStore.getState().cancelSuperSim()

    const state = useDynastyStore.getState()
    expect(state.pendingSuperSim).toBeNull()
    expect(state.dynasty!.activeSeason).toBe(before)
  })

  it('confirmSuperSim completes every pending game through Round 12 and derives the segment record', () => {
    selectProgram()
    useDynastyStore.getState().requestSuperSim('midseason')

    useDynastyStore.getState().confirmSuperSim()

    const state = useDynastyStore.getState()
    expect(getCurrentRound(state.dynasty!.activeSeason!)).toBe(13)
    for (let round = 1; round <= 12; round += 1) {
      expect(getPendingGamesForRound(state.dynasty!.activeSeason!, round)).toHaveLength(0)
    }
    expect(state.pendingSuperSim).toBeNull()

    const finalRecord = deriveProgramRecord(state.dynasty!.activeSeason!, 'charlotte-tech')
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
    selectProgram()
    useDynastyStore.getState().requestSuperSim('endOfRegularSeason')

    useDynastyStore.getState().confirmSuperSim()

    const state = useDynastyStore.getState()
    expect(isRegularSeasonComplete(state.dynasty!.activeSeason!)).toBe(true)
    expect(Object.keys(state.dynasty!.activeSeason!.resultsByGameId)).toHaveLength(384)
    expect(getCurrentRound(state.dynasty!.activeSeason!)).toBeUndefined()
    expect(state.superSimSummary!.kind).toBe('endOfRegularSeason')
    expect(
      state.superSimSummary!.segmentWins + state.superSimSummary!.segmentLosses,
    ).toBe(24)
  })

  it('preserves an already in-progress segment record (before/after, not from a fresh 0-0 Season)', () => {
    selectProgram()
    // Play a few rounds by hand first, establishing a non-zero "before" record.
    for (let round = 0; round < 3; round += 1) {
      useDynastyStore.getState().simulateNextGame()
      useDynastyStore.getState().simulateRestOfRound()
    }
    const before = deriveProgramRecord(
      useDynastyStore.getState().dynasty!.activeSeason!,
      'charlotte-tech',
    )

    useDynastyStore.getState().requestSuperSim('midseason')
    useDynastyStore.getState().confirmSuperSim()

    const after = deriveProgramRecord(
      useDynastyStore.getState().dynasty!.activeSeason!,
      'charlotte-tech',
    )
    const summary = useDynastyStore.getState().superSimSummary!
    expect(summary.segmentWins).toBe(after.wins - before.wins)
    expect(summary.segmentLosses).toBe(after.losses - before.losses)
  })

  it('dismissSuperSimSummary clears the feedback without altering Season state', () => {
    selectProgram()
    useDynastyStore.getState().requestSuperSim('midseason')
    useDynastyStore.getState().confirmSuperSim()
    const seasonAfterSim = useDynastyStore.getState().dynasty!.activeSeason

    useDynastyStore.getState().dismissSuperSimSummary()

    const state = useDynastyStore.getState()
    expect(state.superSimSummary).toBeNull()
    expect(state.dynasty!.activeSeason).toBe(seasonAfterSim)
  })

  it("uses each Program's current committed Rotation, unaffected by a stale invalid Game Prep draft", () => {
    selectProgram()
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const canonicalRotation = season!.programStates['charlotte-tech']!.rotation
    const [firstPlayer] = getPlayersByMinutes(controlledTeam, canonicalRotation)

    // Leave an invalid draft behind, exactly like the Dashboard Quick Sim boundary test.
    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(firstPlayer!.player.id, firstPlayer!.minutes + 5)
    expect(
      validateRotation(controlledTeam, useDynastyStore.getState().draftRotation!)
        .valid,
    ).toBe(false)

    useDynastyStore.getState().requestSuperSim('midseason')
    useDynastyStore.getState().confirmSuperSim()

    const state = useDynastyStore.getState()
    expect(getCurrentRound(state.dynasty!.activeSeason!)).toBe(13)
    // The canonical committed Rotation — never the invalid draft — was used.
    expect(state.dynasty!.activeSeason!.programStates['charlotte-tech']!.rotation).toEqual(
      canonicalRotation,
    )
  })

  it('preserves a custom, legally committed Rotation across the entire bulk simulation', () => {
    selectProgram()
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const controlledTeam = season!.programStates['charlotte-tech']!.team
    const forwards = getPlayersByMinutes(
      controlledTeam,
      season!.programStates['charlotte-tech']!.rotation,
    ).filter(({ player }) => player.position === 'SF')

    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(forwards[0]!.player.id, forwards[0]!.minutes - 3)
    useDynastyStore
      .getState()
      .setDraftPlayerMinutes(forwards[1]!.player.id, forwards[1]!.minutes + 3)
    const customRotation = useDynastyStore.getState().draftRotation!

    useDynastyStore.getState().requestSuperSim('midseason')
    useDynastyStore.getState().confirmSuperSim()

    const state = useDynastyStore.getState()
    expect(state.dynasty!.activeSeason!.programStates['charlotte-tech']!.rotation).toEqual(
      customRotation,
    )
  })

  it('preserves already-completed results exactly when Super Sim runs from a partial Season', () => {
    selectProgram()
    useDynastyStore.getState().simulateNextGame()
    useDynastyStore.getState().simulateRestOfRound()
    const round1Results = { ...useDynastyStore.getState().dynasty!.activeSeason!.resultsByGameId }

    useDynastyStore.getState().requestSuperSim('midseason')
    useDynastyStore.getState().confirmSuperSim()

    const state = useDynastyStore.getState()
    for (const [gameId, result] of Object.entries(round1Results)) {
      expect(state.dynasty!.activeSeason!.resultsByGameId[gameId]).toEqual(result)
    }
  })

  it('produces full PlayerGameStats, still available as historical results', () => {
    selectProgram()
    useDynastyStore.getState().requestSuperSim('midseason')
    useDynastyStore.getState().confirmSuperSim()

    const { activeSeason: season, controlledProgramId } = useDynastyStore.getState().dynasty!
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
    useDynastyStore.getState().viewCompletedGame(anyGameId)
    expect(useDynastyStore.getState().view).toBe('gameHistory')
  })
})

describe('seasonStore League & Player exploration navigation', () => {
  const NON_CONTROLLED_PROGRAM_ID = 'northbridge'

  it('opens League from the Hub and records the Hub as the return step', () => {
    selectProgram()
    useDynastyStore.getState().goToLeague()

    const state = useDynastyStore.getState()
    expect(state.view).toBe('league')
    expect(state.explorationViewHistory).toEqual(['hub'])
  })

  it('opens Team Details for any Program, controlled or not', () => {
    selectProgram()
    useDynastyStore.getState().openTeamDetails(NON_CONTROLLED_PROGRAM_ID)

    const state = useDynastyStore.getState()
    expect(state.view).toBe('teamDetails')
    expect(state.selectedTeamProgramId).toBe(NON_CONTROLLED_PROGRAM_ID)
  })

  it('opens Player Details for a Player on any Program', () => {
    selectProgram()
    const roster =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[NON_CONTROLLED_PROGRAM_ID]!
        .team.roster
    const playerId = roster[0]!.id

    useDynastyStore.getState().openPlayerDetails(NON_CONTROLLED_PROGRAM_ID, playerId)

    const state = useDynastyStore.getState()
    expect(state.view).toBe('playerDetails')
    expect(state.selectedPlayerProgramId).toBe(NON_CONTROLLED_PROGRAM_ID)
    expect(state.selectedPlayerId).toBe(playerId)
  })

  it('unwinds a multi-hop trip (Hub → League → Team → Player) one step at a time', () => {
    selectProgram()
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().openTeamDetails(NON_CONTROLLED_PROGRAM_ID)
    const playerId =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[NON_CONTROLLED_PROGRAM_ID]!
        .team.roster[0]!.id
    useDynastyStore.getState().openPlayerDetails(NON_CONTROLLED_PROGRAM_ID, playerId)

    expect(useDynastyStore.getState().view).toBe('playerDetails')

    useDynastyStore.getState().goBackFromExploration()
    expect(useDynastyStore.getState().view).toBe('teamDetails')
    // The Program the Player screen was opened from is still available for the Team screen.
    expect(useDynastyStore.getState().selectedTeamProgramId).toBe(
      NON_CONTROLLED_PROGRAM_ID,
    )

    useDynastyStore.getState().goBackFromExploration()
    expect(useDynastyStore.getState().view).toBe('league')

    useDynastyStore.getState().goBackFromExploration()
    expect(useDynastyStore.getState().view).toBe('hub')
    expect(useDynastyStore.getState().explorationViewHistory).toEqual([])
  })

  it('returns Standings → Team Details directly back to the Hub in one step', () => {
    selectProgram()
    useDynastyStore.getState().openTeamDetails(NON_CONTROLLED_PROGRAM_ID)

    expect(useDynastyStore.getState().explorationViewHistory).toEqual(['hub'])

    useDynastyStore.getState().goBackFromExploration()
    expect(useDynastyStore.getState().view).toBe('hub')
  })

  it('remains reachable from the Postseason Hub and returns there', () => {
    selectProgram()
    for (let round = 0; round < 30; round += 1) {
      if (isRegularSeasonComplete(useDynastyStore.getState().dynasty!.activeSeason!)) break
      useDynastyStore.getState().simulateNextGame()
      useDynastyStore.getState().simulateRestOfRound()
    }
    useDynastyStore.getState().enterPostseason()

    useDynastyStore.getState().goToLeague()
    expect(useDynastyStore.getState().view).toBe('league')
    expect(useDynastyStore.getState().explorationViewHistory).toEqual([
      'postseasonHub',
    ])

    useDynastyStore.getState().goBackFromExploration()
    expect(useDynastyStore.getState().view).toBe('postseasonHub')
  })

  it('resets exploration navigation state when a new Program is selected', () => {
    selectProgram()
    useDynastyStore.getState().openTeamDetails(NON_CONTROLLED_PROGRAM_ID)

    selectProgram('northbridge')

    const state = useDynastyStore.getState()
    expect(state.view).toBe('hub')
    expect(state.explorationViewHistory).toEqual([])
    expect(state.selectedTeamProgramId).toBeNull()
    expect(state.selectedPlayerProgramId).toBeNull()
    expect(state.selectedPlayerId).toBeNull()
  })
})
