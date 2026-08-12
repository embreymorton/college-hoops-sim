import { create } from 'zustand'
import {
  cloneRotationV1,
  validateRotationV1,
  type Position,
  type RotationV1,
  type RngSeed,
} from '../engine'
import {
  addRecruitingBoardTarget,
  alignGeneratedRecruitingFocus,
  autoFinalizeRecruiting,
  beginOffseason,
  buildDefaultRecruitingBoard,
  initializeDynastyState,
  initializeRecruiting,
  manageProgramRecruitingOffers,
  offerRecruit,
  prepareLateRecruiting,
  removeRecruitingBoardTarget,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  setRecruitingFocus,
  withdrawRecruitOffer,
  FINAL_RECRUITING_PERIOD,
  rolloverDynastyToNextSeason,
  type DynastyState,
  type RecruitingState,
} from '../dynasty'
import {
  getCurrentTournamentRound,
  getTournamentGameForProgram,
  initializePostseason,
  isTournamentComplete,
  simulatePendingGamesInCurrentTournamentRound,
  simulatePendingGamesInTournamentRound,
  simulateTournamentGame,
  TOURNAMENT_ROUNDS,
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
  isRoundComplete,
  simulatePendingGamesInCurrentRound,
  simulatePendingGamesInRound,
  simulatePendingGamesThroughRound,
  simulateScheduledGame,
  updateProgramRotation,
  type ProgramRecord,
  type SeasonState,
} from '../season'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'

/** Stable explicit seed retained for tests and any caller needing the former fixed world. */
export const DEFAULT_INTERACTIVE_TEST_SEED =
  'college-hoops-sim:season-presentation:v0:master-seed'

let interactiveSeedSequence = 0

/**
 * Application-boundary entropy for a new user session only. The resulting
 * value becomes the Dynasty's immutable canonical seed; no domain code reads
 * browser randomness.
 */
export function createInteractiveDynastySeed(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `interactive-dynasty:${uuid}`

  interactiveSeedSequence += 1
  return `interactive-dynasty:fallback:${Date.now()}:${interactiveSeedSequence}`
}

function seedValue(seed: RngSeed): string {
  return typeof seed === 'string' ? seed : String(seed)
}

/** Preserves the former string namespaces for explicit fixed-seed workflows. */
function deriveInteractiveSeed(dynastySeed: RngSeed, stream: string): string {
  return `${seedValue(dynastySeed)}:${stream}`
}

function regularSeasonSimulationSeed(
  dynastySeed: RngSeed,
  seasonNumber: number,
): string {
  return deriveInteractiveSeed(dynastySeed, `season-${seasonNumber}:simulation`)
}

function postseasonSimulationSeed(
  dynastySeed: RngSeed,
  seasonNumber: number,
): string {
  return deriveInteractiveSeed(
    dynastySeed,
    `season-${seasonNumber}:postseason:simulation`,
  )
}

/**
 * Super Sim V0's one fixed checkpoint short of the full 24-round regular
 * season. A UI/application policy constant, not a Season-domain rule — the
 * generic `simulatePendingGamesThroughRound` operation accepts any round.
 */
export const MIDSEASON_ROUND = 12

export type SuperSimKind =
  | 'midseason'
  | 'endOfRegularSeason'
  | 'seasonComplete'

type RegularSeasonSuperSimKind = Exclude<SuperSimKind, 'seasonComplete'>

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
  readonly kind: RegularSeasonSuperSimKind
  readonly throughRound: number
  readonly segmentWins: number
  readonly segmentLosses: number
}

export type PendingRecruitingSetupIntent =
  | 'game-prep-catch-up'
  | 'play-scheduled-game'
  | 'quick-sim-controlled-game'
  | 'simulate-other-games'
  | 'confirm-super-sim'

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
  simulationSeed: RngSeed,
): SeasonState {
  let current = season
  let round = getCurrentRound(current)

  while (round !== undefined && round < beforeRound) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed,
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
  | 'recruiting'
  | 'offseason'

export interface DynastySessionState {
  /** The application's one canonical cross-season domain value. */
  readonly dynasty: DynastyState | null
  /** Retained separately because SeasonState only stores the current Rotation. */
  readonly controlledProgramDefaultRotation: RotationV1 | null
  /**
   * The controlled Program's in-progress Rotation edit, scoped to the Game
   * Prep presentation. May be temporarily invalid; only legal values are
   * written through into `dynasty.activeSeason`, and it resets from the canonical Season
   * Rotation whenever Game Prep is (re-)entered so a stale invalid edit can
   * never leak into the Dashboard Quick Sim boundary.
   */
  readonly draftRotation: RotationV1 | null
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
  readonly postseasonControlledDefaultRotation: RotationV1 | null
  /** In-progress Postseason Rotation edit, scoped to Tournament Game Prep — same draft-boundary contract as `draftRotation`. */
  readonly postseasonDraftRotation: RotationV1 | null
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
  /**
   * The message from the most recent rejected Recruiting board/offer action,
   * if any. Recruiting UI derives disabled states to keep this rare; when a
   * command is rejected anyway, the canonical domain error is surfaced here
   * instead of being silently swallowed. Cleared on the next successful
   * Recruiting action or Dynasty-section navigation.
   */
  readonly recruitingActionError: string | null
  /** Serializable UI intent paused before the first Recruiting period can resolve. */
  readonly pendingRecruitingSetupIntent: PendingRecruitingSetupIntent | null
  /**
   * The canonical `recruiting.lastResolvedPeriod` value from just before the
   * most recent Quick Sim / Super Sim simulation boundary, or `null` before
   * any progression has happened this session. Transient session state
   * only — never a persisted history log. Replaced (not held) on every
   * relevant progression action, so the Recruiting Update recap always
   * reflects only the most recent action: a later quiet simulation clears an
   * earlier unseen commitment rather than preserving it indefinitely.
   */
  readonly recruitingActivityBaselinePeriod: number | null
  /** Initializes Universe V0 and canonical Dynasty Season 1 + Recruiting 2. */
  selectProgram(programId: string, dynastySeed?: RngSeed): void
  /** Zero minutes omits the Player, preserving canonical Rotation shape. */
  setDraftPlayerPositionMinutes(
    playerId: string,
    floorPosition: Position,
    minutes: number,
  ): void
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
  setPostseasonDraftPlayerPositionMinutes(
    playerId: string,
    floorPosition: Position,
    minutes: number,
  ): void
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
  /** Opens the Recruiting destination; always reachable while Dynasty Recruiting is active. */
  goToRecruiting(): void
  /**
   * Adds a National Class Recruit to the controlled Program's board at the
   * normal Board status. No-op with a surfaced error if the canonical board API
   * rejects it (e.g. already committed, board full, no projected opening).
   */
  addRecruitingTarget(playerId: string): void
  /** Removes a target from the controlled Program's board. */
  removeRecruitingTarget(playerId: string): void
  /** Focuses or unfocuses one board target through the canonical Recruiting API. */
  setRecruitingFocus(playerId: string, isFocused: boolean): void
  /** Places a controlled-Program offer on a board target. */
  offerRecruitingTarget(playerId: string): void
  /** Withdraws the controlled Program's active offer on a board target. */
  withdrawRecruitingOffer(playerId: string): void
  /** Dismisses the most recent Recruiting action error without changing Dynasty state. */
  dismissRecruitingActionError(): void
  /** Creates the accepted deterministic default board/offers only while the controlled board is empty. */
  generateControlledDraftBoard(): void
  /** Generates the suggested plan and resumes the exact paused basketball action. */
  generateDraftBoardAndContinue(): void
  /** Discards the paused basketball action and opens existing Recruiting management. */
  reviewRecruitingSetup(): void
  /** Dismisses onboarding without changing basketball or Recruiting facts. */
  cancelRecruitingSetup(): void
  /** Opens the user-reviewable Late Recruiting phase after the championship boundary. */
  enterLateRecruiting(): void
  /** Resolves and archives the active Late Recruiting class without starting Offseason. */
  finalizeRecruitingClass(): void
  /** Archives the completed year and prepares Offseason without rolling over. */
  beginDynastyOffseason(): void
  /** Atomically rolls the prepared Dynasty into its next active Season. */
  beginNextSeason(): void
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

function controlledRecruitingBoardIsEmpty(dynasty: DynastyState): boolean {
  const recruiting = dynasty.recruiting
  return Boolean(
    recruiting &&
      recruiting.programs[dynasty.controlledProgramId]?.board.length === 0,
  )
}

/** Pure preflight using the same completed-Round 1 gate as Recruiting synchronization. */
export function needsRecruitingSetupBeforeAdvance(
  dynasty: DynastyState,
  proposedSeason: SeasonState,
): boolean {
  return Boolean(
    dynasty.recruiting?.lastResolvedPeriod === 0 &&
      controlledRecruitingBoardIsEmpty(dynasty) &&
      isRoundComplete(proposedSeason, 1),
  )
}

/** Interactive-only policy: preserve the plan and class, but start user strategy empty. */
function withoutControlledRecruitingStrategy(dynasty: DynastyState): DynastyState {
  const recruiting = dynasty.recruiting
  const program = recruiting?.programs[dynasty.controlledProgramId]
  if (!recruiting || !program) return dynasty
  return {
    ...dynasty,
    recruiting: {
      ...recruiting,
      programs: {
        ...recruiting.programs,
        [program.programId]: { ...program, board: [] },
      },
    },
  }
}

function withGeneratedControlledDraftBoard(dynasty: DynastyState): DynastyState {
  const recruiting = dynasty.recruiting
  const program = recruiting?.programs[dynasty.controlledProgramId]
  if (!recruiting || !program || program.board.length > 0) return dynasty

  const board = buildDefaultRecruitingBoard(
    dynasty,
    recruiting,
    dynasty.controlledProgramId,
  )
  const recruitingWithBoard: RecruitingState = {
    ...recruiting,
    programs: {
      ...recruiting.programs,
      [program.programId]: { ...program, board },
    },
  }
  const context = { ...dynasty, recruiting: recruitingWithBoard }
  const managedProgram = manageProgramRecruitingOffers(
    context,
    recruitingWithBoard,
    dynasty.controlledProgramId,
  )
  const alignedProgram = alignGeneratedRecruitingFocus(
    context,
    recruitingWithBoard,
    dynasty.controlledProgramId,
    managedProgram,
  )

  return {
    ...context,
    recruiting: {
      ...recruitingWithBoard,
      programs: {
        ...recruitingWithBoard.programs,
        [program.programId]: alignedProgram,
      },
    },
  }
}

/**
 * Always replaces the baseline with the pre-simulation
 * `recruiting.lastResolvedPeriod`, so the Recruiting Update recap reflects
 * only the most recent progression action: a later quiet simulation clears
 * an earlier unseen commitment instead of preserving it indefinitely.
 */
function nextRecruitingActivityBaseline(dynasty: DynastyState): number | null {
  return dynasty.recruiting?.lastResolvedPeriod ?? null
}

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
 * Advances through the existing Season and Postseason production operations,
 * synchronizing Recruiting at the same boundaries as stepwise progression.
 * Deliberately stops at the completed-Tournament checkpoint; Late Recruiting
 * remains an explicit user action.
 */
export function simulateDynastyToSeasonComplete(
  dynasty: DynastyState,
): DynastyState {
  const season = dynasty.activeSeason
  if (!season) return dynasty

  const completedSeason = simulatePendingGamesThroughRound({
    season,
    throughRound: season.schedule.roundCount,
    simulationSeed: regularSeasonSimulationSeed(
      dynasty.dynastySeed,
      season.seasonNumber,
    ),
  })
  let current = withActiveSeason(dynasty, completedSeason)
  let postseason =
    current.activePostseason ??
    initializePostseason({ universe: UNIVERSE_V0, season: completedSeason })

  current = { ...current, activePostseason: postseason }
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: postseasonSimulationSeed(
        current.dynastySeed,
        completedSeason.seasonNumber,
      ),
    })
    current = withActivePostseason(current, postseason)
  }

  return current
}

/**
 * Shared core of both simulation entry points: resolves the controlled
 * Program's next ScheduledGame from current canonical Season state, catching
 * up any fully-past rounds first. Returns null when there is nothing pending.
 */
function runNextGameSimulation(
  season: SeasonState,
  controlledProgramId: string,
  simulationSeed: RngSeed,
): { season: SeasonState; playedGameId: string } | null {
  const nextGame = getNextGameForProgram(season, controlledProgramId)

  if (!nextGame) {
    return null
  }

  const caughtUpSeason = catchUpRoundsBefore(
    season,
    controlledProgramId,
    nextGame.round,
    simulationSeed,
  )
  const nextSeason = simulateScheduledGame({
    season: caughtUpSeason,
    scheduledGameId: nextGame.id,
    simulationSeed,
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
  recruitingActionError: null,
  pendingRecruitingSetupIntent: null,
  recruitingActivityBaselinePeriod: null,
  selectProgram(programId, explicitDynastySeed) {
    const dynastySeed = explicitDynastySeed ?? createInteractiveDynastySeed()
    const initializedUniverse = initializeUniverse(
      UNIVERSE_V0,
      deriveInteractiveSeed(dynastySeed, 'universe'),
    )
    const schedule = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: deriveInteractiveSeed(dynastySeed, 'schedule:season-1'),
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

    const dynasty = withoutControlledRecruitingStrategy(
      initializeRecruiting(initializeDynastyState({
        dynastyId: `dynasty:${programId}:${seedValue(dynastySeed)}`,
        dynastySeed,
        controlledProgramId: programId,
        universe: UNIVERSE_V0,
        activeSeason: season,
      })),
    )

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
      recruitingActionError: null,
      pendingRecruitingSetupIntent: null,
      recruitingActivityBaselinePeriod: null,
    })
  },

  setDraftPlayerPositionMinutes(playerId, floorPosition, minutes) {
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
    const nextDraft = cloneRotationV1(draftRotation)
    const nextMinutes = nextDraft.minutesByPosition[floorPosition]

    if (sanitizedMinutes === 0) {
      delete nextMinutes[playerId]
    } else {
      nextMinutes[playerId] = sanitizedMinutes
    }

    const isValid = validateRotationV1(controlledTeam, nextDraft).valid

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
      ? catchUpRoundsBefore(
          season,
          controlledProgramId,
          nextGame.round,
          regularSeasonSimulationSeed(dynasty.dynastySeed, season.seasonNumber),
        )
      : season
    if (needsRecruitingSetupBeforeAdvance(dynasty, caughtUpSeason)) {
      set({ pendingRecruitingSetupIntent: 'game-prep-catch-up' })
      return
    }
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
    set({
      view: 'hub',
      viewedGameId: null,
      explorationViewHistory: [],
      recruitingActionError: null,
    })
  },

  playScheduledGame() {
    const { dynasty, draftRotation } = get()
    const season = dynasty?.activeSeason
    const controlledProgramId = dynasty?.controlledProgramId

    if (!dynasty || !season || !controlledProgramId || !draftRotation) {
      return
    }

    const controlledTeam = season.programStates[controlledProgramId]?.team

    if (!controlledTeam || !validateRotationV1(controlledTeam, draftRotation).valid) {
      return
    }

    const outcome = runNextGameSimulation(
      season,
      controlledProgramId,
      regularSeasonSimulationSeed(dynasty.dynastySeed, season.seasonNumber),
    )

    if (!outcome) {
      return
    }

    if (needsRecruitingSetupBeforeAdvance(dynasty, outcome.season)) {
      set({ pendingRecruitingSetupIntent: 'play-scheduled-game' })
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

    const outcome = runNextGameSimulation(
      season,
      controlledProgramId,
      regularSeasonSimulationSeed(dynasty.dynastySeed, season.seasonNumber),
    )

    if (!outcome) {
      return
    }

    if (needsRecruitingSetupBeforeAdvance(dynasty, outcome.season)) {
      set({ pendingRecruitingSetupIntent: 'quick-sim-controlled-game' })
      return
    }

    set({
      dynasty: withActiveSeason(dynasty, outcome.season),
      lastPlayedGameId: outcome.playedGameId,
      view: 'hub',
      recruitingActivityBaselinePeriod: nextRecruitingActivityBaseline(dynasty),
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
      simulationSeed: regularSeasonSimulationSeed(
        dynasty.dynastySeed,
        season.seasonNumber,
      ),
      excludedProgramIds: [controlledProgramId],
    })

    if (needsRecruitingSetupBeforeAdvance(dynasty, nextSeason)) {
      set({ pendingRecruitingSetupIntent: 'simulate-other-games' })
      return
    }

    set({
      dynasty: withActiveSeason(dynasty, nextSeason),
      recruitingActivityBaselinePeriod: nextRecruitingActivityBaseline(dynasty),
    })
  },

  viewCompletedGame(scheduledGameId) {
    const season = get().dynasty?.activeSeason

    if (!season || season.resultsByGameId[scheduledGameId] === undefined) {
      return
    }

    set({ viewedGameId: scheduledGameId, view: 'gameHistory' })
  },

  requestSuperSim(kind) {
    const dynasty = get().dynasty
    const season = dynasty?.activeSeason

    if (!dynasty || !season) {
      return
    }

    if (
      kind === 'seasonComplete' &&
      dynasty.activePostseason &&
      isTournamentComplete(dynasty.activePostseason) &&
      dynasty.recruiting?.lastResolvedPeriod === FINAL_RECRUITING_PERIOD
    ) {
      return
    }

    const throughRound =
      kind === 'midseason' ? MIDSEASON_ROUND : season.schedule.roundCount

    const pendingSuperSim = { kind, throughRound }
    const proposedSeason = simulatePendingGamesThroughRound({
      season,
      throughRound,
      simulationSeed: regularSeasonSimulationSeed(
        dynasty.dynastySeed,
        season.seasonNumber,
      ),
    })
    set({
      pendingSuperSim,
      pendingRecruitingSetupIntent: needsRecruitingSetupBeforeAdvance(
        dynasty,
        proposedSeason,
      )
        ? 'confirm-super-sim'
        : null,
    })
  },

  cancelSuperSim() {
    set({ pendingSuperSim: null, pendingRecruitingSetupIntent: null })
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
      simulationSeed: regularSeasonSimulationSeed(
        dynasty.dynastySeed,
        season.seasonNumber,
      ),
    })
    if (needsRecruitingSetupBeforeAdvance(dynasty, nextSeason)) {
      set({ pendingRecruitingSetupIntent: 'confirm-super-sim' })
      return
    }

    const recruitingActivityBaselinePeriod = nextRecruitingActivityBaseline(dynasty)

    if (pendingSuperSim.kind === 'seasonComplete') {
      const nextDynasty = simulateDynastyToSeasonComplete(dynasty)
      const controlledState =
        nextDynasty.activePostseason?.programStates[controlledProgramId]

      set({
        dynasty: nextDynasty,
        pendingSuperSim: null,
        pendingRecruitingSetupIntent: null,
        superSimSummary: null,
        postseasonControlledDefaultRotation: controlledState?.rotation ?? null,
        postseasonDraftRotation: controlledState?.rotation ?? null,
        lastPlayedTournamentGameId: null,
        viewedTournamentGameId: null,
        view: 'postseasonHub',
        recruitingActivityBaselinePeriod,
      })
      return
    }
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
      recruitingActivityBaselinePeriod,
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
    set({
      view: 'postseasonHub',
      viewedTournamentGameId: null,
      explorationViewHistory: [],
      recruitingActionError: null,
    })
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

  setPostseasonDraftPlayerPositionMinutes(playerId, floorPosition, minutes) {
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
    const nextDraft = cloneRotationV1(postseasonDraftRotation)
    const nextMinutes = nextDraft.minutesByPosition[floorPosition]

    if (sanitizedMinutes === 0) {
      delete nextMinutes[playerId]
    } else {
      nextMinutes[playerId] = sanitizedMinutes
    }

    const isValid = validateRotationV1(controlledState.team, nextDraft).valid

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

    if (!validateRotationV1(controlledState.team, postseasonDraftRotation).valid) {
      return
    }

    const game = resolveControlledTournamentGame(postseason, controlledProgramId)

    if (!game) {
      return
    }

    const nextPostseason = simulateTournamentGame({
      postseason,
      tournamentGameId: game.id,
      simulationSeed: postseasonSimulationSeed(
        dynasty.dynastySeed,
        dynasty.activeSeason!.seasonNumber,
      ),
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
      simulationSeed: postseasonSimulationSeed(
        dynasty.dynastySeed,
        dynasty.activeSeason!.seasonNumber,
      ),
    })

    set({
      dynasty: withActivePostseason(dynasty, nextPostseason),
      lastPlayedTournamentGameId: game.id,
      view: 'postseasonHub',
      recruitingActivityBaselinePeriod: nextRecruitingActivityBaseline(dynasty),
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
      simulationSeed: postseasonSimulationSeed(
        dynasty.dynastySeed,
        dynasty.activeSeason!.seasonNumber,
      ),
      excludedProgramIds: controlledProgramId ? [controlledProgramId] : [],
    })

    set({
      dynasty: withActivePostseason(dynasty, nextPostseason),
      recruitingActivityBaselinePeriod: nextRecruitingActivityBaseline(dynasty),
    })
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

  goToRecruiting() {
    set({
      view: 'recruiting',
      explorationViewHistory: [],
      recruitingActionError: null,
      recruitingActivityBaselinePeriod: null,
    })
  },

  addRecruitingTarget(playerId) {
    const { dynasty } = get()

    if (!dynasty?.recruiting) {
      return
    }

    try {
      const nextDynasty = addRecruitingBoardTarget({
        dynasty,
        playerId,
      })
      set({ dynasty: nextDynasty, recruitingActionError: null })
    } catch (error) {
      set({
        recruitingActionError:
          error instanceof Error ? error.message : 'Could not add that Recruit to the board.',
      })
    }
  },

  removeRecruitingTarget(playerId) {
    const { dynasty } = get()

    if (!dynasty?.recruiting) {
      return
    }

    try {
      const nextDynasty = removeRecruitingBoardTarget({ dynasty, playerId })
      set({ dynasty: nextDynasty, recruitingActionError: null })
    } catch (error) {
      set({
        recruitingActionError:
          error instanceof Error ? error.message : 'Could not remove that Recruit from the board.',
      })
    }
  },

  setRecruitingFocus(playerId, isFocused) {
    const { dynasty } = get()

    if (!dynasty?.recruiting) {
      return
    }

    try {
      const nextDynasty = setRecruitingFocus({ dynasty, playerId, isFocused })
      set({ dynasty: nextDynasty, recruitingActionError: null })
    } catch (error) {
      set({
        recruitingActionError:
          error instanceof Error ? error.message : 'Could not update that focus target.',
      })
    }
  },

  offerRecruitingTarget(playerId) {
    const { dynasty } = get()

    if (!dynasty?.recruiting) {
      return
    }

    try {
      const nextDynasty = offerRecruit({ dynasty, playerId })
      set({ dynasty: nextDynasty, recruitingActionError: null })
    } catch (error) {
      set({
        recruitingActionError:
          error instanceof Error ? error.message : 'Could not extend that offer.',
      })
    }
  },

  withdrawRecruitingOffer(playerId) {
    const { dynasty } = get()

    if (!dynasty?.recruiting) {
      return
    }

    try {
      const nextDynasty = withdrawRecruitOffer({ dynasty, playerId })
      set({ dynasty: nextDynasty, recruitingActionError: null })
    } catch (error) {
      set({
        recruitingActionError:
          error instanceof Error ? error.message : 'Could not withdraw that offer.',
      })
    }
  },

  dismissRecruitingActionError() {
    set({ recruitingActionError: null })
  },

  generateControlledDraftBoard() {
    const { dynasty } = get()
    if (!dynasty?.recruiting) return
    const nextDynasty = withGeneratedControlledDraftBoard(dynasty)
    if (nextDynasty === dynasty) return
    set({ dynasty: nextDynasty, recruitingActionError: null })
  },

  generateDraftBoardAndContinue() {
    const intent = get().pendingRecruitingSetupIntent
    if (!intent) return

    get().generateControlledDraftBoard()
    set({ pendingRecruitingSetupIntent: null })

    switch (intent) {
      case 'game-prep-catch-up':
        get().goToGamePrep()
        break
      case 'play-scheduled-game':
        get().playScheduledGame()
        break
      case 'quick-sim-controlled-game':
        get().simulateNextGame()
        break
      case 'simulate-other-games':
        get().simulateRestOfRound()
        break
      case 'confirm-super-sim':
        get().confirmSuperSim()
        break
    }
  },

  reviewRecruitingSetup() {
    set({ pendingRecruitingSetupIntent: null, pendingSuperSim: null })
    get().goToRecruiting()
  },

  cancelRecruitingSetup() {
    const cancelsSuperSim =
      get().pendingRecruitingSetupIntent === 'confirm-super-sim'
    set({
      pendingRecruitingSetupIntent: null,
      pendingSuperSim: cancelsSuperSim ? null : get().pendingSuperSim,
    })
  },

  enterLateRecruiting() {
    const { dynasty } = get()
    if (!dynasty) return

    try {
      const nextDynasty = prepareLateRecruiting(dynasty)
      set({
        dynasty: nextDynasty,
        view: 'recruiting',
        recruitingActionError: null,
      })
    } catch (error) {
      set({
        recruitingActionError:
          error instanceof Error ? error.message : 'Could not enter Late Recruiting.',
      })
    }
  },

  finalizeRecruitingClass() {
    const { dynasty } = get()
    if (!dynasty) return
    if (dynasty.recruiting?.phase !== 'late') {
      set({
        recruitingActionError: 'Recruiting must be in Late Recruiting before it can be finalized.',
      })
      return
    }

    try {
      const nextDynasty = autoFinalizeRecruiting(dynasty).dynasty
      set({
        dynasty: nextDynasty,
        view: 'recruiting',
        recruitingActionError: null,
      })
    } catch (error) {
      set({
        recruitingActionError:
          error instanceof Error ? error.message : 'Could not finalize Recruiting.',
      })
    }
  },

  beginDynastyOffseason() {
    const { dynasty } = get()
    if (!dynasty) return
    if (dynasty.recruiting?.phase !== 'finalized') {
      set({
        recruitingActionError: 'Recruiting must be finalized before Offseason can begin.',
      })
      return
    }

    try {
      const nextDynasty = beginOffseason(dynasty)
      set({
        dynasty: nextDynasty,
        view: 'offseason',
        recruitingActionError: null,
      })
    } catch (error) {
      set({
        recruitingActionError:
          error instanceof Error ? error.message : 'Could not begin Offseason.',
      })
    }
  },

  beginNextSeason() {
    const { dynasty } = get()
    if (!dynasty) return

    try {
      const nextDynasty = withoutControlledRecruitingStrategy(
        rolloverDynastyToNextSeason(dynasty),
      )
      const controlledRotation = nextDynasty.activeSeason!
        .programStates[nextDynasty.controlledProgramId]!.rotation

      set({
        dynasty: nextDynasty,
        controlledProgramDefaultRotation: controlledRotation,
        draftRotation: controlledRotation,
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
        recruitingActionError: null,
        pendingRecruitingSetupIntent: null,
        recruitingActivityBaselinePeriod: null,
      })
    } catch (error) {
      set({
        recruitingActionError:
          error instanceof Error ? error.message : 'Could not begin the next Season.',
      })
    }
  },
}))
