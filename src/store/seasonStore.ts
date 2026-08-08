import { create } from 'zustand'
import { validateRotation, type Rotation, type RngSeed } from '../engine'
import { generateRegularSeasonSchedule } from '../schedule'
import {
  getCurrentRound,
  getNextGameForProgram,
  initializeSeason,
  simulatePendingGamesInCurrentRound,
  simulatePendingGamesInRound,
  simulateScheduledGame,
  updateProgramRotation,
  type SeasonState,
} from '../season'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'

/**
 * One stable master seed for Season Presentation V0, namespaced into the
 * deterministic concepts it drives. Reproducible development behavior only —
 * never exposed as a user-facing seed editor.
 */
const MASTER_SEED = 'college-hoops-sim:season-presentation:v0:master-seed'
const UNIVERSE_SEED = `${MASTER_SEED}:universe`
const SCHEDULE_SEED = `${MASTER_SEED}:schedule:season-1`
const SEASON_SIMULATION_SEED = `${MASTER_SEED}:season-1:simulation`

/**
 * Resolves every round strictly before `beforeRound` so AI games never pile
 * up behind the controlled Program as it keeps advancing through its own
 * schedule. The controlled Program never has a pending game in these rounds
 * — by definition its next pending game is `beforeRound` or later — but the
 * exclusion is still passed as a safety boundary, not a load-bearing check.
 */
function catchUpRoundsBefore(
  season: SeasonState,
  controlledProgramId: string,
  beforeRound: number,
): SeasonState {
  let current = season
  let round = getCurrentRound(current)

  while (round !== undefined && round < beforeRound) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed: SEASON_SIMULATION_SEED,
      excludedProgramIds: [controlledProgramId],
    })
    round = getCurrentRound(current)
  }

  return current
}

export type SeasonSessionView = 'programSelect' | 'hub' | 'gamePrep' | 'postgame'

export interface SeasonSessionState {
  /** User-controlled Program ownership; intentionally absent from SeasonState itself. */
  readonly controlledProgramId: string | null
  readonly season: SeasonState | null
  /** Retained separately because SeasonState only stores the current Rotation. */
  readonly controlledProgramDefaultRotation: Rotation | null
  /**
   * The controlled Program's in-progress Rotation edit. May be temporarily
   * invalid; only legal values are written through into `season`.
   */
  readonly draftRotation: Rotation | null
  readonly view: SeasonSessionView
  /** The controlled Program's most recently completed ScheduledGame, for postgame. */
  readonly lastPlayedGameId: string | null
  readonly masterSeed: RngSeed
  /** Initializes Universe V0, Season 1, and controls the chosen Program. */
  selectProgram(programId: string): void
  /** Zero minutes omits the Player, preserving canonical Rotation shape. */
  setDraftPlayerMinutes(playerId: string, minutes: number): void
  resetDraftRotation(): void
  /** Also catches up any fully-past rounds so AI results never lag behind. */
  goToGamePrep(): void
  goToHub(): void
  /** No-op if the draft Rotation is invalid or no game is pending; never simulates an illegal Rotation. */
  playScheduledGame(): void
  /** Excludes the controlled Program as a safety boundary; never re-simulates completed games. */
  simulateRestOfRound(): void
}

export const useSeasonStore = create<SeasonSessionState>((set, get) => ({
  controlledProgramId: null,
  season: null,
  controlledProgramDefaultRotation: null,
  draftRotation: null,
  view: 'programSelect',
  lastPlayedGameId: null,
  masterSeed: MASTER_SEED,

  selectProgram(programId) {
    const initializedUniverse = initializeUniverse(UNIVERSE_V0, UNIVERSE_SEED)
    const schedule = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: SCHEDULE_SEED,
    })
    const season = initializeSeason({
      universe: UNIVERSE_V0,
      initializedUniverse,
      schedule,
      seasonNumber: 1,
    })
    const initializedProgram = initializedUniverse.programs.find(
      (candidate) => candidate.program.id === programId,
    )

    if (!initializedProgram) {
      throw new RangeError(`Unknown Universe V0 program ID "${programId}"`)
    }

    set({
      controlledProgramId: programId,
      season,
      controlledProgramDefaultRotation: initializedProgram.rotation,
      draftRotation: initializedProgram.rotation,
      view: 'hub',
      lastPlayedGameId: null,
    })
  },

  setDraftPlayerMinutes(playerId, minutes) {
    const { season, controlledProgramId, draftRotation } = get()

    if (!season || !controlledProgramId || !draftRotation) {
      return
    }

    const controlledTeam = season.programStates[controlledProgramId]?.team

    if (!controlledTeam) {
      return
    }

    const sanitizedMinutes = Math.max(0, Math.round(minutes))
    const nextMinutes = { ...draftRotation.minutes }

    if (sanitizedMinutes === 0) {
      delete nextMinutes[playerId]
    } else {
      nextMinutes[playerId] = sanitizedMinutes
    }

    const nextDraft: Rotation = { minutes: nextMinutes }
    const isValid = validateRotation(controlledTeam, nextDraft).valid

    set({
      draftRotation: nextDraft,
      season: isValid
        ? updateProgramRotation(season, controlledProgramId, nextDraft)
        : season,
    })
  },

  resetDraftRotation() {
    const { season, controlledProgramId, controlledProgramDefaultRotation } =
      get()

    if (!season || !controlledProgramId || !controlledProgramDefaultRotation) {
      return
    }

    set({
      draftRotation: controlledProgramDefaultRotation,
      season: updateProgramRotation(
        season,
        controlledProgramId,
        controlledProgramDefaultRotation,
      ),
    })
  },

  goToGamePrep() {
    const { season, controlledProgramId } = get()

    if (!season || !controlledProgramId) {
      return
    }

    const nextGame = getNextGameForProgram(season, controlledProgramId)
    const caughtUpSeason = nextGame
      ? catchUpRoundsBefore(season, controlledProgramId, nextGame.round)
      : season

    set({ season: caughtUpSeason, view: 'gamePrep' })
  },

  goToHub() {
    set({ view: 'hub' })
  },

  playScheduledGame() {
    const { season, controlledProgramId, draftRotation } = get()

    if (!season || !controlledProgramId || !draftRotation) {
      return
    }

    const controlledTeam = season.programStates[controlledProgramId]?.team

    if (!controlledTeam || !validateRotation(controlledTeam, draftRotation).valid) {
      return
    }

    const nextGame = getNextGameForProgram(season, controlledProgramId)

    if (!nextGame) {
      return
    }

    // Belt-and-braces: catch up again in case this is ever reached without
    // having gone through goToGamePrep() first.
    const caughtUpSeason = catchUpRoundsBefore(
      season,
      controlledProgramId,
      nextGame.round,
    )
    const nextSeason = simulateScheduledGame({
      season: caughtUpSeason,
      scheduledGameId: nextGame.id,
      simulationSeed: SEASON_SIMULATION_SEED,
    })

    set({
      season: nextSeason,
      lastPlayedGameId: nextGame.id,
      view: 'postgame',
    })
  },

  simulateRestOfRound() {
    const { season, controlledProgramId } = get()

    if (!season || !controlledProgramId) {
      return
    }

    const nextSeason = simulatePendingGamesInCurrentRound({
      season,
      simulationSeed: SEASON_SIMULATION_SEED,
      excludedProgramIds: [controlledProgramId],
    })

    set({ season: nextSeason })
  },
}))
