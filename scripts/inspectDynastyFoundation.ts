import { calculateOverall, TEAM_ROSTER_SIZE, type Player } from '../src/engine'
import {
  beginOffseason,
  deriveAttributeDevelopmentGains,
  deriveDevelopmentSummary,
  deriveOffseasonRosterOutlook,
  deriveProjectedRosterOutlook,
  developReturningPlayer,
  initializeDynastyState,
  type DynastyState,
  type PlayerDevelopmentSummary,
} from '../src/dynasty'
import {
  deriveNationalChampion,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  type PostseasonState,
  type TournamentRound,
} from '../src/postseason'
import { generateRegularSeasonSchedule } from '../src/schedule'
import {
  initializeSeason,
  simulatePendingGamesInRound,
  type SeasonState,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const DYNASTY_SEED = 'dynasty-foundation-inspection-v0'
const ROUNDS: readonly TournamentRound[] = [
  'round-of-16',
  'quarterfinals',
  'semifinals',
  'championship',
]
const ATTRIBUTES = [
  'finishing', 'shooting', 'playmaking', 'ballHandling', 'perimeterDefense',
  'interiorDefense', 'rebounding', 'athleticism', 'stamina',
] as const
const ATTRIBUTE_LABELS = {
  finishing: 'FIN',
  shooting: 'SHO',
  playmaking: 'PLY',
  ballHandling: 'HND',
  perimeterDefense: 'PER D',
  interiorDefense: 'INT D',
  rebounding: 'REB',
  athleticism: 'ATH',
  stamina: 'STA',
} as const

const HEADROOM_BUCKETS = [
  { label: '0', includes: (headroom: number) => headroom === 0 },
  { label: '1–2', includes: (headroom: number) => headroom >= 1 && headroom <= 2 },
  { label: '3–5', includes: (headroom: number) => headroom >= 3 && headroom <= 5 },
  { label: '6–9', includes: (headroom: number) => headroom >= 6 && headroom <= 9 },
  { label: '10+', includes: (headroom: number) => headroom >= 10 },
] as const

function completeRegularSeason(season: SeasonState): SeasonState {
  let current = season
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed: 'dynasty-foundation-regular-season-v0',
    })
  }
  return current
}

function completeTournament(postseason: PostseasonState): PostseasonState {
  return ROUNDS.reduce(
    (current, round) => simulatePendingGamesInTournamentRound({
      postseason: current,
      round,
      simulationSeed: 'dynasty-foundation-postseason-v0',
    }),
    postseason,
  )
}

function initializeCompletedCompetition() {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    'dynasty-foundation-universe-v0',
  )
  const season = completeRegularSeason(initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: 'dynasty-foundation-schedule-v0',
    }),
    seasonNumber: 1,
  }))
  const postseason = completeTournament(initializePostseason({
    universe: UNIVERSE_V0,
    season,
  }))
  return { season, postseason }
}

function createDynasty(
  season: SeasonState,
  postseason: PostseasonState,
  dynastySeed: string,
  reversePrograms = false,
): DynastyState {
  return initializeDynastyState({
    dynastyId: 'dynasty-foundation-inspection',
    dynastySeed,
    controlledProgramId: 'charlotte-tech',
    universe: reversePrograms
      ? { ...UNIVERSE_V0, programs: [...UNIVERSE_V0.programs].reverse() }
      : UNIVERSE_V0,
    activeSeason: season,
    activePostseason: postseason,
  })
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0
}

function countPlayerStats(results: Record<string, { readonly homePlayerStats: readonly object[]; readonly awayPlayerStats: readonly object[] }>): number {
  return Object.values(results).reduce(
    (sum, result) => sum + result.homePlayerStats.length + result.awayPlayerStats.length,
    0,
  )
}

function playersById(dynasty: DynastyState): Record<string, Player> {
  return Object.fromEntries(
    Object.values(dynasty.offseason!.programs).flatMap((program) =>
      program.returningPlayers.map((player) => [player.id, player]),
    ),
  )
}

function sortedPlayersJson(dynasty: DynastyState): string {
  return JSON.stringify(
    Object.values(playersById(dynasty)).sort((a, b) => a.id.localeCompare(b.id)),
  )
}

function main(): void {
  const { season, postseason } = initializeCompletedCompetition()
  const sourceSeasonJson = JSON.stringify(season)
  const sourcePostseasonJson = JSON.stringify(postseason)
  const initial = createDynasty(season, postseason, DYNASTY_SEED)
  const dynasty = beginOffseason(initial)
  const archive = dynasty.history[0]!
  const championId = deriveNationalChampion(postseason)!
  const champion = UNIVERSE_V0.programs.find(({ id }) => id === championId)!.name
  const summaries: PlayerDevelopmentSummary[] = []
  let graduates = 0
  let attributeRegressions = 0
  let attributesAbove99 = 0
  let playersExceedingPotential = 0
  let changedIds = 0

  for (const program of UNIVERSE_V0.programs) {
    const sourceTeam = postseason.programStates[program.id]?.team
      ?? season.programStates[program.id]!.team
    const offseason = dynasty.offseason!.programs[program.id]!
    graduates += sourceTeam.roster.filter(({ classYear }) => classYear === 'SR').length
    for (const after of offseason.returningPlayers) {
      const before = sourceTeam.roster.find(({ id }) => id === after.id)!
      summaries.push(deriveDevelopmentSummary(program.id, before, after))
      if (before.id !== after.id) changedIds += 1
      if (calculateOverall(after) > after.potential) playersExceedingPotential += 1
      for (const attribute of ATTRIBUTES) {
        if (after.attributes[attribute] < before.attributes[attribute]) attributeRegressions += 1
        if (after.attributes[attribute] > 99) attributesAbove99 += 1
      }
    }
  }

  const byClass = (completedClass: 'FR' | 'SO' | 'JR') =>
    summaries.filter((summary) => summary.completedClass === completedClass)
  const deltas = summaries.map(({ overallChange }) => overallChange)
  const sameSeed = beginOffseason(createDynasty(season, postseason, DYNASTY_SEED))
  const differentSeed = beginOffseason(createDynasty(season, postseason, `${DYNASTY_SEED}:different`))
  const reversedPrograms = beginOffseason(createDynasty(season, postseason, DYNASTY_SEED, true))
  const playerOrderForward = season.programStates['charlotte-tech']!.team.roster
    .filter(({ classYear }) => classYear !== 'SR')
    .map((player) => developReturningPlayer({ player, dynastySeed: DYNASTY_SEED, completedSeasonNumber: 1, programId: 'charlotte-tech' }))
    .sort((a, b) => a.id.localeCompare(b.id))
  const playerOrderReverse = [...season.programStates['charlotte-tech']!.team.roster]
    .reverse()
    .filter(({ classYear }) => classYear !== 'SR')
    .map((player) => developReturningPlayer({ player, dynastySeed: DYNASTY_SEED, completedSeasonNumber: 1, programId: 'charlotte-tech' }))
    .sort((a, b) => a.id.localeCompare(b.id))

  process.stdout.write(
    'COLLEGE HOOPS SIM — DYNASTY FOUNDATION V0\n\n' +
    'COMPLETED SEASON\n\n' +
    `Season: ${season.seasonNumber}\nPrograms: ${UNIVERSE_V0.programs.length}\n` +
    `Regular-season games: ${Object.keys(season.resultsByGameId).length} / ${season.schedule.games.length}\n` +
    `Postseason games: ${Object.keys(postseason.resultsByGameId).length} / ${postseason.bracket.games.length}\n` +
    `National Champion: ${champion}\n\n` +
    'ARCHIVE\n\n' +
    `Season archived: ${archive.seasonNumber === season.seasonNumber ? 'PASS' : 'FAIL'}\n` +
    `Regular-season results preserved: ${JSON.stringify(archive.season.resultsByGameId) === JSON.stringify(season.resultsByGameId) ? 'PASS' : 'FAIL'}\n` +
    `Postseason results preserved: ${JSON.stringify(archive.postseason.resultsByGameId) === JSON.stringify(postseason.resultsByGameId) ? 'PASS' : 'FAIL'}\n` +
    `Regular-season PlayerGameStats preserved: ${countPlayerStats(archive.season.resultsByGameId) === countPlayerStats(season.resultsByGameId) ? 'PASS' : 'FAIL'}\n` +
    `Postseason PlayerGameStats preserved: ${countPlayerStats(archive.postseason.resultsByGameId) === countPlayerStats(postseason.resultsByGameId) ? 'PASS' : 'FAIL'}\n` +
    `Original SeasonState unchanged: ${JSON.stringify(season) === sourceSeasonJson ? 'PASS' : 'FAIL'}\n` +
    `Original PostseasonState unchanged: ${JSON.stringify(postseason) === sourcePostseasonJson ? 'PASS' : 'FAIL'}\n\n` +
    'GRADUATION\n\n' +
    `Players before: ${UNIVERSE_V0.programs.length * TEAM_ROSTER_SIZE}\n` +
    `Seniors graduated: ${graduates}\nReturning Players: ${summaries.length}\n\n` +
    'CLASS TRANSITIONS\n\n' +
    `FR → SO: ${byClass('FR').length}\nSO → JR: ${byClass('SO').length}\nJR → SR: ${byClass('JR').length}\n\n` +
    'DEVELOPMENT BY CLASS\n\n' +
    'TRANSITION    COUNT    AVG ΔOVR    P50    P95    MAX\n',
  )
  for (const [completedClass, nextClass] of [['FR', 'SO'], ['SO', 'JR'], ['JR', 'SR']] as const) {
    const values = byClass(completedClass).map(({ overallChange }) => overallChange)
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    process.stdout.write(
      `${`${completedClass} → ${nextClass}`.padEnd(14)}${String(values.length).padEnd(9)}` +
      `${average.toFixed(2).padEnd(12)}${String(percentile(values, 0.5)).padEnd(7)}` +
      `${String(percentile(values, 0.95)).padEnd(7)}${Math.max(...values)}\n`,
    )
  }
  const bucketCount = (predicate: (delta: number) => boolean) => deltas.filter(predicate).length
  const percent = (count: number) => `${count} / ${((count / deltas.length) * 100).toFixed(1)}%`
  process.stdout.write(
    `\nSTAGNATED     ${percent(bucketCount((value) => value === 0))}\n` +
    `+1 OVR        ${percent(bucketCount((value) => value === 1))}\n` +
    `+2 OVR        ${percent(bucketCount((value) => value === 2))}\n` +
    `+3 OVR        ${percent(bucketCount((value) => value === 3))}\n` +
    `+4 OVR        ${percent(bucketCount((value) => value === 4))}\n` +
    `+5+ OVR       ${percent(bucketCount((value) => value >= 5))}\n\n` +
    'DEVELOPMENT BY POTENTIAL HEADROOM\n\n' +
    'HEADROOM    COUNT    AVG ΔOVR    P50    MAX    STAGNATED\n',
  )
  for (const bucket of HEADROOM_BUCKETS) {
    const values = summaries
      .filter(({ potentialHeadroom }) => bucket.includes(potentialHeadroom))
      .map(({ overallChange }) => overallChange)
    const average = values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length
    const stagnated = values.filter((value) => value === 0).length
    const stagnatedPercent = values.length === 0
      ? 0
      : (stagnated / values.length) * 100
    process.stdout.write(
      `${bucket.label.padEnd(12)}${String(values.length).padEnd(9)}` +
      `${average.toFixed(2).padEnd(12)}${String(percentile(values, 0.5)).padEnd(7)}` +
      `${String(values.length === 0 ? 0 : Math.max(...values)).padEnd(7)}` +
      `${stagnatedPercent.toFixed(1)}%\n`,
    )
  }
  process.stdout.write(
    '\nDEVELOPMENT SAFETY\n\n' +
    `Players exceeding POT: ${playersExceedingPotential}\nAttributes above 99: ${attributesAbove99}\n` +
    `Attribute regressions: ${attributeRegressions}\nReturning IDs changed: ${changedIds}\n` +
    `Archived Player snapshots mutated: ${JSON.stringify(archive.season) === sourceSeasonJson ? 0 : 1}\n\n` +
    'DETERMINISM\n\n' +
    `Same seed: ${sortedPlayersJson(sameSeed) === sortedPlayersJson(dynasty) ? 'PASS' : 'FAIL'}\n` +
    `Different seed changes development: ${sortedPlayersJson(differentSeed) !== sortedPlayersJson(dynasty) ? 'PASS' : 'FAIL'}\n` +
    `Program-order independence: ${sortedPlayersJson(reversedPrograms) === sortedPlayersJson(dynasty) ? 'PASS' : 'FAIL'}\n` +
    `Player-order independence: ${JSON.stringify(playerOrderForward) === JSON.stringify(playerOrderReverse) ? 'PASS' : 'FAIL'}\n\n`,
  )

  const openings = Object.values(dynasty.offseason!.programs).map((program) =>
    deriveOffseasonRosterOutlook(program).openRosterSpots,
  )
  const averageReturning = summaries.length / UNIVERSE_V0.programs.length
  const averageOpenings = openings.reduce((sum, value) => sum + value, 0) / openings.length
  const projectedMatches = UNIVERSE_V0.programs.every((program) => {
    const team = postseason.programStates[program.id]?.team ?? season.programStates[program.id]!.team
    return deriveProjectedRosterOutlook(team).projectedOpenings ===
      deriveOffseasonRosterOutlook(dynasty.offseason!.programs[program.id]!).openRosterSpots
  })
  process.stdout.write(
    'PROJECTED / OFFSEASON ROSTERS\n\n' +
    `Average returning Players: ${averageReturning.toFixed(2)}\nAverage open roster spots: ${averageOpenings.toFixed(2)}\n` +
    `Projected openings match offseason: ${projectedMatches ? 'PASS' : 'FAIL'}\n\n`,
  )
  for (const value of [0, 1, 2, 3]) {
    process.stdout.write(`${value} openings: ${openings.filter((count) => count === value).length}\n`)
  }
  process.stdout.write(`4+ openings: ${openings.filter((count) => count >= 4).length}\n\n`)

  const charlotteBefore = postseason.programStates['charlotte-tech']?.team
    ?? season.programStates['charlotte-tech']!.team
  const charlotteAfter = dynasty.offseason!.programs['charlotte-tech']!
  process.stdout.write('CHARLOTTE TECH — OFFSEASON\n\nGRADUATED\nPLAYER                  POS   CLASS   OVR\n')
  for (const player of charlotteBefore.roster.filter(({ classYear }) => classYear === 'SR')) {
    process.stdout.write(`${`${player.firstName} ${player.lastName}`.padEnd(24)}${player.position.padEnd(6)}SR      ${calculateOverall(player)}\n`)
  }
  process.stdout.write('\nRETURNING DEVELOPMENT\nPLAYER                  POS   CLASS      OVR        POT\n')
  for (const after of charlotteAfter.returningPlayers) {
    const before = charlotteBefore.roster.find(({ id }) => id === after.id)!
    process.stdout.write(
      `${`${after.firstName} ${after.lastName}`.padEnd(24)}${after.position.padEnd(6)}` +
      `${`${before.classYear}→${after.classYear}`.padEnd(11)}` +
      `${`${calculateOverall(before)}→${calculateOverall(after)}`.padEnd(11)}${after.potential}\n`,
    )
    const gains = deriveAttributeDevelopmentGains(before, after)
      .slice(0, 3)
      .map(({ attribute, change }) => `${ATTRIBUTE_LABELS[attribute]} +${change}`)
    if (gains.length > 0) {
      process.stdout.write(`  ${gains.join(' · ')}\n`)
    }
  }
  process.stdout.write(
    `\nReturning Players: ${charlotteAfter.returningPlayers.length}\n` +
    `Open Roster Spots: ${deriveOffseasonRosterOutlook(charlotteAfter).openRosterSpots}\n\n` +
    'SERIALIZATION\n\n' +
    `Dynasty JSON: ${JSON.parse(JSON.stringify(dynasty)) ? 'PASS' : 'FAIL'}\n` +
    `Archive JSON: ${JSON.parse(JSON.stringify(archive)) ? 'PASS' : 'FAIL'}\n` +
    `Offseason JSON: ${JSON.parse(JSON.stringify(dynasty.offseason)) ? 'PASS' : 'FAIL'}\n`,
  )
}

main()
