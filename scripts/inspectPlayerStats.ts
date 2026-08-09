import type { Player, PlayerGameStats } from '../src/engine'
import { generateRegularSeasonSchedule } from '../src/schedule'
import {
  deriveProgramPlayerSeasonStats,
  deriveSeasonPlayerStats,
  getCompletedGamesForProgram,
  getPlayerGameLog,
  initializeSeason,
  isRegularSeasonComplete,
  simulatePendingGamesThroughRound,
  validateSeasonState,
  type PlayerSeasonStats,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const UNIVERSE_SEED = 'player-season-stats-inspection-universe-v0'
const SCHEDULE_SEED = 'player-season-stats-inspection-schedule-v0'
const SIMULATION_SEED = 'player-season-stats-inspection-simulation-v0'
const INSPECTION_PROGRAM_ID = 'charlotte-tech'

const TOTAL_FIELDS = [
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
type TotalField = (typeof TOTAL_FIELDS)[number]

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

function fixed(value: number): string {
  return value.toFixed(1)
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function playerName(player: Player): string {
  return `${player.firstName} ${player.lastName}`
}

function passFail(value: boolean): string {
  return value ? 'PASS' : 'FAIL'
}

function sumField(
  rows: readonly PlayerSeasonStats[],
  field: TotalField,
): number {
  return rows.reduce((total, row) => total + row[field], 0)
}

function rawRowsForProgram(
  season: Parameters<typeof getCompletedGamesForProgram>[0],
  programId: string,
): PlayerGameStats[] {
  return getCompletedGamesForProgram(season, programId).flatMap(
    ({ game, result }) =>
      game.homeProgramId === programId
        ? result.homePlayerStats
        : result.awayPlayerStats,
  )
}

function totalsMatchRaw(
  season: Parameters<typeof getCompletedGamesForProgram>[0],
): boolean {
  return Object.keys(season.programStates).every((programId) => {
    const derived = deriveProgramPlayerSeasonStats(season, programId)
    const raw = rawRowsForProgram(season, programId)

    return TOTAL_FIELDS.every(
      (field) =>
        sumField(derived, field) ===
        raw.reduce((total, row) => total + row[field], 0),
    )
  })
}

function gamesPlayedMatchesMinutes(
  season: Parameters<typeof deriveSeasonPlayerStats>[0],
  rows: readonly PlayerSeasonStats[],
): boolean {
  return rows.every(
    (row) =>
      row.gamesPlayed ===
      getPlayerGameLog(season, row.programId, row.playerId).filter(
        ({ stats }) => stats.minutes > 0,
      ).length,
  )
}

function allNumbersFinite(rows: readonly PlayerSeasonStats[]): boolean {
  return rows.every((row) =>
    Object.values(row).every(
      (value) => typeof value !== 'number' || Number.isFinite(value),
    ),
  )
}

function main(): void {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, UNIVERSE_SEED)
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: SCHEDULE_SEED,
  })
  const initialSeason = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule,
    seasonNumber: 1,
  })
  const season = simulatePendingGamesThroughRound({
    season: initialSeason,
    throughRound: schedule.roundCount,
    simulationSeed: SIMULATION_SEED,
  })
  const allStats = deriveSeasonPlayerStats(season)
  const expectedStatLines = Object.values(season.programStates).reduce(
    (total, { team }) => total + team.roster.length,
    0,
  )
  const aggregationMatches = totalsMatchRaw(season)
  const gamesPlayedValid = gamesPlayedMatchesMinutes(season, allStats)
  const finite = allNumbersFinite(allStats)
  const roundTrip = JSON.parse(JSON.stringify(allStats)) as PlayerSeasonStats[]
  const roundTripValid = JSON.stringify(roundTrip) === JSON.stringify(allStats)
  const seasonValid = validateSeasonState(UNIVERSE_V0, season).valid
  const validationPassed =
    seasonValid &&
    isRegularSeasonComplete(season) &&
    Object.keys(season.resultsByGameId).length === schedule.games.length &&
    allStats.length === expectedStatLines &&
    aggregationMatches &&
    gamesPlayedValid &&
    finite &&
    roundTripValid

  process.stdout.write(
    'COLLEGE HOOPS SIM — PLAYER SEASON STATS V0 INSPECTION\n\n' +
      `Programs: ${Object.keys(season.programStates).length}\n` +
      `Completed games: ${Object.keys(season.resultsByGameId).length} / ${schedule.games.length}\n` +
      `Season complete: ${isRegularSeasonComplete(season) ? 'YES' : 'NO'}\n` +
      `Player stat lines: ${allStats.length}\n` +
      `Validation: ${passFail(validationPassed)}\n\n`,
  )

  const programState = season.programStates[INSPECTION_PROGRAM_ID]

  if (!programState) {
    throw new Error(`Missing inspection Program "${INSPECTION_PROGRAM_ID}".`)
  }

  const rosterById = new Map(
    programState.team.roster.map((player) => [player.id, player] as const),
  )
  const programStats = deriveProgramPlayerSeasonStats(
    season,
    INSPECTION_PROGRAM_ID,
  ).sort(
    (first, second) =>
      second.minutes - first.minutes ||
      second.points - first.points ||
      first.playerId.localeCompare(second.playerId),
  )

  process.stdout.write(
    'CHARLOTTE TECH ROSTER STATS\n' +
      `${renderTable(
        [
          'PLAYER',
          'POS',
          'CL',
          'GP',
          'MPG',
          'PPG',
          'RPG',
          'APG',
          'SPG',
          'BPG',
          'FG%',
          '3P%',
          'FT%',
        ],
        programStats.map((row) => {
          const currentPlayer = rosterById.get(row.playerId)!

          return [
            playerName(currentPlayer),
            currentPlayer.position,
            currentPlayer.classYear,
            row.gamesPlayed,
            fixed(row.minutesPerGame),
            fixed(row.pointsPerGame),
            fixed(row.reboundsPerGame),
            fixed(row.assistsPerGame),
            fixed(row.stealsPerGame),
            fixed(row.blocksPerGame),
            percentage(row.fieldGoalPercentage),
            percentage(row.threePointPercentage),
            percentage(row.freeThrowPercentage),
          ]
        }),
      )}\n\n`,
  )

  const leader = (
    field: 'pointsPerGame' | 'reboundsPerGame' | 'assistsPerGame',
  ) =>
    [...programStats].sort(
      (first, second) =>
        second[field] - first[field] ||
        second.gamesPlayed - first.gamesPlayed ||
        first.playerId.localeCompare(second.playerId),
    )[0]!
  const scoringLeader = leader('pointsPerGame')

  process.stdout.write(
    'CHARLOTTE TECH LEADERS\n' +
      `PPG: ${playerName(rosterById.get(scoringLeader.playerId)!)} — ${fixed(scoringLeader.pointsPerGame)}\n` +
      `RPG: ${playerName(rosterById.get(leader('reboundsPerGame').playerId)!)} — ${fixed(leader('reboundsPerGame').reboundsPerGame)}\n` +
      `APG: ${playerName(rosterById.get(leader('assistsPerGame').playerId)!)} — ${fixed(leader('assistsPerGame').assistsPerGame)}\n\n`,
  )

  const playerMetadata = new Map(
    Object.entries(season.programStates).flatMap(([programId, state]) =>
      state.team.roster.map(
        (currentPlayer) =>
          [currentPlayer.id, { player: currentPlayer, programId }] as const,
      ),
    ),
  )
  const programNames = new Map<string, string>(
    UNIVERSE_V0.programs.map(({ id, name }) => [id, name] as const),
  )
  const nationalScoring = [...allStats]
    .filter(({ gamesPlayed }) => gamesPlayed > 0)
    .sort(
      (first, second) =>
        second.pointsPerGame - first.pointsPerGame ||
        second.points - first.points ||
        first.playerId.localeCompare(second.playerId),
    )
    .slice(0, 10)

  process.stdout.write(
    'NATIONAL SCORING SAMPLE\n' +
      `${renderTable(
        ['PLAYER', 'PROGRAM', 'GP', 'PPG', 'RPG', 'APG'],
        nationalScoring.map((row) => {
          const metadata = playerMetadata.get(row.playerId)!

          return [
            playerName(metadata.player),
            programNames.get(metadata.programId) ?? metadata.programId,
            row.gamesPlayed,
            fixed(row.pointsPerGame),
            fixed(row.reboundsPerGame),
            fixed(row.assistsPerGame),
          ]
        }),
      )}\n\n`,
  )

  const gameLog = getPlayerGameLog(
    season,
    INSPECTION_PROGRAM_ID,
    scoringLeader.playerId,
  )

  process.stdout.write(
    `PLAYER GAME LOG — ${playerName(rosterById.get(scoringLeader.playerId)!)}\n` +
      `${renderTable(
        ['ROUND', 'H/A', 'OPPONENT', 'RESULT', 'MIN', 'PTS', 'REB', 'AST'],
        gameLog.map((entry) => [
          entry.round,
          entry.location === 'home' ? 'H' : 'A',
          programNames.get(entry.opponentProgramId) ?? entry.opponentProgramId,
          `${entry.result} ${entry.teamScore}-${entry.opponentScore}`,
          entry.didPlay ? entry.stats.minutes : 'DNP',
          entry.stats.points,
          entry.stats.rebounds,
          entry.stats.assists,
        ]),
      )}\n\n`,
  )

  process.stdout.write(
    'AGGREGATION CHECKS\n' +
      `Season totals match raw PlayerGameStats: ${passFail(aggregationMatches)}\n` +
      `Zero-minute GP semantics: ${passFail(gamesPlayedValid)}\n` +
      `No NaN / Infinity: ${passFail(finite)}\n` +
      `JSON roundtrip: ${passFail(roundTripValid)}\n`,
  )
}

main()
