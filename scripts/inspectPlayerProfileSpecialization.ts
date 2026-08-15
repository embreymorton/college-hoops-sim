import {
  calculateOverall,
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
} from '../src/engine'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import {
  pearsonCorrelation,
  percentile,
  summarize,
} from './playerStatisticalIdentityMetrics'
import {
  countWeaknesses,
  deriveProfileShape,
  PLAYER_ATTRIBUTE_KEYS,
  standardDeviation,
  withAttributeConstraints,
} from './playerProfileSpecializationMetrics'

const UNIVERSE_COUNT = 250
const SEED_FAMILY = 'player-statistical-identity-v1:generation'

const ATTRIBUTE_LABELS: Readonly<Record<keyof PlayerAttributes, string>> = {
  finishing: 'FIN',
  shooting: 'SHT',
  playmaking: 'PLY',
  ballHandling: 'HND',
  perimeterDefense: 'PER',
  interiorDefense: 'INT',
  rebounding: 'REB',
  athleticism: 'ATH',
  stamina: 'STA',
}

const POSITION_WEIGHTS = {
  PG: [0.08, 0.18, 0.22, 0.22, 0.14, 0.02, 0.03, 0.06, 0.05],
  SG: [0.18, 0.24, 0.08, 0.15, 0.17, 0.03, 0.04, 0.07, 0.04],
  SF: [0.14, 0.14, 0.10, 0.10, 0.13, 0.10, 0.11, 0.11, 0.07],
  PF: [0.20, 0.07, 0.05, 0.05, 0.07, 0.17, 0.19, 0.14, 0.06],
  C: [0.19, 0.03, 0.04, 0.03, 0.05, 0.23, 0.23, 0.14, 0.06],
} as const satisfies Readonly<Record<Position, readonly number[]>>

const RELEVANT_ATTRIBUTES = {
  PG: ['shooting', 'playmaking', 'ballHandling', 'perimeterDefense'],
  SG: ['finishing', 'shooting', 'ballHandling', 'perimeterDefense'],
  SF: [
    'finishing',
    'shooting',
    'playmaking',
    'ballHandling',
    'perimeterDefense',
    'interiorDefense',
    'rebounding',
    'athleticism',
  ],
  PF: ['finishing', 'interiorDefense', 'rebounding', 'athleticism'],
  C: ['finishing', 'interiorDefense', 'rebounding', 'athleticism'],
} as const satisfies Readonly<
  Record<Position, readonly (keyof PlayerAttributes)[]>
>

interface SamplePlayer {
  readonly seed: string
  readonly programId: string
  readonly player: Player
  readonly overall: number
}

interface Probe {
  readonly label: string
  readonly position: Position
  readonly attributes: PlayerAttributes
}

interface ConstraintCase {
  readonly label: string
  readonly position: Position
  readonly constraints: Partial<Record<keyof PlayerAttributes, number>>
}

function fixed(value: number, digits = 2): string {
  return value.toFixed(digits)
}

function pct(count: number, total: number): string {
  return `${fixed(total === 0 ? 0 : (count / total) * 100, 1)}%`
}

function seed(index: number): string {
  return `${SEED_FAMILY}:${String(index + 1).padStart(3, '0')}`
}

function collectPopulation(): SamplePlayer[] {
  return Array.from({ length: UNIVERSE_COUNT }, (_, index) => {
    const currentSeed = seed(index)
    return initializeUniverse(UNIVERSE_V0, currentSeed).programs.flatMap(
      ({ program, team }) =>
        team.roster.map((player) => ({
          seed: currentSeed,
          programId: program.id,
          player,
          overall: calculateOverall(player),
        })),
    )
  }).flat()
}

function makeProbe(probe: Probe): Player {
  return {
    id: `diagnostic-${probe.label}`,
    firstName: 'Diagnostic',
    lastName: probe.label,
    position: probe.position,
    classYear: 'SR',
    height: probe.position === 'C' ? 83 : probe.position === 'PF' ? 81 : 78,
    attributes: probe.attributes,
    potential: 99,
  }
}

function attrs(
  finishing: number,
  shooting: number,
  playmaking: number,
  ballHandling: number,
  perimeterDefense: number,
  interiorDefense: number,
  rebounding: number,
  athleticism: number,
  stamina: number,
): PlayerAttributes {
  return {
    finishing,
    shooting,
    playmaking,
    ballHandling,
    perimeterDefense,
    interiorDefense,
    rebounding,
    athleticism,
    stamina,
  }
}

const PROBES: readonly Probe[] = [
  { label: 'SG offense-first', position: 'SG', attributes: attrs(97, 98, 85, 94, 60, 45, 48, 94, 90) },
  { label: 'SG two-way', position: 'SG', attributes: attrs(95, 96, 83, 92, 94, 55, 65, 92, 90) },
  { label: 'SG playmaker', position: 'SG', attributes: attrs(91, 92, 97, 97, 65, 48, 52, 91, 90) },
  { label: 'SG defensive specialist', position: 'SG', attributes: attrs(82, 80, 70, 78, 98, 65, 62, 96, 91) },
  { label: 'C traditional dominant', position: 'C', attributes: attrs(98, 45, 48, 45, 55, 98, 99, 94, 91) },
  { label: 'C rim-running defender', position: 'C', attributes: attrs(88, 43, 45, 44, 55, 99, 99, 98, 92) },
  { label: 'C stretch', position: 'C', attributes: attrs(88, 94, 62, 60, 65, 88, 86, 86, 90) },
  { label: 'C playmaker', position: 'C', attributes: attrs(88, 72, 97, 90, 70, 86, 84, 88, 91) },
  { label: 'PG offense-first', position: 'PG', attributes: attrs(92, 98, 98, 98, 58, 42, 48, 92, 91) },
  { label: 'SF rebounding defender', position: 'SF', attributes: attrs(82, 72, 68, 70, 92, 92, 96, 93, 90) },
  { label: 'SF point forward', position: 'SF', attributes: attrs(88, 85, 97, 94, 78, 70, 78, 90, 91) },
  { label: 'PF defensive interior', position: 'PF', attributes: attrs(86, 52, 55, 52, 70, 98, 98, 94, 91) },
  { label: 'PF point forward', position: 'PF', attributes: attrs(90, 78, 96, 91, 78, 82, 82, 90, 91) },
]

const CONSTRAINTS: readonly ConstraintCase[] = [
  { label: 'SG REB≤50', position: 'SG', constraints: { rebounding: 50 } },
  { label: 'SG PER≤60', position: 'SG', constraints: { perimeterDefense: 60 } },
  { label: 'SG REB≤50 + PER≤60', position: 'SG', constraints: { rebounding: 50, perimeterDefense: 60 } },
  { label: 'SG offense / defense-poor', position: 'SG', constraints: { rebounding: 50, perimeterDefense: 60, interiorDefense: 55 } },
  { label: 'C SHT≤50', position: 'C', constraints: { shooting: 50 } },
  { label: 'C PLY≤50', position: 'C', constraints: { playmaking: 50 } },
  { label: 'C SHT≤50 + PLY≤50', position: 'C', constraints: { shooting: 50, playmaking: 50 } },
  { label: 'C traditional perimeter-poor', position: 'C', constraints: { shooting: 50, playmaking: 50, ballHandling: 50, perimeterDefense: 60 } },
  { label: 'PG PER≤60', position: 'PG', constraints: { perimeterDefense: 60 } },
  { label: 'PG defense-poor', position: 'PG', constraints: { perimeterDefense: 60, interiorDefense: 50 } },
  { label: 'SF interior/rebounding≤60', position: 'SF', constraints: { interiorDefense: 60, rebounding: 60 } },
  { label: 'PF shooting/playmaking≤50', position: 'PF', constraints: { shooting: 50, playmaking: 50 } },
]

function playerLine(row: SamplePlayer): string {
  return (
    `${row.player.position} OVR ${row.overall} POT ${row.player.potential} ` +
    PLAYER_ATTRIBUTE_KEYS.map(
      (key) => `${ATTRIBUTE_LABELS[key]}${row.player.attributes[key]}`,
    ).join(' ')
  )
}

function main(): void {
  const population = collectPopulation()
  process.stdout.write(
    'COLLEGE HOOPS SIM — ELITE PLAYER PROFILE / OVR SPECIALIZATION\n\n' +
      `Sample: ${UNIVERSE_COUNT} canonical fresh Season 1 universes / ${population.length} Players\n` +
      `Seeds: ${SEED_FAMILY}:001..${UNIVERSE_COUNT}\n\n`,
  )

  process.stdout.write('OVR WEIGHTS AND +10 ATTRIBUTE SENSITIVITY\n')
  process.stdout.write(`POS ${PLAYER_ATTRIBUTE_KEYS.map((key) => ATTRIBUTE_LABELS[key].padStart(5)).join(' ')}\n`)
  for (const position of POSITIONS) {
    process.stdout.write(
      `${position}  ${POSITION_WEIGHTS[position]
        .map((weight) => `${fixed(weight * 100, 0)}%/${fixed(weight * 10, 1)}`.padStart(8))
        .join(' ')}\n`,
    )
  }
  process.stdout.write('OVR is round(sum(attribute × position weight)); sensitivity is unrounded OVR gained per +10.\n\n')

  process.stdout.write('FULL S1 ATTRIBUTE DISTRIBUTIONS BY POSITION\n')
  for (const position of POSITIONS) {
    const rows = population.filter(({ player }) => player.position === position)
    process.stdout.write(`\n${position} N=${rows.length}\n`)
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const values = rows.map(({ player }) => player.attributes[key])
      const summary = summarize(values)
      process.stdout.write(
        `${ATTRIBUTE_LABELS[key]} mean ${fixed(summary.mean)} med ${fixed(summary.median, 1)} sd ${fixed(standardDeviation(values))} ` +
          `P10 ${fixed(summary.p10, 1)} P25 ${fixed(summary.p25, 1)} P75 ${fixed(summary.p75, 1)} ` +
          `P90 ${fixed(summary.p90, 1)} P95 ${fixed(percentile(values, 0.95), 1)} min ${summary.minimum} max ${summary.maximum}\n`,
      )
    }
  }

  process.stdout.write('\nPOSITION OVERLAP (P10–P90; P95/MAX)\n')
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    process.stdout.write(
      `${ATTRIBUTE_LABELS[key]}: ${POSITIONS.map((position) => {
        const values = population
          .filter(({ player }) => player.position === position)
          .map(({ player }) => player.attributes[key])
        return `${position} ${fixed(percentile(values, 0.1), 0)}–${fixed(percentile(values, 0.9), 0)};${fixed(percentile(values, 0.95), 0)}/${Math.max(...values)}`
      }).join(' | ')}\n`,
    )
  }

  const bands = [
    ['<70', (overall: number) => overall < 70],
    ['70–79', (overall: number) => overall >= 70 && overall <= 79],
    ['80–84', (overall: number) => overall >= 80 && overall <= 84],
    ['85–89', (overall: number) => overall >= 85 && overall <= 89],
    ['90–94', (overall: number) => overall >= 90 && overall <= 94],
    ['95+', (overall: number) => overall >= 95],
  ] as const
  process.stdout.write('\nOVR BAND WEAKNESS / SPECIALIZATION BY POSITION\n')
  for (const position of POSITIONS) {
    process.stdout.write(`\n${position}\n`)
    for (const [label, includes] of bands) {
      const rows = population.filter(
        ({ player, overall }) => player.position === position && includes(overall),
      )
      const allShapes = rows.map(({ player }) => deriveProfileShape(player.attributes))
      const relevantShapes = rows.map(({ player }) =>
        deriveProfileShape(player.attributes, RELEVANT_ATTRIBUTES[position]),
      )
      const weakness = (threshold: 'below50' | 'below60' | 'below70') => {
        const counts = rows.map(({ player }) => countWeaknesses(Object.values(player.attributes))[threshold])
        return `${fixed(summarize(counts).mean)}/${pct(counts.filter((count) => count > 0).length, counts.length)}`
      }
      process.stdout.write(
        `${label} N=${rows.length} weak<50/<60/<70 mean+any ${weakness('below50')} ${weakness('below60')} ${weakness('below70')} ` +
          `all spread/sd/gap ${fixed(summarize(allShapes.map(({ spread }) => spread)).mean)}/${fixed(summarize(allShapes.map(({ standardDeviation: sd }) => sd)).mean)}/${fixed(summarize(allShapes.map(({ topTwoMinusBottomTwo }) => topTwoMinusBottomTwo)).mean)} ` +
          `relevant spread/sd/gap ${fixed(summarize(relevantShapes.map(({ spread }) => spread)).mean)}/${fixed(summarize(relevantShapes.map(({ standardDeviation: sd }) => sd)).mean)}/${fixed(summarize(relevantShapes.map(({ topTwoMinusBottomTwo }) => topTwoMinusBottomTwo)).mean)}\n`,
      )
    }
  }

  process.stdout.write('\nELITE COHORT ATTRIBUTE FLOORS (mean / P10 / P25 / min)\n')
  for (const threshold of [85, 90, 95]) {
    process.stdout.write(`\nOVR ${threshold}+\n`)
    for (const position of POSITIONS) {
      const rows = population.filter(
        ({ player, overall }) => player.position === position && overall >= threshold,
      )
      process.stdout.write(`${position} N=${rows.length} `)
      process.stdout.write(
        PLAYER_ATTRIBUTE_KEYS.map((key) => {
          const summary = summarize(rows.map(({ player }) => player.attributes[key]))
          return `${ATTRIBUTE_LABELS[key]} ${fixed(summary.mean, 1)}/${fixed(summary.p10, 0)}/${fixed(summary.p25, 0)}/${summary.minimum}`
        }).join(' | ') + '\n',
      )
    }
  }

  process.stdout.write('\nCONTROLLED SPECIALIZED PROBES\n')
  for (const probe of PROBES) {
    const player = makeProbe(probe)
    const allShape = deriveProfileShape(player.attributes)
    const relevantShape = deriveProfileShape(
      player.attributes,
      RELEVANT_ATTRIBUTES[player.position],
    )
    process.stdout.write(
      `${probe.label}: OVR ${calculateOverall(player)} | weak<60 ${allShape.weaknesses.below60} | all/relevant gap ${fixed(allShape.topTwoMinusBottomTwo, 1)}/${fixed(relevantShape.topTwoMinusBottomTwo, 1)}\n`,
    )
  }

  const p99Players = Object.fromEntries(
    POSITIONS.map((position) => {
      const rows = population.filter(({ player }) => player.position === position)
      const attributes = Object.fromEntries(
        PLAYER_ATTRIBUTE_KEYS.map((key) => [
          key,
          Math.floor(percentile(rows.map(({ player }) => player.attributes[key]), 0.99)),
        ]),
      ) as unknown as PlayerAttributes
      return [position, makeProbe({ label: `${position}-p99-bounds`, position, attributes })]
    }),
  ) as Record<Position, Player>

  process.stdout.write('\nMAX OVR UNDER WEAKNESS CONSTRAINTS\n')
  for (const constraint of CONSTRAINTS) {
    const candidates = population.filter(
      ({ player }) =>
        player.position === constraint.position &&
        Object.entries(constraint.constraints).every(
          ([key, limit]) =>
            player.attributes[key as keyof PlayerAttributes] <= limit!,
        ),
    )
    const observed = candidates.slice().sort((a, b) => b.overall - a.overall)[0]
    const rangeBounded = withAttributeConstraints(
      p99Players[constraint.position],
      constraint.constraints,
    )
    const mathematical = withAttributeConstraints(
      makeProbe({
        label: `${constraint.position}-mathematical`,
        position: constraint.position,
        attributes: attrs(99, 99, 99, 99, 99, 99, 99, 99, 99),
      }),
      constraint.constraints,
    )
    process.stdout.write(
      `${constraint.label}: observed ${observed?.overall ?? 'none'} (N=${candidates.length}) | P99-range max ${calculateOverall(rangeBounded)} | mathematical max ${calculateOverall(mathematical)}\n`,
    )
  }

  process.stdout.write('\nHIGH-OVR DIVERSITY BY POSITION\n')
  for (const threshold of [90, 95]) {
    for (const position of POSITIONS) {
      const rows = population.filter(
        ({ player, overall }) => player.position === position && overall >= threshold,
      )
      const weakest = rows.map(({ player }) => Math.min(...Object.values(player.attributes)))
      const strongest = rows.map(({ player }) => Math.max(...Object.values(player.attributes)))
      const withinAttributeSd = PLAYER_ATTRIBUTE_KEYS.map((key) =>
        standardDeviation(rows.map(({ player }) => player.attributes[key])),
      )
      process.stdout.write(
        `${threshold}+ ${position} N=${rows.length} weakest mean/range ${fixed(summarize(weakest).mean)}/${Math.min(...weakest)}–${Math.max(...weakest)} ` +
          `strongest mean/range ${fixed(summarize(strongest).mean)}/${Math.min(...strongest)}–${Math.max(...strongest)} ` +
          `mean attribute-SD ${fixed(summarize(withinAttributeSd).mean)}\n`,
      )
    }
  }

  process.stdout.write('\nATTRIBUTE CORRELATIONS BY POSITION\n')
  const pairs = [
    ['SHT/PLY', 'shooting', 'playmaking'],
    ['FIN/SHT', 'finishing', 'shooting'],
    ['PLY/REB', 'playmaking', 'rebounding'],
    ['PER/INT', 'perimeterDefense', 'interiorDefense'],
    ['REB/INT', 'rebounding', 'interiorDefense'],
    ['ATH/PER', 'athleticism', 'perimeterDefense'],
    ['ATH/INT', 'athleticism', 'interiorDefense'],
  ] as const satisfies readonly (readonly [string, keyof PlayerAttributes, keyof PlayerAttributes])[]
  for (const position of POSITIONS) {
    const rows = population.filter(({ player }) => player.position === position)
    const pairValues = pairs.map(([label, first, second]) =>
      `${label} ${fixed(pearsonCorrelation(rows.map(({ player }) => player.attributes[first]), rows.map(({ player }) => player.attributes[second])), 3)}`,
    )
    const allPairCorrelations: number[] = []
    for (let first = 0; first < PLAYER_ATTRIBUTE_KEYS.length; first += 1) {
      for (let second = first + 1; second < PLAYER_ATTRIBUTE_KEYS.length; second += 1) {
        const firstKey = PLAYER_ATTRIBUTE_KEYS[first]!
        const secondKey = PLAYER_ATTRIBUTE_KEYS[second]!
        allPairCorrelations.push(
          pearsonCorrelation(
            rows.map(({ player }) => player.attributes[firstKey]),
            rows.map(({ player }) => player.attributes[secondKey]),
          ),
        )
      }
    }
    process.stdout.write(
      `${position}: ${pairValues.join(' | ')} | mean all-pair r ${fixed(summarize(allPairCorrelations).mean, 3)}\n`,
    )
  }

  process.stdout.write('\nREAL GENERATED EXAMPLES\n')
  const elite = population.filter(({ overall }) => overall >= 90)
  const examples: readonly [string, SamplePlayer | undefined][] = [
    ['95+ most all-around', population.filter(({ overall }) => overall >= 95).sort((a, b) => Math.min(...Object.values(b.player.attributes)) - Math.min(...Object.values(a.player.attributes)))[0]],
    ['90+ clearest weakness', elite.sort((a, b) => Math.min(...Object.values(a.player.attributes)) - Math.min(...Object.values(b.player.attributes)))[0]],
    ['90+ largest spread', elite.sort((a, b) => deriveProfileShape(b.player.attributes).spread - deriveProfileShape(a.player.attributes).spread)[0]],
    ['elite conventional PG', elite.filter(({ player }) => player.position === 'PG').sort((a, b) => b.overall - a.overall)[0]],
    ['elite conventional C', elite.filter(({ player }) => player.position === 'C').sort((a, b) => b.overall - a.overall)[0]],
    ['highest-OVR skilled big', population.filter(({ player }) => (player.position === 'PF' || player.position === 'C') && player.attributes.playmaking >= 80).sort((a, b) => b.overall - a.overall)[0]],
    ['highest-OVR rebounding guard', population.filter(({ player }) => (player.position === 'PG' || player.position === 'SG') && player.attributes.rebounding >= 80).sort((a, b) => b.overall - a.overall)[0]],
  ]
  for (const [label, row] of examples) {
    process.stdout.write(`${label}: ${row ? playerLine(row) : 'none'}\n`)
  }

  process.stdout.write('\nELITE SCARCITY\n')
  for (const threshold of [90, 95, 97]) {
    const rows = population.filter(({ overall }) => overall >= threshold)
    process.stdout.write(
      `${threshold}+: ${rows.length} | ${fixed(rows.length / UNIVERSE_COUNT)} per universe | ${pct(new Set(rows.map(({ seed: currentSeed }) => currentSeed)).size, UNIVERSE_COUNT)} universes\n`,
    )
  }
}

main()
