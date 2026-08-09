import { create } from 'zustand'
import { validateRotation, type Rotation, type RngSeed } from '../engine'
import { generateRegularSeasonSchedule } from '../schedule'
import {
  deriveProgramRecord,
  getCurrentRound,
  getNextGameForProgram,
  initializeSeason,
  simulatePendingGamesInCurrentRound,
  simulatePendingGamesInRound,
  simulatePendingGamesThroughRound,
  simulateScheduledGame,
  updateProgramRotation,
  type ProgramRecord,
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
 * Super Sim V0's one fixed checkpoint short of the full 24-round regular
 * season. A UI/application policy constant, not a Season-domain rule — the
 * generic `simulatePendingGamesThroughRound` operation accepts any round.
 */
export const MIDSEASON_ROUND = 12

export type SuperSimKind = 'midseason' | 'endOfRegularSeason'

export interface PendingSuperSim {
  readonly kind: SuperSimKind
  readonly throughRound: number
}

/**
 * Transient, presentation-only completion feedback. The segment record is
 * derived once at confirmation time by comparing `deriveProgramRecord()`
 * before and after — never a new Season-domain statistic.
 */
export interface SuperSimSummary {
  readonly kind: SuperSimKind
  readonly throughRound: number
  readonly segmentWins: number
  readonly segmentLosses: number
}

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

export type SeasonSessionView =
  | 'programSelect'
  | 'hub'
  | 'gamePrep'
  | 'postgame'
  | 'gameHistory'

export interface SeasonSessionState {
  /** User-controlled Program ownership; intentionally absent from SeasonState itself. */
  readonly controlledProgramId: string | null
  readonly season: SeasonState | null
  /** Retained separately because SeasonState only stores the current Rotation. */
  readonly controlledProgramDefaultRotation: Rotation | null
  /**
   * The controlled Program's in-progress Rotation edit, scoped to the Game
   * Prep presentation. May be temporarily invalid; only legal values are
   * written through into `season`, and it resets from the canonical Season
   * Rotation whenever Game Prep is (re-)entered so a stale invalid edit can
   * never leak into the Dashboard Quick Sim boundary.
   */
  readonly draftRotation: Rotation | null
  readonly view: SeasonSessionView
  /** The controlled Program's most recently completed ScheduledGame, for postgame. */
  readonly lastPlayedGameId: string | null
  /** The completed ScheduledGame currently open for historical review, if any. */
  readonly viewedGameId: string | null
  /** An in-flight Super Sim confirmation request awaiting Confirm/Cancel. */
  readonly pendingSuperSim: PendingSuperSim | null
  /** One-time completion feedback for the Super Sim that just ran, if any. */
  readonly superSimSummary: SuperSimSummary | null
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
  /**
   * Dashboard Quick Sim: plays the controlled Program's next ScheduledGame
   * directly from the Season Hub using the canonical committed Season
   * Rotation. Never reads or is blocked by `draftRotation` — the committed
   * Rotation is guaranteed legal because only legal edits are ever written
   * through to `season`.
   */
  simulateNextGame(): void
  /** Excludes the controlled Program as a safety boundary; never re-simulates completed games. */
  simulateRestOfRound(): void
  /** Opens a historical read of an already-completed ScheduledGame's result. */
  viewCompletedGame(scheduledGameId: string): void
  /** Opens the Super Sim confirmation for one bulk-progression checkpoint. */
  requestSuperSim(kind: SuperSimKind): void
  /** Closes the confirmation without touching Season state. */
  cancelSuperSim(): void
  /**
   * Runs the confirmed Super Sim checkpoint through the Season layer's bulk
   * operation, using every Program's current Team/Rotation exactly as normal
   * progression would, then records transient completion feedback.
   */
  confirmSuperSim(): void
  /** Dismisses the completion feedback; Season state is unaffected. */
  dismissSuperSimSummary(): void
}

/**
 * Shared core of both simulation entry points: resolves the controlled
 * Program's next ScheduledGame from current canonical Season state, catching
 * up any fully-past rounds first. Returns null when there is nothing pending.
 */
function runNextGameSimulation(
  season: SeasonState,
  controlledProgramId: string,
): { season: SeasonState; playedGameId: string } | null {
  const nextGame = getNextGameForProgram(season, controlledProgramId)

  if (!nextGame) {
    return null
  }

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

  return { season: nextSeason, playedGameId: nextGame.id }
}

export const useSeasonStore = create<SeasonSessionState>((set, get) => ({
  controlledProgramId: null,
  season: null,
  controlledProgramDefaultRotation: null,
  draftRotation: null,
  view: 'programSelect',
  lastPlayedGameId: null,
  viewedGameId: null,
  pendingSuperSim: null,
  superSimSummary: null,
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
      viewedGameId: null,
      pendingSuperSim: null,
      superSimSummary: null,
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
    // Always start the draft from the canonical committed Rotation, so a
    // temporary invalid edit left over from a previous prep visit can never
    // reappear here or leak into the Dashboard Quick Sim boundary.
    const canonicalRotation =
      caughtUpSeason.programStates[controlledProgramId]!.rotation

    set({
      season: caughtUpSeason,
      draftRotation: canonicalRotation,
      view: 'gamePrep',
    })
  },

  goToHub() {
    set({ view: 'hub', viewedGameId: null })
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

    const outcome = runNextGameSimulation(season, controlledProgramId)

    if (!outcome) {
      return
    }

    set({
      season: outcome.season,
      lastPlayedGameId: outcome.playedGameId,
      view: 'postgame',
    })
  },

  simulateNextGame() {
    const { season, controlledProgramId } = get()

    if (!season || !controlledProgramId) {
      return
    }

    const outcome = runNextGameSimulation(season, controlledProgramId)

    if (!outcome) {
      return
    }

    set({
      season: outcome.season,
      lastPlayedGameId: outcome.playedGameId,
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

  viewCompletedGame(scheduledGameId) {
    const { season } = get()

    if (!season || season.resultsByGameId[scheduledGameId] === undefined) {
      return
    }

    set({ viewedGameId: scheduledGameId, view: 'gameHistory' })
  },

  requestSuperSim(kind) {
    const { season } = get()

    if (!season) {
      return
    }

    const throughRound =
      kind === 'midseason' ? MIDSEASON_ROUND : season.schedule.roundCount

    set({ pendingSuperSim: { kind, throughRound } })
  },

  cancelSuperSim() {
    set({ pendingSuperSim: null })
  },

  confirmSuperSim() {
    const { season, controlledProgramId, pendingSuperSim } = get()

    if (!season || !controlledProgramId || !pendingSuperSim) {
      return
    }

    const before: ProgramRecord = deriveProgramRecord(
      season,
      controlledProgramId,
    )
    const nextSeason = simulatePendingGamesThroughRound({
      season,
      throughRound: pendingSuperSim.throughRound,
      simulationSeed: SEASON_SIMULATION_SEED,
    })
    const after: ProgramRecord = deriveProgramRecord(
      nextSeason,
      controlledProgramId,
    )

    set({
      season: nextSeason,
      pendingSuperSim: null,
      superSimSummary: {
        kind: pendingSuperSim.kind,
        throughRound: pendingSuperSim.throughRound,
        segmentWins: after.wins - before.wins,
        segmentLosses: after.losses - before.losses,
      },
    })
  },

  dismissSuperSimSummary() {
    set({ superSimSummary: null })
  },
}))
