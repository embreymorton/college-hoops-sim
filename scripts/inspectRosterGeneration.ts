import {
  calculateOverall,
  calculateRosterAverage,
  calculateTopPlayersAverage,
  CLASS_YEARS,
  createRng,
  generateTeam,
  POSITIONS,
  type Player,
  type Team,
} from '../src/engine'

const BASE_SEED = 'roster-generation-inspection-v1'
const TEAMS_PER_PRESTIGE = 500

const SHOWCASE_TEAMS = [
  { name: 'Pine Valley', abbreviation: 'PVA', prestige: 30 },
  { name: 'Coastal Plains', abbreviation: 'CPU', prestige: 45 },
  { name: 'Capital State', abbreviation: 'CSU', prestige: 60 },
  { name: 'Charlotte Tech', abbreviation: 'CTU', prestige: 75 },
  { name: 'Great Lakes', abbreviation: 'GLU', prestige: 90 },
] as const

type TableCell = string | number

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  const sampleAverage = average(values)

  return Math.sqrt(
    average(values.map((value) => (value - sampleAverage) ** 2)),
  )
}

function fixed(value: number): string {
  return value.toFixed(1)
}

function formatHeight(height: number): string {
  return `${Math.floor(height / 12)}'${height % 12}"`
}

function renderTable(headers: readonly string[], rows: readonly TableCell[][]): string {
  const matrix = [headers, ...rows.map((row) => row.map(String))]
  const widths = headers.map((_, columnIndex) =>
    Math.max(...matrix.map((row) => row[columnIndex]?.length ?? 0)),
  )

  return matrix
    .map((row) =>
      row
        .map((cell, columnIndex) =>
          columnIndex < 2
            ? cell.padEnd(widths[columnIndex] ?? 0)
            : cell.padStart(widths[columnIndex] ?? 0),
        )
        .join('  '),
    )
    .join('\n')
}

function countValues<T extends string>(
  values: readonly T[],
  possibleValues: readonly T[],
): Record<T, number> {
  return Object.fromEntries(
    possibleValues.map((value) => [
      value,
      values.filter((candidate) => candidate === value).length,
    ]),
  ) as Record<T, number>
}

function formatCounts<T extends string>(
  counts: Readonly<Record<T, number>>,
  order: readonly T[],
): string {
  return order.map((value) => `${value} ${counts[value]}`).join(' | ')
}

function sortedRoster(roster: readonly Player[]): Player[] {
  return [...roster].sort(
    (first, second) =>
      calculateOverall(second) - calculateOverall(first) ||
      first.lastName.localeCompare(second.lastName),
  )
}

function writeShowcaseTeam(team: Team): void {
  const overalls = team.roster.map(calculateOverall)
  const positionCounts = countValues(
    team.roster.map((player) => player.position),
    POSITIONS,
  )
  const classYearCounts = countValues(
    team.roster.map((player) => player.classYear),
    CLASS_YEARS,
  )

  process.stdout.write(`\n${team.name.toUpperCase()} (${team.abbreviation})\n`)
  process.stdout.write(`Prestige: ${team.prestige}\n`)
  process.stdout.write(
    `Average OVR: ${fixed(calculateRosterAverage(team.roster))} | ` +
      `Top 5: ${fixed(calculateTopPlayersAverage(team.roster))} | ` +
      `Best: ${Math.max(...overalls)} | Worst: ${Math.min(...overalls)}\n`,
  )
  process.stdout.write(`Positions: ${formatCounts(positionCounts, POSITIONS)}\n`)
  process.stdout.write(
    `Classes: ${formatCounts(classYearCounts, CLASS_YEARS)}\n\n`,
  )

  const rows = sortedRoster(team.roster).map((player) => [
    player.position,
    `${player.firstName} ${player.lastName}`,
    player.classYear,
    formatHeight(player.height),
    calculateOverall(player),
    player.potential,
  ])

  process.stdout.write(
    `${renderTable(['POS', 'PLAYER', 'YR', 'HT', 'OVR', 'POT'], rows)}\n`,
  )
}

function writeShowcase(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      '1. SHOWCASE ROSTERS\n' +
      '==============================================================================\n',
  )

  for (const config of SHOWCASE_TEAMS) {
    const team = generateTeam({
      ...config,
      rng: createRng(`${BASE_SEED}:showcase:${config.prestige}`),
    })
    writeShowcaseTeam(team)
  }
}

interface TeamMetrics {
  readonly rosterAverage: number
  readonly topFiveAverage: number
  readonly bestOverall: number
  readonly worstOverall: number
  readonly rosterStandardDeviation: number
}

function calculateTeamMetrics(team: Team): TeamMetrics {
  const overalls = team.roster.map(calculateOverall)

  return {
    rosterAverage: calculateRosterAverage(team.roster),
    topFiveAverage: calculateTopPlayersAverage(team.roster),
    bestOverall: Math.max(...overalls),
    worstOverall: Math.min(...overalls),
    rosterStandardDeviation: standardDeviation(overalls),
  }
}

function writePrestigeValidation(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      '2. LARGE-SAMPLE PRESTIGE VALIDATION\n' +
      '==============================================================================\n',
  )
  process.stdout.write(
    `Deterministic sample: ${TEAMS_PER_PRESTIGE} teams per prestige tier.\n` +
      `Seed family: ${BASE_SEED}:validation:*\n\n`,
  )

  const rows = SHOWCASE_TEAMS.map(({ prestige }) => {
    const rng = createRng(`${BASE_SEED}:validation:${prestige}`)
    const metrics = Array.from({ length: TEAMS_PER_PRESTIGE }, (_, index) =>
      calculateTeamMetrics(
        generateTeam({
          name: `Validation ${prestige}-${index + 1}`,
          abbreviation: `P${prestige}`,
          prestige,
          rng,
        }),
      ),
    )
    const rosterAverages = metrics.map((metric) => metric.rosterAverage)

    return [
      prestige,
      metrics.length,
      fixed(average(rosterAverages)),
      fixed(Math.min(...rosterAverages)),
      fixed(Math.max(...rosterAverages)),
      fixed(average(metrics.map((metric) => metric.topFiveAverage))),
      fixed(average(metrics.map((metric) => metric.bestOverall))),
      fixed(average(metrics.map((metric) => metric.worstOverall))),
      fixed(
        average(metrics.map((metric) => metric.rosterStandardDeviation)),
      ),
    ]
  })

  process.stdout.write(
    `${renderTable(
      [
        'PRESTIGE',
        'TEAMS',
        'AVG OVR',
        'MIN AVG',
        'MAX AVG',
        'TOP 5',
        'BEST',
        'WORST',
        'AVG SD',
      ],
      rows,
    )}\n`,
  )
}

function main(): void {
  process.stdout.write('COLLEGE HOOPS SIM — ROSTER GENERATION INSPECTION\n')
  process.stdout.write(`Deterministic base seed: ${BASE_SEED}\n`)
  process.stdout.write('Derived ratings are displayed but never stored on Team.\n')

  writeShowcase()
  writePrestigeValidation()
  process.stdout.write('\n')
}

main()
