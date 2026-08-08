/**
 * Neutral application-data demo program catalog for Game Presentation V0.
 * There is no league system yet — these are deterministic display fixtures
 * consumed by the engine's public `generateTeam`/`generateDefaultRotation`
 * API, not engine domain data. Colors and seeds live here, never on `Team`.
 * Lives outside `app/` so both React screens and the Zustand store can
 * depend on it without the store reaching into the app layer.
 */
export interface DemoProgram {
  readonly id: string
  readonly name: string
  readonly abbreviation: string
  readonly prestige: number
  readonly seed: string
  readonly primaryColor: string
  readonly secondaryColor: string
}

export const DEMO_PROGRAMS = [
  {
    id: 'charlotte-tech',
    name: 'Charlotte Tech',
    abbreviation: 'CTU',
    prestige: 75,
    seed: 'demo-program:charlotte-tech:v1',
    primaryColor: '#3f7fe0',
    secondaryColor: '#17335c',
  },
  {
    id: 'capital-state',
    name: 'Capital State',
    abbreviation: 'CSU',
    prestige: 60,
    seed: 'demo-program:capital-state:v1',
    primaryColor: '#c23b3b',
    secondaryColor: '#4a1717',
  },
  {
    id: 'great-lakes',
    name: 'Great Lakes',
    abbreviation: 'GLU',
    prestige: 90,
    seed: 'demo-program:great-lakes:v1',
    primaryColor: '#2f9e6e',
    secondaryColor: '#0f3326',
  },
  {
    id: 'pine-valley',
    name: 'Pine Valley',
    abbreviation: 'PVA',
    prestige: 30,
    seed: 'demo-program:pine-valley:v1',
    primaryColor: '#b5842a',
    secondaryColor: '#40300f',
  },
  {
    id: 'coastal-plains',
    name: 'Coastal Plains',
    abbreviation: 'CPU',
    prestige: 45,
    seed: 'demo-program:coastal-plains:v1',
    primaryColor: '#2ba7a1',
    secondaryColor: '#0f3a38',
  },
  {
    id: 'national-tech',
    name: 'National Tech',
    abbreviation: 'NTU',
    prestige: 85,
    seed: 'demo-program:national-tech:v1',
    primaryColor: '#7a4fd1',
    secondaryColor: '#2a1c4d',
  },
] as const satisfies readonly DemoProgram[]

export const DEFAULT_HOME_PROGRAM_ID = 'charlotte-tech'
export const DEFAULT_AWAY_PROGRAM_ID = 'capital-state'

const DEMO_PROGRAMS_BY_ID: ReadonlyMap<string, DemoProgram> = new Map(
  DEMO_PROGRAMS.map((program) => [program.id, program] as const),
)

export function getDemoProgram(programId: string): DemoProgram {
  const program = DEMO_PROGRAMS_BY_ID.get(programId)

  if (!program) {
    throw new RangeError(`Unknown demo program ID "${programId}"`)
  }

  return program
}
