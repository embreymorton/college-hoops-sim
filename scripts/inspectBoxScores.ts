import {
  calculateTeamStrength,
  createRng,
  generateDefaultRotation,
  generateTeam,
  simulateGame,
  type GameResult,
  type Player,
  type PlayerGameStats,
  type Position,
  type Rotation,
  type Team,
  type TeamStrength,
} from '../src/engine'

const BASE_SEED = 'box-score-inspection-v0'
const SAMPLE_GAMES = 5_000
const STAT_FIELDS = [
  'minutes',
  'points',
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'turnovers',
  'fieldGoalsMade',
  'fieldGoalsAttempted',
  'threePointersMade',
  'threePointersAttempted',
  'freeThrowsMade',
  'freeThrowsAttempted',
] as const satisfies readonly (keyof PlayerGameStats)[]

type TableCell = string | number

interface TeamSetup {
  readonly team: Team
  readonly rotation: Rotation
  readonly strength: TeamStrength
}

interface ShowcaseGame {
  readonly label: string
  readonly home: TeamSetup
  readonly away: TeamSetup
  readonly result: GameResult
}

interface TeamGameSample {
  readonly team: Team
  readonly rotation: Rotation
  readonly score: number
  readonly overtimePeriods: number
  readonly rows: PlayerGameStats[]
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: readonly number[], value: number): number {
  const sorted = [...values].sort((first, second) => first - second)
  const index = Math.round((sorted.length - 1) * value)

  return sorted[index] as number
}

function fixed(value: number): string {
  return value.toFixed(1)
}

function percentage(numerator: number, denominator: number): string {
  return denominator === 0
    ? '—'
    : `${((numerator / denominator) * 100).toFixed(1)}%`
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

function setup(
  name: string,
  abbreviation: string,
  prestige: number,
  seed: string,
): TeamSetup {
  const team = generateTeam({
    name,
    abbreviation,
    prestige,
    rng: createRng(`${BASE_SEED}:team:${seed}`),
  })
  const rotation = generateDefaultRotation(team)

  return {
    team,
    rotation,
    strength: calculateTeamStrength(team, rotation),
  }
}

function play(home: TeamSetup, away: TeamSetup, seed: string): GameResult {
  return simulateGame({
    homeTeam: home.team,
    awayTeam: away.team,
    homeRotation: home.rotation,
    awayRotation: away.rotation,
    seed,
  })
}

function findShowcase(
  label: string,
  home: TeamSetup,
  away: TeamSetup,
  predicate: (result: GameResult) => boolean,
): ShowcaseGame {
  for (let index = 0; index < 20_000; index += 1) {
    const seed = `${BASE_SEED}:showcase:${label}:${index}`
    const result = play(home, away, seed)

    if (predicate(result)) {
      return { label, home, away, result }
    }
  }

  throw new Error(`Unable to find deterministic ${label} showcase`)
}

function playerName(team: Team, playerId: string): string {
  const boxPlayer = team.roster.find(({ id }) => id === playerId)

  return boxPlayer
    ? `${boxPlayer.firstName} ${boxPlayer.lastName}`
    : playerId
}

function playerPosition(team: Team, playerId: string): Position {
  const boxPlayer = team.roster.find(({ id }) => id === playerId)

  if (!boxPlayer) {
    throw new Error(`Unknown player ${playerId}`)
  }

  return boxPlayer.position
}

function shootingLine(made: number, attempted: number): string {
  return `${made}-${attempted}`
}

function writeTeamBox(team: Team, rows: readonly PlayerGameStats[]): void {
  process.stdout.write(
    `${renderTable(
      ['PLAYER', 'POS', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TO', 'FG', '3PT', 'FT'],
      rows.map((row) => [
        playerName(team, row.playerId),
        playerPosition(team, row.playerId),
        row.minutes,
        row.points,
        row.rebounds,
        row.assists,
        row.steals,
        row.blocks,
        row.turnovers,
        shootingLine(row.fieldGoalsMade, row.fieldGoalsAttempted),
        shootingLine(row.threePointersMade, row.threePointersAttempted),
        shootingLine(row.freeThrowsMade, row.freeThrowsAttempted),
      ]),
    )}\n`,
  )
}

function writeShowcases(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'A. SHOWCASE BOX SCORES\n' +
      '==============================================================================\n',
  )

  const evenHome = setup('Lakeview State', 'LVS', 65, 'even-home')
  const evenAway = setup('Prairie Tech', 'PRT', 65, 'even-away')
  const elite = setup('National College', 'NCO', 90, 'elite')
  const weak = setup('Pine Hills', 'PNH', 30, 'weak')
  const showcaseGames = [
    findShowcase(
      'even',
      evenHome,
      evenAway,
      (result) =>
        Math.abs(result.homeScore - result.awayScore) <= 10 &&
        Math.max(
          ...result.homePlayerStats.map(({ points }) => points),
          ...result.awayPlayerStats.map(({ points }) => points),
        ) <= 30,
    ),
    findShowcase(
      'strong-vs-weak',
      elite,
      weak,
      ({ homeScore, awayScore }) => homeScore - awayScore >= 20,
    ),
    findShowcase(
      'high-scoring',
      evenHome,
      evenAway,
      ({ homeScore, awayScore, overtimePeriods }) =>
        overtimePeriods === 0 && homeScore + awayScore >= 185,
    ),
    findShowcase(
      'low-scoring',
      evenHome,
      evenAway,
      ({ homeScore, awayScore }) => homeScore + awayScore <= 105,
    ),
    findShowcase(
      'overtime',
      evenHome,
      evenAway,
      ({ overtimePeriods }) => overtimePeriods > 0,
    ),
  ]

  for (const { label, home, away, result } of showcaseGames) {
    process.stdout.write(
      `\n${label.toUpperCase()} — ${home.team.name} ${result.homeScore}, ` +
        `${away.team.name} ${result.awayScore}` +
        `${result.overtimePeriods > 0 ? ` (${result.overtimePeriods} OT)` : ''}\n`,
    )
    process.stdout.write(
      `${home.team.abbreviation}: OFF ${fixed(home.strength.offense)} | ` +
        `DEF ${fixed(home.strength.defense)} | OVR ${fixed(home.strength.overall)}\n`,
    )
    writeTeamBox(home.team, result.homePlayerStats)
    process.stdout.write(
      `${away.team.abbreviation}: OFF ${fixed(away.strength.offense)} | ` +
        `DEF ${fixed(away.strength.defense)} | OVR ${fixed(away.strength.overall)}\n`,
    )
    writeTeamBox(away.team, result.awayPlayerStats)
    process.stdout.write(`Seed: ${String(result.seed)}\n`)
  }
}

function buildSamples(): TeamGameSample[] {
  const prestigeLevels = [30, 45, 60, 75, 90]
  const teams = prestigeLevels.flatMap((prestige) =>
    Array.from({ length: 15 }, (_, index) =>
      setup(
        `Sample P${prestige}-${index + 1}`,
        `P${prestige}`,
        prestige,
        `sample:${prestige}:${index}`,
      ),
    ),
  )
  const selectionRng = createRng(`${BASE_SEED}:sample-selection`)
  const samples: TeamGameSample[] = []

  for (let index = 0; index < SAMPLE_GAMES; index += 1) {
    const homeIndex = selectionRng.int(0, teams.length - 1)
    let awayIndex = selectionRng.int(0, teams.length - 1)

    if (awayIndex === homeIndex) {
      awayIndex = (awayIndex + 1) % teams.length
    }

    const home = teams[homeIndex] as TeamSetup
    const away = teams[awayIndex] as TeamSetup
    const result = play(home, away, `${BASE_SEED}:sample-game:${index}`)

    samples.push(
      {
        team: home.team,
        rotation: home.rotation,
        score: result.homeScore,
        overtimePeriods: result.overtimePeriods,
        rows: result.homePlayerStats,
      },
      {
        team: away.team,
        rotation: away.rotation,
        score: result.awayScore,
        overtimePeriods: result.overtimePeriods,
        rows: result.awayPlayerStats,
      },
    )
  }

  return samples
}

function writeScoringDistribution(samples: readonly TeamGameSample[]): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'B. INDIVIDUAL SCORING DISTRIBUTION\n' +
      '==============================================================================\n',
  )

  const teamLeaders = samples.map((sample) =>
    Math.max(...sample.rows.map(({ points }) => points)),
  )
  const gameLeaders = Array.from(
    { length: samples.length / 2 },
    (_, index) =>
      Math.max(teamLeaders[index * 2] as number, teamLeaders[index * 2 + 1] as number),
  )

  process.stdout.write(
    `${renderTable(
      ['METRIC', 'VALUE'],
      [
        ['Team-games sampled', samples.length],
        ['Average leading scorer (per Team)', fixed(average(teamLeaders))],
        ['Median leading scorer (per Team)', percentile(teamLeaders, 0.5)],
        ['P95 leading scorer (per Team)', percentile(teamLeaders, 0.95)],
        ['Maximum Player points', Math.max(...teamLeaders)],
        ['Games with a 20+ scorer', percentage(gameLeaders.filter((value) => value >= 20).length, gameLeaders.length)],
        ['Games with a 30+ scorer', percentage(gameLeaders.filter((value) => value >= 30).length, gameLeaders.length)],
        ['Games with a 40+ scorer', percentage(gameLeaders.filter((value) => value >= 40).length, gameLeaders.length)],
      ],
    )}\n`,
  )
}

function aggregatePositionRates(
  samples: readonly TeamGameSample[],
  field: 'rebounds' | 'assists',
): TableCell[][] {
  const totals = new Map<Position, { production: number; minutes: number }>()

  for (const sample of samples) {
    const players = new Map(sample.team.roster.map((item) => [item.id, item]))

    for (const row of sample.rows) {
      const boxPlayer = players.get(row.playerId) as Player
      const total = totals.get(boxPlayer.position) ?? {
        production: 0,
        minutes: 0,
      }
      total.production += row[field]
      total.minutes += row.minutes
      totals.set(boxPlayer.position, total)
    }
  }

  return (['PG', 'SG', 'SF', 'PF', 'C'] as const).map((position) => {
    const total = totals.get(position) as {
      production: number
      minutes: number
    }

    return [position, fixed((total.production / total.minutes) * 40)]
  })
}

function writeReboundDistribution(samples: readonly TeamGameSample[]): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'C. REBOUND DISTRIBUTION\n' +
      '==============================================================================\n',
  )
  const teamTotals = samples.map((sample) =>
    sample.rows.reduce((sum, row) => sum + row.rebounds, 0),
  )
  const leaders = samples.map((sample) =>
    Math.max(...sample.rows.map(({ rebounds }) => rebounds)),
  )

  process.stdout.write(
    `${renderTable(
      ['METRIC', 'VALUE'],
      [
        ['Average Team rebounds', fixed(average(teamTotals))],
        ['Average leading rebounder', fixed(average(leaders))],
        ['P95 leading rebounder', percentile(leaders, 0.95)],
        ['Maximum Player rebounds', Math.max(...leaders)],
      ],
    )}\n\n`,
  )
  process.stdout.write(
    `${renderTable(
      ['POSITION', 'REB PER 40'],
      aggregatePositionRates(samples, 'rebounds'),
    )}\n`,
  )
}

function writeAssistDistribution(samples: readonly TeamGameSample[]): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'D. ASSIST DISTRIBUTION\n' +
      '==============================================================================\n',
  )
  const teamTotals = samples.map((sample) =>
    sample.rows.reduce((sum, row) => sum + row.assists, 0),
  )
  const leaders = samples.map((sample) =>
    Math.max(...sample.rows.map(({ assists }) => assists)),
  )

  process.stdout.write(
    `${renderTable(
      ['METRIC', 'VALUE'],
      [
        ['Average Team assists', fixed(average(teamTotals))],
        ['Average leading assister', fixed(average(leaders))],
        ['P95 leading assister', percentile(leaders, 0.95)],
        ['Maximum Player assists', Math.max(...leaders)],
      ],
    )}\n\n`,
  )
  process.stdout.write(
    `${renderTable(
      ['POSITION', 'AST PER 40'],
      aggregatePositionRates(samples, 'assists'),
    )}\n`,
  )
}

function writeShootingValidation(samples: readonly TeamGameSample[]): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'E. SHOOTING VALIDATION\n' +
      '==============================================================================\n',
  )
  const rows = samples.flatMap((sample) => sample.rows)
  const total = (field: (typeof STAT_FIELDS)[number]) =>
    rows.reduce((sum, row) => sum + row[field], 0)
  const fieldGoalsMade = total('fieldGoalsMade')
  const fieldGoalsAttempted = total('fieldGoalsAttempted')
  const threesMade = total('threePointersMade')
  const threesAttempted = total('threePointersAttempted')
  const freeThrowsMade = total('freeThrowsMade')
  const freeThrowsAttempted = total('freeThrowsAttempted')

  process.stdout.write(
    `${renderTable(
      ['METRIC', 'VALUE'],
      [
        ['FG%', percentage(fieldGoalsMade, fieldGoalsAttempted)],
        ['3P%', percentage(threesMade, threesAttempted)],
        ['FT%', percentage(freeThrowsMade, freeThrowsAttempted)],
        ['Average 3PA per Team', fixed(threesAttempted / samples.length)],
        ['Average FTA per Team', fixed(freeThrowsAttempted / samples.length)],
      ],
    )}\n`,
  )
}

function playerRowIsValid(row: PlayerGameStats): boolean {
  return (
    STAT_FIELDS.every(
      (field) => Number.isInteger(row[field]) && row[field] >= 0,
    ) &&
    row.fieldGoalsMade <= row.fieldGoalsAttempted &&
    row.threePointersMade <= row.threePointersAttempted &&
    row.threePointersMade <= row.fieldGoalsMade &&
    row.threePointersAttempted <= row.fieldGoalsAttempted &&
    row.freeThrowsMade <= row.freeThrowsAttempted &&
    row.points ===
      2 * (row.fieldGoalsMade - row.threePointersMade) +
        3 * row.threePointersMade +
        row.freeThrowsMade
  )
}

function writeInvariantValidation(samples: readonly TeamGameSample[]): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'F. INVARIANT VALIDATION\n' +
      '==============================================================================\n',
  )
  let pointFailures = 0
  let minuteFailures = 0
  let zeroMinuteFailures = 0
  let invalidRows = 0

  for (const sample of samples) {
    if (
      sample.rows.reduce((sum, row) => sum + row.points, 0) !== sample.score
    ) {
      pointFailures += 1
    }

    if (
      sample.rows.reduce((sum, row) => sum + row.minutes, 0) !==
      200 + sample.overtimePeriods * 5
    ) {
      minuteFailures += 1
    }

    for (const row of sample.rows) {
      if (!playerRowIsValid(row)) {
        invalidRows += 1
      }

      if (
        (sample.rotation.minutes[row.playerId] ?? 0) === 0 &&
        STAT_FIELDS.some((field) => row[field] !== 0)
      ) {
        zeroMinuteFailures += 1
      }
    }
  }

  process.stdout.write(
    `${renderTable(
      ['CHECK', 'FAILURES'],
      [
        ['Player points equal Team score', `${pointFailures} / ${samples.length}`],
        ['Team minutes reconcile', `${minuteFailures} / ${samples.length}`],
        ['Zero-minute rows remain zero', `${zeroMinuteFailures} / ${samples.length}`],
        ['Rows satisfy integer/shooting rules', `${invalidRows} / ${samples.flatMap((sample) => sample.rows).length}`],
      ],
    )}\n`,
  )
}

function main(): void {
  process.stdout.write('COLLEGE HOOPS SIM — PLAYER BOX SCORES V0 INSPECTION\n')
  process.stdout.write(`Deterministic base seed: ${BASE_SEED}\n`)
  process.stdout.write(
    'Final scores come from the accepted Single-Game V0 model.\n',
  )

  writeShowcases()
  const samples = buildSamples()
  writeScoringDistribution(samples)
  writeReboundDistribution(samples)
  writeAssistDistribution(samples)
  writeShootingValidation(samples)
  writeInvariantValidation(samples)
  process.stdout.write('\n')
}

main()
