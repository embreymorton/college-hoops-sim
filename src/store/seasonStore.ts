import { create } from 'zustand'
import { validateRotation, type Rotation, type RngSeed } from '../engine'
import {
  initializeDynastyState,
  initializeRecruiting,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
  type RecruitingState,
} from '../dynasty'
import {
  getCurrentTournamentRound,
  getTournamentGameForProgram,
  initializePostseason,
  simulatePendingGamesInCurrentTournamentRound,
  simulateTournamentGame,
  updatePostseasonProgramRotation,
  type PostseasonState,
  type TournamentGame,
} from '../postseason'
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
const POSTSEASON_SIMULATION_SEED = `${MASTER_SEED}:season-1:postseason:simulation`

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
  | 'postseasonHub'
  | 'postseasonGamePrep'
  | 'postseasonPostgame'
  | 'postseasonGameHistory'
  | 'league'
  | 'teamDetails'
  | 'playerDetails'

export interface DynastySessionState {
  /** The application's one canonical cross-season domain value. */
  readonly dynasty: DynastyState | null
  /** Retained separately because SeasonState only stores the current Rotation. */
  readonly controlledProgramDefaultRotation: Rotation | null
  /**
   * The controlled Program's in-progress Rotation edit, scoped to the Game
   * Prep presentation. May be temporarily invalid; only legal values are
   * written through into `dynasty.activeSeason`, and it resets from the canonical Season
   * Rotation whenever Game Prep is (re-)entered so a stale invalid edit can
   * never leak into the Dashboard Quick Sim boundary.
   */
  readonly draftRotation: Rotation | null
  readonly view: SeasonSessionView
  /** The controlled Program's most recently completed ScheduledGame, for inline Hub feedback or postgame. */
  readonly lastPlayedGameId: string | null
  /** The completed ScheduledGame currently open for historical review, if any. */
  readonly viewedGameId: string | null
  /** An in-flight Super Sim confirmation request awaiting Confirm/Cancel. */
  readonly pendingSuperSim: PendingSuperSim | null
  /** One-time completion feedback for the Super Sim that just ran, if any. */
  readonly superSimSummary: SuperSimSummary | null
  /** The controlled Program's Rotation as carried into the tournament; the Postseason "reset" target. */
  readonly postseasonControlledDefaultRotation: Rotation | null
  /** In-progress Postseason Rotation edit, scoped to Tournament Game Prep — same draft-boundary contract as `draftRotation`. */
  readonly postseasonDraftRotation: Rotation | null
  /** The controlled Program's most recently completed Tournament game, for inline Hub feedback or postgame. */
  readonly lastPlayedTournamentGameId: string | null
  /** The completed Tournament game currently open for historical review, if any. */
  readonly viewedTournamentGameId: string | null
  /**
   * A small back-navigation stack of exploration entry points (Season Hub,
   * Postseason Hub, League, or Team Details). Pushed once per forward step
   * into League/Team/Player Details and popped by `goBackFromExploration`,
   * so a multi-hop trip (e.g. League → Team → Player) unwinds one screen at
   * a time without a generalized router.
   */
  readonly explorationViewHistory: readonly SeasonSessionView[]
  /** The Program currently open in Team Details, for any Program in the Universe. */
  readonly selectedTeamProgramId: string | null
  /** The Program owning the Player currently open in Player Details. */
  readonly selectedPlayerProgramId: string | null
  /** The Player currently open in Player Details. */
  readonly selectedPlayerId: string | null
  readonly masterSeed: RngSeed
  /** Initializes Universe V0 and canonical Dynasty Season 1 + Recruiting 2. */
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
   * Rotation, then remains on the Hub. Never reads or is blocked by
   * `draftRotation` — the committed
   * Rotation is guaranteed legal because only legal edits are ever written
   * through to `dynasty.activeSeason`.
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
  /**
   * Initializes Postseason from the completed Season the first time it is
   * called, then simply navigates on every later call — so re-entering the
   * Tournament from the Season Hub never re-selects or re-seeds the field.
   */
  enterPostseason(): void
  goToPostseasonHub(): void
  /** Starts the Postseason Rotation draft from the canonical current Postseason Rotation. */
  goToPostseasonGamePrep(): void
  setPostseasonDraftPlayerMinutes(playerId: string, minutes: number): void
  resetPostseasonDraftRotation(): void
  /** No-op if the draft Rotation is invalid or no Tournament game is currently playable. */
  playPostseasonScheduledGame(): void
  /** Tournament Quick Sim: plays the controlled Program's current-round Tournament game using its canonical committed Postseason Rotation, then remains on the Hub. */
  simulateNextPostseasonGame(): void
  /**
   * Advances the bracket's current round via the existing Postseason round
   * operation. Works uniformly whether the controlled Program is alive,
   * already resolved for this round, eliminated, or never qualified —
   * excluding it is a safety boundary, never a load-bearing branch.
   */
  simulateRestOfCurrentTournamentRound(): void
  /** Opens a historical read of an already-completed Tournament game's result. */
  viewCompletedTournamentGame(tournamentGameId: string): void
  /** Opens the League destination (National Leaders / Teams) from the current Hub. */
  goToLeague(): void
  /** Opens Team Details for any Program in the Universe, not only the controlled one. */
  openTeamDetails(programId: string): void
  /** Opens Player Details for any current-roster Player in the Universe. */
  openPlayerDetails(programId: string, playerId: string): void
  /** Unwinds one step of `explorationViewHistory`, back to where exploration was entered. */
  goBackFromExploration(): void
}

export const selectActiveSeason = (
  state: DynastySessionState,
): SeasonState | null => state.dynasty?.activeSeason ?? null

export const selectActivePostseason = (
  state: DynastySessionState,
): PostseasonState | null => state.dynasty?.activePostseason ?? null

export const selectActiveRecruiting = (
  state: DynastySessionState,
): RecruitingState | null => state.dynasty?.recruiting ?? null

export const selectControlledProgramId = (
  state: DynastySessionState,
): string | null => state.dynasty?.controlledProgramId ?? null

function withActiveSeason(
  dynasty: DynastyState,
  activeSeason: SeasonState,
): DynastyState {
  return syncRecruitingThroughCompletedRounds({ ...dynasty, activeSeason })
}

function withActivePostseason(
  dynasty: DynastyState,
  activePostseason: PostseasonState,
): DynastyState {
  return syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason,
  })
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

/**
 * Resolves the controlled Program's currently playable Tournament game, if
 * any: undefined once eliminated, never fielded, already resolved for this
 * round while the round itself continues, or after the Tournament ends.
 */
function resolveControlledTournamentGame(
  postseason: PostseasonState,
  controlledProgramId: string,
): TournamentGame | undefined {
  const round = getCurrentTournamentRound(postseason)

  if (round === undefined) {
    return undefined
  }

  const game = getTournamentGameForProgram(postseason, controlledProgramId, round)

  if (!game || postseason.resultsByGameId[game.id] !== undefined) {
    return undefined
  }

  return game
}

export const useDynastyStore = create<DynastySessionState>((set, get) => ({
  dynasty: null,
  controlledProgramDefaultRotation: null,
  draftRotation: null,
  view: 'programSelect',
  lastPlayedGameId: null,
  viewedGameId: null,
  pendingSuperSim: null,
  superSimSummary: null,
  postseasonControlledDefaultRotation: null,
  postseasonDraftRotation: null,
  lastPlayedTournamentGameId: null,
  viewedTournamentGameId: null,
  explorationViewHistory: [],
  selectedTeamProgramId: null,
  selectedPlayerProgramId: null,
  selectedPlayerId: null,
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

    const dynasty = initializeRecruiting(initializeDynastyState({
      dynastyId: `dynasty:${programId}`,
      dynastySeed: MASTER_SEED,
      controlledProgramId: programId,
      universe: UNIVERSE_V0,
      activeSeason: season,
    }))

    set({
      dynasty,
      controlledProgramDefaultRotation: initializedProgram.rotation,
      draftRotation: initializedProgram.rotation,
      view: 'hub',
      lastPlayedGameId: null,
      viewedGameId: null,
      pendingSuperSim: null,
      superSimSummary: null,
      postseasonControlledDefaultRotation: null,
      postseasonDraftRotation: null,
      lastPlayedTournamentGameId: null,
      viewedTournamentGameId: null,
      explorationViewHistory: [],
      selectedTeamProgramId: null,
      selectedPlayerProgramId: null,
      selectedPlayerId: null,
    })
  },

  setDraftPlayerMinutes(playerId, minutes) {
    const { dynasty, draftRotation } = get()
    const season = dynasty?.activeSeason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !season || !controlledProgramId || !draftRotation) {
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
      dynasty: isValid
        ? {
            ...dynasty,
            activeSeason: updateProgramRotation(
              season,
              controlledProgramId,
              nextDraft,
            ),
          }
        : dynasty,
    })
  },

  resetDraftRotation() {
    const { dynasty, controlledProgramDefaultRotation } = get()
    const season = dynasty?.activeSeason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !season || !controlledProgramId || !controlledProgramDefaultRotation) {
      return
    }

    set({
      draftRotation: controlledProgramDefaultRotation,
      dynasty: {
        ...dynasty,
        activeSeason: updateProgramRotation(
          season,
          controlledProgramId,
          controlledProgramDefaultRotation,
        ),
      },
    })
  },

  goToGamePrep() {
    const { dynasty } = get()
    const season = dynasty?.activeSeason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !season || !controlledProgramId) {
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
      dynasty: withActiveSeason(dynasty, caughtUpSeason),
      draftRotation: canonicalRotation,
      view: 'gamePrep',
    })
  },

  goToHub() {
    set({ view: 'hub', viewedGameId: null })
  },

  playScheduledGame() {
    const { dynasty, draftRotation } = get()
    const season = dynasty?.activeSeason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !season || !controlledProgramId || !draftRotation) {
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
      dynasty: withActiveSeason(dynasty, outcome.season),
      lastPlayedGameId: outcome.playedGameId,
      view: 'postgame',
    })
  },

  simulateNextGame() {
    const { dynasty } = get()
    const season = dynasty?.activeSeason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !season || !controlledProgramId) {
      return
    }

    const outcome = runNextGameSimulation(season, controlledProgramId)

    if (!outcome) {
      return
    }

    set({
      dynasty: withActiveSeason(dynasty, outcome.season),
      lastPlayedGameId: outcome.playedGameId,
      view: 'hub',
    })
  },

  simulateRestOfRound() {
    const { dynasty } = get()
    const season = dynasty?.activeSeason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !season || !controlledProgramId) {
      return
    }

    const nextSeason = simulatePendingGamesInCurrentRound({
      season,
      simulationSeed: SEASON_SIMULATION_SEED,
      excludedProgramIds: [controlledProgramId],
    })

    set({ dynasty: withActiveSeason(dynasty, nextSeason) })
  },

  viewCompletedGame(scheduledGameId) {
    const season = get().dynasty?.activeSeason

    if (!season || season.resultsByGameId[scheduledGameId] === undefined) {
      return
    }

    set({ viewedGameId: scheduledGameId, view: 'gameHistory' })
  },

  requestSuperSim(kind) {
    const season = get().dynasty?.activeSeason

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
    const { dynasty, pendingSuperSim } = get()
    const season = dynasty?.activeSeason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !season || !controlledProgramId || !pendingSuperSim) {
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
      dynasty: withActiveSeason(dynasty, nextSeason),
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

  enterPostseason() {
    const { dynasty } = get()
    const season = dynasty?.activeSeason
    const postseason = dynasty?.activePostseason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !season) {
      return
    }

    if (postseason) {
      set({ view: 'postseasonHub', viewedTournamentGameId: null })
      return
    }

    const synchronized = syncRecruitingThroughCompletedRounds(dynasty)
    const nextPostseason = initializePostseason({
      universe: UNIVERSE_V0,
      season: synchronized.activeSeason!,
    })
    const controlledState = controlledProgramId
      ? nextPostseason.programStates[controlledProgramId]
      : undefined

    set({
      dynasty: { ...synchronized, activePostseason: nextPostseason },
      postseasonControlledDefaultRotation: controlledState?.rotation ?? null,
      postseasonDraftRotation: controlledState?.rotation ?? null,
      view: 'postseasonHub',
      viewedTournamentGameId: null,
    })
  },

  goToPostseasonHub() {
    set({ view: 'postseasonHub', viewedTournamentGameId: null })
  },

  goToPostseasonGamePrep() {
    const { dynasty } = get()
    const postseason = dynasty?.activePostseason
    const controlledProgramId = dynasty?.controlledProgramId
    const controlledState =
      postseason && controlledProgramId
        ? postseason.programStates[controlledProgramId]
        : undefined

    if (!controlledState) {
      return
    }

    set({
      postseasonDraftRotation: controlledState.rotation,
      view: 'postseasonGamePrep',
    })
  },

  setPostseasonDraftPlayerMinutes(playerId, minutes) {
    const { dynasty, postseasonDraftRotation } = get()
    const postseason = dynasty?.activePostseason
    const controlledProgramId = dynasty?.controlledProgramId
    const controlledState =
      postseason && controlledProgramId
        ? postseason.programStates[controlledProgramId]
        : undefined

    if (!dynasty || !postseason || !controlledProgramId || !postseasonDraftRotation || !controlledState) {
      return
    }

    const sanitizedMinutes = Math.max(0, Math.round(minutes))
    const nextMinutes = { ...postseasonDraftRotation.minutes }

    if (sanitizedMinutes === 0) {
      delete nextMinutes[playerId]
    } else {
      nextMinutes[playerId] = sanitizedMinutes
    }

    const nextDraft: Rotation = { minutes: nextMinutes }
    const isValid = validateRotation(controlledState.team, nextDraft).valid

    set({
      postseasonDraftRotation: nextDraft,
      dynasty: isValid
        ? {
            ...dynasty,
            activePostseason: updatePostseasonProgramRotation(
              postseason,
              controlledProgramId,
              nextDraft,
            ),
          }
        : dynasty,
    })
  },

  resetPostseasonDraftRotation() {
    const {
      dynasty,
      postseasonControlledDefaultRotation,
    } = get()
    const postseason = dynasty?.activePostseason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !postseason || !controlledProgramId || !postseasonControlledDefaultRotation) {
      return
    }

    set({
      postseasonDraftRotation: postseasonControlledDefaultRotation,
      dynasty: {
        ...dynasty,
        activePostseason: updatePostseasonProgramRotation(
          postseason,
          controlledProgramId,
          postseasonControlledDefaultRotation,
        ),
      },
    })
  },

  playPostseasonScheduledGame() {
    const { dynasty, postseasonDraftRotation } = get()
    const postseason = dynasty?.activePostseason
    const controlledProgramId = dynasty?.controlledProgramId
    const controlledState =
      postseason && controlledProgramId
        ? postseason.programStates[controlledProgramId]
        : undefined

    if (!dynasty || !postseason || !controlledProgramId || !postseasonDraftRotation || !controlledState) {
      return
    }

    if (!validateRotation(controlledState.team, postseasonDraftRotation).valid) {
      return
    }

    const game = resolveControlledTournamentGame(postseason, controlledProgramId)

    if (!game) {
      return
    }

    const nextPostseason = simulateTournamentGame({
      postseason,
      tournamentGameId: game.id,
      simulationSeed: POSTSEASON_SIMULATION_SEED,
    })

    set({
      dynasty: withActivePostseason(dynasty, nextPostseason),
      lastPlayedTournamentGameId: game.id,
      view: 'postseasonPostgame',
    })
  },

  simulateNextPostseasonGame() {
    const { dynasty } = get()
    const postseason = dynasty?.activePostseason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !postseason || !controlledProgramId) {
      return
    }

    const game = resolveControlledTournamentGame(postseason, controlledProgramId)

    if (!game) {
      return
    }

    const nextPostseason = simulateTournamentGame({
      postseason,
      tournamentGameId: game.id,
      simulationSeed: POSTSEASON_SIMULATION_SEED,
    })

    set({
      dynasty: withActivePostseason(dynasty, nextPostseason),
      lastPlayedTournamentGameId: game.id,
      view: 'postseasonHub',
    })
  },

  simulateRestOfCurrentTournamentRound() {
    const { dynasty } = get()
    const postseason = dynasty?.activePostseason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !postseason) {
      return
    }

    const nextPostseason = simulatePendingGamesInCurrentTournamentRound({
      postseason,
      simulationSeed: POSTSEASON_SIMULATION_SEED,
      excludedProgramIds: controlledProgramId ? [controlledProgramId] : [],
    })

    set({ dynasty: withActivePostseason(dynasty, nextPostseason) })
  },

  viewCompletedTournamentGame(tournamentGameId) {
    const postseason = get().dynasty?.activePostseason

    if (!postseason || postseason.resultsByGameId[tournamentGameId] === undefined) {
      return
    }

    set({ viewedTournamentGameId: tournamentGameId, view: 'postseasonGameHistory' })
  },

  goToLeague() {
    const { view, explorationViewHistory } = get()

    set({
      view: 'league',
      explorationViewHistory: [...explorationViewHistory, view],
    })
  },

  openTeamDetails(programId) {
    const { view, explorationViewHistory } = get()

    set({
      view: 'teamDetails',
      selectedTeamProgramId: programId,
      explorationViewHistory: [...explorationViewHistory, view],
    })
  },

  openPlayerDetails(programId, playerId) {
    const { view, explorationViewHistory } = get()

    set({
      view: 'playerDetails',
      selectedPlayerProgramId: programId,
      selectedPlayerId: playerId,
      explorationViewHistory: [...explorationViewHistory, view],
    })
  },

  goBackFromExploration() {
    const { explorationViewHistory, dynasty } = get()
    const previousView = explorationViewHistory.at(-1)

    set({
      view: previousView ?? (dynasty?.activePostseason ? 'postseasonHub' : 'hub'),
      explorationViewHistory: explorationViewHistory.slice(0, -1),
    })
  },
}))
