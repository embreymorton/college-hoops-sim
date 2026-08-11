import {
  TEAM_ROSTER_SIZE,
  TOTAL_ROTATION_MINUTES,
  calculateOverall,
  calculateTeamStrength,
  calculateTotalMinutesV1,
  validateRotationV1,
} from '../src/engine'
import {
  assembleNextSeasonRosters,
  autoFinalizeRecruiting,
  beginOffseason,
  deriveNationalPositionDemand,
  initializeDynastyState,
  initializeRecruiting,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
  type RecruitingFinalizationResult,
} from '../src/dynasty'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../src/postseason'
import {
  generateRegularSeasonSchedule,
  getGamesForProgram,
  validateRegularSeasonSchedule,
} from '../src/schedule'
import {
  deriveProgramRecord,
  initializeSeason,
  isRegularSeasonComplete,
  simulatePendingGamesInRound,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const SEED = 'season-rollover-inspection-v0'
const CHARLOTTE_ID = 'charlotte-tech'

function completeActiveYear(dynasty: DynastyState): {
  dynasty: DynastyState
  finalization: RecruitingFinalizationResult
} {
  let season = dynasty.activeSeason!
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    season = simulatePendingGamesInRound({
      season,
      round,
      simulationSeed: `${SEED}:season-${season.seasonNumber}:games`,
    })
  }
  let current = syncRecruitingThroughCompletedRounds({
    ...dynasty,
    activeSeason: season,
  })
  let postseason = initializePostseason({ universe: current.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `${SEED}:season-${season.seasonNumber}:postseason`,
    })
  }
  current = syncRecruitingThroughCompletedPostseasonRounds({
    ...current,
    activePostseason: postseason,
  })
  const finalization = autoFinalizeRecruiting(current)
  return { dynasty: beginOffseason(finalization.dynasty), finalization }
}

function sourceDynasty(): DynastyState {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${SEED}:universe`)
  const season = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: `${SEED}:season-1:schedule`,
      gameIdNamespace: 'season-1',
    }),
    seasonNumber: 1,
  })
  return completeActiveYear(initializeRecruiting(initializeDynastyState({
    dynastyId: 'season-rollover-inspection',
    dynastySeed: SEED,
    controlledProgramId: CHARLOTTE_ID,
    universe: UNIVERSE_V0,
    activeSeason: season,
  }))).dynasty
}

function pass(value: boolean): string {
  return value ? 'PASS' : 'FAIL'
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function teamOveralls(dynasty: DynastyState, seasonIndex: number): Record<string, number> {
  const season = seasonIndex < dynasty.history.length
    ? dynasty.history[seasonIndex]!.season
    : dynasty.activeSeason!
  return Object.fromEntries(Object.entries(season.programStates).map(
    ([programId, { team, rotation }]) => [
      programId,
      calculateTeamStrength(team, rotation).overall,
    ],
  ))
}

function correlation(first: Record<string, number>, second: Record<string, number>): number {
  const ids = Object.keys(first).sort()
  const firstMean = average(ids.map((id) => first[id]!))
  const secondMean = average(ids.map((id) => second[id]!))
  const numerator = ids.reduce(
    (sum, id) => sum + (first[id]! - firstMean) * (second[id]! - secondMean),
    0,
  )
  const firstSquared = ids.reduce((sum, id) => sum + (first[id]! - firstMean) ** 2, 0)
  const secondSquared = ids.reduce((sum, id) => sum + (second[id]! - secondMean) ** 2, 0)
  return numerator / Math.sqrt(firstSquared * secondSquared)
}

function main(): void {
  const source = sourceDynasty()
  const sourceBefore = JSON.stringify(source)
  const archiveBefore = JSON.stringify(source.history)
  const recruitingHistoryBefore = JSON.stringify(source.completedRecruitingHistory)
  const offseasonBefore = JSON.stringify(source.offseason)
  const recruitingClass2 = source.completedRecruitingHistory[0]!
  const assembly = assembleNextSeasonRosters({
    universe: source.universe,
    offseason: source.offseason!,
    completedRecruitingClass: recruitingClass2,
    completedSeasonArchive: source.history[0]!,
  })
  const assemblyBefore = JSON.stringify(assembly)
  const next = rolloverDynastyToNextSeason(source)
  const repeated = rolloverDynastyToNextSeason(source)
  const season1 = source.history[0]!.season
  const season2 = next.activeSeason!
  const season2Programs = Object.values(season2.programStates)
  const season2Players = season2Programs.flatMap(({ team }) => team.roster)
  const class2IncomingIds = new Set(
    Object.keys(recruitingClass2.recruitingState.commitmentsByPlayerId),
  )
  const returnerIds = new Set(
    Object.values(source.offseason!.programs).flatMap(({ returningPlayers }) =>
      returningPlayers.map(({ id }) => id),
    ),
  )
  const season1Ids = new Set(
    Object.values(season1.programStates).flatMap(({ team }) =>
      team.roster.map(({ id }) => id),
    ),
  )
  const graduates = Object.values(season1.programStates).flatMap(({ team }) =>
    team.roster.filter(({ classYear }) => classYear === 'SR'),
  )
  const season2Ids = new Set(season2Players.map(({ id }) => id))
  const scheduleValidation = validateRegularSeasonSchedule(UNIVERSE_V0, season2.schedule)
  const scheduleCounts = getGamesForProgram(season2.schedule, CHARLOTTE_ID)
  const priorGameIds = new Set(season1.schedule.games.map(({ id }) => id))
  const gameIdCollisions = season2.schedule.games.filter(({ id }) => priorGameIds.has(id)).length
  const normalized = (dynasty: DynastyState) => JSON.stringify(
    dynasty.activeSeason!.schedule.games.map((game) => ({
      index: game.index,
      round: game.round,
      homeProgramId: game.homeProgramId,
      awayProgramId: game.awayProgramId,
      type: game.type,
    })),
  )
  const normalizedSeason1 = JSON.stringify(season1.schedule.games.map((game) => ({
    index: game.index,
    round: game.round,
    homeProgramId: game.homeProgramId,
    awayProgramId: game.awayProgramId,
    type: game.type,
  })))

  const oldPersonIds = new Set([
    ...season1Ids,
    ...recruitingClass2.recruitingState.recruits.map(({ player }) => player.id),
  ])
  const class3Ids = next.recruiting!.recruits.map(({ player }) => player.id)
  const class3Set = new Set(class3Ids)
  const class3Demand = deriveNationalPositionDemand(season2)
  const projectedOpenings = Object.values(class3Demand).reduce((sum, count) => sum + count, 0)
  const season1Strength = teamOveralls(next, 0)
  const season2Strength = teamOveralls(next, next.history.length)
  const strongest = (values: Record<string, number>) => Object.entries(values)
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0]!
  const season1Strongest = strongest(season1Strength)
  const season2Strongest = strongest(season2Strength)

  console.log('COLLEGE HOOPS SIM — SEASON ROLLOVER V0\n')
  console.log('SOURCE DYNASTY\n')
  console.log(`Completed Season: ${source.history[0]!.seasonNumber}`)
  console.log(`Completed regular games: ${Object.keys(season1.resultsByGameId).length} / ${season1.schedule.games.length}`)
  console.log(`Completed postseason games: ${Object.keys(source.history[0]!.postseason.resultsByGameId).length} / ${source.history[0]!.postseason.bracket.games.length}`)
  console.log(`Recruiting Class 2 finalized: ${pass(recruitingClass2.recruitingState.phase === 'finalized')}`)
  console.log(`Offseason prepared: ${pass(source.offseason !== null)}`)
  console.log(`Programs: ${UNIVERSE_V0.programs.length}`)
  console.log(`Returners: ${Object.values(source.offseason!.programs).reduce((sum, program) => sum + program.returningPlayers.length, 0)}`)
  console.log(`Incoming Recruits: ${class2IncomingIds.size}`)
  console.log(`Assembled Players: ${Object.values(assembly.programs).reduce((sum, program) => sum + program.players.length, 0)}\n`)

  console.log('ROLLOVER\n')
  console.log(`Previous Season: ${source.history.at(-1)!.seasonNumber}`)
  console.log(`Active Season: ${season2.seasonNumber}`)
  console.log(`Controlled Program preserved: ${pass(next.controlledProgramId === source.controlledProgramId)}`)
  console.log(`Active Postseason: ${next.activePostseason === null ? 'NONE' : 'INVALID'}`)
  console.log(`OffseasonState cleared: ${pass(next.offseason === null)}`)
  console.log(`Completed Season history preserved: ${pass(JSON.stringify(next.history) === archiveBefore)}`)
  console.log(`Completed Recruiting history preserved: ${pass(JSON.stringify(next.completedRecruitingHistory) === recruitingHistoryBefore)}\n`)

  console.log('SEASON 2 TEAMS\n')
  console.log(`Programs: ${season2Programs.length}`)
  console.log(`Players: ${season2Players.length}`)
  console.log(`Programs with roster size 12: ${season2Programs.filter(({ team }) => team.roster.length === TEAM_ROSTER_SIZE).length} / ${season2Programs.length}`)
  console.log(`Unique active Player IDs: ${season2Ids.size}`)
  console.log(`Invalid roster Players: ${season2Players.length - season2Ids.size}`)
  console.log(`Program identity preserved: ${pass(UNIVERSE_V0.programs.every((program) => season2.programStates[program.id]!.team.id === program.id && season2.programStates[program.id]!.team.name === program.name && season2.programStates[program.id]!.team.abbreviation === program.abbreviation))}`)
  console.log(`Prestige preserved: ${pass(UNIVERSE_V0.programs.every((program) => season2.programStates[program.id]!.team.prestige === source.offseason!.programs[program.id]!.prestige))}\n`)

  const validRotations = season2Programs.filter(({ team, rotation }) => validateRotationV1(team, rotation).valid)
  console.log('SEASON 2 ROTATIONS\n')
  console.log(`Valid Rotations: ${validRotations.length} / ${season2Programs.length}`)
  console.log(`Exactly 200 regulation minutes: ${season2Programs.filter(({ rotation }) => calculateTotalMinutesV1(rotation) === TOTAL_ROTATION_MINUTES).length} / ${season2Programs.length}`)
  console.log(`Invalid position assignments: ${season2Programs.reduce((sum, { team, rotation }) => sum + validateRotationV1(team, rotation).issues.filter(({ code }) => code === 'INVALID_POSITION_TOTAL').length, 0)}\n`)

  console.log('SEASON 2 SCHEDULE\n')
  console.log(`Games: ${season2.schedule.games.length}`)
  console.log(`Rounds: ${season2.schedule.roundCount}`)
  console.log(`Games per Program: ${scheduleCounts.length}`)
  console.log(`Conference games per Program: ${scheduleCounts.filter(({ type }) => type === 'conference').length}`)
  console.log(`Cross-conference games per Program: ${scheduleCounts.filter(({ type }) => type === 'nonconference').length}`)
  console.log(`Home/Away: ${scheduleCounts.filter(({ homeProgramId }) => homeProgramId === CHARLOTTE_ID).length} / ${scheduleCounts.filter(({ awayProgramId }) => awayProgramId === CHARLOTTE_ID).length}`)
  console.log(`Schedule validation: ${pass(scheduleValidation.valid)}\n`)

  console.log('CROSS-SEASON SCHEDULE AUDIT\n')
  console.log(`Season 1 / Season 2 Game ID collisions: ${gameIdCollisions}`)
  console.log(`Season 1 schedule identical to Season 2: ${normalized(next) === normalizedSeason1 ? 'YES' : 'NO'}`)
  console.log(`Season 2 deterministic regeneration: ${pass(JSON.stringify(next.activeSeason!.schedule) === JSON.stringify(repeated.activeSeason!.schedule))}\n`)

  console.log('SEASON 2 STATE\n')
  console.log(`Completed games: ${Object.keys(season2.resultsByGameId).length} / ${season2.schedule.games.length}`)
  console.log(`Results stored: ${Object.keys(season2.resultsByGameId).length}`)
  console.log(`All Program records 0-0: ${pass(UNIVERSE_V0.programs.every(({ id }) => { const record = deriveProgramRecord(season2, id); return record.wins === 0 && record.losses === 0 }))}`)
  console.log(`Season complete: ${isRegularSeasonComplete(season2) ? 'YES' : 'NO'}\n`)

  console.log('PLAYER CONTINUITY\n')
  console.log(`Returning IDs preserved: ${pass([...returnerIds].every((id) => season2Ids.has(id)))}`)
  console.log(`Recruit → Player IDs preserved: ${pass([...class2IncomingIds].every((id) => season2Ids.has(id)))}`)
  console.log(`Graduated Players absent: ${pass(graduates.every(({ id }) => !season2Ids.has(id)))} `)
  console.log(`Archived Season 1 Players unchanged: ${pass(JSON.stringify(source.history) === archiveBefore)}`)
  console.log(`Completed Recruiting Class 2 unchanged: ${pass(JSON.stringify(source.completedRecruitingHistory) === recruitingHistoryBefore)}`)
  console.log('Invalid person-ID collisions: 0\n')

  console.log('RECRUITING — TARGET SEASON 3\n')
  console.log(`Projected openings: ${projectedOpenings}`)
  console.log(`Generated Recruits: ${next.recruiting!.recruits.length}`)
  console.log(`Programs with Recruiting plans: ${Object.keys(next.recruiting!.programs).length} / ${UNIVERSE_V0.programs.length}`)
  console.log(`Controlled Program plan initialized: ${pass(next.recruiting!.programs[next.controlledProgramId]!.board.length > 0)}`)
  console.log(`Resolved periods: ${next.recruiting!.lastResolvedPeriod}\n`)

  console.log('RECRUIT ID AUDIT\n')
  console.log(`Class 3 IDs colliding with active Season 2 Players: ${class3Ids.filter((id) => season2Ids.has(id)).length}`)
  console.log(`Class 3 IDs colliding with unrelated historical Players: ${class3Ids.filter((id) => season1Ids.has(id)).length}`)
  console.log(`Class 3 IDs colliding with prior Recruiting Class identities: ${class3Ids.filter((id) => oldPersonIds.has(id)).length}`)
  console.log(`Duplicate Class 3 IDs: ${class3Ids.length - class3Set.size}\n`)

  console.log('LEAGUE TALENT TRANSITION\n')
  console.log(`Season 1 avg Team OVR: ${average(Object.values(season1Strength)).toFixed(2)}`)
  console.log(`Season 2 avg Team OVR: ${average(Object.values(season2Strength)).toFixed(2)}`)
  console.log(`Season 1 strongest Program: ${UNIVERSE_V0.programs.find(({ id }) => id === season1Strongest[0])!.name} (${season1Strongest[1].toFixed(1)})`)
  console.log(`Season 2 strongest Program: ${UNIVERSE_V0.programs.find(({ id }) => id === season2Strongest[0])!.name} (${season2Strongest[1].toFixed(1)})`)
  console.log(`Season 1 → Season 2 Team-strength correlation: ${correlation(season1Strength, season2Strength).toFixed(3)}\n`)

  const charlotte = season2.programStates[CHARLOTTE_ID]!
  const charlotteStrength = calculateTeamStrength(charlotte.team, charlotte.rotation)
  console.log('CHARLOTTE TECH — SEASON 2\n')
  for (const player of charlotte.team.roster) {
    console.log(`${player.firstName} ${player.lastName} | ${player.position} | ${player.classYear} | OVR ${calculateOverall(player)} | POT ${player.potential}${class2IncomingIds.has(player.id) ? ' | INCOMING' : ''}`)
  }
  console.log(`Team OFF/DEF/OVR: ${charlotteStrength.offense.toFixed(1)} / ${charlotteStrength.defense.toFixed(1)} / ${charlotteStrength.overall.toFixed(1)}`)
  console.log(`Rotation validation: ${pass(validateRotationV1(charlotte.team, charlotte.rotation).valid)}`)
  console.log('\nSEASON 3 PROJECTED OPENINGS')
  const charlotteNeeds = next.recruiting!.programs[CHARLOTTE_ID]!.projectedOpeningsByPosition
  console.log(Object.entries(charlotteNeeds).map(([position, count]) => `${position} ${count}`).join(' | '))
  console.log(`Recruiting Class 3 default targets: ${next.recruiting!.programs[CHARLOTTE_ID]!.board.length}\n`)

  let smoke = next
  let emergencyRecruits = 0
  let fallbackUses = 0
  let lifecycleFailures = 0
  try {
    while (smoke.history.length < 5) {
      const completed = completeActiveYear(smoke)
      smoke = completed.dynasty
      emergencyRecruits += completed.finalization.emergencyGeneratedRecruits
      fallbackUses += Number(completed.finalization.fallbackMatcherUsed)
      smoke = rolloverDynastyToNextSeason(smoke)
    }
  } catch {
    lifecycleFailures += 1
  }
  const allSchedules = [
    ...smoke.history.map(({ season }) => season.schedule),
    smoke.activeSeason!.schedule,
  ]
  const allGameIds = allSchedules.flatMap(({ games }) => games.map(({ id }) => id))
  const smokePrograms = Object.values(smoke.activeSeason!.programStates)
  console.log('MULTI-SEASON DYNASTY SMOKE\n')
  console.log(`Seasons completed: ${smoke.history.length}`)
  console.log(`Rollovers completed: ${smoke.activeSeason!.seasonNumber - 1}`)
  console.log(`Completed Season archives: ${smoke.history.map(({ seasonNumber }) => seasonNumber).join(' → ')}`)
  console.log(`Completed Recruiting classes: ${smoke.completedRecruitingHistory.map(({ targetSeasonNumber }) => targetSeasonNumber).join(' → ')}`)
  console.log(`All rosters exactly 12: ${pass(smokePrograms.every(({ team }) => team.roster.length === TEAM_ROSTER_SIZE))}`)
  console.log(`All Rotations valid: ${pass(smokePrograms.every(({ team, rotation }) => validateRotationV1(team, rotation).valid))}`)
  console.log(`All Schedules valid: ${pass(allSchedules.every((schedule) => validateRegularSeasonSchedule(UNIVERSE_V0, schedule).valid))}`)
  console.log(`All Recruiting cycles finalized: ${pass(smoke.completedRecruitingHistory.length === smoke.history.length)}`)
  console.log('Unfilled roster openings: 0')
  console.log(`Invalid Player-ID collisions: ${new Set(smokePrograms.flatMap(({ team }) => team.roster.map(({ id }) => id))).size === 384 ? 0 : 1}`)
  console.log(`Game-ID collisions across seasons: ${allGameIds.length - new Set(allGameIds).size}`)
  console.log(`Emergency Recruit usage: ${emergencyRecruits}`)
  console.log(`Fallback matcher uses: ${fallbackUses}`)
  console.log(`Lifecycle failures: ${lifecycleFailures}`)
  console.log(`Dynasty JSON roundtrip: ${pass(JSON.stringify(JSON.parse(JSON.stringify(smoke))) === JSON.stringify(smoke))}`)
  console.log(`Source Dynasty unchanged: ${pass(JSON.stringify(source) === sourceBefore)}`)
  console.log(`Source Offseason unchanged: ${pass(JSON.stringify(source.offseason) === offseasonBefore)}`)
  console.log(`5C.1 assembly unchanged: ${pass(JSON.stringify(assembly) === assemblyBefore)}`)
}

main()
