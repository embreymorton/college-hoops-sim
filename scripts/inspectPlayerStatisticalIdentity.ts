import {
  POSITIONS,
  calculateOverall,
  type Player,
  type PlayerAttributes,
  type Position,
} from '../src/engine'
import { generateRegularSeasonSchedule } from '../src/schedule'
import {
  deriveNationalPlayerLeaders,
  deriveSeasonPlayerStats,
  initializeSeason,
  simulatePendingGamesThroughRound,
  type NationalLeaderCategory,
  type PlayerSeasonStats,
  type SeasonState,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import {
  deriveLeaderSeparation,
  pearsonCorrelation,
  per40,
  percentile,
  summarize,
  type LeaderSeparation,
  type NumericSummary,
} from './playerStatisticalIdentityMetrics'

const GENERATION_UNIVERSES = 250
const FULL_SEASONS = 60
const SEED_FAMILY = 'player-statistical-identity-v1'

const STAT_FIELDS = {
  points: ['pointsPerGame', 'points'],
  rebounds: ['reboundsPerGame', 'rebounds'],
  assists: ['assistsPerGame', 'assists'],
  steals: ['stealsPerGame', 'steals'],
  blocks: ['blocksPerGame', 'blocks'],
} as const satisfies Readonly<
  Record<NationalLeaderCategory, readonly [keyof PlayerSeasonStats, keyof PlayerSeasonStats]>
>

type IdentityStat = keyof typeof STAT_FIELDS
type ProfileName =
  | 'elitePasser'
  | 'eliteRebounder'
  | 'elitePerimeterDefender'
  | 'eliteInteriorDefender'
  | 'highAthleticismDefender'
  | 'unusuallyTallGuard'
  | 'unusuallySkilledBig'
  | 'multiCategorySuperstar'

interface PlayerContext {
  readonly seed: string
  readonly programId: string
  readonly player: Player
  readonly overall: number
}

interface ProfileThresholds {
  readonly attributeP75: Readonly<Record<keyof PlayerAttributes, number>>
  readonly attributeP85: Readonly<Record<keyof PlayerAttributes, number>>
  readonly attributeP90: Readonly<Record<keyof PlayerAttributes, number>>
  readonly attributeP95: Readonly<Record<keyof PlayerAttributes, number>>
  readonly heightP95ByPosition: Readonly<Record<Position, number>>
}

interface SeasonObservation {
  readonly seed: string
  readonly season: SeasonState
  readonly playersById: ReadonlyMap<string, Player>
  readonly stats: readonly PlayerSeasonStats[]
  readonly leaders: Readonly<Record<IdentityStat, readonly number[]>>
  readonly separations: Readonly<Record<IdentityStat, LeaderSeparation>>
  readonly per40Leaders: Readonly<Record<IdentityStat, number>>
  readonly rawLeaderPer40: Readonly<Record<IdentityStat, number>>
  readonly topMpg: readonly number[]
  readonly scoringGames40: number
  readonly scoringGames50: number
}

const ATTRIBUTES = [
  'finishing',
  'shooting',
  'playmaking',
  'ballHandling',
  'perimeterDefense',
  'interiorDefense',
  'rebounding',
  'athleticism',
  'stamina',
] as const satisfies readonly (keyof PlayerAttributes)[]

function fixed(value: number, digits = 2): string {
  return value.toFixed(digits)
}

function percent(count: number, total: number): string {
  return `${fixed(total === 0 ? 0 : (count / total) * 100, 1)}%`
}

function generationSeed(index: number): string {
  return `${SEED_FAMILY}:generation:${String(index + 1).padStart(3, '0')}`
}

function seasonSeed(index: number, scope: 'universe' | 'schedule' | 'simulation'): string {
  return `${SEED_FAMILY}:season:${String(index + 1).padStart(3, '0')}:${scope}`
}

function collectPlayers(seed: string): PlayerContext[] {
  return initializeUniverse(UNIVERSE_V0, seed).programs.flatMap(({ program, team }) =>
    team.roster.map((player) => ({
      seed,
      programId: program.id,
      player,
      overall: calculateOverall(player),
    })),
  )
}

function attributeThresholds(players: readonly PlayerContext[]): ProfileThresholds {
  const thresholds = (quantile: number) =>
    Object.fromEntries(
      ATTRIBUTES.map((attribute) => [
        attribute,
        percentile(players.map(({ player }) => player.attributes[attribute]), quantile),
      ]),
    ) as Record<keyof PlayerAttributes, number>

  return {
    attributeP75: thresholds(0.75),
    attributeP85: thresholds(0.85),
    attributeP90: thresholds(0.9),
    attributeP95: thresholds(0.95),
    heightP95ByPosition: Object.fromEntries(
      POSITIONS.map((position) => [
        position,
        percentile(
          players
            .filter(({ player }) => player.position === position)
            .map(({ player }) => player.height),
          0.95,
        ),
      ]),
    ) as Record<Position, number>,
  }
}

function hasProfile(
  context: PlayerContext,
  profile: ProfileName,
  thresholds: ProfileThresholds,
): boolean {
  const { player, overall } = context
  const { attributes } = player

  switch (profile) {
    case 'elitePasser':
      return attributes.playmaking >= thresholds.attributeP95.playmaking
    case 'eliteRebounder':
      return attributes.rebounding >= thresholds.attributeP95.rebounding
    case 'elitePerimeterDefender':
      return attributes.perimeterDefense >= thresholds.attributeP95.perimeterDefense
    case 'eliteInteriorDefender':
      return attributes.interiorDefense >= thresholds.attributeP95.interiorDefense
    case 'highAthleticismDefender':
      return (
        attributes.athleticism >= thresholds.attributeP90.athleticism &&
        Math.max(attributes.perimeterDefense, attributes.interiorDefense) >=
          Math.max(
            thresholds.attributeP90.perimeterDefense,
            thresholds.attributeP90.interiorDefense,
          )
      )
    case 'unusuallyTallGuard':
      return (
        (player.position === 'PG' || player.position === 'SG') &&
        player.height >= thresholds.heightP95ByPosition[player.position] &&
        attributes.playmaking >= thresholds.attributeP75.playmaking
      )
    case 'unusuallySkilledBig':
      return (
        (player.position === 'PF' || player.position === 'C') &&
        (attributes.playmaking >= thresholds.attributeP90.playmaking ||
          (attributes.playmaking >= thresholds.attributeP85.playmaking &&
            attributes.ballHandling >= thresholds.attributeP85.ballHandling))
      )
    case 'multiCategorySuperstar': {
      const eliteAttributes = ATTRIBUTES.filter(
        (attribute) =>
          attributes[attribute] >= thresholds.attributeP90[attribute],
      ).length
      return overall >= 90 && eliteAttributes >= 3
    }
  }
}

function completeSeason(index: number): SeasonObservation {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    seasonSeed(index, 'universe'),
  )
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: seasonSeed(index, 'schedule'),
  })
  const season = simulatePendingGamesThroughRound({
    season: initializeSeason({
      universe: UNIVERSE_V0,
      initializedUniverse,
      schedule,
      seasonNumber: 1,
    }),
    throughRound: schedule.roundCount,
    simulationSeed: seasonSeed(index, 'simulation'),
  })
  const stats = deriveSeasonPlayerStats(season).filter(({ gamesPlayed }) => gamesPlayed >= 12)
  const playersById = new Map(
    Object.values(season.programStates).flatMap(({ team }) =>
      team.roster.map((player) => [player.id, player] as const),
    ),
  )
  const leaderboards = deriveNationalPlayerLeaders(season)
  const leaders = {} as Record<IdentityStat, readonly number[]>
  const separations = {} as Record<IdentityStat, LeaderSeparation>
  for (const category of Object.keys(STAT_FIELDS) as IdentityStat[]) {
    leaders[category] = leaderboards[category].map(({ value }) => value)
    separations[category] = deriveLeaderSeparation(leaders[category])
  }
  const per40Leaders = {} as Record<IdentityStat, number>
  const rawLeaderPer40 = {} as Record<IdentityStat, number>

  for (const category of Object.keys(STAT_FIELDS) as IdentityStat[]) {
    const [rateField, totalField] = STAT_FIELDS[category]
    const ranked = stats
      .slice()
      .sort(
        (first, second) =>
          (second[rateField] as number) - (first[rateField] as number) ||
          first.playerId.localeCompare(second.playerId),
      )
    const rawLeader = ranked[0]!
    per40Leaders[category] = Math.max(
      ...stats.map((row) => per40(row[totalField] as number, row.minutes)),
    )
    rawLeaderPer40[category] = per40(
      rawLeader[totalField] as number,
      rawLeader.minutes,
    )
  }

  let scoringGames40 = 0
  let scoringGames50 = 0
  for (const result of Object.values(season.resultsByGameId)) {
    for (const row of [...result.homePlayerStats, ...result.awayPlayerStats]) {
      if (row.points >= 40) scoringGames40 += 1
      if (row.points >= 50) scoringGames50 += 1
    }
  }

  return {
    seed: seasonSeed(index, 'universe'),
    season,
    playersById,
    stats,
    leaders,
    separations,
    per40Leaders,
    rawLeaderPer40,
    topMpg: stats
      .map(({ minutesPerGame }) => minutesPerGame)
      .sort((first, second) => second - first)
      .slice(0, 10),
    scoringGames40,
    scoringGames50,
  }
}

function formatSummary(summary: NumericSummary): string {
  return [
    `mean ${fixed(summary.mean)}`,
    `median ${fixed(summary.median)}`,
    `P10 ${fixed(summary.p10)}`,
    `P90 ${fixed(summary.p90)}`,
    `min ${fixed(summary.minimum)}`,
    `max ${fixed(summary.maximum)}`,
  ].join(' | ')
}

function groupTranslation(
  seasons: readonly SeasonObservation[],
  thresholds: ProfileThresholds,
  attribute: keyof PlayerAttributes,
  category: IdentityStat,
  positions: readonly Position[],
): { eliteRaw: number; ordinaryRaw: number; elitePer40: number; ordinaryPer40: number; count: number } {
  const eliteRaw: number[] = []
  const ordinaryRaw: number[] = []
  const eliteRates: number[] = []
  const ordinaryRates: number[] = []
  const [rawField, totalField] = STAT_FIELDS[category]

  for (const observation of seasons) {
    for (const row of observation.stats) {
      const player = observation.playersById.get(row.playerId)!
      if (!positions.includes(player.position)) continue
      const isElite = player.attributes[attribute] >= thresholds.attributeP95[attribute]
      const rawTarget = isElite ? eliteRaw : ordinaryRaw
      const rateTarget = isElite ? eliteRates : ordinaryRates
      rawTarget.push(row[rawField] as number)
      rateTarget.push(per40(row[totalField] as number, row.minutes))
    }
  }

  return {
    eliteRaw: summarize(eliteRaw).mean,
    ordinaryRaw: summarize(ordinaryRaw).mean,
    elitePer40: summarize(eliteRates).mean,
    ordinaryPer40: summarize(ordinaryRates).mean,
    count: eliteRaw.length,
  }
}

function main(): void {
  const generationPlayers = Array.from(
    { length: GENERATION_UNIVERSES },
    (_, index) => collectPlayers(generationSeed(index)),
  ).flat()
  const thresholds = attributeThresholds(generationPlayers)
  const profiles: readonly ProfileName[] = [
    'elitePasser',
    'eliteRebounder',
    'elitePerimeterDefender',
    'eliteInteriorDefender',
    'highAthleticismDefender',
    'unusuallyTallGuard',
    'unusuallySkilledBig',
    'multiCategorySuperstar',
  ]

  process.stdout.write(
    'COLLEGE HOOPS SIM — PLAYER STATISTICAL IDENTITY CHARACTERIZATION\n\n' +
      `Generation sample: ${GENERATION_UNIVERSES} fresh S1 universes / ${generationPlayers.length} Players\n` +
      `Generation seeds: ${SEED_FAMILY}:generation:001..${GENERATION_UNIVERSES}\n` +
      `Full-season sample: ${FULL_SEASONS} deterministic S1 seasons\n` +
      `Season seed namespaces: ${SEED_FAMILY}:season:001..${FULL_SEASONS}:{universe,schedule,simulation}\n\n`,
  )

  process.stdout.write('S1 DISTRIBUTION-GROUNDED THRESHOLDS\n')
  for (const attribute of ATTRIBUTES) {
    process.stdout.write(
      `${attribute}: P90 ${fixed(thresholds.attributeP90[attribute], 1)} | P95 ${fixed(thresholds.attributeP95[attribute], 1)}\n`,
    )
  }
  process.stdout.write('\nS1 PROFILE SUPPLY\n')
  for (const profile of profiles) {
    const selected = generationPlayers.filter((player) => hasProfile(player, profile, thresholds))
    const universes = new Set(selected.map(({ seed }) => seed)).size
    process.stdout.write(
      `${profile}: ${selected.length} | ${fixed(selected.length / GENERATION_UNIVERSES)} per universe | ${percent(universes, GENERATION_UNIVERSES)} universes | ` +
        POSITIONS.map(
          (position) =>
            `${position} ${selected.filter(({ player }) => player.position === position).length}`,
        ).join(' / ') +
        '\n',
    )
  }

  process.stdout.write('\nS1 POSITION TAILS\n')
  for (const position of POSITIONS) {
    const players = generationPlayers.filter(({ player }) => player.position === position)
    const line = [
      `${position} N=${players.length}`,
      `HT P95/max ${fixed(percentile(players.map(({ player }) => player.height), 0.95), 1)}/${Math.max(...players.map(({ player }) => player.height))}`,
      `PLY P95/max ${fixed(percentile(players.map(({ player }) => player.attributes.playmaking), 0.95), 1)}/${Math.max(...players.map(({ player }) => player.attributes.playmaking))}`,
      `REB P95/max ${fixed(percentile(players.map(({ player }) => player.attributes.rebounding), 0.95), 1)}/${Math.max(...players.map(({ player }) => player.attributes.rebounding))}`,
      `OVR P95/max ${fixed(percentile(players.map(({ overall }) => overall), 0.95), 1)}/${Math.max(...players.map(({ overall }) => overall))}`,
    ]
    process.stdout.write(`${line.join(' | ')}\n`)
  }
  const over90 = generationPlayers.filter(({ overall }) => overall >= 90)
  const over95 = generationPlayers.filter(({ overall }) => overall >= 95)
  process.stdout.write(
    `\nS1 ELITE OVR\n90+: ${over90.length} (${fixed(over90.length / GENERATION_UNIVERSES)} per universe) | 95+: ${over95.length} (${fixed(over95.length / GENERATION_UNIVERSES)} per universe)\n` +
      `90+ POT: ${formatSummary(summarize(over90.map(({ player }) => player.potential)))}\n`,
  )
  for (const position of POSITIONS) {
    process.stdout.write(
      `${position}: 90+ ${over90.filter(({ player }) => player.position === position).length} | 95+ ${over95.filter(({ player }) => player.position === position).length}\n`,
    )
  }

  const seasons = Array.from({ length: FULL_SEASONS }, (_, index) => completeSeason(index))
  process.stdout.write('\nCURRENT MINUTES ENVIRONMENT\n')
  process.stdout.write(
    `League-high MPG: ${formatSummary(summarize(seasons.map(({ topMpg }) => topMpg[0]!)))}\n` +
      `Top-5 MPG average: ${formatSummary(summarize(seasons.map(({ topMpg }) => topMpg.slice(0, 5).reduce((sum, value) => sum + value, 0) / 5)))}\n` +
      `Top-10 MPG average: ${formatSummary(summarize(seasons.map(({ topMpg }) => topMpg.reduce((sum, value) => sum + value, 0) / 10)))}\n`,
  )
  const allSeasonStats = seasons.flatMap(({ stats }) => stats)
  for (const threshold of [36, 38, 40]) {
    const count = allSeasonStats.filter(({ minutesPerGame }) => minutesPerGame >= threshold).length
    process.stdout.write(`MPG ${threshold}+: ${count}/${allSeasonStats.length} (${percent(count, allSeasonStats.length)})\n`)
  }
  const elitePairs = seasons.flatMap(({ stats, playersById }) =>
    stats
      .filter(({ playerId }) => calculateOverall(playersById.get(playerId)!) >= 90)
      .map((row) => ({ overall: calculateOverall(playersById.get(row.playerId)!), mpg: row.minutesPerGame })),
  )
  process.stdout.write(
    `90+ OVR MPG: ${formatSummary(summarize(elitePairs.map(({ mpg }) => mpg)))} | OVR/MPG r=${fixed(pearsonCorrelation(elitePairs.map(({ overall }) => overall), elitePairs.map(({ mpg }) => mpg)), 3)}\n`,
  )

  process.stdout.write('\nNATIONAL LEADERS / SEPARATION / PER-40\n')
  for (const category of Object.keys(STAT_FIELDS) as IdentityStat[]) {
    const leaderSummary = summarize(seasons.map(({ separations }) => separations[category].leader))
    const gapSecond = summarize(seasons.map(({ separations }) => separations[category].leaderMinusSecond))
    const gapFive = summarize(seasons.map(({ separations }) => separations[category].leaderMinusTopFiveAverage))
    const gapTen = summarize(seasons.map(({ separations }) => separations[category].leaderMinusTopTenAverage))
    const ratioTen = summarize(seasons.map(({ separations }) => separations[category].leaderToTopTenAverage))
    const per40Leaders = summarize(seasons.map(({ per40Leaders }) => per40Leaders[category]))
    const rawLeaderRates = summarize(seasons.map(({ rawLeaderPer40 }) => rawLeaderPer40[category]))
    process.stdout.write(
      `${category.toUpperCase()} leader: ${formatSummary(leaderSummary)}\n` +
        `  leader−#2 mean ${fixed(gapSecond.mean)} | leader−Top5 mean ${fixed(gapFive.mean)} | leader−Top10 mean ${fixed(gapTen.mean)} | leader/Top10 mean ${fixed(ratioTen.mean, 3)}\n` +
        `  max per40: ${formatSummary(per40Leaders)}\n` +
        `  raw leader per40: ${formatSummary(rawLeaderRates)}\n`,
    )
  }

  const ppgLeaders = seasons.map(({ separations }) => separations.points.leader)
  process.stdout.write('\nSCORING EXTREMES\n')
  for (const threshold of [25, 28, 30]) {
    const count = ppgLeaders.filter((value) => value >= threshold).length
    process.stdout.write(`Seasons with ${threshold}+ PPG leader: ${count}/${FULL_SEASONS} (${percent(count, FULL_SEASONS)})\n`)
  }
  process.stdout.write(
    `40+ point games: ${seasons.reduce((sum, season) => sum + season.scoringGames40, 0)} across ${FULL_SEASONS * 384} games\n` +
      `50+ point games: ${seasons.reduce((sum, season) => sum + season.scoringGames50, 0)} across ${FULL_SEASONS * 384} games\n`,
  )

  process.stdout.write('\nDEFENSIVE LEADER THRESHOLDS\n')
  for (const [category, cuts] of [
    ['steals', [2, 2.5, 3]],
    ['blocks', [3, 4, 5]],
  ] as const) {
    const values = seasons.map(({ separations }) => separations[category].leader)
    for (const cut of cuts) {
      const count = values.filter((value) => value >= cut).length
      process.stdout.write(`${category} leader ${cut}+: ${count}/${FULL_SEASONS} (${percent(count, FULL_SEASONS)})\n`)
    }
  }

  process.stdout.write('\nATTRIBUTE → PRODUCTION (P95 ATTRIBUTE VS OTHER, WITHIN POSITION GROUP)\n')
  const translations = [
    ['PG passing', 'playmaking', 'assists', ['PG']],
    ['big passing', 'playmaking', 'assists', ['PF', 'C']],
    ['guard rebounding', 'rebounding', 'rebounds', ['PG', 'SG']],
    ['big rebounding', 'rebounding', 'rebounds', ['PF', 'C']],
    ['perimeter defense', 'perimeterDefense', 'steals', ['PG', 'SG', 'SF']],
    ['interior defense', 'interiorDefense', 'blocks', ['PF', 'C']],
  ] as const satisfies readonly (readonly [string, keyof PlayerAttributes, IdentityStat, readonly Position[]])[]
  for (const [label, attribute, category, positions] of translations) {
    const result = groupTranslation(seasons, thresholds, attribute, category, positions)
    process.stdout.write(
      `${label}: elite N=${result.count} | raw ${fixed(result.eliteRaw)} vs ${fixed(result.ordinaryRaw)} | per40 ${fixed(result.elitePer40)} vs ${fixed(result.ordinaryPer40)}\n`,
    )
  }

  const statPlayerRows = seasons.flatMap(({ stats, playersById }) =>
    stats.map((row) => ({ row, player: playersById.get(row.playerId)! })),
  )
  const correlation = (attribute: keyof PlayerAttributes, category: IdentityStat) => {
    const [, totalField] = STAT_FIELDS[category]
    return pearsonCorrelation(
      statPlayerRows.map(({ player }) => player.attributes[attribute]),
      statPlayerRows.map(({ row }) => per40(row[totalField] as number, row.minutes)),
    )
  }
  const heightBlockCorrelation = pearsonCorrelation(
    statPlayerRows.map(({ player }) => player.height),
    statPlayerRows.map(({ row }) => per40(row.blocks, row.minutes)),
  )
  process.stdout.write(
    '\nATTRIBUTE/RATE CORRELATIONS (ALL QUALIFIED PLAYERS)\n' +
      `PLY/AST40 ${fixed(correlation('playmaking', 'assists'), 3)} | HND/AST40 ${fixed(correlation('ballHandling', 'assists'), 3)}\n` +
      `REB/REB40 ${fixed(correlation('rebounding', 'rebounds'), 3)} | PER/STL40 ${fixed(correlation('perimeterDefense', 'steals'), 3)} | ATH/STL40 ${fixed(correlation('athleticism', 'steals'), 3)}\n` +
      `INT/BLK40 ${fixed(correlation('interiorDefense', 'blocks'), 3)} | ATH/BLK40 ${fixed(correlation('athleticism', 'blocks'), 3)} | HT/BLK40 ${fixed(heightBlockCorrelation, 3)}\n`,
  )

  process.stdout.write('\nTOP-10 POSITION SHARES\n')
  for (const category of Object.keys(STAT_FIELDS) as IdentityStat[]) {
    const counts = Object.fromEntries(POSITIONS.map((position) => [position, 0])) as Record<Position, number>
    for (const observation of seasons) {
      const [rateField] = STAT_FIELDS[category]
      for (const row of observation.stats
        .slice()
        .sort((first, second) => (second[rateField] as number) - (first[rateField] as number))
        .slice(0, 10)) {
        counts[observation.playersById.get(row.playerId)!.position] += 1
      }
    }
    process.stdout.write(
      `${category}: ${POSITIONS.map((position) => `${position} ${counts[position]} (${percent(counts[position], FULL_SEASONS * 10)})`).join(' | ')}\n`,
    )
  }
}

main()
