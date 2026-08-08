import { create } from 'zustand'
import {
  calculateTeamStrength,
  createRng,
  generateDefaultRotation,
  generateTeam,
  simulateGame,
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
  readonly phase: GamePresentationPhase
  readonly result: GameResult | null
  /** Number of games simulated for the current home/away pairing. */
  readonly simulationSequence: number
  /** No-op if programId matches the current away program. */
  setHomeProgram(programId: string): void
  /** No-op if programId matches the current home program. */
  setAwayProgram(programId: string): void
  simulate(): void
  changeMatchup(): void
}

export const useGamePresentationStore = create<GamePresentationState>(
  (set, get) => ({
    homeProgramId: DEFAULT_HOME_PROGRAM_ID,
    awayProgramId: DEFAULT_AWAY_PROGRAM_ID,
    homeSetup: getDemoTeamSetup(DEFAULT_HOME_PROGRAM_ID),
    awaySetup: getDemoTeamSetup(DEFAULT_AWAY_PROGRAM_ID),
    phase: 'pregame',
    result: null,
    simulationSequence: 0,

    setHomeProgram(programId) {
      if (programId === get().awayProgramId) {
        return
      }

      set({
        homeProgramId: programId,
        homeSetup: getDemoTeamSetup(programId),
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

    simulate() {
      const {
        homeProgramId,
        awayProgramId,
        homeSetup,
        awaySetup,
        simulationSequence,
      } = get()
      const nextSequence = simulationSequence + 1
      const seed = buildGameSeed(
        getDemoProgram(homeProgramId).abbreviation,
        getDemoProgram(awayProgramId).abbreviation,
        nextSequence,
      )
      const result = simulateGame({
        homeTeam: homeSetup.team,
        awayTeam: awaySetup.team,
        homeRotation: homeSetup.rotation,
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
