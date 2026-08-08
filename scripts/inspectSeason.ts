import { calculateTeamStrength } from '../src/engine'
import { generateRegularSeasonSchedule, type ScheduledGame } from '../src/schedule'
import {
  deriveConferenceRecord,
  deriveConferenceStandings,
  deriveProgramRecord,
  getCompletedGamesForRound,
  getCurrentRound,
  getGamesForRound,
  initializeSeason,
  isRegularSeasonComplete,
  simulatePendingGamesInRound,
  simulateScheduledGame,
  validateSeasonState,
  type SeasonState,
  type StandingRow,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const UNIVERSE_SEED = 'full-season-inspection-universe-v0'
const SCHEDULE_SEED = 'full-season-inspection-schedule-v0'
const SIMULATION_SEED = 'full-season-inspection-simulation-v0'
const DIFFERENT_SIMULATION_SEED = 'full-season-inspection-simulation-alternate'
const MULTI_SEASON_SAMPLE_SIZE = 50
const EXCLUDED_PROGRAM_ID = 'charlotte-tech'
const EXAMPLE_PROGRAM_IDS = [
  'great-lakes',
  'charlotte-tech',
  'capital-state',
  'pine-valley',
] as const

const initializedUniverse = initializeUniverse(UNIVERSE_V0, UNIVERSE_SEED)
const schedule = generateRegularSeasonSchedule({
  universe: UNIVERSE_V0,
  seed: SCHEDULE_SEED,
})

function createSeason(): SeasonState {
  return initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule,
    seasonNumber: 1,
  })
}

function completeSeason(
  season: SeasonState,
  simulationSeed: string,
): SeasonState {
  let current = season

  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed,
    })
  }

  return current
}

function recordGamesIndividually(
  season: SeasonState,
  games: readonly ScheduledGame[],
  simulationSeed: string,
): SeasonState {
  return games.reduce(
    (current, game) =>
      simulateScheduledGame({
        season: current,
        scheduledGameId: game.id,
        simulationSeed,
      }),
    season,
  )
}

function yesNo(value: boolean): string {
  return value ? 'YES' : 'NO'
}

function record(wins: number, losses: number): string {
  return `${wins}-${losses}`
}

function programName(programId: string): string {
  return (
    UNIVERSE_V0.programs.find(({ id }) => id === programId)?.name ?? programId
  )
}

function writeStandings(title: string, rows: readonly StandingRow[]): void {
  process.stdout.write(`${title.toUpperCase()}\n`)
  process.stdout.write('   TEAM                     OVERALL   CONF\n')

  rows.forEach((row, index) => {
    process.stdout.write(
      `${String(index + 1).padStart(2)}. ` +
        `${programName(row.programId).padEnd(24)} ` +
        `${record(row.wins, row.losses).padEnd(9)} ` +
        `${record(row.conferenceWins, row.conferenceLosses)}\n`,
    )
  })
}

function sameGameOutcomes(
  first: SeasonState,
  second: SeasonState,
  games: readonly ScheduledGame[],
): boolean {
  return games.every(
    ({ id }) =>
      JSON.stringify(first.resultsByGameId[id]) ===
      JSON.stringify(second.resultsByGameId[id]),
  )
}

function outcomesDiffer(first: SeasonState, second: SeasonState): boolean {
  return first.schedule.games.some(({ id }) => {
    const firstResult = first.resultsByGameId[id]
    const secondResult = second.resultsByGameId[id]

    return (
      firstResult?.homeScore !== secondResult?.homeScore ||
      firstResult?.awayScore !== secondResult?.awayScore ||
      firstResult?.winnerId !== secondResult?.winnerId
    )
  })
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

function correlation(first: readonly number[], second: readonly number[]): number {
  const firstAverage = average(first)
  const secondAverage = average(second)
  let covariance = 0
  let firstVariance = 0
  let secondVariance = 0

  for (let index = 0; index < first.length; index += 1) {
    const firstDifference = first[index]! - firstAverage
    const secondDifference = second[index]! - secondAverage
    covariance += firstDifference * secondDifference
    firstVariance += firstDifference ** 2
    secondVariance += secondDifference ** 2
  }

  return covariance / Math.sqrt(firstVariance * secondVariance)
}

function writeMultiSeasonDiagnostics(): void {
  const winsByProgram = new Map(
    UNIVERSE_V0.programs.map(({ id }) => [id, [] as number[]]),
  )

  for (let index = 0; index < MULTI_SEASON_SAMPLE_SIZE; index += 1) {
    const simulationSeed = JSON.stringify({
      namespace: 'full-season-strength-diagnostic:v0',
      index,
    })
    const season = completeSeason(createSeason(), simulationSeed)

    for (const program of UNIVERSE_V0.programs) {
      winsByProgram.get(program.id)!.push(
        deriveProgramRecord(season, program.id).wins,
      )
    }
  }

  const bands = [
    { label: '85+', includes: (prestige: number) => prestige >= 85 },
    {
      label: '70-84',
      includes: (prestige: number) => prestige >= 70 && prestige < 85,
    },
    {
      label: '55-69',
      includes: (prestige: number) => prestige >= 55 && prestige < 70,
    },
    { label: '<55', includes: (prestige: number) => prestige < 55 },
  ]

  process.stdout.write(
    `MULTI-SEASON STRENGTH DIAGNOSTIC (${MULTI_SEASON_SAMPLE_SIZE} SEASONS)\n` +
      'PRESTIGE   MEAN WINS   PROGRAM-AVG RANGE\n',
  )

  for (const band of bands) {
    const programs = UNIVERSE_V0.programs.filter(({ basePrestige }) =>
      band.includes(basePrestige),
    )
    const observations = programs.flatMap(({ id }) => winsByProgram.get(id)!)
    const programAverages = programs.map(({ id }) =>
      average(winsByProgram.get(id)!),
    )

    process.stdout.write(
      `${band.label.padEnd(10)} ` +
        `${average(observations).toFixed(2).padStart(9)}   ` +
        `${Math.min(...programAverages).toFixed(2)}-${Math.max(...programAverages).toFixed(2)}\n`,
    )
  }

  const strengths = UNIVERSE_V0.programs.map(({ id }) => {
    const state = createSeason().programStates[id]!
    return calculateTeamStrength(state.team, state.rotation).overall
  })
  const averageWins = UNIVERSE_V0.programs.map(({ id }) =>
    average(winsByProgram.get(id)!),
  )

  process.stdout.write(
    `Initial Team Strength / average wins correlation: ${correlation(strengths, averageWins).toFixed(3)}\n`,
  )
}

function main(): void {
  const initialSeason = createSeason()
  const initialValidation = validateSeasonState(UNIVERSE_V0, initialSeason)

  process.stdout.write(
    'COLLEGE HOOPS SIM — FULL SEASON V0 INSPECTION\n\n' +
      'SEEDS\n' +
      `Universe initialization: ${UNIVERSE_SEED}\n` +
      `Schedule generation:    ${SCHEDULE_SEED}\n` +
      `Season simulation:      ${SIMULATION_SEED}\n\n` +
      'INITIAL STATE\n' +
      `Programs: ${Object.keys(initialSeason.programStates).length}\n` +
      `Rounds: ${initialSeason.schedule.roundCount}\n` +
      `Scheduled games: ${initialSeason.schedule.games.length}\n` +
      `Completed games: ${Object.keys(initialSeason.resultsByGameId).length}\n` +
      `Current round: ${getCurrentRound(initialSeason)}\n` +
      `Season valid: ${yesNo(initialValidation.valid)}\n\n`,
  )

  const roundOne = getGamesForRound(initialSeason, 1)
  const excludedGame = roundOne.find(
    ({ homeProgramId, awayProgramId }) =>
      homeProgramId === EXCLUDED_PROGRAM_ID ||
      awayProgramId === EXCLUDED_PROGRAM_ID,
  )!
  const firstFive = roundOne
    .filter(({ id }) => id !== excludedGame.id)
    .slice(0, 5)
  const partial = recordGamesIndividually(
    initialSeason,
    firstFive,
    SIMULATION_SEED,
  )
  const afterAi = simulatePendingGamesInRound({
    season: partial,
    round: 1,
    simulationSeed: SIMULATION_SEED,
    excludedProgramIds: [EXCLUDED_PROGRAM_ID],
  })
  const roundOneComplete = simulateScheduledGame({
    season: afterAi,
    scheduledGameId: excludedGame.id,
    simulationSeed: SIMULATION_SEED,
  })

  process.stdout.write(
    'PARTIAL ROUND 1\n' +
      `Excluded Program: ${programName(EXCLUDED_PROGRAM_ID)}\n` +
      `Before AI simulation: ${getCompletedGamesForRound(partial, 1).length} / 16\n` +
      `After AI simulation:  ${getCompletedGamesForRound(afterAi, 1).length} / 16\n` +
      `Current round with excluded game pending: ${getCurrentRound(afterAi)}\n` +
      `After excluded game:  ${getCompletedGamesForRound(roundOneComplete, 1).length} / 16\n` +
      `Current round: ${getCurrentRound(roundOneComplete)}\n\n`,
  )

  let earlySeason = roundOneComplete
  for (let round = 2; round <= 4; round += 1) {
    earlySeason = simulatePendingGamesInRound({
      season: earlySeason,
      round,
      simulationSeed: SIMULATION_SEED,
    })
  }

  const earlyConference = UNIVERSE_V0.conferences.find(
    ({ id }) => id === 'lakes-union',
  )!
  writeStandings(
    `EARLY STANDINGS — ${earlyConference.name}`,
    deriveConferenceStandings(UNIVERSE_V0, earlySeason, earlyConference.id),
  )

  const complete = completeSeason(earlySeason, SIMULATION_SEED)
  const validation = validateSeasonState(UNIVERSE_V0, complete)

  process.stdout.write(
    '\nFULL REGULAR SEASON\n' +
      `Completed games: ${Object.keys(complete.resultsByGameId).length} / ${complete.schedule.games.length}\n` +
      `Season complete: ${yesNo(isRegularSeasonComplete(complete))}\n` +
      `Current round: ${getCurrentRound(complete) ?? 'none'}\n` +
      `Season validation: ${validation.valid ? 'PASS' : 'FAIL'}\n\n`,
  )

  for (const conference of UNIVERSE_V0.conferences) {
    writeStandings(
      conference.name,
      deriveConferenceStandings(UNIVERSE_V0, complete, conference.id),
    )
    process.stdout.write('\n')
  }

  process.stdout.write('PROGRAM EXAMPLES\n')
  for (const programId of EXAMPLE_PROGRAM_IDS) {
    const overall = deriveProgramRecord(complete, programId)
    const conference = deriveConferenceRecord(complete, programId)
    process.stdout.write(
      `${programName(programId).padEnd(24)} ` +
        `${record(overall.wins, overall.losses).padEnd(9)} ` +
        `CONF ${record(conference.wins, conference.losses)}\n`,
    )
  }

  const reproduced = completeSeason(createSeason(), SIMULATION_SEED)
  const orderGames = initialSeason.schedule.games.slice(0, 3)
  const forward = recordGamesIndividually(
    createSeason(),
    orderGames,
    SIMULATION_SEED,
  )
  const reverse = recordGamesIndividually(
    createSeason(),
    [...orderGames].reverse(),
    SIMULATION_SEED,
  )
  const different = completeSeason(createSeason(), DIFFERENT_SIMULATION_SEED)

  process.stdout.write(
    '\nDETERMINISM\n' +
      `Same-seed full-season reproduction: ${JSON.stringify(reproduced.resultsByGameId) === JSON.stringify(complete.resultsByGameId) ? 'PASS' : 'FAIL'}\n` +
      `Game execution-order independence: ${sameGameOutcomes(forward, reverse, orderGames) ? 'PASS' : 'FAIL'}\n` +
      `Different simulation seed changes Season outcomes: ${outcomesDiffer(complete, different) ? 'PASS' : 'FAIL'}\n\n`,
  )

  writeMultiSeasonDiagnostics()
}

main()
