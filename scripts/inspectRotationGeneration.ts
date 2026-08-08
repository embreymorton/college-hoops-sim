import {
  calculateOverall,
  calculatePositionMinutes,
  calculateTotalMinutes,
  createRng,
  generateDefaultRotation,
  generateTeam,
  getPlayersByMinutes,
  POSITIONS,
  validateRotation,
  type Player,
  type Position,
  type Rotation,
  type Team,
} from '../src/engine'

const BASE_SEED = 'rotation-generation-inspection-v1'
const TEAMS_PER_PRESTIGE = 500

const SHOWCASE_TEAMS = [
  { name: 'Pine Valley', abbreviation: 'PVA', prestige: 30 },
  { name: 'Capital State', abbreviation: 'CSU', prestige: 60 },
  { name: 'Great Lakes', abbreviation: 'GLU', prestige: 90 },
] as const

type TableCell = string | number

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function fixed(value: number): string {
  return value.toFixed(1)
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

function playerName(player: Player): string {
  return `${player.firstName} ${player.lastName}`
}

function minutesFor(rotation: Rotation, player: Player): number {
  return rotation.minutes[player.id] ?? 0
}

function writeShowcaseTeam(team: Team): void {
  const rotation = generateDefaultRotation(team)
  const validation = validateRotation(team, rotation)

  process.stdout.write(`\n${team.name.toUpperCase()} (${team.abbreviation})\n`)
  process.stdout.write(`Prestige: ${team.prestige}\n`)

  for (const position of POSITIONS) {
    const players = team.roster
      .filter((player) => player.position === position)
      .sort(
        (first, second) =>
          minutesFor(rotation, second) - minutesFor(rotation, first) ||
          calculateOverall(second) - calculateOverall(first),
      )
    const rows = players.map((player) => [
      playerName(player),
      player.classYear,
      calculateOverall(player),
      player.attributes.stamina,
      minutesFor(rotation, player),
    ])

    process.stdout.write(`\n${position}\n`)
    process.stdout.write(
      `${renderTable(['PLAYER', 'YR', 'OVR', 'STA', 'MIN'], rows)}\n`,
    )
  }

  const positionTotals = POSITIONS.map(
    (position) =>
      `${position} ${calculatePositionMinutes(team, rotation, position)}`,
  ).join(' | ')
  const highestMinutePlayers = getPlayersByMinutes(team, rotation)
    .slice(0, 5)
    .map(
      ({ player, minutes }) =>
        `${playerName(player)} (${player.position}, ${minutes})`,
    )
    .join(' | ')

  process.stdout.write(`\nPosition totals: ${positionTotals}\n`)
  process.stdout.write(
    `TOTAL MINUTES: ${calculateTotalMinutes(rotation)} | ` +
      `VALID: ${validation.valid ? 'YES' : 'NO'}\n`,
  )
  process.stdout.write(`Highest-minute five: ${highestMinutePlayers}\n`)
}

interface RotationMetrics {
  readonly valid: boolean
  readonly activePlayers: number
  readonly zeroMinutePlayers: number
  readonly averagePositionLeaderMinutes: number
  readonly averageTopTwoGap: number
  readonly maximumPlayerMinutes: number
}

function calculateRotationMetrics(team: Team): RotationMetrics {
  const rotation = generateDefaultRotation(team)
  const assignments = getPlayersByMinutes(team, rotation)
  const positionMetrics = POSITIONS.map((position) => {
    const positionMinutes = assignments
      .filter(({ player }) => player.position === position)
      .map(({ minutes }) => minutes)
      .sort((first, second) => second - first)

    return {
      leaderMinutes: positionMinutes[0] ?? 0,
      topTwoGap: (positionMinutes[0] ?? 0) - (positionMinutes[1] ?? 0),
    }
  })

  return {
    valid: validateRotation(team, rotation).valid,
    activePlayers: assignments.filter(({ minutes }) => minutes > 0).length,
    zeroMinutePlayers: assignments.filter(({ minutes }) => minutes === 0)
      .length,
    averagePositionLeaderMinutes: average(
      positionMetrics.map(({ leaderMinutes }) => leaderMinutes),
    ),
    averageTopTwoGap: average(
      positionMetrics.map(({ topTwoGap }) => topTwoGap),
    ),
    maximumPlayerMinutes: Math.max(
      ...assignments.map(({ minutes }) => minutes),
    ),
  }
}

function writeLargeSampleValidation(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      '2. LARGE-SAMPLE ROTATION VALIDATION\n' +
      '==============================================================================\n',
  )
  process.stdout.write(
    `Deterministic sample: ${TEAMS_PER_PRESTIGE} teams per prestige tier.\n\n`,
  )

  const rows = SHOWCASE_TEAMS.map(({ prestige }) => {
    const rng = createRng(`${BASE_SEED}:validation:${prestige}`)
    const metrics = Array.from({ length: TEAMS_PER_PRESTIGE }, (_, index) =>
      calculateRotationMetrics(
        generateTeam({
          name: `Rotation Validation ${prestige}-${index + 1}`,
          abbreviation: `P${prestige}`,
          prestige,
          rng,
        }),
      ),
    )

    return [
      prestige,
      metrics.length,
      metrics.filter(({ valid }) => valid).length,
      fixed(average(metrics.map(({ activePlayers }) => activePlayers))),
      fixed(
        average(metrics.map(({ zeroMinutePlayers }) => zeroMinutePlayers)),
      ),
      fixed(
        average(
          metrics.map(
            ({ averagePositionLeaderMinutes }) =>
              averagePositionLeaderMinutes,
          ),
        ),
      ),
      fixed(average(metrics.map(({ averageTopTwoGap }) => averageTopTwoGap))),
      Math.max(...metrics.map(({ maximumPlayerMinutes }) => maximumPlayerMinutes)),
    ]
  })

  process.stdout.write(
    `${renderTable(
      [
        'PRESTIGE',
        'TEAMS',
        'VALID',
        'AVG ACTIVE',
        'AVG ZERO',
        'AVG LEADER',
        'AVG TOP-2 GAP',
        'MAX MIN',
      ],
      rows,
    )}\n`,
  )
}

function cloneRotation(rotation: Rotation): Rotation {
  return JSON.parse(JSON.stringify(rotation)) as Rotation
}

function firstActivePlayer(
  team: Team,
  rotation: Rotation,
  position?: Position,
): Player {
  const player = team.roster.find(
    (player) =>
      (!position || player.position === position) &&
      (rotation.minutes[player.id] ?? 0) > 0,
  )

  if (!player) {
    throw new Error(`No active ${position ?? 'roster'} player found`)
  }

  return player
}

function writeInvalidRotationLab(): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      '3. INVALID-ROTATION LAB\n' +
      '==============================================================================\n',
  )

  const team = generateTeam({
    name: 'Validation State',
    abbreviation: 'VST',
    prestige: 60,
    rng: createRng(`${BASE_SEED}:invalid-lab`),
  })
  const validRotation = generateDefaultRotation(team)
  const anyPlayer = firstActivePlayer(team, validRotation)
  const pointGuard = firstActivePlayer(team, validRotation, 'PG')
  const shootingGuard = team.roster.find(
    (player) =>
      player.position === 'SG' &&
      (validRotation.minutes[player.id] ?? 0) < 40,
  )

  if (!shootingGuard) {
    throw new Error('No shooting guard available for the validation lab')
  }
  const cases = [
    {
      label: '199 total minutes',
      create(): Rotation {
        const rotation = cloneRotation(validRotation)
        rotation.minutes[anyPlayer.id] =
          (rotation.minutes[anyPlayer.id] ?? 0) - 1
        return rotation
      },
    },
    {
      label: '41 minutes for one player',
      create(): Rotation {
        const rotation = cloneRotation(validRotation)
        rotation.minutes[anyPlayer.id] = 41
        return rotation
      },
    },
    {
      label: 'only 37 PG minutes',
      create(): Rotation {
        const rotation = cloneRotation(validRotation)
        rotation.minutes[pointGuard.id] =
          (rotation.minutes[pointGuard.id] ?? 0) - 3
        return rotation
      },
    },
    {
      label: 'unknown player ID',
      create(): Rotation {
        const rotation = cloneRotation(validRotation)
        rotation.minutes['unknown-player-id'] = 1
        return rotation
      },
    },
    {
      label: '200 total but PG/SG imbalance',
      create(): Rotation {
        const rotation = cloneRotation(validRotation)
        rotation.minutes[pointGuard.id] =
          (rotation.minutes[pointGuard.id] ?? 0) - 1
        rotation.minutes[shootingGuard.id] =
          (rotation.minutes[shootingGuard.id] ?? 0) + 1
        return rotation
      },
    },
  ]

  for (const invalidCase of cases) {
    const result = validateRotation(team, invalidCase.create())
    process.stdout.write(
      `\n${invalidCase.label}: VALID ${result.valid ? 'YES' : 'NO'}\n`,
    )
    for (const issue of result.issues) {
      process.stdout.write(`  - [${issue.code}] ${issue.message}\n`)
    }
  }
}

function main(): void {
  process.stdout.write('COLLEGE HOOPS SIM — ROTATION INSPECTION\n')
  process.stdout.write(`Deterministic base seed: ${BASE_SEED}\n`)
  process.stdout.write(
    'Missing player IDs mean zero minutes; no separate starters are stored.\n',
  )
  process.stdout.write(
    '\n==============================================================================\n' +
      '1. SHOWCASE ROTATIONS\n' +
      '==============================================================================\n',
  )

  for (const config of SHOWCASE_TEAMS) {
    writeShowcaseTeam(
      generateTeam({
        ...config,
        rng: createRng(`${BASE_SEED}:showcase:${config.prestige}`),
      }),
    )
  }

  writeLargeSampleValidation()
  writeInvalidRotationLab()
  process.stdout.write('\n')
}

main()
