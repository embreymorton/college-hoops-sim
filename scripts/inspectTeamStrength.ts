import {
  calculateOverall,
  calculatePlayerDefense,
  calculatePlayerOffense,
  calculateTeamStrength,
  createRng,
  generateDefaultRotation,
  generateTeam,
  getPlayersByMinutes,
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
  type Rotation,
  type Team,
  type TeamStrength,
} from '../src/engine'

const BASE_SEED = 'team-strength-inspection-v1'
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

function correlation(
  firstValues: readonly number[],
  secondValues: readonly number[],
): number {
  const firstAverage = average(firstValues)
  const secondAverage = average(secondValues)
  const covariance = average(
    firstValues.map(
      (value, index) =>
        (value - firstAverage) *
        ((secondValues[index] as number) - secondAverage),
    ),
  )
  const denominator =
    standardDeviation(firstValues) * standardDeviation(secondValues)

  return denominator === 0 ? 0 : covariance / denominator
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

function writeShowcaseTeam(team: Team): void {
  const rotation = generateDefaultRotation(team)
  const strength = calculateTeamStrength(team, rotation)
  const rows = getPlayersByMinutes(team, rotation).map(
    ({ player, minutes }) => [
      playerName(player),
      player.position,
      player.classYear,
      calculateOverall(player),
      fixed(calculatePlayerOffense(player)),
      fixed(calculatePlayerDefense(player)),
      minutes,
    ],
  )

  process.stdout.write(`\n${team.name.toUpperCase()} (${team.abbreviation})\n`)
  process.stdout.write(`Prestige: ${team.prestige}\n\n`)
  process.stdout.write('TEAM STRENGTH\n')
  process.stdout.write(`OFFENSE  ${fixed(strength.offense)}\n`)
  process.stdout.write(`DEFENSE  ${fixed(strength.defense)}\n`)
  process.stdout.write(`OVERALL  ${fixed(strength.overall)}\n\n`)
  process.stdout.write('ROTATION CONTRIBUTIONS\n')
  process.stdout.write(
    `${renderTable(
      ['PLAYER', 'POS', 'YR', 'OVR', 'OFF', 'DEF', 'MIN'],
      rows,
    )}\n`,
  )
}

interface SampledTeamStrength {
  readonly team: Team
  readonly strength: TeamStrength
}

function generateStrengthSample(prestige: number): SampledTeamStrength[] {
  const rng = createRng(`${BASE_SEED}:validation:${prestige}`)

  return Array.from({ length: TEAMS_PER_PRESTIGE }, (_, index) => {
    const team = generateTeam({
      name: `Strength Validation ${prestige}-${index + 1}`,
      abbreviation: `P${prestige}`,
      prestige,
      rng,
    })
    const rotation = generateDefaultRotation(team)

    return { team, strength: calculateTeamStrength(team, rotation) }
  })
}

function writeLargeSampleValidation(): SampledTeamStrength[][] {
  process.stdout.write(
    '\n==============================================================================\n' +
      '2. LARGE-SAMPLE TEAM-STRENGTH VALIDATION\n' +
      '==============================================================================\n',
  )
  process.stdout.write(
    `Deterministic sample: ${TEAMS_PER_PRESTIGE} teams per prestige tier.\n\n`,
  )

  const samples = SHOWCASE_TEAMS.map(({ prestige }) =>
    generateStrengthSample(prestige),
  )
  const strengthRows = samples.map((sample, index) => {
    const prestige = SHOWCASE_TEAMS[index]?.prestige ?? 0
    const offenses = sample.map(({ strength }) => strength.offense)
    const defenses = sample.map(({ strength }) => strength.defense)
    const overalls = sample.map(({ strength }) => strength.overall)

    return [
      prestige,
      sample.length,
      fixed(average(offenses)),
      `${fixed(Math.min(...offenses))}–${fixed(Math.max(...offenses))}`,
      fixed(standardDeviation(offenses)),
      fixed(average(defenses)),
      `${fixed(Math.min(...defenses))}–${fixed(Math.max(...defenses))}`,
      fixed(standardDeviation(defenses)),
      fixed(average(overalls)),
      fixed(
        average(
          sample.map(
            ({ strength }) => strength.offense - strength.defense,
          ),
        ),
      ),
    ]
  })

  process.stdout.write(
    `${renderTable(
      [
        'PRESTIGE',
        'TEAMS',
        'AVG OFF',
        'OFF RANGE',
        'OFF SD',
        'AVG DEF',
        'DEF RANGE',
        'DEF SD',
        'AVG OVR',
        'AVG O-D',
      ],
      strengthRows,
    )}\n`,
  )

  const identityRows = samples.map((sample, index) => {
    const prestige = SHOWCASE_TEAMS[index]?.prestige ?? 0
    const offenses = sample.map(({ strength }) => strength.offense)
    const defenses = sample.map(({ strength }) => strength.defense)

    return [
      prestige,
      sample.filter(
        ({ strength }) => strength.offense - strength.defense >= 2,
      ).length,
      sample.filter(
        ({ strength }) => strength.defense - strength.offense >= 2,
      ).length,
      correlation(offenses, defenses).toFixed(2),
    ]
  })

  process.stdout.write(
    `\n${renderTable(
      ['PRESTIGE', 'OFF +2 TEAMS', 'DEF +2 TEAMS', 'OFF/DEF CORR'],
      identityRows,
    )}\n`,
  )

  return samples
}

function makeAttributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  return {
    finishing: 70,
    shooting: 70,
    playmaking: 70,
    ballHandling: 70,
    perimeterDefense: 70,
    interiorDefense: 70,
    rebounding: 70,
    athleticism: 70,
    stamina: 70,
    ...overrides,
  }
}

function makePlayer(
  id: string,
  position: Position,
  attributes: PlayerAttributes,
): Player {
  return {
    id,
    firstName: id,
    lastName: 'Fixture',
    position,
    classYear: 'JR',
    height: 78,
    attributes,
    potential: 99,
  }
}

function makeFixtureTeam(name: string, roster: Player[]): Team {
  return {
    id: `team-${name.toLowerCase().replaceAll(' ', '-')}`,
    name,
    abbreviation: 'FIX',
    prestige: 60,
    roster,
  }
}

function fullMinutes(players: readonly Player[]): Rotation {
  return {
    minutes: Object.fromEntries(players.map((player) => [player.id, 40])),
  }
}

function writeIdentityDiagnostics(samples: readonly SampledTeamStrength[][]): void {
  process.stdout.write(
    '\n==============================================================================\n' +
      '3. OFFENSE/DEFENSE IDENTITY DIAGNOSTICS\n' +
      '==============================================================================\n',
  )

  const highOffenseAttributes = makeAttributes({
    finishing: 92,
    shooting: 92,
    playmaking: 92,
    ballHandling: 92,
    perimeterDefense: 52,
    interiorDefense: 52,
    rebounding: 65,
    athleticism: 82,
  })
  const highDefenseAttributes = makeAttributes({
    finishing: 52,
    shooting: 52,
    playmaking: 52,
    ballHandling: 52,
    perimeterDefense: 92,
    interiorDefense: 92,
    rebounding: 88,
    athleticism: 82,
  })
  const offensePlayers = POSITIONS.map((position) =>
    makePlayer(`high-offense-${position}`, position, highOffenseAttributes),
  )
  const defensePlayers = POSITIONS.map((position) =>
    makePlayer(`high-defense-${position}`, position, highDefenseAttributes),
  )
  const offenseTeam = makeFixtureTeam('High Offense Attributes', offensePlayers)
  const defenseTeam = makeFixtureTeam('High Defense Attributes', defensePlayers)
  const offenseStrength = calculateTeamStrength(
    offenseTeam,
    fullMinutes(offensePlayers),
  )
  const defenseStrength = calculateTeamStrength(
    defenseTeam,
    fullMinutes(defensePlayers),
  )

  const basePlayers = POSITIONS.filter((position) => position !== 'SG').map(
    (position) =>
      makePlayer(`swap-base-${position}`, position, makeAttributes()),
  )
  const shooter = makePlayer(
    'shooter-sg',
    'SG',
    makeAttributes({
      finishing: 88,
      shooting: 96,
      playmaking: 84,
      ballHandling: 90,
      perimeterDefense: 48,
      interiorDefense: 48,
      rebounding: 58,
      athleticism: 78,
    }),
  )
  const stopper = makePlayer(
    'stopper-sg',
    'SG',
    makeAttributes({
      finishing: 62,
      shooting: 58,
      playmaking: 60,
      ballHandling: 64,
      perimeterDefense: 96,
      interiorDefense: 86,
      rebounding: 82,
      athleticism: 90,
    }),
  )
  const swapTeam = makeFixtureTeam('Shooter Stopper Swap', [
    ...basePlayers,
    shooter,
    stopper,
  ])
  const baseMinutes = fullMinutes(basePlayers).minutes
  const shooterStrength = calculateTeamStrength(swapTeam, {
    minutes: { ...baseMinutes, [shooter.id]: 40 },
  })
  const stopperStrength = calculateTeamStrength(swapTeam, {
    minutes: { ...baseMinutes, [stopper.id]: 40 },
  })

  process.stdout.write(
    `${renderTable(
      ['CONSTRUCTED CASE', 'OFF', 'DEF', 'OVR', 'O-D'],
      [
        [
          'High offense attributes',
          fixed(offenseStrength.offense),
          fixed(offenseStrength.defense),
          fixed(offenseStrength.overall),
          fixed(offenseStrength.offense - offenseStrength.defense),
        ],
        [
          'High defense attributes',
          fixed(defenseStrength.offense),
          fixed(defenseStrength.defense),
          fixed(defenseStrength.overall),
          fixed(defenseStrength.offense - defenseStrength.defense),
        ],
        [
          'Shooter plays 40 at SG',
          fixed(shooterStrength.offense),
          fixed(shooterStrength.defense),
          fixed(shooterStrength.overall),
          fixed(shooterStrength.offense - shooterStrength.defense),
        ],
        [
          'Stopper plays 40 at SG',
          fixed(stopperStrength.offense),
          fixed(stopperStrength.defense),
          fixed(stopperStrength.overall),
          fixed(stopperStrength.offense - stopperStrength.defense),
        ],
      ],
    )}\n`,
  )

  const perimeterProfile = makeAttributes({
    finishing: 60,
    shooting: 95,
    playmaking: 95,
    ballHandling: 95,
    perimeterDefense: 95,
    interiorDefense: 45,
    rebounding: 48,
    athleticism: 86,
  })
  const interiorProfile = makeAttributes({
    finishing: 95,
    shooting: 45,
    playmaking: 45,
    ballHandling: 45,
    perimeterDefense: 45,
    interiorDefense: 96,
    rebounding: 94,
    athleticism: 88,
  })
  const profileRows = ['PG', 'C'].flatMap((position) =>
    [
      ['Perimeter profile', perimeterProfile],
      ['Interior profile', interiorProfile],
    ].map(([label, attributes]) => {
      const player = makePlayer(
        `${label}-${position}`,
        position as Position,
        attributes as PlayerAttributes,
      )

      return [
        label as string,
        position,
        fixed(calculatePlayerOffense(player)),
        fixed(calculatePlayerDefense(player)),
      ]
    }),
  )

  process.stdout.write(
    `\n${renderTable(['SAME ATTRIBUTE PROFILE', 'POS', 'OFF', 'DEF'], profileRows)}\n`,
  )

  const allGeneratedTeams = samples.flat()
  const mostOffenseLeaning = [...allGeneratedTeams].sort(
    (first, second) =>
      second.strength.offense - second.strength.defense -
      (first.strength.offense - first.strength.defense),
  )[0]
  const mostDefenseLeaning = [...allGeneratedTeams].sort(
    (first, second) =>
      second.strength.defense - second.strength.offense -
      (first.strength.defense - first.strength.offense),
  )[0]

  if (mostOffenseLeaning && mostDefenseLeaning) {
    process.stdout.write(
      '\nGenerated extremes across all 2,500 sampled teams:\n' +
        `  Largest O-D: ${mostOffenseLeaning.team.name} — ` +
        `${fixed(mostOffenseLeaning.strength.offense)} OFF, ` +
        `${fixed(mostOffenseLeaning.strength.defense)} DEF\n` +
        `  Largest D-O: ${mostDefenseLeaning.team.name} — ` +
        `${fixed(mostDefenseLeaning.strength.offense)} OFF, ` +
        `${fixed(mostDefenseLeaning.strength.defense)} DEF\n`,
    )
  }
}

function main(): void {
  process.stdout.write('COLLEGE HOOPS SIM — TEAM STRENGTH INSPECTION\n')
  process.stdout.write(`Deterministic base seed: ${BASE_SEED}\n`)
  process.stdout.write(
    'Ratings are derived at full precision; displayed values use one decimal.\n',
  )
  process.stdout.write(
    '\n==============================================================================\n' +
      '1. SHOWCASE TEAM STRENGTHS\n' +
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

  const samples = writeLargeSampleValidation()
  writeIdentityDiagnostics(samples)
  process.stdout.write('\n')
}

main()
