import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import {
  CLASS_YEARS,
  POSITIONS,
  TEAM_ROSTER_SIZE,
  calculateOverall,
  validateRotationV1,
} from '../src/engine'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  deriveRemainingOpeningsByPosition,
  initializeDynastyState,
  initializeRecruiting,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from '../src/dynasty'
import {
  getGamesForTournamentRound,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../src/postseason'
import { generateRegularSeasonSchedule, validateRegularSeasonSchedule } from '../src/schedule'
import {
  initializeSeason,
  simulatePendingGamesInRound,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import {
  PRESTIGE_BANDS,
  auditIdentityCollisions,
  average,
  correlation,
  deriveDevelopmentRecords,
  extractSeasonTalentMetrics,
  extractSignedRecruitRecords,
  graduatingPlayers,
  linearSlope,
  playerCeilingRates,
  percentile,
  prestigeBand,
  serializedSizeBytes,
  summarizeDistribution,
  type DevelopmentRecord,
  type PlayerTalentRecord,
  type SeasonTalentMetrics,
  type SignedRecruitRecord,
} from './dynastyLongRunMetrics'
import type { AuditLevel } from './calibration/presets'
import { calibrationSeeds, resolveLongRunCliConfig } from './calibration/presets'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
const CHECKPOINTS = new Set([10, 25, 50])
const TRAJECTORY_SEASONS = new Set([1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 40, 50])

interface StateGrowthCheckpoint {
  readonly season: number
  readonly completedSeasons: number
  readonly recruitingClasses: number
  readonly bytes: number
}

interface RecruitingCycleMetric {
  readonly targetSeasonNumber: number
  readonly projectedOpenings: number
  readonly commitments: number
  readonly programClassSizes: readonly number[]
}

export interface TournamentStrengthRecord {
  readonly seasonNumber: number
  readonly programId: string
  readonly role: 'champion' | 'runnerUp' | 'semifinalist'
  readonly overall: number
}

interface StructuralHealth {
  invalidRosters: number
  invalidRotations: number
  invalidSchedules: number
  unfilledRecruitingOpenings: number
  playerIdCollisions: number
  gameIdCollisions: number
  historyCollisions: number
  historyOverwriteEvents: number
  emergencyRecruits: number
  fallbackMatcherUses: number
  unsignedFiveStarsWithCompatibleCapacity: number
  unsignedFourStarsWithCompatibleCapacity: number
  invalidFocusStates: number
  focusLimitViolations: number
  focusedRecruitNotOnBoard: number
  duplicateCommitments: number
  lifecycleFailures: number
  serializationFailures: number
}

export interface DynastyRunResult {
  readonly seed: string
  readonly seasons: readonly SeasonTalentMetrics[]
  readonly developments: readonly DevelopmentRecord[]
  readonly signedRecruits: readonly SignedRecruitRecord[]
  readonly recruitingCycles: readonly RecruitingCycleMetric[]
  readonly graduating: readonly PlayerTalentRecord[]
  readonly champions: Readonly<Record<string, number>>
  readonly semifinalAppearances: Readonly<Record<string, number>>
  readonly stateGrowth: readonly StateGrowthCheckpoint[]
  readonly tournamentStrengths: readonly TournamentStrengthRecord[]
  readonly health: StructuralHealth
  readonly rollovers: number
}

export interface LongRunCalibrationResult {
  readonly seeds: readonly string[]
  readonly seasonsPerSeed: number
  readonly runs: readonly DynastyRunResult[]
}

function createDynasty(seed: string): DynastyState {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  const activeSeason = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: `${seed}:season-1:schedule`,
      gameIdNamespace: 'season-1',
    }),
    seasonNumber: 1,
  })
  return initializeRecruiting(initializeDynastyState({
    dynastyId: `long-run:${seed}`,
    dynastySeed: seed,
    controlledProgramId: CONTROLLED_PROGRAM_ID,
    universe: UNIVERSE_V0,
    activeSeason,
  }))
}

function emptyHealth(): StructuralHealth {
  return {
    invalidRosters: 0,
    invalidRotations: 0,
    invalidSchedules: 0,
    unfilledRecruitingOpenings: 0,
    playerIdCollisions: 0,
    gameIdCollisions: 0,
    historyCollisions: 0,
    historyOverwriteEvents: 0,
    emergencyRecruits: 0,
    fallbackMatcherUses: 0,
    unsignedFiveStarsWithCompatibleCapacity: 0,
    unsignedFourStarsWithCompatibleCapacity: 0,
    invalidFocusStates: 0,
    focusLimitViolations: 0,
    focusedRecruitNotOnBoard: 0,
    duplicateCommitments: 0,
    lifecycleFailures: 0,
    serializationFailures: 0,
  }
}

function snapshotHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function auditActiveSeason(dynasty: DynastyState, health: StructuralHealth): void {
  const season = dynasty.activeSeason!
  const programs = Object.values(season.programStates)
  const players = programs.flatMap(({ team }) => team.roster)
  health.invalidRosters += Number(
    programs.length !== UNIVERSE_V0.programs.length ||
    players.length !== UNIVERSE_V0.programs.length * TEAM_ROSTER_SIZE ||
    programs.some(({ team }) => team.roster.length !== TEAM_ROSTER_SIZE),
  )
  health.invalidRotations += programs.filter(
    ({ team, rotation }) => !validateRotationV1(team, rotation).valid,
  ).length
  health.invalidSchedules += Number(
    !validateRegularSeasonSchedule(UNIVERSE_V0, season.schedule).valid,
  )
  health.playerIdCollisions += players.length - new Set(
    players.map(({ id }) => id),
  ).size
}

function playerRecords(
  seasonNumber: number,
  players: ReturnType<typeof graduatingPlayers>,
  programIdByPlayerId: Readonly<Record<string, string>>,
): PlayerTalentRecord[] {
  return players.map((player) => ({
    seasonNumber,
    playerId: player.id,
    programId: programIdByPlayerId[player.id]!,
    classYear: player.classYear,
    position: player.position,
    overall: calculateOverall(player),
    potential: player.potential,
  }))
}

function countCompatibleUnsignedPremium(
  dynasty: DynastyState,
  stars: 4 | 5,
): number {
  const recruiting = dynasty.recruiting!
  return recruiting.recruits.filter((recruit) =>
    recruit.stars === stars &&
    !recruiting.commitmentsByPlayerId[recruit.player.id] &&
    Object.values(recruiting.programs).some((program) =>
      deriveRemainingOpeningsByPosition(recruiting, program)[recruit.player.position] > 0,
    ),
  ).length
}

/** Tooling-only audit of the persisted Board-based Focus representation. */
function auditRecruitingFocus(dynasty: DynastyState, health: StructuralHealth): void {
  const recruiting = dynasty.recruiting!
  for (const program of Object.values(recruiting.programs)) {
    const focused = program.board.filter(({ isFocused }) => isFocused)
    health.focusLimitViolations += Number(focused.length > 3)
    const boardIds = new Set(program.board.map(({ playerId }) => playerId))
    health.focusedRecruitNotOnBoard += focused.filter(
      ({ playerId }) => !boardIds.has(playerId),
    ).length
    health.invalidFocusStates += focused.filter(({ playerId }) =>
      recruiting.commitmentsByPlayerId[playerId] !== undefined,
    ).length
  }
  const commitments = Object.values(recruiting.commitmentsByPlayerId)
  health.duplicateCommitments += commitments.length - new Set(
    commitments.map(({ playerId }) => playerId),
  ).size
}

export function runDynastyCalibration(
  seed: string,
  seasonsToComplete: number,
  auditLevel: AuditLevel = 'full',
): DynastyRunResult {
  let dynasty = createDynasty(seed)
  const seasons: SeasonTalentMetrics[] = []
  const developments: DevelopmentRecord[] = []
  const signedRecruits: SignedRecruitRecord[] = []
  const recruitingCycles: RecruitingCycleMetric[] = []
  const graduating: PlayerTalentRecord[] = []
  const champions: Record<string, number> = {}
  const semifinalAppearances: Record<string, number> = {}
  const stateGrowth: StateGrowthCheckpoint[] = []
  const tournamentStrengths: TournamentStrengthRecord[] = []
  const health = emptyHealth()
  const historicalGameIds = new Set<string>()
  const knownPersonIds = new Set<string>()
  let archivedSeasonSnapshots: string[] = []
  let archivedRecruitingSnapshots: string[] = []
  let rollovers = 0

  try {
    for (let iteration = 0; iteration < seasonsToComplete; iteration += 1) {
      auditActiveSeason(dynasty, health)
      let season = dynasty.activeSeason!
      const activePlayerIds = Object.values(season.programStates).flatMap(
        ({ team }) => team.roster.map(({ id }) => id),
      )
      for (const id of activePlayerIds) knownPersonIds.add(id)
      const programIdByPlayerId = Object.fromEntries(
        Object.entries(season.programStates).flatMap(([programId, { team }]) =>
          team.roster.map(({ id }) => [id, programId]),
        ),
      )

      for (let round = 1; round <= season.schedule.roundCount; round += 1) {
        season = simulatePendingGamesInRound({
          season,
          round,
          simulationSeed: `${seed}:season-${season.seasonNumber}:games`,
        })
        dynasty = syncRecruitingThroughCompletedRounds({
          ...dynasty,
          activeSeason: season,
        })
      }
      const seasonMetrics = extractSeasonTalentMetrics(season)
      seasons.push(seasonMetrics)
      graduating.push(...playerRecords(
        season.seasonNumber,
        graduatingPlayers(season),
        programIdByPlayerId,
      ))

      if (auditLevel === 'full') {
        for (const game of season.schedule.games) {
          if (historicalGameIds.has(game.id)) health.gameIdCollisions += 1
          historicalGameIds.add(game.id)
        }
      }

      let postseason = initializePostseason({ universe: dynasty.universe, season })
      for (const round of TOURNAMENT_ROUNDS) {
        postseason = simulatePendingGamesInTournamentRound({
          postseason,
          round,
          simulationSeed: `${seed}:season-${season.seasonNumber}:postseason`,
        })
        dynasty = syncRecruitingThroughCompletedPostseasonRounds({
          ...dynasty,
          activePostseason: postseason,
        })
      }
      const champion = postseason.resultsByGameId[
        getGamesForTournamentRound(postseason, 'championship')[0]!.id
      ]!.winnerId
      const championshipGame = getGamesForTournamentRound(postseason, 'championship')[0]!
      const championshipResult = postseason.resultsByGameId[championshipGame.id]!
      const teamOverallByProgramId = new Map(
        seasonMetrics.teams.map(({ programId, overall }) => [programId, overall]),
      )
      for (const programId of [championshipResult.homeTeamId, championshipResult.awayTeamId]) {
        tournamentStrengths.push({
          seasonNumber: season.seasonNumber,
          programId,
          role: programId === championshipResult.winnerId ? 'champion' : 'runnerUp',
          overall: teamOverallByProgramId.get(programId)!,
        })
      }
      champions[champion] = (champions[champion] ?? 0) + 1
      for (const game of getGamesForTournamentRound(postseason, 'semifinals')) {
        const result = postseason.resultsByGameId[game.id]!
        for (const programId of [result.homeTeamId, result.awayTeamId]) {
          if (programId !== championshipResult.homeTeamId && programId !== championshipResult.awayTeamId) {
            tournamentStrengths.push({
              seasonNumber: season.seasonNumber,
              programId,
              role: 'semifinalist',
              overall: teamOverallByProgramId.get(programId)!,
            })
          }
        }
        semifinalAppearances[result.homeTeamId] =
          (semifinalAppearances[result.homeTeamId] ?? 0) + 1
        semifinalAppearances[result.awayTeamId] =
          (semifinalAppearances[result.awayTeamId] ?? 0) + 1
      }

      dynasty = { ...dynasty, activePostseason: postseason }
      auditRecruitingFocus(dynasty, health)
      const finalization = autoFinalizeRecruiting(dynasty)
      dynasty = finalization.dynasty
      auditRecruitingFocus(dynasty, health)
      health.fallbackMatcherUses += Number(finalization.fallbackMatcherUsed)
      health.emergencyRecruits += finalization.emergencyGeneratedRecruits
      health.unsignedFiveStarsWithCompatibleCapacity +=
        countCompatibleUnsignedPremium(dynasty, 5)
      health.unsignedFourStarsWithCompatibleCapacity +=
        countCompatibleUnsignedPremium(dynasty, 4)
      const finalized = dynasty.completedRecruitingHistory.at(-1)!
      const projectedOpenings = Object.values(finalized.recruitingState.programs)
        .reduce((total, program) => total + Object.values(
          program.projectedOpeningsByPosition,
        ).reduce((sum, count) => sum + count, 0), 0)
      const commitments = Object.keys(
        finalized.recruitingState.commitmentsByPlayerId,
      ).length
      const programClassSizes = Object.keys(finalized.recruitingState.programs)
        .sort()
        .map((programId) => Object.values(
          finalized.recruitingState.commitmentsByPlayerId,
        ).filter((commitment) => commitment.programId === programId).length)
      recruitingCycles.push({
        targetSeasonNumber: finalized.targetSeasonNumber,
        projectedOpenings,
        commitments,
        programClassSizes,
      })
      health.unfilledRecruitingOpenings += Math.max(0, projectedOpenings - commitments)
      const prestigeByProgramId = Object.fromEntries(
        Object.entries(season.programStates).map(([programId, { team }]) => [
          programId,
          team.prestige,
        ]),
      )
      signedRecruits.push(...extractSignedRecruitRecords(
        finalized,
        prestigeByProgramId,
      ))

      const priorSeasonSnapshots = archivedSeasonSnapshots
      const priorRecruitingSnapshots = archivedRecruitingSnapshots
      dynasty = beginOffseason(dynasty)
      if (auditLevel === 'full' && (
        CHECKPOINTS.has(season.seasonNumber) ||
        season.seasonNumber === seasonsToComplete
      )) {
        health.historyOverwriteEvents += priorSeasonSnapshots.filter(
          (snapshot, index) => snapshotHash(dynasty.history[index]) !== snapshot,
        ).length
        health.historyOverwriteEvents += priorRecruitingSnapshots.filter(
          (snapshot, index) =>
            snapshotHash(dynasty.completedRecruitingHistory[index]) !== snapshot,
        ).length
      }
      developments.push(...deriveDevelopmentRecords(season, dynasty.offseason!))
      if (auditLevel === 'full') {
        archivedSeasonSnapshots = [
          ...archivedSeasonSnapshots,
          snapshotHash(dynasty.history.at(-1)),
        ]
        archivedRecruitingSnapshots = [
          ...archivedRecruitingSnapshots,
          snapshotHash(dynasty.completedRecruitingHistory.at(-1)),
        ]
        const seasonHistoryNumbers = dynasty.history.map(({ seasonNumber }) => seasonNumber)
        const recruitingHistoryNumbers = dynasty.completedRecruitingHistory.map(
          ({ targetSeasonNumber }) => targetSeasonNumber,
        )
        health.historyCollisions +=
          seasonHistoryNumbers.length - new Set(seasonHistoryNumbers).size
        health.historyCollisions +=
          recruitingHistoryNumbers.length - new Set(recruitingHistoryNumbers).size
      }

      dynasty = rolloverDynastyToNextSeason(dynasty)
      rollovers += 1
      const nextPlayerIds = Object.values(dynasty.activeSeason!.programStates).flatMap(
        ({ team }) => team.roster.map(({ id }) => id),
      )
      const nextRecruitIds = dynasty.recruiting!.recruits.map(({ player }) => player.id)
      const identityAudit = auditIdentityCollisions({
        activePlayerIds: nextPlayerIds,
        existingPersonIds: knownPersonIds,
        newRecruitIds: nextRecruitIds,
      })
      health.playerIdCollisions +=
        identityAudit.duplicateActivePlayerIds +
        identityAudit.duplicateNewRecruitIds +
        identityAudit.newRecruitExistingPersonCollisions
      for (const id of nextRecruitIds) knownPersonIds.add(id)

      if (auditLevel === 'full' && (CHECKPOINTS.has(season.seasonNumber) || season.seasonNumber === seasonsToComplete)) {
        const bytes = serializedSizeBytes(dynasty)
        stateGrowth.push({
          season: season.seasonNumber,
          completedSeasons: dynasty.history.length,
          recruitingClasses: dynasty.completedRecruitingHistory.length,
          bytes,
        })
        try {
          if (JSON.stringify(JSON.parse(JSON.stringify(dynasty))) !== JSON.stringify(dynasty)) {
            health.serializationFailures += 1
          }
        } catch {
          health.serializationFailures += 1
        }
      }
    }
  } catch (error) {
    health.lifecycleFailures += 1
    throw error
  }

  return {
    seed,
    seasons,
    developments,
    signedRecruits,
    recruitingCycles,
    graduating,
    champions,
    semifinalAppearances,
    stateGrowth,
    tournamentStrengths,
    health,
    rollovers,
  }
}

export function runLongRunCalibration(options: {
  readonly seasonsPerSeed: number
  readonly seeds: readonly string[]
  readonly auditLevel?: AuditLevel
}): LongRunCalibrationResult {
  return {
    seeds: options.seeds,
    seasonsPerSeed: options.seasonsPerSeed,
    runs: options.seeds.map((seed) =>
      runDynastyCalibration(seed, options.seasonsPerSeed, options.auditLevel),
    ),
  }
}

function windowSeasons(
  run: DynastyRunResult,
  start: number,
  end: number,
): SeasonTalentMetrics[] {
  return run.seasons.filter(
    ({ seasonNumber }) => seasonNumber >= start && seasonNumber <= end,
  )
}

function fixed(value: number, digits = 2): string {
  return value.toFixed(digits)
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`
}

function printReport(
  result: LongRunCalibrationResult,
  runtimeSeconds: number,
  determinismPassed: boolean,
  configuration: { readonly preset: string; readonly workers: number; readonly audit: AuditLevel },
): void {
  const allSeasons = result.runs.flatMap(({ seasons }) => seasons)
  const lateStart = Math.min(16, result.seasonsPerSeed)
  const lateByRun = result.runs.map((run) => windowSeasons(
    run,
    lateStart,
    result.seasonsPerSeed,
  ))
  const lateSeasons = lateByRun.flat()
  const lateSlopes = lateByRun.map((seasons) => linearSlope(seasons.map(
    ({ seasonNumber, teamOverall }) => ({ x: seasonNumber, y: teamOverall.average }),
  )))
  const canonical = result.runs[0]!

  console.log('COLLEGE HOOPS SIM — DYNASTY LONG-RUN CALIBRATION V1\n')
  console.log('CONFIGURATION\n')
  console.log(`Preset: ${configuration.preset}`)
  console.log(`Seeds: ${result.seeds.length}`)
  console.log(`Seasons per seed: ${result.seasonsPerSeed}`)
  console.log(`Workers: ${configuration.workers}`)
  console.log(`Audit: ${configuration.audit.toUpperCase()}`)
  console.log(`Total Season observations: ${allSeasons.length}`)
  console.log(`Approx runtime: ${runtimeSeconds.toFixed(1)} seconds\n`)

  console.log('CANONICAL DYNASTY TRAJECTORY\n')
  console.log('SEASON  AVG TEAM  MIN   MAX   AVG PLAYER  FR    SO    JR    SR')
  for (const season of canonical.seasons.filter(({ seasonNumber }) =>
    TRAJECTORY_SEASONS.has(seasonNumber) || seasonNumber === result.seasonsPerSeed,
  )) {
    console.log([
      String(season.seasonNumber).padStart(6),
      fixed(season.teamOverall.average).padStart(8),
      fixed(season.teamOverall.minimum, 1).padStart(5),
      fixed(season.teamOverall.maximum, 1).padStart(5),
      fixed(season.playerOverall.average).padStart(10),
      ...CLASS_YEARS.map((classYear) =>
        fixed(season.classOverall[classYear].average, 1).padStart(5),
      ),
    ].join('  '))
  }

  const talentCheckpoints = [1, 2, 5, 10].filter(
    (seasonNumber) => seasonNumber <= result.seasonsPerSeed,
  )
  console.log('\nACTIVE PLAYER CHECKPOINTS — MULTI-SEED')
  console.log('SEASON  P10   P25   MED   P75   P90   P95   80+   85+   90+   95+  <70  <65')
  for (const seasonNumber of talentCheckpoints) {
    const players = result.runs.flatMap((run) => run.seasons)
      .filter((season) => season.seasonNumber === seasonNumber)
      .flatMap(({ players }) => players)
    const overalls = players.map(({ overall }) => overall)
    const distribution = summarizeDistribution(overalls)
    const count = (predicate: (overall: number) => boolean) =>
      average(result.runs.map((run) => run.seasons.find((season) =>
        season.seasonNumber === seasonNumber,
      )!.players.filter(({ overall }) => predicate(overall)).length))
    console.log(`${String(seasonNumber).padStart(6)}  ${fixed(distribution.p10, 1).padStart(4)}  ${fixed(distribution.p25, 1).padStart(4)}  ${fixed(distribution.median, 1).padStart(4)}  ${fixed(distribution.p75, 1).padStart(4)}  ${fixed(distribution.p90, 1).padStart(4)}  ${fixed(percentile(overalls, 0.95), 1).padStart(4)}  ${fixed(count((overall) => overall >= 80), 1).padStart(4)}  ${fixed(count((overall) => overall >= 85), 1).padStart(4)}  ${fixed(count((overall) => overall >= 90), 1).padStart(4)}  ${fixed(count((overall) => overall >= 95), 1).padStart(4)}  ${fixed(count((overall) => overall < 70), 1).padStart(3)}  ${fixed(count((overall) => overall < 65), 1).padStart(3)}`)
  }

  console.log('\nTEAM OVR CHECKPOINTS — MULTI-SEED')
  console.log('SEASON  MIN   P10   P25   MED   P75   P90   MAX')
  for (const seasonNumber of talentCheckpoints) {
    const distribution = summarizeDistribution(result.runs.flatMap((run) => run.seasons)
      .filter((season) => season.seasonNumber === seasonNumber)
      .flatMap(({ teams }) => teams.map(({ overall }) => overall)))
    console.log(`${String(seasonNumber).padStart(6)}  ${fixed(distribution.minimum, 1).padStart(4)}  ${fixed(distribution.p10, 1).padStart(4)}  ${fixed(distribution.p25, 1).padStart(4)}  ${fixed(distribution.median, 1).padStart(4)}  ${fixed(distribution.p75, 1).padStart(4)}  ${fixed(distribution.p90, 1).padStart(4)}  ${fixed(distribution.maximum, 1).padStart(4)}`)
  }

  console.log('\nTEAM TALENT EQUILIBRIUM\n')
  console.log('WINDOW   AVG TEAM OVR  SLOPE/SEASON  TEAM OVR SD')
  for (const [label, start, end] of [
    ['1–5', 1, Math.min(5, result.seasonsPerSeed)],
    ['6–15', 6, Math.min(15, result.seasonsPerSeed)],
    [`${lateStart}–${result.seasonsPerSeed}`, lateStart, result.seasonsPerSeed],
  ] as const) {
    const values = result.runs.flatMap((run) => windowSeasons(run, start, end))
    if (values.length === 0) continue
    const perSeasonAverages = values.map(({ teamOverall }) => teamOverall.average)
    const slope = average(result.runs.map((run) => linearSlope(
      windowSeasons(run, start, end).map(({ seasonNumber, teamOverall }) => ({
        x: seasonNumber,
        y: teamOverall.average,
      })),
    )))
    console.log(
      `${label.padEnd(8)} ${fixed(average(perSeasonAverages)).padStart(12)}  ${fixed(slope, 3).padStart(12)}  ${fixed(average(values.map(({ teamOverall }) => teamOverall.standardDeviation))).padStart(11)}`,
    )
  }
  lateSlopes.forEach((slope, index) =>
    console.log(`Seed ${index + 1} late slope: ${fixed(slope, 3)}`),
  )
  console.log(`Mean late slope: ${fixed(average(lateSlopes), 3)}`)
  console.log(`Median late slope: ${fixed(summarizeDistribution(lateSlopes).median, 3)}`)
  console.log(`Late slope range: ${fixed(Math.min(...lateSlopes), 3)} to ${fixed(Math.max(...lateSlopes), 3)}`)
  const lateTeamValues = lateSeasons.flatMap(({ teams }) => teams.map(({ overall }) => overall))
  const lateTeamDistribution = summarizeDistribution(lateTeamValues)
  console.log(`Late Team OVR percentiles P10/P25/P50/P75/P90: ${[lateTeamDistribution.p10, lateTeamDistribution.p25, lateTeamDistribution.median, lateTeamDistribution.p75, lateTeamDistribution.p90].map((value) => fixed(value, 1)).join(' / ')}`)

  const latePlayers = lateSeasons.flatMap(({ players }) => players)
  console.log('\nSTEADY-STATE PLAYER TALENT\n')
  console.log('CLASS  AVG OVR  AVG POT  AVG POT GAP  AT POT  WITHIN 1  WITHIN 3')
  for (const classYear of CLASS_YEARS) {
    const players = latePlayers.filter((player) => player.classYear === classYear)
    const ceiling = playerCeilingRates(players)
    console.log(
      `${classYear.padEnd(5)}  ${fixed(average(players.map(({ overall }) => overall))).padStart(7)}  ${fixed(average(players.map(({ potential }) => potential))).padStart(7)}  ${fixed(average(players.map(({ overall, potential }) => potential - overall))).padStart(11)}  ${percent(ceiling.atPotential).padStart(6)}  ${percent(ceiling.withinOne).padStart(8)}  ${percent(ceiling.withinThree).padStart(8)}`,
    )
  }

  const lateDevelopments = result.runs.flatMap(({ developments }) => developments)
    .filter(({ seasonNumber }) => seasonNumber >= lateStart)
  console.log('\nDEVELOPMENT\n')
  console.log('TRANSITION  AVG GAIN  MEDIAN  % ZERO  % 1+   % 3+')
  for (const transition of ['FR→SO', 'SO→JR', 'JR→SR'] as const) {
    const gains = lateDevelopments
      .filter((record) => record.transition === transition)
      .map(({ overallGain }) => overallGain)
    console.log(
      `${transition.padEnd(10)}  ${fixed(average(gains)).padStart(8)}  ${fixed(summarizeDistribution(gains).median, 1).padStart(6)}  ${percent(gains.filter((gain) => gain === 0).length / gains.length).padStart(6)}  ${percent(gains.filter((gain) => gain >= 1).length / gains.length).padStart(6)}  ${percent(gains.filter((gain) => gain >= 3).length / gains.length).padStart(6)}`,
    )
  }

  const lateRecruiting = result.runs.flatMap(({ signedRecruits }) => signedRecruits)
    .filter(({ targetSeasonNumber }) =>
      targetSeasonNumber >= lateStart &&
      targetSeasonNumber <= result.seasonsPerSeed,
    )
  const lateGraduating = result.runs.flatMap(({ graduating }) => graduating)
    .filter(({ seasonNumber }) => seasonNumber >= lateStart)
  console.log('\nTALENT FLOW\n')
  console.log(`Incoming freshmen: ${lateRecruiting.length} | AVG OVR ${fixed(average(lateRecruiting.map(({ overall }) => overall)))} | AVG POT ${fixed(average(lateRecruiting.map(({ potential }) => potential)))}`)
  console.log(`Graduating seniors: ${lateGraduating.length} | AVG OVR ${fixed(average(lateGraduating.map(({ overall }) => overall)))} | AVG POT ${fixed(average(lateGraduating.map(({ potential }) => potential)))}`)
  console.log(`Graduating OVR minus incoming OVR: ${fixed(average(lateGraduating.map(({ overall }) => overall)) - average(lateRecruiting.map(({ overall }) => overall)))}`)
  const incomingOverallDistribution = summarizeDistribution(
    lateRecruiting.map(({ overall }) => overall),
  )
  const incomingPotentialDistribution = summarizeDistribution(
    lateRecruiting.map(({ potential }) => potential),
  )
  console.log(`Incoming OVR P10/P50/P90: ${fixed(incomingOverallDistribution.p10, 1)} / ${fixed(incomingOverallDistribution.median, 1)} / ${fixed(incomingOverallDistribution.p90, 1)}`)
  console.log(`Incoming POT P10/P50/P90: ${fixed(incomingPotentialDistribution.p10, 1)} / ${fixed(incomingPotentialDistribution.median, 1)} / ${fixed(incomingPotentialDistribution.p90, 1)}`)
  console.log('Incoming by star:')
  for (const stars of [5, 4, 3, 2] as const) {
    const recruits = lateRecruiting.filter((recruit) => recruit.stars === stars)
    console.log(`${'★'.repeat(stars)} ${recruits.length} | AVG OVR ${fixed(average(recruits.map(({ overall }) => overall)))} | AVG POT ${fixed(average(recruits.map(({ potential }) => potential)))}`)
  }

  console.log('\nHIGH-END TALENT — LATE WINDOW\n')
  for (const threshold of [80, 85, 90, 95] as const) {
    console.log(`OVR >= ${threshold}: ${fixed(average(lateSeasons.map(({ highEndCounts }) => highEndCounts[threshold])))} Players/Season`)
  }
  console.log(`Position counts/Season: ${POSITIONS.map((position) => `${position} ${fixed(average(lateSeasons.map(({ positionCounts }) => positionCounts[position])), 1)}`).join(' | ')}`)

  const programById = Object.fromEntries(UNIVERSE_V0.programs.map((program) => [
    program.id,
    program,
  ]))
  const allChampions = Object.fromEntries(UNIVERSE_V0.programs.map(({ id }) => [
    id,
    result.runs.reduce((sum, run) => sum + (run.champions[id] ?? 0), 0),
  ]))
  console.log('\nSTEADY-STATE PROGRAM QUALITY\n')
  console.log('PRESTIGE  AVG TEAM  AVG REC RANK  AVG REC OVR  AVG REC POT  TITLES')
  for (const band of PRESTIGE_BANDS) {
    const teams = lateSeasons.flatMap(({ teams }) => teams)
      .filter(({ prestige }) => prestigeBand(prestige) === band)
    const recruits = lateRecruiting.filter(({ prestigeBand }) => prestigeBand === band)
    const titles = Object.entries(allChampions).reduce(
      (sum, [programId, count]) =>
        sum + (prestigeBand(programById[programId]!.basePrestige) === band ? count : 0),
      0,
    )
    console.log(
      `${band.padEnd(8)}  ${fixed(average(teams.map(({ overall }) => overall))).padStart(8)}  ${fixed(average(recruits.map(({ nationalRank }) => nationalRank)), 1).padStart(12)}  ${fixed(average(recruits.map(({ overall }) => overall))).padStart(11)}  ${fixed(average(recruits.map(({ potential }) => potential))).padStart(11)}  ${String(titles).padStart(6)}`,
    )
  }
  const prestigeTeamPairs = lateSeasons.flatMap(({ teams }) => teams.map(
    ({ prestige, overall }) => ({ first: prestige, second: overall }),
  ))
  const qualityWinPairs = lateSeasons.flatMap(({ teams }) => teams.map(
    ({ overall, winPercentage }) => ({ first: overall, second: winPercentage }),
  ))
  const adjacentSeasonCorrelations = result.runs.flatMap((run) =>
    run.seasons.slice(1).flatMap((season, index) => {
      if (season.seasonNumber < lateStart) return []
      const prior = new Map(run.seasons[index]!.teams.map(({ programId, overall }) => [
        programId,
        overall,
      ]))
      return [correlation(season.teams.map(({ programId, overall }) => ({
        first: prior.get(programId)!,
        second: overall,
      })))]
    }),
  )
  console.log(`Prestige ↔ Team OVR correlation: ${fixed(correlation(prestigeTeamPairs), 3)}`)
  console.log(`Team OVR ↔ win% correlation: ${fixed(correlation(qualityWinPairs), 3)}`)
  console.log(`Average adjacent-season Team OVR correlation: ${fixed(average(adjacentSeasonCorrelations), 3)}`)

  const teamOvrCheckpoints = [1, 5, 10].filter(
    (seasonNumber) => seasonNumber <= result.seasonsPerSeed,
  )
  console.log('\nTEAM OVR BY PRESTIGE BAND\n')
  console.log(`PRESTIGE  ${teamOvrCheckpoints.map((seasonNumber) => `S${seasonNumber}`).join('      ')}`)
  for (const band of PRESTIGE_BANDS) {
    const values = teamOvrCheckpoints.map((seasonNumber) => average(
      result.runs.flatMap((run) => run.seasons)
        .filter(({ seasonNumber: current }) => current === seasonNumber)
        .flatMap(({ teams }) => teams)
        .filter(({ prestige }) => prestigeBand(prestige) === band)
        .map(({ overall }) => overall),
    ))
    console.log(`${band.padEnd(8)}  ${values.map((value) => fixed(value)).join('  ')}`)
  }

  const lateRecruitingCycles = result.runs.flatMap(({ recruitingCycles }) =>
    recruitingCycles.filter(({ targetSeasonNumber }) =>
      targetSeasonNumber >= lateStart &&
      targetSeasonNumber <= result.seasonsPerSeed,
    ),
  )
  const classSizes = lateRecruitingCycles.flatMap(({ programClassSizes }) =>
    programClassSizes,
  )
  console.log('\nRECRUITING CLASS SIZE\n')
  console.log(`Cycles finalized: ${result.runs.reduce((sum, run) => sum + run.recruitingCycles.length, 0)}`)
  console.log(`Late projected openings: ${lateRecruitingCycles.reduce((sum, cycle) => sum + cycle.projectedOpenings, 0)}`)
  console.log(`Late commitments: ${lateRecruitingCycles.reduce((sum, cycle) => sum + cycle.commitments, 0)}`)
  console.log(`Program class size AVG/MIN/MAX: ${fixed(average(classSizes))} / ${Math.min(...classSizes)} / ${Math.max(...classSizes)}`)

  console.log('\nPREMIUM RECRUIT DESTINATIONS\n')
  for (const stars of [5, 4] as const) {
    const recruits = lateRecruiting.filter((recruit) => recruit.stars === stars)
    console.log(`${stars}-star: ${PRESTIGE_BANDS.map((band) => {
      const count = recruits.filter(({ prestigeBand }) => prestigeBand === band).length
      return `${band} ${percent(count / recruits.length)}`
    }).join(' | ')}`)
    const topDestination = Object.entries(recruits.reduce<Record<string, number>>(
      (counts, recruit) => ({
        ...counts,
        [recruit.programId]: (counts[recruit.programId] ?? 0) + 1,
      }),
      {},
    )).sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0]
    if (topDestination) {
      console.log(`Most ${stars}-stars: ${programById[topDestination[0]]!.name} ${topDestination[1]} (${percent(topDestination[1] / recruits.length)})`)
    }
  }

  console.log('\nCHAMPIONSHIP DISTRIBUTION\n')
  const totalTitles = Object.values(allChampions).reduce((sum, count) => sum + count, 0)
  const titleRows = Object.entries(allChampions)
    .filter(([, count]) => count > 0)
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
  console.log(`Total titles: ${totalTitles}`)
  console.log(`Unique champions: ${titleRows.length}`)
  console.log(`Most titles: ${titleRows.slice(0, 5).map(([programId, count]) => `${programById[programId]!.name} ${count}`).join(' | ')}`)
  console.log(`Titles by prestige band: ${PRESTIGE_BANDS.map((band) => `${band} ${titleRows.reduce((sum, [programId, count]) => sum + (prestigeBand(programById[programId]!.basePrestige) === band ? count : 0), 0)}`).join(' | ')}`)
  const semifinalTotals = Object.fromEntries(UNIVERSE_V0.programs.map(({ id }) => [
    id,
    result.runs.reduce((sum, run) => sum + (run.semifinalAppearances[id] ?? 0), 0),
  ]))
  console.log(`Final Four appearances by prestige band: ${PRESTIGE_BANDS.map((band) => `${band} ${Object.entries(semifinalTotals).reduce((sum, [programId, count]) => sum + (prestigeBand(programById[programId]!.basePrestige) === band ? count : 0), 0)}`).join(' | ')}`)

  const health = result.runs.reduce((total, run) => {
    for (const key of Object.keys(total) as (keyof StructuralHealth)[]) {
      total[key] += run.health[key]
    }
    return total
  }, emptyHealth())
  console.log('\nLONG-RUN STRUCTURAL HEALTH\n')
  console.log(`Seasons completed: ${allSeasons.length}`)
  console.log(`Rollovers completed: ${result.runs.reduce((sum, run) => sum + run.rollovers, 0)}`)
  console.log(`Invalid rosters: ${health.invalidRosters}`)
  console.log(`Invalid Rotations: ${health.invalidRotations}`)
  console.log(`Invalid Schedules: ${health.invalidSchedules}`)
  console.log(`Unfilled Recruiting openings: ${health.unfilledRecruitingOpenings}`)
  console.log(`Player-ID collisions: ${health.playerIdCollisions}`)
  console.log(`Game-ID collisions: ${health.gameIdCollisions}`)
  console.log(`History collisions: ${health.historyCollisions}`)
  console.log(`History overwrite events: ${health.historyOverwriteEvents}`)
  console.log(`Emergency Recruits: ${health.emergencyRecruits}`)
  console.log(`Fallback matcher uses: ${health.fallbackMatcherUses}`)
  console.log(`Unsigned 5-stars with compatible capacity: ${health.unsignedFiveStarsWithCompatibleCapacity}`)
  console.log(`Unsigned 4-stars with compatible capacity: ${health.unsignedFourStarsWithCompatibleCapacity}`)
  console.log(`Invalid Focus states: ${health.invalidFocusStates}`)
  console.log(`Focus count > 3: ${health.focusLimitViolations}`)
  console.log(`Focused Recruit not on Board: ${health.focusedRecruitNotOnBoard}`)
  console.log(`Duplicate commitments: ${health.duplicateCommitments}`)
  console.log(`Lifecycle failures: ${health.lifecycleFailures}`)
  console.log(`Serialization failures: ${health.serializationFailures}`)

  console.log('\nDYNASTY STATE GROWTH — CANONICAL SEED\n')
  console.log('SEASON  COMPLETED SEASONS  RECRUITING CLASSES  JSON SIZE')
  for (const checkpoint of canonical.stateGrowth) {
    console.log(`${String(checkpoint.season).padStart(6)}  ${String(checkpoint.completedSeasons).padStart(17)}  ${String(checkpoint.recruitingClasses).padStart(19)}  ${formatBytes(checkpoint.bytes).padStart(9)}`)
  }

  const structuralFailures = Object.entries(health)
    .filter(([key]) => key !== 'fallbackMatcherUses')
    .reduce((sum, [, value]) => sum + value, 0)
  const meanSlope = average(lateSlopes)
  const classification = structuralFailures > 0
    ? 'STRUCTURALLY UNSTABLE'
    : meanSlope > 0.15
      ? 'MEANINGFUL TALENT INFLATION'
      : meanSlope < -0.15
        ? 'MEANINGFUL TALENT DEFLATION'
        : Math.abs(meanSlope) > 0.05
          ? 'MOSTLY STABLE — MINOR WATCHPOINT'
          : 'STABLE'
  const firstAverage = average(result.runs.map((run) => run.seasons[0]!.teamOverall.average))
  const secondAverage = average(result.runs.map((run) => run.seasons[1]?.teamOverall.average ?? run.seasons[0]!.teamOverall.average))
  const lateAverage = average(lateSeasons.map(({ teamOverall }) => teamOverall.average))
  console.log('\nASSESSMENT\n')
  console.log(`Classification: ${classification}`)
  console.log(`Multi-seed Season 1 → 2 Team OVR: ${fixed(firstAverage)} → ${fixed(secondAverage)}; late-window average ${fixed(lateAverage)}.`)
  console.log(`Late drift diagnostic: ${Math.abs(meanSlope) > 0.10 ? 'WARNING — sustained material drift remains.' : 'PASS — no sustained material drift.'}`)
  console.log(`LONG-RUN DETERMINISM: ${determinismPassed ? 'PASS' : 'FAIL'}`)
}

export async function main(): Promise<void> {
  const config = resolveLongRunCliConfig(process.argv.slice(2))
  const seeds = calibrationSeeds(config.seeds)
  const determinismConfig = {
    seasonsPerSeed: Math.min(2, config.seasons),
    seeds: ['dynasty-long-run-v0:determinism'],
    auditLevel: config.audit,
  }
  const deterministicFirst = runLongRunCalibration(determinismConfig)
  const deterministicSecond = runLongRunCalibration(determinismConfig)
  const determinismPassed = JSON.stringify(deterministicFirst) ===
    JSON.stringify(deterministicSecond)
  const start = performance.now()
  const result = config.workers === 1
    ? runLongRunCalibration({
      seasonsPerSeed: config.seasons,
      seeds,
      auditLevel: config.audit,
    })
    : await runLongRunCalibrationParallel({
      seasonsPerSeed: config.seasons,
      seeds,
      auditLevel: config.audit,
      workers: config.workers,
    })
  const runtimeSeconds = (performance.now() - start) / 1_000
  if (config.json) {
    console.log(JSON.stringify({ config, result, determinismPassed, runtimeSeconds }))
  } else {
    printReport(result, runtimeSeconds, determinismPassed, {
      preset: config.preset ?? 'custom',
      workers: config.workers,
      audit: config.audit,
    })
  }
  if (!determinismPassed) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
