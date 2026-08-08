import {
  calculateOverall,
  CLASS_YEARS,
  createRng,
  generatePlayer,
  MAX_PLAYER_RATING,
  MIN_PLAYER_RATING,
  PLAYER_NAME_POOL_COUNTS,
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
} from '../src/engine'

const BASE_SEED = 'player-generation-inspection-v1'
const SHOWCASE_TALENT_LEVELS = [55, 65, 75, 85] as const
const POSITION_SAMPLE_SIZE = 750
const TALENT_SAMPLE_SIZE_PER_POSITION = 250
const POSITION_COMPARISON_TALENT = 75

const ATTRIBUTE_COLUMNS = [
  ['finishing', 'FIN'],
  ['shooting', 'SHT'],
  ['playmaking', 'PLY'],
  ['ballHandling', 'HND'],
  ['perimeterDefense', 'PER'],
  ['interiorDefense', 'INT'],
  ['rebounding', 'REB'],
  ['athleticism', 'ATH'],
  ['stamina', 'STA'],
] as const satisfies readonly (readonly [keyof PlayerAttributes, string])[]

type TableCell = string | number

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  const average = mean(values)
  const variance = mean(values.map((value) => (value - average) ** 2))

  return Math.sqrt(variance)
}

function fixed(value: number): string {
  return value.toFixed(1)
}

function percent(count: number, total: number): string {
  return `${((count / total) * 100).toFixed(1)}%`
}

function formatHeight(height: number): string {
  const feet = Math.floor(height / 12)
  const inches = height % 12

  return `${feet}'${inches}"`
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

function generatePopulation(
  position: Position,
  talentLevel: number,
  count: number,
  seedScope: string,
): Player[] {
  const rng = createRng(
    `${BASE_SEED}:${seedScope}:${position}:${talentLevel}:${count}`,
  )

  return Array.from({ length: count }, (_, index) =>
    generatePlayer({
      position,
      talentLevel,
      classYear: CLASS_YEARS[index % CLASS_YEARS.length] ?? 'FR',
      rng,
    }),
  )
}

function writeSection(title: string): void {
  process.stdout.write(`\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}\n`)
}

function writeShowcase(): void {
  writeSection('1. SHOWCASE PLAYERS')
  process.stdout.write(
    `Seed: ${BASE_SEED}:showcase | 20 players across all positions and talent levels\n\n`,
  )

  const rng = createRng(`${BASE_SEED}:showcase`)

  for (const [positionIndex, position] of POSITIONS.entries()) {
    for (const [talentIndex, talentLevel] of SHOWCASE_TALENT_LEVELS.entries()) {
      const classYear =
        CLASS_YEARS[(positionIndex + talentIndex) % CLASS_YEARS.length] ?? 'FR'
      const player = generatePlayer({ position, talentLevel, classYear, rng })
      const { attributes } = player

      process.stdout.write(
        [
          `${player.firstName} ${player.lastName}`,
          `${player.position} | ${formatHeight(player.height)} | ${player.classYear} | Requested talent ${talentLevel}`,
          `OVR ${calculateOverall(player)} | POT ${player.potential}`,
          `FIN ${attributes.finishing} | SHT ${attributes.shooting} | PLY ${attributes.playmaking} | HND ${attributes.ballHandling}`,
          `PER ${attributes.perimeterDefense} | INT ${attributes.interiorDefense} | REB ${attributes.rebounding}`,
          `ATH ${attributes.athleticism} | STA ${attributes.stamina}`,
          '',
        ].join('\n'),
      )
    }
  }
}

function writePositionComparison(): void {
  writeSection('2. POSITION COMPARISON')
  process.stdout.write(
    `Deterministic sample: ${POSITION_SAMPLE_SIZE.toLocaleString()} players per position at talent ${POSITION_COMPARISON_TALENT}.\n` +
      `Seed family: ${BASE_SEED}:position-comparison:*\n\n`,
  )

  const rows = POSITIONS.map((position) => {
    const players = generatePopulation(
      position,
      POSITION_COMPARISON_TALENT,
      POSITION_SAMPLE_SIZE,
      'position-comparison',
    )
    const attributeAverages = ATTRIBUTE_COLUMNS.map(([attribute]) =>
      fixed(mean(players.map((player) => player.attributes[attribute]))),
    )

    return [
      position,
      players.length,
      fixed(mean(players.map((player) => player.height))),
      fixed(mean(players.map(calculateOverall))),
      fixed(mean(players.map((player) => player.potential))),
      ...attributeAverages,
    ]
  })

  process.stdout.write(
    `${renderTable(
      ['POS', 'N', 'HT(in)', 'OVR', 'POT', ...ATTRIBUTE_COLUMNS.map(([, label]) => label)],
      rows,
    )}\n`,
  )

}

interface TalentSample {
  readonly talentLevel: number
  readonly players: readonly Player[]
}

function writeTalentValidation(): TalentSample[] {
  writeSection('3. TALENT-LEVEL VALIDATION')
  process.stdout.write(
    `Deterministic sample: ${TALENT_SAMPLE_SIZE_PER_POSITION} players per position at each talent level ` +
      `(${(TALENT_SAMPLE_SIZE_PER_POSITION * POSITIONS.length).toLocaleString()} per level).\n` +
      `Seed family: ${BASE_SEED}:talent-level:*\n\n`,
  )

  const samples = SHOWCASE_TALENT_LEVELS.map((talentLevel) => {
    const players = POSITIONS.flatMap((position) =>
      generatePopulation(
        position,
        talentLevel,
        TALENT_SAMPLE_SIZE_PER_POSITION,
        'talent-level',
      ),
    )

    return { talentLevel, players }
  })

  const rows = samples.map(({ talentLevel, players }) => {
    const overalls = players.map(calculateOverall)

    return [
      talentLevel,
      players.length,
      fixed(mean(overalls)),
      Math.min(...overalls),
      Math.max(...overalls),
      fixed(standardDeviation(overalls)),
      fixed(mean(players.map((player) => player.potential))),
    ]
  })

  process.stdout.write(
    `${renderTable(
      ['TALENT', 'N', 'AVG OVR', 'MIN', 'MAX', 'STD DEV', 'AVG POT'],
      rows,
    )}\n`,
  )

  return samples
}

function writeAttributeHealth(players: readonly Player[]): void {
  const rows = ATTRIBUTE_COLUMNS.map(([attribute, label]) => {
    const values = players.map((player) => player.attributes[attribute])
    const lowerHits = values.filter((value) => value === MIN_PLAYER_RATING).length
    const upperHits = values.filter((value) => value === MAX_PLAYER_RATING).length

    return [
      label,
      Math.min(...values),
      Math.max(...values),
      `${lowerHits} (${percent(lowerHits, values.length)})`,
      `${upperHits} (${percent(upperHits, values.length)})`,
    ]
  })

  process.stdout.write('Attribute ranges and clamp rates across the health sample:\n')
  process.stdout.write(
    `${renderTable(['ATTR', 'MIN', 'MAX', 'AT 40', 'AT 99'], rows)}\n\n`,
  )

  const positionRows = POSITIONS.map((position) => {
    const positionPlayers = players.filter((player) => player.position === position)

    return [
      position,
      ...ATTRIBUTE_COLUMNS.map(([attribute]) => {
        const values = positionPlayers.map((player) => player.attributes[attribute])
        const lowerHits = values.filter((value) => value === MIN_PLAYER_RATING).length
        const upperHits = values.filter((value) => value === MAX_PLAYER_RATING).length

        return `${percent(lowerHits, values.length)}/${percent(upperHits, values.length)}`
      }),
    ]
  })

  process.stdout.write('Clamp rate by position and attribute (lower/upper):\n')
  process.stdout.write(
    `${renderTable(
      ['POS', ...ATTRIBUTE_COLUMNS.map(([, label]) => label)],
      positionRows,
    )}\n`,
  )
}

function writeHeightHealth(players: readonly Player[]): void {
  const rows = POSITIONS.map((position) => {
    const heights = players
      .filter((player) => player.position === position)
      .map((player) => player.height)

    return [
      position,
      Math.min(...heights),
      formatHeight(Math.min(...heights)),
      Math.max(...heights),
      formatHeight(Math.max(...heights)),
    ]
  })

  process.stdout.write('\nGenerated height extremes by position:\n')
  process.stdout.write(
    `${renderTable(['POS', 'MIN IN', 'MIN', 'MAX IN', 'MAX'], rows)}\n`,
  )
}

function writePotentialHealth(players: readonly Player[]): void {
  const differences = players.map(
    (player) => player.potential - calculateOverall(player),
  )
  const below = differences.filter((difference) => difference < 0).length
  const equal = differences.filter((difference) => difference === 0).length
  const slightlyAbove = differences.filter(
    (difference) => difference > 0 && difference < 5,
  ).length
  const meaningfullyAbove = differences.filter(
    (difference) => difference >= 5,
  ).length

  process.stdout.write('\nPotential relative to current overall:\n')
  process.stdout.write(`Average POT - OVR: ${fixed(mean(differences))}\n`)
  process.stdout.write(`Below overall: ${below} (${percent(below, players.length)})\n`)
  process.stdout.write(`Equal to overall: ${equal} (${percent(equal, players.length)})\n`)
  process.stdout.write(
    `Above by 1–4: ${slightlyAbove} (${percent(slightlyAbove, players.length)})\n`,
  )
  process.stdout.write(
    `Meaningfully above (5+): ${meaningfullyAbove} (${percent(meaningfullyAbove, players.length)})\n`,
  )

  const classYearRows = CLASS_YEARS.map((classYear) => {
    const classPlayers = players.filter(
      (player) => player.classYear === classYear,
    )
    const classDifferences = classPlayers.map(
      (player) => player.potential - calculateOverall(player),
    )

    return [
      classYear,
      classPlayers.length,
      fixed(mean(classDifferences)),
      Math.min(...classDifferences),
      Math.max(...classDifferences),
    ]
  })

  process.stdout.write('\nDevelopment runway by class year:\n')
  process.stdout.write(
    `${renderTable(['CLASS', 'N', 'AVG GAP', 'MIN', 'MAX'], classYearRows)}\n`,
  )
}

function writeNameHealth(players: readonly Player[]): void {
  const nameCounts = new Map<string, number>()

  for (const player of players) {
    const name = `${player.firstName} ${player.lastName}`
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }

  const duplicateOccurrences = players.length - nameCounts.size
  const duplicatedNames = [...nameCounts.values()].filter((count) => count > 1).length
  const mostCommon = [...nameCounts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count})`)
    .join(', ')

  process.stdout.write('\nDuplicate full names (informational):\n')
  process.stdout.write(
    `Local pool: ${PLAYER_NAME_POOL_COUNTS.firstNames} first × ` +
      `${PLAYER_NAME_POOL_COUNTS.lastNames} last = ` +
      `${PLAYER_NAME_POOL_COUNTS.combinations.toLocaleString()} combinations\n`,
  )
  process.stdout.write(`Unique names: ${nameCounts.size} of ${players.length} players\n`)
  process.stdout.write(`Duplicate occurrences: ${duplicateOccurrences}\n`)
  process.stdout.write(`Name combinations occurring more than once: ${duplicatedNames}\n`)
  process.stdout.write(`Most common: ${mostCommon}\n`)
}

function writeDistributionHealth(samples: readonly TalentSample[]): void {
  writeSection('4. DISTRIBUTION HEALTH CHECKS')

  const players = samples.flatMap(({ players: samplePlayers }) => samplePlayers)
  const attributeValues = players.flatMap((player) =>
    ATTRIBUTE_COLUMNS.map(([attribute]) => player.attributes[attribute]),
  )
  const lowerHits = attributeValues.filter(
    (value) => value === MIN_PLAYER_RATING,
  ).length
  const upperHits = attributeValues.filter(
    (value) => value === MAX_PLAYER_RATING,
  ).length

  process.stdout.write(
    `Health sample: ${players.length.toLocaleString()} players (${(
      players.length / POSITIONS.length
    ).toLocaleString()} per position) across talent levels ${SHOWCASE_TALENT_LEVELS.join(', ')}.\n`,
  )
  process.stdout.write(
    `Generated attribute range: ${Math.min(...attributeValues)}–${Math.max(...attributeValues)}\n`,
  )
  process.stdout.write(
    `All lower-bound hits: ${lowerHits} of ${attributeValues.length.toLocaleString()} ` +
      `(${percent(lowerHits, attributeValues.length)})\n`,
  )
  process.stdout.write(
    `All upper-bound hits: ${upperHits} of ${attributeValues.length.toLocaleString()} ` +
      `(${percent(upperHits, attributeValues.length)})\n\n`,
  )

  writeAttributeHealth(players)
  writeHeightHealth(players)
  writePotentialHealth(players)
  writeNameHealth(players)
}

function main(): void {
  process.stdout.write('COLLEGE HOOPS SIM — PLAYER GENERATION INSPECTION\n')
  process.stdout.write(`Deterministic base seed: ${BASE_SEED}\n`)
  process.stdout.write('Observational report only; no generator values are changed.\n')

  writeShowcase()
  writePositionComparison()
  const talentSamples = writeTalentValidation()
  writeDistributionHealth(talentSamples)
  process.stdout.write('\n')
}

main()
