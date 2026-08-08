import {
  calculateRosterAverage,
  calculateTeamStrength,
  validateRotation,
} from '../src/engine'
import {
  initializeUniverse,
  UNIVERSE_V0,
  validateUniverseDefinition,
  type InitializedProgram,
  type UniverseDefinition,
} from '../src/universe'

const DYNASTY_SEED = 'universe-inspection-v0'
const SAMPLE_PROGRAM_IDS = [
  'great-lakes',
  'charlotte-tech',
  'capital-state',
  'pine-valley',
] as const

type TableCell = string | number

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function fixed(value: number): string {
  return value.toFixed(1)
}

function renderTable(
  headers: readonly string[],
  rows: readonly TableCell[][],
): string {
  const matrix = [headers, ...rows.map((row) => row.map(String))]
  const widths = headers.map((_, columnIndex) =>
    Math.max(...matrix.map((row) => row[columnIndex]?.length ?? 0)),
  )

  return matrix
    .map((row) =>
      row
        .map((cell, columnIndex) =>
          columnIndex === 0
            ? cell.padEnd(widths[columnIndex] ?? 0)
            : cell.padStart(widths[columnIndex] ?? 0),
        )
        .join('  '),
    )
    .join('\n')
}

function byProgramId(
  programs: readonly InitializedProgram[],
): Map<string, InitializedProgram> {
  return new Map(programs.map((program) => [program.program.id, program]))
}

function main(): void {
  const definitionValidation = validateUniverseDefinition(UNIVERSE_V0)

  if (!definitionValidation.valid) {
    throw new Error(
      definitionValidation.issues.map(({ message }) => message).join(' '),
    )
  }

  const initialized = initializeUniverse(UNIVERSE_V0, DYNASTY_SEED)
  const repeated = initializeUniverse(UNIVERSE_V0, DYNASTY_SEED)
  const reversedDefinition: UniverseDefinition = {
    ...UNIVERSE_V0,
    programs: [...UNIVERSE_V0.programs].reverse(),
  }
  const reversed = byProgramId(
    initializeUniverse(reversedDefinition, DYNASTY_SEED).programs,
  )
  const original = byProgramId(initialized.programs)
  const stableTeamIds = initialized.programs.every(
    ({ program, team }) => team.id === program.id,
  )
  const validRotations = initialized.programs.every(
    ({ team, rotation }) => validateRotation(team, rotation).valid,
  )
  const orderIndependent = UNIVERSE_V0.programs.every(({ id }) =>
    JSON.stringify(original.get(id)) === JSON.stringify(reversed.get(id)),
  )

  process.stdout.write(
    'COLLEGE HOOPS SIM — UNIVERSE V0 INSPECTION\n' +
      `Deterministic dynasty seed: ${DYNASTY_SEED}\n\n` +
      'UNIVERSE SUMMARY\n' +
      'Universe: Fictional US V0\n' +
      `Programs: ${UNIVERSE_V0.programs.length}\n` +
      `Conferences: ${UNIVERSE_V0.conferences.length}\n` +
      `Definition valid: ${definitionValidation.valid ? 'YES' : 'NO'}\n` +
      `Stable Team IDs: ${stableTeamIds ? 'YES' : 'NO'}\n` +
      `Default Rotations valid: ${validRotations ? 'YES' : 'NO'}\n\n`,
  )

  const conferenceRows = UNIVERSE_V0.conferences.map((conference) => {
    const programs = UNIVERSE_V0.programs.filter(
      ({ conferenceId }) => conferenceId === conference.id,
    )
    const ordered = [...programs].sort(
      (first, second) => second.basePrestige - first.basePrestige,
    )

    return [
      conference.name,
      programs.length,
      fixed(average(programs.map(({ basePrestige }) => basePrestige))),
      `${ordered[0]!.name} (${ordered[0]!.basePrestige})`,
      `${ordered.at(-1)!.name} (${ordered.at(-1)!.basePrestige})`,
    ]
  })

  process.stdout.write(
    'CONFERENCE SUMMARY\n' +
      `${renderTable(
        ['CONFERENCE', 'TEAMS', 'AVG PRESTIGE', 'HIGHEST', 'LOWEST'],
        conferenceRows,
      )}\n\n`,
  )

  const sampleRows = SAMPLE_PROGRAM_IDS.map((programId) => {
    const entry = original.get(programId)

    if (!entry) {
      throw new Error(`Missing initialized program "${programId}"`)
    }

    const conference = UNIVERSE_V0.conferences.find(
      ({ id }) => id === entry.program.conferenceId,
    )
    const strength = calculateTeamStrength(entry.team, entry.rotation)

    return [
      entry.program.name,
      conference?.name ?? entry.program.conferenceId,
      entry.program.basePrestige,
      fixed(calculateRosterAverage(entry.team.roster)),
      fixed(strength.offense),
      fixed(strength.defense),
      fixed(strength.overall),
    ]
  })

  process.stdout.write(
    'PROGRAM INITIALIZATION SAMPLE\n' +
      `${renderTable(
        ['PROGRAM', 'CONFERENCE', 'PRESTIGE', 'AVG OVR', 'OFF', 'DEF', 'OVR'],
        sampleRows,
      )}\n\n` +
      'DETERMINISM\n' +
      `Same-seed reproduction: ${JSON.stringify(initialized) === JSON.stringify(repeated) ? 'PASS' : 'FAIL'}\n` +
      `Reverse-order independence by program ID: ${orderIndependent ? 'PASS' : 'FAIL'}\n`,
  )
}

main()
