import { create } from 'zustand'
import {
  calculateTeamStrength,
  createRng,
  generateDefaultRotation,
  generateTeam,
  simulateGame,
  validateRotation,
  type GameResult,
  type Rotation,
  type Team,
  type TeamStrength,
} from '../engine'
import {
  DEFAULT_AWAY_PROGRAM_ID,
  DEFAULT_HOME_PROGRAM_ID,
  getDemoProgram,
} from '../demo/demoPrograms'

/** One demo program's generated Team, its default Rotation, and derived Team Strength. */
export interface DemoTeamSetup {
  readonly team: Team
  readonly rotation: Rotation
  readonly strength: TeamStrength
}

const demoTeamSetupCache = new Map<string, DemoTeamSetup>()

function buildDemoTeamSetup(programId: string): DemoTeamSetup {
  const program = getDemoProgram(programId)
  const team = generateTeam({
    name: program.name,
    abbreviation: program.abbreviation,
    prestige: program.prestige,
    rng: createRng(program.seed),
  })
  const rotation = generateDefaultRotation(team)
  const strength = calculateTeamStrength(team, rotation)

  return { team, rotation, strength }
}

/** A demo program's Team/Rotation/Strength are stable for the session, so cache them. */
function getDemoTeamSetup(programId: string): DemoTeamSetup {
  const cached = demoTeamSetupCache.get(programId)

  if (cached) {
    return cached
  }

  const setup = buildDemoTeamSetup(programId)
  demoTeamSetupCache.set(programId, setup)

  return setup
}

/** Deterministic presentation-layer seed scheme: game:{HOME}:{AWAY}:{sequence}. */
export function buildGameSeed(
  homeAbbreviation: string,
  awayAbbreviation: string,
  sequence: number,
): string {
  return `game:${homeAbbreviation}:${awayAbbreviation}:${sequence}`
}

export type GamePresentationPhase = 'pregame' | 'postgame'

export interface GamePresentationState {
  readonly homeProgramId: string
  readonly awayProgramId: string
  readonly homeSetup: DemoTeamSetup
  readonly awaySetup: DemoTeamSetup
  /**
   * The coach's current home Rotation. Starts equal to `homeSetup.rotation`
   * and may be temporarily invalid while the coach reallocates minutes; only
   * the away Team's Rotation remains the fixed generated default.
   */
  readonly homeRotation: Rotation
  readonly phase: GamePresentationPhase
  readonly result: GameResult | null
  /** Number of games simulated for the current home/away pairing. */
  readonly simulationSequence: number
  /** No-op if programId matches the current away program. */
  setHomeProgram(programId: string): void
  /** No-op if programId matches the current home program. */
  setAwayProgram(programId: string): void
  /** Assigns one Player's minutes; zero minutes omits the Player, preserving canonical Rotation shape. */
  setHomePlayerMinutes(playerId: string, minutes: number): void
  /** Restores the coached home Rotation to the current Team's generated default. */
  resetHomeRotation(): void
  /** No-op if the current home Rotation is invalid; never simulates an illegal Rotation. */
  simulate(): void
  changeMatchup(): void
}

export const useGamePresentationStore = create<GamePresentationState>(
  (set, get) => ({
    homeProgramId: DEFAULT_HOME_PROGRAM_ID,
    awayProgramId: DEFAULT_AWAY_PROGRAM_ID,
    homeSetup: getDemoTeamSetup(DEFAULT_HOME_PROGRAM_ID),
    awaySetup: getDemoTeamSetup(DEFAULT_AWAY_PROGRAM_ID),
    homeRotation: getDemoTeamSetup(DEFAULT_HOME_PROGRAM_ID).rotation,
    phase: 'pregame',
    result: null,
    simulationSequence: 0,

    setHomeProgram(programId) {
      if (programId === get().awayProgramId) {
        return
      }

      const homeSetup = getDemoTeamSetup(programId)

      set({
        homeProgramId: programId,
        homeSetup,
        homeRotation: homeSetup.rotation,
        phase: 'pregame',
        result: null,
        simulationSequence: 0,
      })
    },

    setAwayProgram(programId) {
      if (programId === get().homeProgramId) {
        return
      }

      set({
        awayProgramId: programId,
        awaySetup: getDemoTeamSetup(programId),
        phase: 'pregame',
        result: null,
        simulationSequence: 0,
      })
    },

    setHomePlayerMinutes(playerId, minutes) {
      const sanitizedMinutes = Math.max(0, Math.round(minutes))
      const nextMinutes = { ...get().homeRotation.minutes }

      if (sanitizedMinutes === 0) {
        delete nextMinutes[playerId]
      } else {
        nextMinutes[playerId] = sanitizedMinutes
      }

      set({ homeRotation: { minutes: nextMinutes } })
    },

    resetHomeRotation() {
      set({ homeRotation: get().homeSetup.rotation })
    },

    simulate() {
      const {
        homeProgramId,
        awayProgramId,
        homeSetup,
        awaySetup,
        homeRotation,
        simulationSequence,
      } = get()

      if (!validateRotation(homeSetup.team, homeRotation).valid) {
        return
      }

      const nextSequence = simulationSequence + 1
      const seed = buildGameSeed(
        getDemoProgram(homeProgramId).abbreviation,
        getDemoProgram(awayProgramId).abbreviation,
        nextSequence,
      )
      const result = simulateGame({
        homeTeam: homeSetup.team,
        awayTeam: awaySetup.team,
        homeRotation,
        awayRotation: awaySetup.rotation,
        seed,
      })

      set({ result, simulationSequence: nextSequence, phase: 'postgame' })
    },

    changeMatchup() {
      set({ phase: 'pregame' })
    },
  }),
)
