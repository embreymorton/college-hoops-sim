import {
  calculateTeamStrength,
  createRng,
  generateDefaultRotation,
  generateTeam,
  POSITIONS,
  simulateGame,
  type GameResult,
  type Player,
  type PlayerAttributes,
  type Rotation,
  type Team,
  type TeamStrength,
} from '../src/engine'

const BASE_SEED = 'game-simulation-inspection-v0'
const REPEATED_GAMES = 5_000
const GLOBAL_GAMES = 10_000

type TableCell = string | number

interface TeamSetup {
  readonly team: Team
  readonly rotation: Rotation
  readonly strength: TeamStrength
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  const sampleAverage = average(values)

  return Math.sqrt(
    average(values.map((value) => (value - sampleAverage) ** 2)),
  )
}

function percentile(values: readonly number[], percentileValue: number): number {
  const sorted = [...values].sort((first, second) => first - second)
  const index = Math.round((sorted.length - 1) * percentileValue)

  return sorted[index] as number
}

function fixed(value: number): string {
  return value.toFixed(1)
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
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
          columnIndex === 0
            ? cell.padEnd(widths[columnIndex] ?? 0)
            : cell.padStart(widths[columnIndex] ?? 0),
        )
        .join('  '),
    )
    .join('\n')
}

function generatedSetup(
  name: string,
  abbreviation: string,
  prestige: number,
  seedSuffix: string,
): TeamSetup {
  const team = generateTeam({
    name,
    abbreviation,
    prestige,
    rng: createRng(`${BASE_SEED}:team:${seedSuffix}`),
  })
  const rotation = generateDefaultRotation(team)

  return {
    team,
    rotation,
    strength: calculateTeamStrength(team, rotation),
  }
}

function makeAttributes(rating: number): PlayerAttributes {
  return {
    finishing: rating,
    shooting: rating,
    playmaking: rating,
    ballHandling: rating,
    perimeterDefense: rating,
    interiorDefense: rating,
    rebounding: rating,
    athleticism: rating,
    stamina: rating,
  }
}

function constructedSetup(id: string, rating: number): TeamSetup {
  const roster = POSITIONS.map(
    (position): Player => ({
      id: `${id}-${position}`,
      firstName: id,
      lastName: position,
      position,
      classYear: 'JR',
      height: 78,
      attributes: makeAttributes(rating),
      potential: 99,
    }),
  )
  const team: Team = {
    id,
    name: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    prestige: rating,
    roster,
  }
  const rotation: Rotation = {
    minutes: Object.fromEntries(roster.map((player) => [player.id, 40])),
  }

  return {
    team,
    rotation,
    strength: calculateTeamStrength(team, rotation),
  }
}

function simulateSetupGame(
  home: TeamSetup,
  away: TeamSetup,
  seed: string,
): GameResult {
  return simulateGame({
    homeTeam: home.team,
    awayTeam: away.team,
    homeRotation: home.rotation,
    awayRotation: away.rotation,
    seed,
  })
}

function writeShowcaseGames(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'A. SHOWCASE GAMES\n' +
      '==============================================================================\n',
  )

  const matchups = [
    {
      home: generatedSetup('Pine Valley', 'PVA', 30, 'showcase-30-home'),
      away: generatedSetup('River County', 'RCU', 30, 'showcase-30-away'),
      seed: `${BASE_SEED}:showcase:30-v-30`,
    },
    {
      home: generatedSetup('Capital State', 'CSU', 60, 'showcase-60-home'),
      away: generatedSetup('Central Tech', 'CEN', 60, 'showcase-60-away'),
      seed: `${BASE_SEED}:showcase:60-v-60`,
    },
    {
      home: generatedSetup('Great Lakes', 'GLU', 90, 'showcase-90-home'),
      away: generatedSetup('Atlantic State', 'ASU', 90, 'showcase-90-away'),
      seed: `${BASE_SEED}:showcase:90-v-90`,
    },
    {
      home: generatedSetup('National Tech', 'NTU', 90, 'showcase-90-v-30-home'),
      away: generatedSetup('Hill County', 'HCU', 30, 'showcase-90-v-30-away'),
      seed: `${BASE_SEED}:showcase:90-v-30`,
    },
    {
      home: generatedSetup('Charlotte Tech', 'CTU', 75, 'showcase-75-home'),
      away: generatedSetup('Metro State', 'MSU', 60, 'showcase-75-away'),
      seed: `${BASE_SEED}:showcase:75-v-60`,
    },
  ]

  for (const { home, away, seed } of matchups) {
    const result = simulateSetupGame(home, away, seed)
    const winner =
      result.winnerId === home.team.id ? home.team.name : away.team.name

    process.stdout.write(
      `\n${home.team.name.toUpperCase()} ${result.homeScore}\n` +
        `${away.team.name.toUpperCase()} ${result.awayScore}\n` +
        `FINAL${result.overtimePeriods > 0 ? ` (${result.overtimePeriods} OT)` : ''}\n\n`,
    )
    process.stdout.write(
      `${home.team.abbreviation} Strength: OFF ${fixed(home.strength.offense)} | ` +
        `DEF ${fixed(home.strength.defense)} | OVR ${fixed(home.strength.overall)}\n`,
    )
    process.stdout.write(
      `${away.team.abbreviation} Strength: OFF ${fixed(away.strength.offense)} | ` +
        `DEF ${fixed(away.strength.defense)} | OVR ${fixed(away.strength.overall)}\n`,
    )
    process.stdout.write(
      `Winner: ${winner} | OT: ${result.overtimePeriods} | Seed: ${seed}\n`,
    )
  }
}

interface RepeatedMetrics {
  readonly homeWinRate: number
  readonly averageHomeScore: number
  readonly averageAwayScore: number
  readonly averageAbsoluteMargin: number
  readonly scoreStandardDeviation: number
  readonly overtimeRate: number
  readonly largestHomeWin: number
  readonly largestAwayWin: number
}

function repeatedMetrics(
  home: TeamSetup,
  away: TeamSetup,
  seedFamily: string,
  gameCount = REPEATED_GAMES,
): RepeatedMetrics {
  const results = Array.from({ length: gameCount }, (_, index) =>
    simulateSetupGame(home, away, `${BASE_SEED}:${seedFamily}:${index}`),
  )
  const homeScores = results.map(({ homeScore }) => homeScore)
  const awayScores = results.map(({ awayScore }) => awayScore)
  const margins = results.map(({ homeScore, awayScore }) => homeScore - awayScore)

  return {
    homeWinRate:
      results.filter(({ winnerId }) => winnerId === home.team.id).length /
      results.length,
    averageHomeScore: average(homeScores),
    averageAwayScore: average(awayScores),
    averageAbsoluteMargin: average(margins.map(Math.abs)),
    scoreStandardDeviation: standardDeviation([...homeScores, ...awayScores]),
    overtimeRate:
      results.filter(({ overtimePeriods }) => overtimePeriods > 0).length /
      results.length,
    largestHomeWin: Math.max(...margins),
    largestAwayWin: Math.max(...margins.map((margin) => -margin)),
  }
}

function writeRepeatedMatchups(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'B. REPEATED IDENTICAL MATCHUPS\n' +
      '==============================================================================\n',
  )
  process.stdout.write(`${REPEATED_GAMES} seeded games per fixed matchup.\n\n`)

  const matchups = [
    {
      label: 'Even matched',
      home: constructedSetup('Even Home', 70),
      away: constructedSetup('Even Away', 70),
    },
    {
      label: 'Modest favorite',
      home: generatedSetup('Modest Favorite', 'MDF', 75, 'repeat-modest-home'),
      away: generatedSetup('Average Opponent', 'AVO', 60, 'repeat-modest-away'),
    },
    {
      label: 'Strong favorite',
      home: generatedSetup('Strong Favorite', 'STF', 90, 'repeat-strong-home'),
      away: generatedSetup('Solid Opponent', 'SOP', 60, 'repeat-strong-away'),
    },
    {
      label: 'Elite vs weak',
      home: generatedSetup('Elite Favorite', 'ELT', 90, 'repeat-elite-home'),
      away: generatedSetup('Weak Opponent', 'WEK', 30, 'repeat-elite-away'),
    },
  ]
  const rows = matchups.map(({ label, home, away }) => {
    const metrics = repeatedMetrics(home, away, `repeat:${label}`)

    return [
      label,
      `${fixed(home.strength.overall)}–${fixed(away.strength.overall)}`,
      percent(metrics.homeWinRate),
      percent(1 - metrics.homeWinRate),
      fixed(metrics.averageHomeScore),
      fixed(metrics.averageAwayScore),
      fixed(metrics.averageAbsoluteMargin),
      fixed(metrics.scoreStandardDeviation),
      percent(metrics.overtimeRate),
      metrics.largestHomeWin,
      metrics.largestAwayWin,
    ]
  })

  process.stdout.write(
    `${renderTable(
      [
        'MATCHUP',
        'OVR H–A',
        'HOME W%',
        'AWAY W%',
        'AVG H',
        'AVG A',
        'AVG |M|',
        'SCORE SD',
        'OT%',
        'MAX H W',
        'MAX A W',
      ],
      rows,
    )}\n`,
  )
}

function writeStrengthGapValidation(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'C. STRENGTH-GAP VALIDATION\n' +
      '==============================================================================\n',
  )
  process.stdout.write(
    `${REPEATED_GAMES} games per gap with the stronger Team alternating home/away.\n\n`,
  )

  const rows = [0, 5, 10, 15, 20, 25].map((gap) => {
    const first = constructedSetup(`Gap ${gap} First`, 70 + gap)
    const second = constructedSetup(`Gap ${gap} Second`, 70)
    let firstWins = 0
    const margins: number[] = []

    for (let index = 0; index < REPEATED_GAMES; index += 1) {
      const firstIsHome = index % 2 === 0
      const home = firstIsHome ? first : second
      const away = firstIsHome ? second : first
      const result = simulateSetupGame(
        home,
        away,
        `${BASE_SEED}:gap:${gap}:${index}`,
      )
      const firstScore = firstIsHome ? result.homeScore : result.awayScore
      const secondScore = firstIsHome ? result.awayScore : result.homeScore

      firstWins += Number(result.winnerId === first.team.id)
      margins.push(firstScore - secondScore)
    }

    return [
      gap,
      `${fixed(first.strength.overall)}–${fixed(second.strength.overall)}`,
      percent(firstWins / REPEATED_GAMES),
      fixed(average(margins)),
    ]
  })

  process.stdout.write(
    `${renderTable(
      ['OVR GAP', 'ACTUAL OVR', 'STRONGER W%', 'AVG STRONGER MARGIN'],
      rows,
    )}\n`,
  )
}

function writeHomeCourtValidation(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'D. HOME-COURT VALIDATION\n' +
      '==============================================================================\n',
  )

  const first = constructedSetup('Identical Team A', 70)
  const second = constructedSetup('Identical Team B', 70)
  const firstHome = repeatedMetrics(first, second, 'home-court:first-home')
  const secondHome = repeatedMetrics(second, first, 'home-court:second-home')
  const combinedHomeRate =
    (firstHome.homeWinRate + secondHome.homeWinRate) / 2

  process.stdout.write(
    `${renderTable(
      ['ORIENTATION', 'HOME W%', 'AVG HOME', 'AVG AWAY', 'OT%'],
      [
        [
          'Team A home',
          percent(firstHome.homeWinRate),
          fixed(firstHome.averageHomeScore),
          fixed(firstHome.averageAwayScore),
          percent(firstHome.overtimeRate),
        ],
        [
          'Team B home',
          percent(secondHome.homeWinRate),
          fixed(secondHome.averageHomeScore),
          fixed(secondHome.averageAwayScore),
          percent(secondHome.overtimeRate),
        ],
        ['Combined', percent(combinedHomeRate), '—', '—', '—'],
      ],
    )}\n`,
  )
}

function writeGlobalDistribution(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      'E. GLOBAL SCORING DISTRIBUTION\n' +
      '==============================================================================\n',
  )

  const prestigeLevels = [30, 45, 60, 75, 90]
  const teams = prestigeLevels.flatMap((prestige) =>
    Array.from({ length: 50 }, (_, index) =>
      generatedSetup(
        `Global P${prestige}-${index + 1}`,
        `P${prestige}`,
        prestige,
        `global:${prestige}:${index}`,
      ),
    ),
  )
  const selectionRng = createRng(`${BASE_SEED}:global:selection`)
  const results = Array.from({ length: GLOBAL_GAMES }, (_, index) => {
    const homeIndex = selectionRng.int(0, teams.length - 1)
    let awayIndex = selectionRng.int(0, teams.length - 1)

    if (awayIndex === homeIndex) {
      awayIndex = (awayIndex + 1) % teams.length
    }

    return simulateSetupGame(
      teams[homeIndex] as TeamSetup,
      teams[awayIndex] as TeamSetup,
      `${BASE_SEED}:global:game:${index}`,
    )
  })
  const teamScores = results.flatMap(({ homeScore, awayScore }) => [
    homeScore,
    awayScore,
  ])
  const combinedScores = results.map(
    ({ homeScore, awayScore }) => homeScore + awayScore,
  )
  const margins = results.map(({ homeScore, awayScore }) =>
    Math.abs(homeScore - awayScore),
  )
  const gamesInRange = (minimum: number, maximum = Number.POSITIVE_INFINITY) =>
    margins.filter((margin) => margin >= minimum && margin <= maximum).length /
    margins.length

  process.stdout.write(
    `${renderTable(
      ['METRIC', 'VALUE'],
      [
        ['Games', results.length],
        ['Average Team score', fixed(average(teamScores))],
        ['Average combined score', fixed(average(combinedScores))],
        ['Team score min / max', `${Math.min(...teamScores)} / ${Math.max(...teamScores)}`],
        ['Team score P5 / P50 / P95', `${percentile(teamScores, 0.05)} / ${percentile(teamScores, 0.5)} / ${percentile(teamScores, 0.95)}`],
        ['Average / median margin', `${fixed(average(margins))} / ${percentile(margins, 0.5)}`],
        ['Margin 1–3', percent(gamesInRange(1, 3))],
        ['Margin 4–10', percent(gamesInRange(4, 10))],
        ['Margin 11–20', percent(gamesInRange(11, 20))],
        ['Margin 21+', percent(gamesInRange(21))],
        [
          'Overtime rate',
          percent(
            results.filter(({ overtimePeriods }) => overtimePeriods > 0)
              .length / results.length,
          ),
        ],
      ],
    )}\n`,
  )
}

function main(): void {
  process.stdout.write('COLLEGE HOOPS SIM — SINGLE-GAME V0 INSPECTION\n')
  process.stdout.write(`Deterministic base seed: ${BASE_SEED}\n`)
  process.stdout.write(
    'Team-level outcomes only; player box scores and possessions are absent.\n',
  )

  writeShowcaseGames()
  writeRepeatedMatchups()
  writeStrengthGapValidation()
  writeHomeCourtValidation()
  writeGlobalDistribution()
  process.stdout.write('\n')
}

main()
