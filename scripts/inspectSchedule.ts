import {
  generateRegularSeasonSchedule,
  getGamesForProgram,
  validateRegularSeasonSchedule,
  type RegularSeasonSchedule,
} from '../src/schedule'
import {
  UNIVERSE_V0,
  type ProgramDefinition,
  type UniverseDefinition,
} from '../src/universe'

const SCHEDULE_SEED = 'schedule-inspection-v0'
const SAMPLE_PROGRAM_IDS = [
  'great-lakes',
  'charlotte-tech',
  'capital-state',
  'pine-valley',
] as const

type TableCell = string | number

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

function pairKey(firstId: string, secondId: string): string {
  return [firstId, secondId].sort().join('/')
}

function getOpponentId(
  programId: string,
  homeProgramId: string,
  awayProgramId: string,
): string {
  return homeProgramId === programId ? awayProgramId : homeProgramId
}

function nonConferenceSignature(schedule: RegularSeasonSchedule): string {
  return schedule.games
    .filter(({ type }) => type === 'nonconference')
    .map(
      ({ homeProgramId, awayProgramId, round }) =>
        `${round}:${homeProgramId}:${awayProgramId}`,
    )
    .join('|')
}

function printSampleSchedule(
  schedule: RegularSeasonSchedule,
  programId: string,
): void {
  const program = UNIVERSE_V0.programs.find(({ id }) => id === programId)

  if (!program) {
    throw new Error(`Unknown sample Program "${programId}".`)
  }

  const rows = getGamesForProgram(schedule, programId).map((game) => {
    const opponentId = getOpponentId(
      programId,
      game.homeProgramId,
      game.awayProgramId,
    )
    const opponent = UNIVERSE_V0.programs.find(({ id }) => id === opponentId)
    const opponentConference = UNIVERSE_V0.conferences.find(
      ({ id }) => id === opponent?.conferenceId,
    )

    return [
      game.round,
      game.homeProgramId === programId ? 'H' : 'A',
      opponent?.name ?? opponentId,
      opponentConference?.name ?? opponent?.conferenceId ?? 'UNKNOWN',
      game.type === 'conference' ? 'CONF' : 'NONCONF',
    ]
  })

  process.stdout.write(
    `${program.name.toLocaleUpperCase('en-US')} — 24-GAME SCHEDULE\n` +
      `${renderTable(
        ['ROUND', 'H/A', 'OPPONENT', 'OPPONENT CONFERENCE', 'TYPE'],
        rows,
      )}\n\n`,
  )
}

function main(): void {
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: SCHEDULE_SEED,
  })
  const validation = validateRegularSeasonSchedule(UNIVERSE_V0, schedule)
  const repeated = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: SCHEDULE_SEED,
  })
  const reversedUniverse: UniverseDefinition = {
    ...UNIVERSE_V0,
    conferences: [...UNIVERSE_V0.conferences].reverse(),
    programs: [...UNIVERSE_V0.programs].reverse(),
  }
  const reversed = generateRegularSeasonSchedule({
    universe: reversedUniverse,
    seed: SCHEDULE_SEED,
  })
  const alternate = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: `${SCHEDULE_SEED}:alternate`,
  })
  const programCounts = UNIVERSE_V0.programs.map((program) => {
    const games = getGamesForProgram(schedule, program.id)
    const conferenceGames = games.filter(({ type }) => type === 'conference')
    const nonConferenceGames = games.filter(
      ({ type }) => type === 'nonconference',
    )

    return {
      total: games.length,
      conference: conferenceGames.length,
      nonconference: nonConferenceGames.length,
      home: games.filter(({ homeProgramId }) => homeProgramId === program.id)
        .length,
      away: games.filter(({ awayProgramId }) => awayProgramId === program.id)
        .length,
      nonConferenceHome: nonConferenceGames.filter(
        ({ homeProgramId }) => homeProgramId === program.id,
      ).length,
    }
  })

  process.stdout.write(
    'COLLEGE HOOPS SIM — SCHEDULE V0 INSPECTION\n' +
      `Deterministic schedule seed: ${SCHEDULE_SEED}\n\n` +
      'SUMMARY\n' +
      `Programs: ${UNIVERSE_V0.programs.length}\n` +
      `Rounds: ${schedule.roundCount}\n` +
      `Regular-season games: ${schedule.games.length}\n` +
      `Games per Team: ${Math.min(...programCounts.map(({ total }) => total))} / ${Math.max(...programCounts.map(({ total }) => total))} min/max\n` +
      `Conference games: ${schedule.games.filter(({ type }) => type === 'conference').length} (${Math.min(...programCounts.map(({ conference }) => conference))} per Team)\n` +
      `Non-conference games: ${schedule.games.filter(({ type }) => type === 'nonconference').length} (${Math.min(...programCounts.map(({ nonconference }) => nonconference))} per Team)\n` +
      `Home/Away per Team: ${Math.min(...programCounts.map(({ home }) => home))} / ${Math.min(...programCounts.map(({ away }) => away))}\n` +
      `Validation: ${validation.valid ? 'PASS' : 'FAIL'}\n\n`,
  )

  for (const programId of SAMPLE_PROGRAM_IDS) {
    printSampleSchedule(schedule, programId)
  }

  const conferenceRows = UNIVERSE_V0.conferences.map((conference) => {
    const memberIds = new Set<string>(
      UNIVERSE_V0.programs
        .filter(({ conferenceId }) => conferenceId === conference.id)
        .map(({ id }) => id),
    )
    const conferenceGames = schedule.games.filter(
      ({ homeProgramId, awayProgramId, type }) =>
        type === 'conference' &&
        memberIds.has(homeProgramId) &&
        memberIds.has(awayProgramId),
    )
    const pairings = new Map<string, string[]>()

    for (const game of conferenceGames) {
      const key = pairKey(game.homeProgramId, game.awayProgramId)
      const hosts = pairings.get(key) ?? []
      hosts.push(game.homeProgramId)
      pairings.set(key, hosts)
    }

    const reciprocal = [...pairings.values()].every(
      (hosts) => hosts.length === 2 && new Set(hosts).size === 2,
    )
    const everyTeamHasFourteen = [...memberIds].every(
      (programId) =>
        getGamesForProgram(schedule, programId).filter(
          ({ type }) => type === 'conference',
        ).length === 14,
    )

    return [
      conference.name,
      conferenceGames.length,
      pairings.size,
      everyTeamHasFourteen ? 'PASS' : 'FAIL',
      reciprocal ? 'PASS' : 'FAIL',
    ]
  })

  process.stdout.write(
    'CONFERENCE DIAGNOSTICS\n' +
      `${renderTable(
        ['CONFERENCE', 'GAMES', 'PAIRS', '14 EACH', 'RECIPROCAL H/A'],
        conferenceRows,
      )}\n\n`,
  )

  const nonConferenceGames = schedule.games.filter(
    ({ type }) => type === 'nonconference',
  )
  const programById = new Map<string, ProgramDefinition>(
    UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
  )
  const nonConferencePairCounts = new Map<string, number>()
  const conferencePairCounts = new Map<string, number>()

  for (const game of nonConferenceGames) {
    const key = pairKey(game.homeProgramId, game.awayProgramId)
    const homeConferenceId = programById.get(game.homeProgramId)?.conferenceId
    const awayConferenceId = programById.get(game.awayProgramId)?.conferenceId
    nonConferencePairCounts.set(
      key,
      (nonConferencePairCounts.get(key) ?? 0) + 1,
    )

    if (homeConferenceId && awayConferenceId) {
      const conferenceKey = pairKey(homeConferenceId, awayConferenceId)
      conferencePairCounts.set(
        conferenceKey,
        (conferencePairCounts.get(conferenceKey) ?? 0) + 1,
      )
    }
  }

  const duplicateNonConferenceMatchups = [
    ...nonConferencePairCounts.values(),
  ].filter((count) => count > 1).length
  const crossConferenceOnly = nonConferenceGames.every(
    ({ homeProgramId, awayProgramId }) =>
      programById.get(homeProgramId)?.conferenceId !==
      programById.get(awayProgramId)?.conferenceId,
  )
  const conferencePairRows = [...conferencePairCounts]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([pair, count]) => [pair.replace('/', ' / '), count])

  process.stdout.write(
    'NON-CONFERENCE DIAGNOSTICS\n' +
      `Games per Team min/max: ${Math.min(...programCounts.map(({ nonconference }) => nonconference))} / ${Math.max(...programCounts.map(({ nonconference }) => nonconference))}\n` +
      `Home games per Team min/max: ${Math.min(...programCounts.map(({ nonConferenceHome }) => nonConferenceHome))} / ${Math.max(...programCounts.map(({ nonConferenceHome }) => nonConferenceHome))}\n` +
      `Duplicate matchups: ${duplicateNonConferenceMatchups}\n` +
      `Cross-conference only: ${crossConferenceOnly ? 'PASS' : 'FAIL'}\n` +
      `${renderTable(['CONFERENCE PAIR', 'GAMES'], conferencePairRows)}\n\n`,
  )

  let validSampleCount = 0

  for (let index = 0; index < 100; index += 1) {
    const sampledSchedule = generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: `schedule-inspection-sample-${index}`,
    })

    if (validateRegularSeasonSchedule(UNIVERSE_V0, sampledSchedule).valid) {
      validSampleCount += 1
    }
  }

  process.stdout.write(
    'DETERMINISM AND STRUCTURAL SAMPLE\n' +
      `Same-seed reproduction: ${JSON.stringify(schedule) === JSON.stringify(repeated) ? 'PASS' : 'FAIL'}\n` +
      `Program/Conference-order independence: ${JSON.stringify(schedule) === JSON.stringify(reversed) ? 'PASS' : 'FAIL'}\n` +
      `Different seed changes non-conference schedule: ${nonConferenceSignature(schedule) !== nonConferenceSignature(alternate) ? 'PASS' : 'FAIL'}\n` +
      `Valid schedules: ${validSampleCount} / 100\n`,
  )
}

main()
