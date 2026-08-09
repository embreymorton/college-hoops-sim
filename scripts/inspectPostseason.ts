import { generateRegularSeasonSchedule } from '../src/schedule'
import {
  deriveConferenceRecord,
  deriveProgramRecord,
  initializeSeason,
  isRegularSeasonComplete,
  simulatePendingGamesInRound,
  type SeasonState,
} from '../src/season'
import {
  deriveNationalChampion,
  getGamesForTournamentRound,
  initializePostseason,
  resolveTournamentGameParticipants,
  selectNationalTournamentField,
  simulatePendingGamesInTournamentRound,
  simulateTournamentGame,
  validateNationalTournamentBracket,
  validatePostseasonState,
  validateTournamentSelection,
  type PostseasonState,
  type TournamentRound,
} from '../src/postseason'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const REGULAR_SEASON_SEED = 'postseason-inspection-regular-v0'
const TOURNAMENT_SEED = 'postseason-inspection-tournament-v0'
const BALANCE_SAMPLE_SIZE = 200
const ROUNDS: readonly TournamentRound[] = [
  'round-of-16',
  'quarterfinals',
  'semifinals',
  'championship',
]

function completeRegularSeason(season: SeasonState): SeasonState {
  let current = season
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed: REGULAR_SEASON_SEED,
    })
  }
  return current
}

function completeTournament(
  postseason: PostseasonState,
  simulationSeed: string,
): PostseasonState {
  return ROUNDS.reduce(
    (current, round) =>
      simulatePendingGamesInTournamentRound({
        postseason: current,
        round,
        simulationSeed,
      }),
    postseason,
  )
}

function name(programId: string): string {
  return UNIVERSE_V0.programs.find(({ id }) => id === programId)?.name ?? programId
}

function conferenceName(programId: string): string {
  const conferenceId = UNIVERSE_V0.programs.find(({ id }) => id === programId)?.conferenceId
  return UNIVERSE_V0.conferences.find(({ id }) => id === conferenceId)?.name ?? 'Unknown'
}

function record(season: SeasonState, programId: string): string {
  const overall = deriveProgramRecord(season, programId)
  return `${overall.wins}-${overall.losses}`
}

function conferenceRecord(season: SeasonState, programId: string): string {
  const conference = deriveConferenceRecord(season, programId)
  return `${conference.wins}-${conference.losses}`
}

function seedFor(postseason: PostseasonState, programId: string): number {
  return postseason.field.find((entry) => entry.programId === programId)!.seed
}

function printRound(postseason: PostseasonState, round: TournamentRound): void {
  const title = round === 'championship' ? 'NATIONAL CHAMPIONSHIP' : round.replaceAll('-', ' ').toUpperCase()
  process.stdout.write(`${title}\n`)
  for (const game of getGamesForTournamentRound(postseason, round)) {
    const result = postseason.resultsByGameId[game.id]!
    const homeSeed = seedFor(postseason, result.homeTeamId)
    const awaySeed = seedFor(postseason, result.awayTeamId)
    const upset =
      result.winnerId === result.homeTeamId
        ? homeSeed > awaySeed
        : awaySeed > homeSeed
    process.stdout.write(
      `#${homeSeed} ${name(result.homeTeamId)} ${result.homeScore}  ` +
        `#${awaySeed} ${name(result.awayTeamId)} ${result.awayScore}` +
        `${upset ? '  UPSET' : ''}\n`,
    )
  }
  process.stdout.write('\n')
}

function main(): void {
  const initialized = initializeUniverse(UNIVERSE_V0, 'postseason-inspection-universe-v0')
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: 'postseason-inspection-schedule-v0',
  })
  const season = completeRegularSeason(
    initializeSeason({
      universe: UNIVERSE_V0,
      initializedUniverse: initialized,
      schedule,
      seasonNumber: 1,
    }),
  )
  const selection = selectNationalTournamentField(UNIVERSE_V0, season)
  const initial = initializePostseason({ universe: UNIVERSE_V0, season })
  const completed = completeTournament(initial, TOURNAMENT_SEED)

  process.stdout.write(
    'COLLEGE HOOPS SIM — POSTSEASON V0 INSPECTION\n\n' +
      'REGULAR-SEASON ENDPOINT\n' +
      `Programs: ${UNIVERSE_V0.programs.length}\n` +
      `Regular-season games: ${Object.keys(season.resultsByGameId).length} / ${season.schedule.games.length}\n` +
      `Season complete: ${isRegularSeasonComplete(season) ? 'YES' : 'NO'}\n\n` +
      'TOURNAMENT FIELD\n' +
      'SEED  BID        PROGRAM                  OVERALL  CONF    CONFERENCE\n',
  )
  for (const entry of selection.field) {
    process.stdout.write(
      `${String(entry.seed).padEnd(6)}` +
        `${(entry.bidType === 'automatic' ? 'AUTO' : 'AT-LARGE').padEnd(11)}` +
        `${name(entry.programId).padEnd(25)}` +
        `${record(season, entry.programId).padEnd(9)}` +
        `${conferenceRecord(season, entry.programId).padEnd(8)}` +
        `${conferenceName(entry.programId)}\n`,
    )
  }

  process.stdout.write('\nFIRST FOUR OUT\nPROGRAM                  OVERALL  CONF    CONFERENCE\n')
  for (const programId of selection.firstFourOutProgramIds) {
    process.stdout.write(
      `${name(programId).padEnd(25)}` +
        `${record(season, programId).padEnd(9)}` +
        `${conferenceRecord(season, programId).padEnd(8)}` +
        `${conferenceName(programId)}\n`,
    )
  }

  process.stdout.write('\nROUND OF 16 BRACKET\n')
  for (const game of getGamesForTournamentRound(initial, 'round-of-16')) {
    const participants = resolveTournamentGameParticipants(initial, game.id)!
    process.stdout.write(
      `#${seedFor(initial, participants.homeProgramId)} ${name(participants.homeProgramId)} vs ` +
        `#${seedFor(initial, participants.awayProgramId)} ${name(participants.awayProgramId)}\n`,
    )
  }
  process.stdout.write('\n')
  for (const round of ROUNDS) printRound(completed, round)

  const championId = deriveNationalChampion(completed)!
  const reproduction = completeTournament(initial, TOURNAMENT_SEED)
  const forward = ['national-r16-g1', 'national-r16-g2'].reduce(
    (state, tournamentGameId) =>
      simulateTournamentGame({
        postseason: state,
        tournamentGameId,
        simulationSeed: TOURNAMENT_SEED,
      }),
    initial,
  )
  const reverse = ['national-r16-g2', 'national-r16-g1'].reduce(
    (state, tournamentGameId) =>
      simulateTournamentGame({
        postseason: state,
        tournamentGameId,
        simulationSeed: TOURNAMENT_SEED,
      }),
    initial,
  )
  const alternate = completeTournament(initial, `${TOURNAMENT_SEED}:alternate`)

  process.stdout.write(
    'NATIONAL CHAMPION\n' +
      `${name(championId)}\n` +
      `Seed: ${seedFor(completed, championId)}\n\n` +
      'DETERMINISM\n' +
      `Same-seed tournament reproduction: ${JSON.stringify(reproduction.resultsByGameId) === JSON.stringify(completed.resultsByGameId) ? 'PASS' : 'FAIL'}\n` +
      `Ready-game execution-order independence: ${JSON.stringify(forward.resultsByGameId) === JSON.stringify(reverse.resultsByGameId) ? 'PASS' : 'FAIL'}\n` +
      `Different simulation seed changes Tournament outcomes: ${JSON.stringify(alternate.resultsByGameId) !== JSON.stringify(completed.resultsByGameId) ? 'PASS' : 'FAIL'}\n\n` +
      'VALIDATION\n' +
      `Field validation: ${validateTournamentSelection(UNIVERSE_V0, season, selection.field).valid ? 'PASS' : 'FAIL'}\n` +
      `Bracket validation: ${validateNationalTournamentBracket(initial.bracket).valid ? 'PASS' : 'FAIL'}\n` +
      `Final Postseason validation: ${validatePostseasonState(UNIVERSE_V0, completed).valid ? 'PASS' : 'FAIL'}\n` +
      `Tournament games completed: ${Object.keys(completed.resultsByGameId).length} / 15\n\n`,
  )

  const matchupWins = Array.from({ length: 8 }, () => 0)
  const championBands = [0, 0, 0, 0]
  for (let sample = 0; sample < BALANCE_SAMPLE_SIZE; sample += 1) {
    const tournament = completeTournament(initial, `postseason-balance-${sample}`)
    for (const [index, game] of getGamesForTournamentRound(tournament, 'round-of-16').entries()) {
      const result = tournament.resultsByGameId[game.id]!
      const higherSeed = Math.min(
        seedFor(tournament, result.homeTeamId),
        seedFor(tournament, result.awayTeamId),
      )
      if (seedFor(tournament, result.winnerId) === higherSeed) matchupWins[index]! += 1
    }
    const championSeed = seedFor(tournament, deriveNationalChampion(tournament)!)
    championBands[Math.floor((championSeed - 1) / 4)]! += 1
  }
  process.stdout.write(`BALANCE DIAGNOSTIC (${BALANCE_SAMPLE_SIZE} TOURNAMENTS)\n`)
  for (const [index, game] of getGamesForTournamentRound(initial, 'round-of-16').entries()) {
    const participants = resolveTournamentGameParticipants(initial, game.id)!
    process.stdout.write(
      `#${seedFor(initial, participants.homeProgramId)} vs #${seedFor(initial, participants.awayProgramId)} higher-seed wins: ` +
        `${((matchupWins[index]! / BALANCE_SAMPLE_SIZE) * 100).toFixed(1)}%\n`,
    )
  }
  process.stdout.write('Champion seed bands:\n')
  ;['1-4', '5-8', '9-12', '13-16'].forEach((label, index) => {
    process.stdout.write(
      `${label}: ${((championBands[index]! / BALANCE_SAMPLE_SIZE) * 100).toFixed(1)}%\n`,
    )
  })
}

main()
