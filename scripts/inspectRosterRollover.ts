import {
  CLASS_YEARS,
  MAX_PLAYER_RATING,
  MIN_PLAYER_RATING,
  POSITIONS,
  TEAM_ROSTER_SIZE,
  calculateOverall,
  type ClassYear,
  type Player,
  type Position,
} from '../src/engine'
import {
  assembleNextSeasonRosters,
  autoFinalizeRecruiting,
  beginOffseason,
  initializeDynastyState,
  initializeRecruiting,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  validateNextSeasonRosterAssembly,
  type AssembleNextSeasonRostersOptions,
  type CommitmentTiming,
} from '../src/dynasty'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../src/postseason'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason, simulatePendingGamesInRound } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const INSPECTION_SEED = 'roster-rollover-inspection-v0'
const CHARLOTTE_ID = 'charlotte-tech'
const ATTRIBUTE_NAMES = [
  'finishing', 'shooting', 'playmaking', 'ballHandling', 'perimeterDefense',
  'interiorDefense', 'rebounding', 'athleticism', 'stamina',
] as const

function createCanonicalSources(): AssembleNextSeasonRostersOptions {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    `${INSPECTION_SEED}:universe`,
  )
  let season = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: `${INSPECTION_SEED}:schedule`,
    }),
    seasonNumber: 1,
  })
  let dynasty = initializeRecruiting(initializeDynastyState({
    dynastyId: 'roster-rollover-inspection',
    dynastySeed: INSPECTION_SEED,
    controlledProgramId: CHARLOTTE_ID,
    universe: UNIVERSE_V0,
    activeSeason: season,
  }))
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    season = simulatePendingGamesInRound({
      season,
      round,
      simulationSeed: `${INSPECTION_SEED}:regular-season`,
    })
  }
  dynasty = syncRecruitingThroughCompletedRounds({ ...dynasty, activeSeason: season })
  let postseason = initializePostseason({ universe: UNIVERSE_V0, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `${INSPECTION_SEED}:postseason`,
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  dynasty = autoFinalizeRecruiting(dynasty).dynasty
  dynasty = beginOffseason(dynasty)
  return {
    universe: dynasty.universe,
    offseason: dynasty.offseason!,
    completedRecruitingClass: dynasty.completedRecruitingHistory[0]!,
    completedSeasonArchive: dynasty.history[0]!,
  }
}

function fullName(player: Player): string {
  return `${player.firstName} ${player.lastName}`
}

function timingLabel(timing: CommitmentTiming): string {
  return timing.kind === 'late' ? 'LATE' : `PERIOD ${timing.period}`
}

function pass(value: boolean): string {
  return value ? 'PASS' : 'FAIL'
}

function main(): void {
  const sources = createCanonicalSources()
  const archiveBefore = JSON.stringify(sources.completedSeasonArchive)
  const recruitingBefore = JSON.stringify(sources.completedRecruitingClass)
  const offseasonBefore = JSON.stringify(sources.offseason)
  const assembly = assembleNextSeasonRosters(sources)
  const validation = validateNextSeasonRosterAssembly(sources)
  const recruiting = sources.completedRecruitingClass.recruitingState
  const programs = Object.values(assembly.programs)
  const players = programs.flatMap(({ players }) => players)
  const returners = Object.values(sources.offseason.programs)
    .flatMap(({ returningPlayers }) => returningPlayers)
  const commitments = Object.values(recruiting.commitmentsByPlayerId)
  const recruitsById = new Map(recruiting.recruits.map((recruit) => [recruit.player.id, recruit]))
  const incomingIds = new Set(commitments.map(({ playerId }) => playerId))
  const incoming = players.filter(({ id }) => incomingIds.has(id))
  const archivedLatestPlayers = UNIVERSE_V0.programs.flatMap(({ id }) =>
    sources.completedSeasonArchive.postseason.programStates[id]?.team.roster
      ?? sources.completedSeasonArchive.season.programStates[id]!.team.roster,
  )
  const graduates = archivedLatestPlayers.filter(({ classYear }) => classYear === 'SR')
  const activeIds = players.map(({ id }) => id)
  const activeIdSet = new Set(activeIds)
  const invalidPlayers = players.filter((player) =>
    !POSITIONS.includes(player.position) ||
    !CLASS_YEARS.includes(player.classYear) ||
    !Number.isSafeInteger(player.height) ||
    player.height <= 0 ||
    !Number.isInteger(player.potential) ||
    player.potential < MIN_PLAYER_RATING ||
    player.potential > MAX_PLAYER_RATING ||
    calculateOverall(player) > player.potential ||
    ATTRIBUTE_NAMES.some((attribute) =>
      !Number.isInteger(player.attributes[attribute]) ||
      player.attributes[attribute] < MIN_PLAYER_RATING ||
      player.attributes[attribute] > MAX_PLAYER_RATING,
    ),
  )
  const classCounts = Object.fromEntries(
    CLASS_YEARS.map((classYear) => [
      classYear,
      players.filter((player) => player.classYear === classYear).length,
    ]),
  ) as Record<ClassYear, number>
  const positionCounts = Object.fromEntries(
    POSITIONS.map((position) => [
      position,
      players.filter((player) => player.position === position).length,
    ]),
  ) as Record<Position, number>

  const sourceJson = JSON.stringify(sources)
  const sameInput = JSON.stringify(assembleNextSeasonRosters(sources)) === JSON.stringify(assembly)
  const reversedSources: AssembleNextSeasonRostersOptions = {
    ...structuredClone(sources),
    universe: { ...sources.universe, programs: [...sources.universe.programs].reverse() },
    offseason: {
      ...structuredClone(sources.offseason),
      programs: Object.fromEntries(Object.entries(sources.offseason.programs).reverse().map(
        ([programId, program]) => [
          programId,
          { ...structuredClone(program), returningPlayers: [...program.returningPlayers].reverse() },
        ],
      )),
    },
    completedRecruitingClass: {
      ...structuredClone(sources.completedRecruitingClass),
      recruitingState: {
        ...structuredClone(sources.completedRecruitingClass.recruitingState),
        programs: Object.fromEntries(
          Object.entries(sources.completedRecruitingClass.recruitingState.programs).reverse(),
        ),
        recruits: [...sources.completedRecruitingClass.recruitingState.recruits].reverse(),
      },
    },
  }
  const orderIndependent = JSON.stringify(assembleNextSeasonRosters(reversedSources)) === JSON.stringify(assembly)

  console.log('COLLEGE HOOPS SIM — NEXT-SEASON ROSTER ASSEMBLY V0\n')
  console.log('SOURCE\n')
  console.log(`Completed Season: ${sources.completedSeasonArchive.seasonNumber}`)
  console.log(`Target Season: ${sources.offseason.targetSeasonNumber}`)
  console.log(`Programs: ${UNIVERSE_V0.programs.length}`)
  console.log(`Offseason returners: ${returners.length}`)
  console.log(`Committed incoming Recruits: ${commitments.length}`)
  console.log(`Projected final Players: ${returners.length + commitments.length}\n`)

  console.log('ROSTER INTEGRITY\n')
  console.log(`Programs assembled: ${programs.length} / ${UNIVERSE_V0.programs.length}`)
  console.log(`Programs with roster size 12: ${programs.filter(({ players }) => players.length === TEAM_ROSTER_SIZE).length} / ${programs.length}`)
  console.log(`Programs with invalid roster size: ${programs.filter(({ players }) => players.length !== TEAM_ROSTER_SIZE).length}`)
  console.log(`Total Players: ${players.length}`)
  console.log(`Unique active Player IDs: ${activeIdSet.size}`)
  console.log(`Invalid positions: ${validation.issues.filter(({ code }) => code === 'INVALID_POSITIONAL_COMPOSITION').length}`)
  console.log(`Invalid classes: ${players.filter(({ classYear }) => !CLASS_YEARS.includes(classYear)).length}`)
  console.log(`Invalid attributes: ${invalidPlayers.filter((player) => ATTRIBUTE_NAMES.some((attribute) => player.attributes[attribute] < MIN_PLAYER_RATING || player.attributes[attribute] > MAX_PLAYER_RATING)).length}`)
  console.log(`Invalid POT semantics: ${players.filter((player) => player.potential < calculateOverall(player) || player.potential < MIN_PLAYER_RATING || player.potential > MAX_PLAYER_RATING).length}\n`)

  console.log('PLAYER LIFECYCLE\n')
  console.log(`Returners enrolled: ${returners.filter(({ id }) => activeIdSet.has(id)).length}`)
  console.log(`Incoming freshmen enrolled: ${incoming.length}`)
  console.log(`Graduated Players excluded: ${graduates.filter(({ id }) => !activeIdSet.has(id)).length}`)
  console.log(`Returner IDs changed: ${returners.filter(({ id }) => !activeIdSet.has(id)).length}`)
  console.log(`Recruit → Player IDs changed: ${commitments.filter(({ playerId }) => !activeIdSet.has(playerId)).length}`)
  console.log(`Duplicate active Player IDs: ${activeIds.length - activeIdSet.size}\n`)

  console.log('HISTORY IMMUTABILITY\n')
  console.log(`Completed Season archive unchanged: ${pass(JSON.stringify(sources.completedSeasonArchive) === archiveBefore)}`)
  console.log(`Completed Recruiting Class unchanged: ${pass(JSON.stringify(sources.completedRecruitingClass) === recruitingBefore)}`)
  console.log(`Offseason input unchanged: ${pass(JSON.stringify(sources.offseason) === offseasonBefore)}\n`)

  console.log('RECRUIT ENROLLMENT\n')
  const incomingPairs = commitments.map((commitment) => ({
    recruit: recruitsById.get(commitment.playerId)!.player,
    player: assembly.programs[commitment.programId]!.players.find(({ id }) => id === commitment.playerId)!,
  }))
  console.log(`Committed Recruits: ${commitments.length}`)
  console.log(`Enrolled freshmen: ${incoming.length}`)
  console.log(`ID preserved: ${pass(incomingPairs.every(({ recruit, player }) => recruit.id === player.id))}`)
  console.log(`Name preserved: ${pass(incomingPairs.every(({ recruit, player }) => recruit.firstName === player.firstName && recruit.lastName === player.lastName))}`)
  console.log(`Position preserved: ${pass(incomingPairs.every(({ recruit, player }) => recruit.position === player.position))}`)
  console.log(`Height preserved: ${pass(incomingPairs.every(({ recruit, player }) => recruit.height === player.height))}`)
  console.log(`Attributes preserved: ${pass(incomingPairs.every(({ recruit, player }) => JSON.stringify(recruit.attributes) === JSON.stringify(player.attributes)))}`)
  console.log(`Potential preserved: ${pass(incomingPairs.every(({ recruit, player }) => recruit.potential === player.potential))}`)
  console.log(`Class set to FR: ${pass(incomingPairs.every(({ player }) => player.classYear === 'FR'))}`)
  console.log(`Unsigned Recruits enrolled: ${recruiting.recruits.filter(({ player }) => !recruiting.commitmentsByPlayerId[player.id] && activeIdSet.has(player.id)).length}\n`)

  console.log('CLASS DISTRIBUTION\n')
  for (const classYear of CLASS_YEARS) console.log(`${classYear}: ${classCounts[classYear]}`)
  console.log(`FR equals incoming Recruit count: ${pass(classCounts.FR === commitments.length)}\n`)

  console.log('POSITION DISTRIBUTION\n')
  for (const position of POSITIONS) console.log(`${position}: ${positionCounts[position]}`)

  console.log('\nIDENTITY AUDIT\n')
  console.log(`Valid returning identity continuations: ${returners.filter(({ id }) => activeIdSet.has(id)).length}`)
  console.log(`Valid Recruit → Player continuations: ${incomingPairs.filter(({ recruit, player }) => recruit.id === player.id).length}`)
  console.log(`Invalid person-ID collisions: ${validation.issues.filter(({ code }) => code === 'INVALID_IDENTITY_CONTINUITY').length}`)
  console.log(`Active-roster duplicate IDs: ${activeIds.length - activeIdSet.size}\n`)

  console.log('DETERMINISM\n')
  console.log(`Same input state: ${pass(sameInput)}`)
  console.log(`Program-order independence: ${pass(orderIndependent)}`)
  console.log(`Recruit-order independence: ${pass(orderIndependent)}`)
  console.log(`Returner-order independence: ${pass(orderIndependent)}`)
  console.log(`Source state unchanged: ${pass(JSON.stringify(sources) === sourceJson)}\n`)

  const charlotte = assembly.programs[CHARLOTTE_ID]!
  const charlotteReturnerIds = new Set(
    sources.offseason.programs[CHARLOTTE_ID]!.returningPlayers.map(({ id }) => id),
  )
  console.log('CHARLOTTE TECH — NEXT-SEASON ROSTER\n')
  console.log('RETURNERS')
  for (const player of charlotte.players.filter(({ id }) => charlotteReturnerIds.has(id))) {
    console.log(`${fullName(player)} | ${player.position} | ${player.classYear} | OVR ${calculateOverall(player)} | POT ${player.potential} | ${player.id}`)
  }
  console.log('\nINCOMING')
  for (const player of charlotte.players.filter(({ id }) => incomingIds.has(id))) {
    const recruit = recruitsById.get(player.id)!
    const commitment = recruiting.commitmentsByPlayerId[player.id]!
    console.log(`${fullName(player)} | ${player.position} | ${player.classYear} | OVR ${calculateOverall(player)} | POT ${player.potential} | ${player.id} | NATL #${recruit.nationalRank} | ${'★'.repeat(recruit.stars)} | ${timingLabel(commitment.timing)}`)
  }

  const identityReturner = sources.offseason.programs[CHARLOTTE_ID]!.returningPlayers[0]!
  const archivedReturner = sources.completedSeasonArchive.season.programStates[CHARLOTTE_ID]!.team.roster
    .find(({ id }) => id === identityReturner.id)!
  const assembledReturner = charlotte.players.find(({ id }) => id === identityReturner.id)!
  const incomingExample = charlotte.players.find(({ id }) => incomingIds.has(id))!
  const recruitExample = recruitsById.get(incomingExample.id)!
  const charlotteGraduate = sources.completedSeasonArchive.season.programStates[CHARLOTTE_ID]!.team.roster
    .find(({ classYear }) => classYear === 'SR')!
  console.log('\nCHARLOTTE IDENTITY EXAMPLES\n')
  console.log(`Returner: Season 1 ${fullName(archivedReturner)} ${archivedReturner.classYear} OVR ${calculateOverall(archivedReturner)} → Offseason ${identityReturner.classYear} OVR ${calculateOverall(identityReturner)} → Assembled ${assembledReturner.classYear} OVR ${calculateOverall(assembledReturner)} | ID ${assembledReturner.id}`)
  console.log(`Incoming: Recruit ${fullName(recruitExample.player)} #${recruitExample.nationalRank} ${'★'.repeat(recruitExample.stars)} → Assembled ${incomingExample.classYear} OVR ${calculateOverall(incomingExample)} | ID ${incomingExample.id}`)
  console.log(`Graduate: Season 1 ${fullName(charlotteGraduate)} ${charlotteGraduate.classYear} → graduated → absent ${pass(!activeIdSet.has(charlotteGraduate.id))} | archived ${pass(sources.completedSeasonArchive.season.programStates[CHARLOTTE_ID]!.team.roster.some(({ id }) => id === charlotteGraduate.id))}`)
}

main()
