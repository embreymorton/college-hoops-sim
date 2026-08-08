import { UNIVERSE_V0, type ProgramDefinition } from '../universe'

/**
 * Presentation adapter for the accepted six-program exhibition workflow.
 * Permanent identity/branding comes from Universe V0; National Tech remains
 * an explicitly development-only fixture. The stable universe is not yet a
 * season or league UI.
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

const PERMANENT_DEMO_PROGRAM_IDS = [
  'charlotte-tech',
  'capital-state',
  'great-lakes',
  'pine-valley',
  'coastal-plains',
] as const

function getUniverseProgram(programId: string): ProgramDefinition {
  const program = UNIVERSE_V0.programs.find(({ id }) => id === programId)

  if (!program) {
    throw new RangeError(`Unknown Universe V0 program ID "${programId}"`)
  }

  return program
}

function toPermanentDemoProgram(programId: string): DemoProgram {
  const program = getUniverseProgram(programId)

  return {
    id: program.id,
    name: program.name,
    abbreviation: program.abbreviation,
    prestige: program.basePrestige,
    seed: `demo-program:${program.id}:v1`,
    primaryColor: program.branding.primaryColor,
    secondaryColor: program.branding.secondaryColor,
  }
}

const DEVELOPMENT_ONLY_DEMO_PROGRAMS = [
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

export const DEMO_PROGRAMS: readonly DemoProgram[] = [
  ...PERMANENT_DEMO_PROGRAM_IDS.map(toPermanentDemoProgram),
  ...DEVELOPMENT_ONLY_DEMO_PROGRAMS,
]

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
