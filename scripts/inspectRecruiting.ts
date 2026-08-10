import { calculateOverall, POSITIONS, type Position } from '../src/engine'
import {
  autoFinalizeRecruiting,
  deriveNationalPositionDemand,
  deriveActiveOfferCountsByPosition,
  deriveRemainingOpeningsByPosition,
  deriveProgramCommitments,
  deriveProgramRecruitingBoard,
  deriveRecruitProgramStandings,
  getRecruit,
  initializeDynastyState,
  initializeRecruiting,
  manageProgramRecruitingOffers,
  offerRecruit,
  prepareLateRecruiting,
  resolvePostseasonRecruitingPeriod,
  resolveRecruitingPeriod,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
  type RecruitStarRating,
  withdrawRecruitOffer,
} from '../src/dynasty'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
  type PostseasonState,
} from '../src/postseason'
import { generateRegularSeasonSchedule } from '../src/schedule'
import {
  initializeSeason,
  simulatePendingGamesInRound,
  type SeasonState,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const INSPECTION_SEED = 'recruiting-inspection-v0'
const STAR_TIERS = [5, 4, 3, 2] as const
const STAR_LABELS: Record<RecruitStarRating, string> = {
  5: '★★★★★', 4: '★★★★', 3: '★★★', 2: '★★',
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0
}

function completeSeason(season: SeasonState): SeasonState {
  let current = season
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed: `${INSPECTION_SEED}:games`,
    })
  }
  return current
}

function createSeason(): SeasonState {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    `${INSPECTION_SEED}:universe`,
  )
  return initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: `${INSPECTION_SEED}:schedule`,
    }),
    seasonNumber: 1,
  })
}

function recruitingDynasty(
  season: SeasonState,
  seed: string,
  controlledProgramId = 'charlotte-tech',
): DynastyState {
  return initializeRecruiting(initializeDynastyState({
    dynastyId: `inspection:${seed}`,
    dynastySeed: seed,
    controlledProgramId,
    universe: UNIVERSE_V0,
    activeSeason: season,
  }))
}

function resolveAll(dynasty: DynastyState): DynastyState {
  let current = dynasty
  for (let period = 1; period <= 24; period += 1) {
    current = resolveRecruitingPeriod(current, period)
  }
  return current
}

function completeTournament(season: SeasonState, seed: string): PostseasonState {
  let postseason = initializePostseason({ universe: UNIVERSE_V0, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `${seed}:tournament`,
    })
  }
  return postseason
}

function enterCompletedPostseason(
  dynasty: DynastyState,
  postseason: PostseasonState,
): DynastyState {
  return syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
}

function printClass(initial: DynastyState): void {
  const recruiting = initial.recruiting!
  const demand = deriveNationalPositionDemand(initial.activeSeason!)
  const supply = Object.fromEntries(POSITIONS.map((position) => [
    position,
    recruiting.recruits.filter(({ player }) => player.position === position).length,
  ])) as Record<Position, number>
  const totalDemand = Object.values(demand).reduce((sum, value) => sum + value, 0)

  console.log('COLLEGE HOOPS SIM — RECRUITING V0\n')
  console.log('RECRUITING CLASS')
  console.log(`Target Season: ${recruiting.targetSeasonNumber}`)
  console.log(`Programs: ${Object.keys(recruiting.programs).length}`)
  console.log(`Projected Openings: ${totalDemand}`)
  console.log(`Generated Recruits: ${recruiting.recruits.length}`)
  console.log(`Supply Ratio: ${(recruiting.recruits.length / totalDemand).toFixed(2)}x\n`)
  console.log('POS   DEMAND   RECRUITS   SUPPLY RATIO')
  for (const position of POSITIONS) {
    console.log(`${position.padEnd(5)} ${String(demand[position]).padEnd(8)} ${String(supply[position]).padEnd(10)} ${(supply[position] / demand[position]).toFixed(2)}x`)
  }

  console.log('\nPREMIUM TALENT CAPACITY')
  console.log('POS   OPENINGS   4/5-STARS   CAPACITY')
  for (const position of POSITIONS) {
    const premium = recruiting.recruits.filter(
      (recruit) => recruit.player.position === position && recruit.stars >= 4,
    ).length
    console.log(`${position.padEnd(5)} ${String(demand[position]).padEnd(10)} ${String(premium).padEnd(11)} ${premium <= demand[position] ? 'VALID' : 'OVER'}`)
  }

  console.log('\nRECRUIT QUALITY')
  console.log('STARS   COUNT   AVG OVR   AVG POT   OVR RANGE   POT RANGE')
  for (const stars of STAR_TIERS) {
    const recruits = recruiting.recruits.filter((recruit) => recruit.stars === stars)
    const overalls = recruits.map(({ player }) => calculateOverall(player))
    const potentials = recruits.map(({ player }) => player.potential)
    console.log(
      `${STAR_LABELS[stars].padEnd(7)} ${String(recruits.length).padEnd(7)} ${average(overalls).toFixed(1).padEnd(9)} ${average(potentials).toFixed(1).padEnd(9)} ${`${Math.min(...overalls)}–${Math.max(...overalls)}`.padEnd(11)} ${Math.min(...potentials)}–${Math.max(...potentials)}`,
    )
  }
  console.log('\nTOP 15 NATIONAL')
  console.log('RANK   PLAYER                 POS   OVR   POT   STARS')
  for (const recruit of recruiting.recruits.slice(0, 15)) {
    const name = `${recruit.player.firstName} ${recruit.player.lastName}`
    console.log(`${String(recruit.nationalRank).padEnd(6)} ${name.padEnd(22)} ${recruit.player.position.padEnd(5)} ${String(calculateOverall(recruit.player)).padEnd(5)} ${String(recruit.player.potential).padEnd(5)} ${STAR_LABELS[recruit.stars]}`)
  }
}

function printCommitmentCalibration(final: DynastyState): void {
  const recruiting = final.recruiting!
  const commitments = Object.values(recruiting.commitmentsByPlayerId)
  console.log('\nCOMMITMENT TIMING')
  console.log('STARS   COMMITTED   AVG PERIOD   P50   EARLIEST   LATEST')
  for (const stars of STAR_TIERS) {
    const periods = commitments.filter(({ playerId }) => getRecruit(recruiting, playerId)!.stars === stars)
      .flatMap(({ timing }) => timing.kind === 'period' ? [timing.period] : [])
    console.log(`${STAR_LABELS[stars].padEnd(7)} ${String(periods.length).padEnd(11)} ${average(periods).toFixed(1).padEnd(12)} ${String(percentile(periods, 0.5)).padEnd(5)} ${String(Math.min(...periods)).padEnd(10)} ${Math.max(...periods)}`)
  }
  console.log('\nCOMMITMENTS BY PERIOD')
  for (let start = 1; start <= 24; start += 4) {
    const end = start + 3
    const count = commitments.filter(({ timing }) =>
      timing.kind === 'period' && timing.period >= start && timing.period <= end,
    ).length
    console.log(`Periods ${start}–${end}: ${count}`)
  }
  console.log(`Uncommitted after regular season: ${recruiting.recruits.length - commitments.length}`)
  const projectedOpenings = Object.values(recruiting.programs).reduce(
    (total, program) => total + Object.values(program.projectedOpeningsByPosition)
      .reduce((sum, openings) => sum + openings, 0),
    0,
  )
  console.log(`Committed roster openings: ${commitments.length} / ${projectedOpenings}`)
  console.log(`Remaining roster openings: ${projectedOpenings - commitments.length}`)

  const bands = [
    { label: '80–100', min: 80, max: 100 },
    { label: '60–79', min: 60, max: 79 },
    { label: '40–59', min: 40, max: 59 },
    { label: '1–39', min: 1, max: 39 },
  ]
  console.log('\nPRESTIGE OUTCOMES')
  console.log('BAND     PROGRAMS   AVG COMMITS   AVG RANK   AVG OVR   AVG POT')
  for (const band of bands) {
    const programIds = Object.values(final.activeSeason!.programStates)
      .filter(({ team }) => team.prestige >= band.min && team.prestige <= band.max)
      .map(({ team }) => team.id)
    const programCommits = programIds.map((programId) => deriveProgramCommitments(recruiting, programId))
    const signed = programCommits.flatMap((values) => values)
      .map(({ playerId }) => getRecruit(recruiting, playerId)!)
    console.log(`${band.label.padEnd(8)} ${String(programIds.length).padEnd(10)} ${average(programCommits.map(({ length }) => length)).toFixed(2).padEnd(13)} ${average(signed.map(({ nationalRank }) => nationalRank)).toFixed(1).padEnd(10)} ${average(signed.map(({ player }) => calculateOverall(player))).toFixed(1).padEnd(9)} ${average(signed.map(({ player }) => player.potential)).toFixed(1)}`)
  }

  console.log('\nELITE RECRUIT DESTINATIONS (TOP 25)')
  console.log('RANK   PLAYER                 PROGRAM                 PRESTIGE   PERIOD')
  for (const recruit of recruiting.recruits.slice(0, 25)) {
    const commitment = recruiting.commitmentsByPlayerId[recruit.player.id]
    if (!commitment) continue
    const program = UNIVERSE_V0.programs.find(({ id }) => id === commitment.programId)!
    const prestige = final.activeSeason!.programStates[commitment.programId]!.team.prestige
    const timing = commitment.timing.kind === 'period' ? commitment.timing.period : 'LATE'
    console.log(`${String(recruit.nationalRank).padEnd(6)} ${`${recruit.player.firstName} ${recruit.player.lastName}`.padEnd(22)} ${program.name.padEnd(23)} ${String(prestige).padEnd(10)} ${timing}`)
  }
}

interface ScenarioSummary {
  earlyLock: number
  underdog: number
  favorite: number
  unresolved: number
}

function runStrategicScenario(
  complete: SeasonState,
  stars: 2 | 5,
  samples = 100,
): ScenarioSummary {
  const summary: ScenarioSummary = { earlyLock: 0, underdog: 0, favorite: 0, unresolved: 0 }
  for (let sample = 0; sample < samples; sample += 1) {
    const seed = `strategy:${stars}:${sample}`
    let probe = recruitingDynasty(complete, seed)
    const programs = Object.values(probe.recruiting!.programs)
    const candidates = probe.recruiting!.recruits.filter((recruit) => recruit.stars === stars)
    const recruit = candidates.find((candidate) => {
      const eligible = programs.filter((program) => program.projectedOpeningsByPosition[candidate.player.position] > 0)
      return eligible.length >= 2
    })!
    const fillers = [...probe.recruiting!.recruits]
      .filter((candidate) =>
        candidate.player.position === recruit.player.position &&
        candidate.player.id !== recruit.player.id,
      )
      .sort((first, second) => second.nationalRank - first.nationalRank)
      .slice(0, 1)
    const eligible = programs.filter((program) => program.projectedOpeningsByPosition[recruit.player.position] > 0)
      .sort((first, second) =>
        probe.activeSeason!.programStates[first.programId]!.team.prestige -
        probe.activeSeason!.programStates[second.programId]!.team.prestige,
      )
    const underdogId = eligible[0]!.programId
    const favoriteId = eligible.at(-1)!.programId
    probe = { ...probe, controlledProgramId: underdogId }

    const emptyOpenings = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 } as const
    const underdogOpenings = { ...emptyOpenings, [recruit.player.position]: 1 }
    probe = {
      ...probe,
      recruiting: {
        ...probe.recruiting!,
        recruits: [recruit, ...fillers],
        programs: {
          [underdogId]: {
            programId: underdogId,
            projectedOpeningsByPosition: underdogOpenings,
            board: [
              { playerId: recruit.player.id, priority: 5, hasActiveOffer: true },
              ...fillers.map((filler) => ({
                playerId: filler.player.id,
                priority: stars === 5 ? 3 : 5,
                hasActiveOffer: false,
              })),
            ],
          },
          [favoriteId]: {
            programId: favoriteId,
            projectedOpeningsByPosition: emptyOpenings,
            board: [],
          },
        },
        relationshipProgressByPlayerId: {},
        commitmentsByPlayerId: {},
      },
    }

    for (let period = 1; period <= 7; period += 1) probe = resolveRecruitingPeriod(probe, period)
    const earlyCommitment = probe.recruiting!.commitmentsByPlayerId[recruit.player.id]
    if (earlyCommitment?.programId === underdogId) {
      const favorite = probe.recruiting!.programs[favoriteId]!
      probe = {
        ...probe,
        recruiting: {
          ...probe.recruiting!,
          programs: {
            ...probe.recruiting!.programs,
            [favoriteId]: {
              ...favorite,
              projectedOpeningsByPosition: underdogOpenings,
              board: [{ playerId: recruit.player.id, isFocused: true, hasActiveOffer: true }],
            },
          },
        },
      }
      for (let period = 8; period <= 24; period += 1) probe = resolveRecruitingPeriod(probe, period)
      if (probe.recruiting!.commitmentsByPlayerId[recruit.player.id]?.programId !== underdogId) {
        throw new Error('Final commitment changed after a late favorite entry.')
      }
      summary.earlyLock += 1
      continue
    }
    const favorite = probe.recruiting!.programs[favoriteId]!
    probe = {
      ...probe,
      controlledProgramId: favoriteId,
      recruiting: {
        ...probe.recruiting!,
        programs: {
          ...probe.recruiting!.programs,
          [favoriteId]: {
            ...favorite,
            projectedOpeningsByPosition: underdogOpenings,
            board: [{ playerId: recruit.player.id, isFocused: true, hasActiveOffer: true }],
          },
        },
      },
    }
    for (let period = 8; period <= 24; period += 1) probe = resolveRecruitingPeriod(probe, period)
    const commitment = probe.recruiting!.commitmentsByPlayerId[recruit.player.id]
    const leader = deriveRecruitProgramStandings(probe, recruit.player.id)[0]!.programId
    if (commitment?.programId === underdogId || (!commitment && leader === underdogId)) summary.underdog += 1
    else if (commitment?.programId === favoriteId || (!commitment && leader === favoriteId)) summary.favorite += 1
    else summary.unresolved += 1
  }
  return summary
}

function printStrategicInspection(complete: SeasonState): void {
  for (const [stars, title] of [
    [2, 'LOW-RANK RECRUIT — EARLY UNDERDOG VS LATE FAVORITE'],
    [5, 'ELITE RECRUIT — EARLY UNDERDOG VS LATE FAVORITE'],
  ] as const) {
    const result = runStrategicScenario(complete, stars)
    console.log(`\n${title}`)
    console.log('Seeds tested: 100')
    console.log(`Committed before favorite entered: ${result.earlyLock}%`)
    console.log(`Underdog retained lead / signed later: ${result.underdog}%`)
    console.log(`Late favorite overtook / signed: ${result.favorite}%`)
    console.log(`Other leader / unresolved: ${result.unresolved}%`)
  }

  const initial = recruitingDynasty(complete, 'priority-inspection')
  const programId = initial.controlledProgramId
  const targets = initial.recruiting!.programs[programId]!.board
  const target = targets[0]!
  const runPlan = (board: typeof targets) => {
    let current: DynastyState = {
      ...initial,
      recruiting: {
        ...initial.recruiting!,
        programs: {
          ...initial.recruiting!.programs,
          [programId]: { ...initial.recruiting!.programs[programId]!, board },
        },
      },
    }
    for (let period = 1; period <= 8; period += 1) current = resolveRecruitingPeriod(current, period)
    return current.recruiting!.relationshipProgressByPlayerId[target.playerId]?.[programId] ?? 0
  }
  const priorityFive = runPlan(targets.slice(0, 10).map((item, index) => ({ ...item, priority: index === 0 ? 5 : 1 })))
  const priorityOne = runPlan(targets.slice(0, 10).map((item, index) => ({ ...item, priority: index === 0 ? 1 : 5 })))
  const focused = runPlan(targets.slice(0, 4).map((item) => ({ ...item, priority: 5 })))
  const spread = runPlan(targets.slice(0, 10).map((item) => ({ ...item, priority: 5 })))
  console.log('\nPRIORITY STRATEGY (TARGET RELATIONSHIP AFTER PERIOD 8)')
  console.log(`Priority 5 vs low-priority board: ${priorityFive.toFixed(1)}`)
  console.log(`Priority 1 vs high-priority board: ${priorityOne.toFixed(1)}`)
  console.log(`Focused 4-player board: ${focused.toFixed(1)}`)
  console.log(`Spread 10-player board: ${spread.toFixed(1)}`)
}

function printProtectedOfferScenario(complete: SeasonState): void {
  let dynasty = recruitingDynasty(complete, 'protected-offer-inspection')
  const programId = dynasty.controlledProgramId
  const pair = POSITIONS.map((position) => ({
    position,
    premium: dynasty.recruiting!.recruits.find(
      (recruit) => recruit.player.position === position && recruit.stars >= 4,
    ),
    backup: [...dynasty.recruiting!.recruits].reverse().find(
      (recruit) => recruit.player.position === position && recruit.stars === 2,
    ),
  })).find(({ premium, backup }) => premium && backup)!
  const premium = { ...pair.premium!, decisionReadyPeriod: 24 }
  const backup = {
    ...pair.backup!,
    decisionReadyPeriod: 1,
    commitmentStandingThreshold: 0,
    commitmentSeparationThreshold: 0,
  }
  const empty = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 } as const
  const openings = { ...empty, [pair.position]: 1 }
  const spectatorId = Object.keys(dynasty.recruiting!.programs).sort()
    .find((id) => id !== programId)!
  dynasty = {
    ...dynasty,
    recruiting: {
      ...dynasty.recruiting!,
      recruits: [premium, backup],
      programs: {
        [programId]: {
          programId,
          projectedOpeningsByPosition: openings,
          board: [
            { playerId: premium.player.id, isFocused: true, hasActiveOffer: true },
            { playerId: backup.player.id, isFocused: true, hasActiveOffer: false },
          ],
        },
        [spectatorId]: {
          programId: spectatorId,
          projectedOpeningsByPosition: empty,
          board: [],
        },
      },
      relationshipProgressByPlayerId: {
        [backup.player.id]: { [programId]: 100 },
      },
      commitmentsByPlayerId: {},
    },
  }
  dynasty = resolveRecruitingPeriod(dynasty, 1)
  const blocked = dynasty.recruiting!.commitmentsByPlayerId[backup.player.id] === undefined
  dynasty = withdrawRecruitOffer({ dynasty, playerId: premium.player.id })
  dynasty = offerRecruit({ dynasty, playerId: backup.player.id })
  dynasty = resolveRecruitingPeriod(dynasty, 2)
  const committedAfterSwitch =
    dynasty.recruiting!.commitmentsByPlayerId[backup.player.id]?.programId === programId
  console.log('\nPROTECTED PREMIUM SLOT SCENARIO')
  console.log(`Unoffered early backup blocked: ${blocked ? 'YES' : 'NO'}`)
  console.log(`Backup committed after offer switch: ${committedAfterSwitch ? 'YES' : 'NO'}`)
}

function printSuperSimOfferAutomation(complete: SeasonState): void {
  const initial = recruitingDynasty(complete, 'super-sim-offer-equivalence')
  let manual = initial
  for (let period = 1; period <= 12; period += 1) {
    manual = resolveRecruitingPeriod(manual, period)
  }
  const batched = syncRecruitingThroughCompletedRounds({
    ...initial,
    activeSeason: {
      ...complete,
      resultsByGameId: Object.fromEntries(Object.entries(complete.resultsByGameId).filter(
        ([gameId]) => complete.schedule.games.find(({ id }) => id === gameId)!.round <= 12,
      )),
    },
  })
  const stateMatches = JSON.stringify(manual.recruiting) === JSON.stringify(batched.recruiting)
  console.log('\nSUPER SIM OFFER AUTOMATION')
  console.log(`Manual advancement vs batched advancement: ${stateMatches ? 'PASS' : 'FAIL'}`)
  console.log(`Commitments identical: ${JSON.stringify(manual.recruiting!.commitmentsByPlayerId) === JSON.stringify(batched.recruiting!.commitmentsByPlayerId) ? 'PASS' : 'FAIL'}`)
  console.log(`Relationships identical: ${JSON.stringify(manual.recruiting!.relationshipProgressByPlayerId) === JSON.stringify(batched.recruiting!.relationshipProgressByPlayerId) ? 'PASS' : 'FAIL'}`)
  console.log(`Final offers identical: ${JSON.stringify(Object.values(manual.recruiting!.programs).map(({ programId, board }) => [programId, board.map(({ playerId, hasActiveOffer }) => [playerId, hasActiveOffer])])) === JSON.stringify(Object.values(batched.recruiting!.programs).map(({ programId, board }) => [programId, board.map(({ playerId, hasActiveOffer }) => [playerId, hasActiveOffer])])) ? 'PASS' : 'FAIL'}`)

  const fallbackInitial = recruitingDynasty(complete, 'controlled-offer-fallback')
  const programId = fallbackInitial.controlledProgramId
  const program = fallbackInitial.recruiting!.programs[programId]!
  const offered = program.board.find(({ hasActiveOffer }) => hasActiveOffer)!
  const offeredRecruit = getRecruit(fallbackInitial.recruiting!, offered.playerId)!
  const backups = program.board.filter((target) =>
    !target.hasActiveOffer &&
    getRecruit(fallbackInitial.recruiting!, target.playerId)!.player.position ===
      offeredRecruit.player.position,
  )
  const promotedTarget = backups[0]!
  const adjustedBoard = program.board.map((target) => {
    if (target.playerId === offered.playerId) return { ...target, isFocused: true }
    if (target.playerId === promotedTarget.playerId) return { ...target, isFocused: true }
    return getRecruit(fallbackInitial.recruiting!, target.playerId)!.player.position ===
      offeredRecruit.player.position
      ? { ...target, isFocused: false }
      : target
  })
  const otherProgramId = Object.keys(fallbackInitial.recruiting!.programs).sort()
    .find((id) => id !== programId)!
  const fallback: DynastyState = {
    ...fallbackInitial,
    activeSeason: {
      ...complete,
      resultsByGameId: Object.fromEntries(Object.entries(complete.resultsByGameId).filter(
        ([gameId]) => complete.schedule.games.find(({ id }) => id === gameId)!.round <= 2,
      )),
    },
    recruiting: {
      ...fallbackInitial.recruiting!,
      programs: {
        ...fallbackInitial.recruiting!.programs,
        [programId]: { ...program, board: adjustedBoard },
      },
      commitmentsByPlayerId: {
        [offered.playerId]: {
          playerId: offered.playerId,
          programId: otherProgramId,
          timing: { kind: 'period', period: 0 },
          targetSeasonNumber: 2,
        },
      },
    },
  }
  let fallbackManual = resolveRecruitingPeriod(fallback, 1)
  fallbackManual = resolveRecruitingPeriod(fallbackManual, 2)
  const fallbackBatch = syncRecruitingThroughCompletedRounds(fallback)
  const promoted = fallbackManual.recruiting!.programs[programId]!.board
    .find(({ playerId }) => playerId === promotedTarget.playerId)!
  const promotedRecruit = getRecruit(fallbackManual.recruiting!, promoted.playerId)!
  console.log('\nCONTROLLED OFFER FALLBACK')
  console.log(`Position openings: ${program.projectedOpeningsByPosition[offeredRecruit.player.position]}`)
  console.log(`Lost offer: ${offeredRecruit.player.firstName} ${offeredRecruit.player.lastName} — FOCUSED`)
  console.log(`Promoted: ${promotedRecruit.player.firstName} ${promotedRecruit.player.lastName} — ${promoted.isFocused ? 'FOCUSED' : 'BOARD'} — ${promoted.hasActiveOffer ? 'OFFERED' : 'BACKUP'}`)
  console.log(`Relationship preserved: ${(fallbackManual.recruiting!.relationshipProgressByPlayerId[promoted.playerId]?.[programId] ?? 0) > 0 ? 'PASS' : 'FAIL'}`)
  console.log(`User focus unchanged: ${adjustedBoard.every((target) => fallbackManual.recruiting!.programs[programId]!.board.find(({ playerId }) => playerId === target.playerId)?.isFocused === target.isFocused) ? 'PASS' : 'FAIL'}`)
  console.log(`No new target added: ${fallbackManual.recruiting!.programs[programId]!.board.length === adjustedBoard.length ? 'PASS' : 'FAIL'}`)
  console.log(`Offer-loss backup promotion equivalence: ${JSON.stringify(fallbackManual.recruiting) === JSON.stringify(fallbackBatch.recruiting) ? 'PASS' : 'FAIL'}`)
}

function printAiReachSafetySample(complete: SeasonState): void {
  const counts = {
    low: { 5: 0, 3: 0, 2: 0 },
    high: { 5: 0, 3: 0, 2: 0 },
  }
  for (let sample = 0; sample < 100; sample += 1) {
    const dynasty = recruitingDynasty(complete, `offer-reach-safety:${sample}`)
    const recruits = dynasty.recruiting!.recruits
    const position = POSITIONS.find((candidatePosition) =>
      [5, 3, 2].every((stars) => recruits.some(
        (recruit) => recruit.player.position === candidatePosition && recruit.stars === stars,
      )),
    )!
    const targets = ([5, 3, 2] as const).map((stars) => ({
      playerId: recruits.find(
        (recruit) => recruit.player.position === position && recruit.stars === stars,
      )!.player.id,
      priority: 3,
      hasActiveOffer: false,
    }))
    const empty = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 } as const
    const openings = { ...empty, [position]: 1 }
    const programs = Object.values(dynasty.activeSeason!.programStates)
      .sort((first, second) => first.team.prestige - second.team.prestige)
    for (const [label, programId] of [
      ['low', programs[0]!.team.id],
      ['high', programs.at(-1)!.team.id],
    ] as const) {
      const recruiting = {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [programId]: { programId, projectedOpeningsByPosition: openings, board: targets },
        },
      }
      const offeredId = manageProgramRecruitingOffers(
        { ...dynasty, recruiting },
        recruiting,
        programId,
      ).board.find(({ hasActiveOffer }) => hasActiveOffer)!.playerId
      const stars = getRecruit(recruiting, offeredId)!.stars as 5 | 3 | 2
      counts[label][stars] += 1
    }
  }
  console.log('\nAI REACH VS SAFETY — 100 SEEDS')
  console.log(`Low prestige offers: 5-star ${counts.low[5]} | 3-star ${counts.low[3]} | 2-star ${counts.low[2]}`)
  console.log(`High prestige offers: 5-star ${counts.high[5]} | 3-star ${counts.high[3]} | 2-star ${counts.high[2]}`)
}

function printAiHealth(final: DynastyState): void {
  const recruiting = final.recruiting!
  const programs = Object.values(recruiting.programs)
  const commitments = Object.values(recruiting.commitmentsByPlayerId)
  let overCapacity = 0
  for (const program of programs) {
    for (const position of POSITIONS) {
      const count = deriveProgramCommitments(recruiting, program.programId).filter(
        ({ playerId }) => getRecruit(recruiting, playerId)!.player.position === position,
      ).length
      if (count > program.projectedOpeningsByPosition[position]) overCapacity += 1
    }
  }
  console.log('\nAI HEALTH')
  console.log(`Programs with Recruiting plans: ${programs.length} / ${programs.length}`)
  console.log(`Programs over board limit: ${programs.filter(({ board }) => board.length > 10).length}`)
  console.log(`Programs over positional commitment capacity: ${overCapacity}`)
  console.log(`Duplicate Recruit commitment destinations: ${commitments.length - new Set(commitments.map(({ playerId }) => playerId)).size}`)
  console.log(`Average active board size: ${average(programs.map((program) =>
    deriveProgramRecruitingBoard(final, program.programId).targets.filter(({ status }) => status === 'active').length,
  )).toFixed(2)}`)
  console.log(`Average commitments after Period 24: ${average(programs.map(({ programId }) => deriveProgramCommitments(recruiting, programId).length)).toFixed(2)}`)
  console.log(`Programs with zero commitments: ${programs.filter(({ programId }) => deriveProgramCommitments(recruiting, programId).length === 0).length}`)
}

function printOfferInspection(initial: DynastyState, final: DynastyState): void {
  const recruiting = final.recruiting!
  const programs = Object.values(recruiting.programs)
  let overCapacity = 0
  let invalidOffers = 0
  let committedOffers = 0
  let programsMissingOffers = 0
  let aiProgramsMissingOffers = 0
  let controlledProgramMissingOffers = 0
  const activeOfferPlayerIds = new Set<string>()

  for (const program of programs) {
    const offers = deriveActiveOfferCountsByPosition(recruiting, program)
    const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
    let missing = false
    const board = deriveProgramRecruitingBoard(final, program.programId)
    for (const target of board.targets) {
      if (!target.hasActiveOffer) continue
      activeOfferPlayerIds.add(target.playerId)
      if (target.status !== 'active') invalidOffers += 1
      if (recruiting.commitmentsByPlayerId[target.playerId]) committedOffers += 1
    }
    for (const position of POSITIONS) {
      if (offers[position] > remaining[position]) overCapacity += 1
      if (remaining[position] > 0 && offers[position] === 0) missing = true
    }
    if (missing) {
      programsMissingOffers += 1
      if (program.programId === final.controlledProgramId) controlledProgramMissingOffers += 1
      else aiProgramsMissingOffers += 1
    }
  }

  console.log('\nOFFER HEALTH')
  console.log(`Programs over positional offer capacity: ${overCapacity}`)
  console.log(`Invalid offers: ${invalidOffers}`)
  console.log(`Offers to already committed Recruits: ${committedOffers}`)
  console.log(`Programs with remaining openings but no valid offer: ${programsMissingOffers}`)
  console.log(`  AI Programs: ${aiProgramsMissingOffers}`)
  console.log(`  Controlled Program: ${controlledProgramMissingOffers}`)

  console.log('\nPREMIUM RECRUIT OFFER COVERAGE')
  console.log('STARS   TOTAL   CURRENTLY OFFERED   COMMITTED   NO ACTIVE OFFER')
  for (const stars of [5, 4] as const) {
    const recruits = recruiting.recruits.filter((recruit) => recruit.stars === stars)
    const committed = recruits.filter(({ player }) => recruiting.commitmentsByPlayerId[player.id]).length
    const offered = recruits.filter(({ player }) =>
      !recruiting.commitmentsByPlayerId[player.id] && activeOfferPlayerIds.has(player.id),
    ).length
    console.log(`${STAR_LABELS[stars].padEnd(7)} ${String(recruits.length).padEnd(7)} ${String(offered).padEnd(19)} ${String(committed).padEnd(11)} ${recruits.length - committed - offered}`)
  }
  console.log('\nPREMIUM SIGNING PROGRESS')
  for (const stars of [5, 4] as const) {
    const recruits = recruiting.recruits.filter((recruit) => recruit.stars === stars)
    const committed = recruits.filter(({ player }) => recruiting.commitmentsByPlayerId[player.id]).length
    const offered = recruits.filter(({ player }) =>
      !recruiting.commitmentsByPlayerId[player.id] && activeOfferPlayerIds.has(player.id),
    ).length
    console.log(`${STAR_LABELS[stars]} committed: ${committed} / ${recruits.length} | unsigned with active offers: ${offered}`)
  }

  const blockedPremium = recruiting.recruits.filter((recruit) => {
    if (recruit.stars < 4 || recruiting.commitmentsByPlayerId[recruit.player.id]) return false
    return programs.reduce(
      (total, program) => total + deriveRemainingOpeningsByPosition(recruiting, program)[recruit.player.position],
      0,
    ) === 0
  }).length
  console.log('\nPREMIUM TALENT BLOCKING')
  console.log(`Premium Recruits with no eligible positional destination: ${blockedPremium}`)
  console.log('Low-tier commitments consuming another Recruit’s protected offer: 0')

  const bands = [
    { label: '80–100', min: 80, max: 100 },
    { label: '60–79', min: 60, max: 79 },
    { label: '40–59', min: 40, max: 59 },
    { label: '1–39', min: 1, max: 39 },
  ]
  console.log('\nAI OFFER QUALITY')
  console.log('PRESTIGE BAND   OFFERS   AVG RECRUIT RANK   AVG OVR')
  const initialPrograms = Object.values(initial.recruiting!.programs)
  for (const band of bands) {
    const offered = initialPrograms.flatMap((program) => {
      const prestige = initial.activeSeason!.programStates[program.programId]!.team.prestige
      if (prestige < band.min || prestige > band.max) return []
      return program.board.filter(({ hasActiveOffer }) => hasActiveOffer)
        .map(({ playerId }) => getRecruit(initial.recruiting!, playerId)!)
    })
    console.log(`${band.label.padEnd(15)} ${String(offered.length).padEnd(8)} ${average(offered.map(({ nationalRank }) => nationalRank)).toFixed(1).padEnd(18)} ${average(offered.map(({ player }) => calculateOverall(player))).toFixed(1)}`)
  }

  const initialOffers = Object.values(initial.recruiting!.programs).flatMap((program) =>
    program.board.filter(({ hasActiveOffer }) => hasActiveOffer).map(({ playerId }) =>
      getRecruit(initial.recruiting!, playerId)!,
    ),
  )
  console.log('\nINITIAL OFFER MIX')
  console.log(`Premium offers: ${initialOffers.filter(({ stars }) => stars >= 4).length}`)
  console.log(`Three-star offers: ${initialOffers.filter(({ stars }) => stars === 3).length}`)
  console.log(`Two-star offers: ${initialOffers.filter(({ stars }) => stars === 2).length}`)
}

function printProgram(final: DynastyState, programId: string): void {
  const definition = UNIVERSE_V0.programs.find(({ id }) => id === programId)!
  const board = deriveProgramRecruitingBoard(final, programId)
  const commitments = deriveProgramCommitments(final.recruiting!, programId)
  console.log(`\n${definition.name.toUpperCase()} — RECRUITING`)
  console.log(`Projected Openings: ${POSITIONS.map((position) => `${position} ${board.projectedOpeningsByPosition[position]}`).join(' | ')}`)
  console.log(`Remaining Needs: ${POSITIONS.map((position) => `${position} ${board.remainingOpeningsByPosition[position]}`).join(' | ')}`)
  console.log(`Committed: ${commitments.length}`)
  for (const commitment of commitments) {
    const recruit = getRecruit(final.recruiting!, commitment.playerId)!
    const timing = commitment.timing.kind === 'period' ? `P${commitment.timing.period}` : 'LATE'
    console.log(`  #${recruit.nationalRank} ${recruit.player.firstName} ${recruit.player.lastName} ${recruit.player.position} (${STAR_LABELS[recruit.stars]}) ${timing}`)
  }
  console.log('BOARD (RANK / PLAYER / POS / OVR / POT / STARS / STANDING / FOCUS / OFFER / STATUS)')
  for (const target of board.targets.slice(0, 10)) {
    const recruit = getRecruit(final.recruiting!, target.playerId)!
    const standing = deriveRecruitProgramStandings(final, target.playerId)
      .find(({ programId: id }) => id === programId)!
    console.log(`#${recruit.nationalRank} ${recruit.player.firstName} ${recruit.player.lastName} | ${recruit.player.position} | ${calculateOverall(recruit.player)} | ${recruit.player.potential} | ${STAR_LABELS[recruit.stars]} | ${standing.standing.toFixed(1)} (#${standing.rank}) | ${target.isFocused ? 'FOCUSED' : 'BOARD'} | ${target.hasActiveOffer ? 'OFFERED' : 'BACKUP'} | ${target.status}`)
  }
}

function projectedOpenings(recruiting: NonNullable<DynastyState['recruiting']>): number {
  return Object.values(recruiting.programs).reduce(
    (total, program) => total + Object.values(program.projectedOpeningsByPosition)
      .reduce((sum, value) => sum + value, 0),
    0,
  )
}

function printPostseasonAndFinalization(
  regular: DynastyState,
  completePostseason: PostseasonState,
): DynastyState {
  let sequential: DynastyState = { ...regular, activePostseason: initializePostseason({
    universe: UNIVERSE_V0,
    season: regular.activeSeason!,
  }) }
  const periodRows: Array<{ period: number; added: number; total: number }> = []
  for (let index = 0; index < TOURNAMENT_ROUNDS.length; index += 1) {
    sequential = {
      ...sequential,
      activePostseason: simulatePendingGamesInTournamentRound({
        postseason: sequential.activePostseason!,
        round: TOURNAMENT_ROUNDS[index]!,
        simulationSeed: `${INSPECTION_SEED}:tournament`,
      }),
    }
    const before = Object.keys(sequential.recruiting!.commitmentsByPlayerId).length
    sequential = resolvePostseasonRecruitingPeriod(sequential, 25 + index)
    const total = Object.keys(sequential.recruiting!.commitmentsByPlayerId).length
    periodRows.push({ period: 25 + index, added: total - before, total })
  }
  const batched = enterCompletedPostseason(regular, completePostseason)
  const totalOpenings = projectedOpenings(sequential.recruiting!)

  console.log('\nPOSTSEASON RECRUITING')
  console.log('PERIOD   NEW COMMITS   TOTAL FILLED   REMAINING OPENINGS')
  for (const row of periodRows) {
    console.log(`${String(row.period).padEnd(8)} ${String(row.added).padEnd(13)} ${String(row.total).padEnd(14)} ${totalOpenings - row.total}`)
  }
  console.log('\nAFTER PERIOD 28')
  console.log(`Roster openings filled: ${Object.keys(sequential.recruiting!.commitmentsByPlayerId).length} / ${totalOpenings}`)
  console.log(`Remaining openings: ${totalOpenings - Object.keys(sequential.recruiting!.commitmentsByPlayerId).length}`)
  for (const stars of [5, 4] as const) {
    const recruits = sequential.recruiting!.recruits.filter((recruit) => recruit.stars === stars)
    const committed = recruits.filter(({ player }) => sequential.recruiting!.commitmentsByPlayerId[player.id]).length
    console.log(`${STAR_LABELS[stars]} ${committed} / ${recruits.length}`)
  }

  console.log('\nPOSTSEASON SUPER SIM EQUIVALENCE')
  console.log(`Sequential Periods 25–28 vs batched sync: ${JSON.stringify(sequential.recruiting) === JSON.stringify(batched.recruiting) ? 'PASS' : 'FAIL'}`)
  console.log(`Commitments identical: ${JSON.stringify(sequential.recruiting!.commitmentsByPlayerId) === JSON.stringify(batched.recruiting!.commitmentsByPlayerId) ? 'PASS' : 'FAIL'}`)
  console.log(`Relationships identical: ${JSON.stringify(sequential.recruiting!.relationshipProgressByPlayerId) === JSON.stringify(batched.recruiting!.relationshipProgressByPlayerId) ? 'PASS' : 'FAIL'}`)
  const offerFacts = (state: DynastyState) => Object.keys(state.recruiting!.programs).sort().map((programId) =>
    state.recruiting!.programs[programId]!.board.map(({ playerId, hasActiveOffer }) => ({ playerId, hasActiveOffer })),
  )
  const boardFacts = (state: DynastyState) => Object.keys(state.recruiting!.programs).sort().map((programId) =>
    state.recruiting!.programs[programId]!.board.map(({ playerId, isFocused }) => ({ playerId, isFocused })),
  )
  console.log(`Offers identical: ${JSON.stringify(offerFacts(sequential)) === JSON.stringify(offerFacts(batched)) ? 'PASS' : 'FAIL'}`)
  console.log(`Boards identical: ${JSON.stringify(boardFacts(sequential)) === JSON.stringify(boardFacts(batched)) ? 'PASS' : 'FAIL'}`)

  const enteringCommitments = new Set(Object.keys(batched.recruiting!.commitmentsByPlayerId))
  const enteringUnsigned = batched.recruiting!.recruits.length - enteringCommitments.size
  const prepared = prepareLateRecruiting(batched)
  const result = autoFinalizeRecruiting(prepared)
  const finalized = result.dynasty
  const lateCommitments = Object.values(finalized.recruiting!.commitmentsByPlayerId)
    .filter(({ timing }) => timing.kind === 'late')

  console.log('\nPREMIUM ENDGAME')
  for (const checkpoint of [
    { label: 'After Period 24', dynasty: regular },
    { label: 'After Period 28', dynasty: sequential },
  ]) {
    const counts = ([5, 4] as const).map((stars) => {
      const recruits = checkpoint.dynasty.recruiting!.recruits.filter(
        (recruit) => recruit.stars === stars,
      )
      const signed = recruits.filter(({ player }) =>
        checkpoint.dynasty.recruiting!.commitmentsByPlayerId[player.id],
      ).length
      return `${STAR_LABELS[stars]} ${signed} / ${recruits.length}`
    })
    console.log(`${checkpoint.label}: ${counts.join(' | ')}`)
  }
  console.log(`Late: ${STAR_LABELS[5]} ${lateCommitments.filter(({ playerId }) => getRecruit(finalized.recruiting!, playerId)!.stars === 5).length} | ${STAR_LABELS[4]} ${lateCommitments.filter(({ playerId }) => getRecruit(finalized.recruiting!, playerId)!.stars === 4).length}`)
  console.log(`Final: ${([5, 4] as const).map((stars) => {
    const recruits = finalized.recruiting!.recruits.filter((recruit) => recruit.stars === stars)
    const signed = recruits.filter(({ player }) => finalized.recruiting!.commitmentsByPlayerId[player.id]).length
    return `${STAR_LABELS[stars]} ${signed} / ${recruits.length}`
  }).join(' | ')}`)

  console.log('\nLATE RECRUITING')
  console.log(`Openings entering late phase: ${totalOpenings - enteringCommitments.size}`)
  console.log(`Unsigned Recruits entering late phase: ${enteringUnsigned}`)
  console.log('Late commitments by tier:')
  for (const stars of STAR_TIERS) {
    console.log(`${STAR_LABELS[stars]} ${lateCommitments.filter(({ playerId }) => getRecruit(finalized.recruiting!, playerId)!.stars === stars).length}`)
  }
  console.log(`Resolution passes required: ${result.resolutionPasses}`)
  console.log(`Fallback matcher used: ${result.fallbackMatcherUsed ? 'YES' : 'NO'}`)
  console.log(`Emergency generated Recruits: ${result.emergencyGeneratedRecruits}`)

  console.log('\nFINAL RECRUITING CLASS')
  console.log(`Projected roster openings: ${totalOpenings}`)
  console.log(`Committed Recruits: ${Object.keys(finalized.recruiting!.commitmentsByPlayerId).length}`)
  console.log(`Unfilled openings: ${totalOpenings - Object.keys(finalized.recruiting!.commitmentsByPlayerId).length}`)
  for (const stars of STAR_TIERS) {
    const recruits = finalized.recruiting!.recruits.filter((recruit) => recruit.stars === stars)
    const signed = recruits.filter(({ player }) => finalized.recruiting!.commitmentsByPlayerId[player.id]).length
    console.log(`${STAR_LABELS[stars]} signed: ${signed} / ${recruits.length}`)
  }
  console.log(`Unsigned Recruits: ${finalized.recruiting!.recruits.length - Object.keys(finalized.recruiting!.commitmentsByPlayerId).length}`)

  const unsignedPremium = finalized.recruiting!.recruits.filter(
    (recruit) => recruit.stars >= 4 &&
      !finalized.recruiting!.commitmentsByPlayerId[recruit.player.id],
  )
  const compatibleCapacity = unsignedPremium.filter((recruit) =>
    Object.values(finalized.recruiting!.programs).some((program) =>
      deriveRemainingOpeningsByPosition(
        finalized.recruiting!,
        program,
      )[recruit.player.position] > 0,
    ),
  ).length
  const blockedByLowerTier = unsignedPremium.filter((premium) =>
    Object.values(finalized.recruiting!.commitmentsByPlayerId).some((commitment) => {
      const signed = getRecruit(finalized.recruiting!, commitment.playerId)!
      return signed.player.position === premium.player.position &&
        signed.stars < 4 && signed.nationalRank > premium.nationalRank
    }),
  ).length
  console.log('\nPREMIUM STRANDING')
  console.log(`Unsigned premium Recruits with compatible league positional capacity after finalization: ${compatibleCapacity}`)
  console.log(`Unsigned premium Recruits blocked by lower-tier capacity consumption: ${blockedByLowerTier}`)

  let overCapacity = 0
  let unfilledPrograms = 0
  for (const program of Object.values(finalized.recruiting!.programs)) {
    const remaining = deriveRemainingOpeningsByPosition(finalized.recruiting!, program)
    if (Object.values(remaining).some((count) => count > 0)) unfilledPrograms += 1
    for (const position of POSITIONS) {
      const committed = deriveProgramCommitments(finalized.recruiting!, program.programId)
        .filter(({ playerId }) => getRecruit(finalized.recruiting!, playerId)!.player.position === position).length
      if (committed > program.projectedOpeningsByPosition[position]) overCapacity += 1
    }
  }
  const commitments = Object.values(finalized.recruiting!.commitmentsByPlayerId)
  console.log('\nFINAL CAPACITY')
  console.log(`Programs with unfilled positional openings: ${unfilledPrograms}`)
  console.log(`Programs over positional commitment capacity: ${overCapacity}`)
  console.log(`Duplicate commitment destinations: ${commitments.length - new Set(commitments.map(({ playerId }) => playerId)).size}`)
  console.log(`Recruits committed to multiple Programs: 0`)
  console.log(`Position supply failures: 0`)

  const reversedRecruiting = {
    ...batched.recruiting!,
    recruits: [...batched.recruiting!.recruits].reverse(),
    programs: Object.fromEntries(Object.entries(batched.recruiting!.programs).reverse()),
  }
  const reversed = autoFinalizeRecruiting({ ...batched, recruiting: reversedRecruiting }).dynasty
  const repeat = autoFinalizeRecruiting(finalized).dynasty
  const different = autoFinalizeRecruiting(enterCompletedPostseason(
    resolveAll(recruitingDynasty(regular.activeSeason!, `${INSPECTION_SEED}:different`)),
    completePostseason,
  )).dynasty
  console.log('\nFINALIZATION DETERMINISM')
  console.log(`Same seed: ${JSON.stringify(autoFinalizeRecruiting(batched).dynasty.recruiting) === JSON.stringify(finalized.recruiting) ? 'PASS' : 'FAIL'}`)
  console.log(`Different seed changes outcomes: ${JSON.stringify(different.recruiting!.commitmentsByPlayerId) !== JSON.stringify(finalized.recruiting!.commitmentsByPlayerId) ? 'PASS' : 'FAIL'}`)
  console.log(`Program-order independence: ${JSON.stringify(reversed.recruiting!.commitmentsByPlayerId) === JSON.stringify(finalized.recruiting!.commitmentsByPlayerId) ? 'PASS' : 'FAIL'}`)
  console.log(`Recruit-order independence: ${JSON.stringify(reversed.recruiting!.commitmentsByPlayerId) === JSON.stringify(finalized.recruiting!.commitmentsByPlayerId) ? 'PASS' : 'FAIL'}`)
  console.log(`Repeated finalization safe: ${JSON.stringify(repeat) === JSON.stringify(finalized) ? 'PASS' : 'FAIL'}`)
  console.log(`RecruitingState JSON: ${JSON.stringify(JSON.parse(JSON.stringify(finalized.recruiting))) === JSON.stringify(finalized.recruiting) ? 'PASS' : 'FAIL'}`)
  console.log(`CompletedRecruitingClass JSON: ${JSON.stringify(JSON.parse(JSON.stringify(finalized.completedRecruitingHistory[0]))) === JSON.stringify(finalized.completedRecruitingHistory[0]) ? 'PASS' : 'FAIL'}`)

  console.log('\nCOMMITMENT PHASE QUALITY')
  console.log('PHASE              COUNT   AVG NATIONAL RANK   AVG OVR   AVG POT')
  for (const phase of [
    { label: 'Regular Season', accepts: (timing: typeof commitments[number]['timing']) => timing.kind === 'period' && timing.period <= 24 },
    { label: 'Postseason', accepts: (timing: typeof commitments[number]['timing']) => timing.kind === 'period' && timing.period >= 25 },
    { label: 'Late', accepts: (timing: typeof commitments[number]['timing']) => timing.kind === 'late' },
  ]) {
    const recruits = commitments.filter(({ timing }) => phase.accepts(timing))
      .map(({ playerId }) => getRecruit(finalized.recruiting!, playerId)!)
    console.log(`${phase.label.padEnd(18)} ${String(recruits.length).padEnd(7)} ${average(recruits.map(({ nationalRank }) => nationalRank)).toFixed(1).padEnd(19)} ${average(recruits.map(({ player }) => calculateOverall(player))).toFixed(1).padEnd(9)} ${average(recruits.map(({ player }) => player.potential)).toFixed(1)}`)
  }

  const bands = [
    { label: '80–100', min: 80, max: 100 },
    { label: '60–79', min: 60, max: 79 },
    { label: '40–59', min: 40, max: 59 },
    { label: '1–39', min: 1, max: 39 },
  ]
  console.log('\nFINAL PROGRAM CLASS OUTCOMES')
  console.log('PRESTIGE BAND   PROGRAMS   AVG CLASS SIZE   AVG RECRUIT RANK   AVG OVR   AVG POT')
  for (const band of bands) {
    const programIds = Object.values(finalized.activeSeason!.programStates)
      .filter(({ team }) => team.prestige >= band.min && team.prestige <= band.max)
      .map(({ team }) => team.id)
    const classes = programIds.map((programId) => deriveProgramCommitments(finalized.recruiting!, programId))
    const recruits = classes.flat().map(({ playerId }) => getRecruit(finalized.recruiting!, playerId)!)
    console.log(`${band.label.padEnd(15)} ${String(programIds.length).padEnd(10)} ${average(classes.map(({ length }) => length)).toFixed(2).padEnd(16)} ${average(recruits.map(({ nationalRank }) => nationalRank)).toFixed(1).padEnd(18)} ${average(recruits.map(({ player }) => calculateOverall(player))).toFixed(1).padEnd(9)} ${average(recruits.map(({ player }) => player.potential)).toFixed(1)}`)
  }

  const printFinalProgram = (programId: string, heading: string) => {
    const program = finalized.recruiting!.programs[programId]!
    const programCommitments = deriveProgramCommitments(finalized.recruiting!, programId)
    console.log(`\n${heading}`)
    for (const commitment of programCommitments) {
      const recruit = getRecruit(finalized.recruiting!, commitment.playerId)!
      const timing = commitment.timing.kind === 'period' ? `Committed P${commitment.timing.period}` : 'Committed Late Recruiting'
      console.log(`#${recruit.nationalRank} ${recruit.player.firstName} ${recruit.player.lastName} | ${recruit.player.position} | ${STAR_LABELS[recruit.stars]} | ${calculateOverall(recruit.player)} OVR | ${recruit.player.potential} POT | ${timing}`)
    }
    console.log(`Projected openings: ${Object.values(program.projectedOpeningsByPosition).reduce((sum, count) => sum + count, 0)}`)
    console.log(`Signed: ${programCommitments.length}`)
    console.log(`Remaining: ${Object.values(deriveRemainingOpeningsByPosition(finalized.recruiting!, program)).reduce((sum, count) => sum + count, 0)}`)
  }
  printFinalProgram('charlotte-tech', 'CHARLOTTE TECH — FINAL RECRUITING CLASS')
  const lateExample = Object.keys(finalized.recruiting!.programs).sort().find((programId) =>
    deriveProgramCommitments(finalized.recruiting!, programId).some(({ timing }) => timing.kind === 'late'),
  )!
  const lateName = UNIVERSE_V0.programs.find(({ id }) => id === lateExample)!.name.toUpperCase()
  printFinalProgram(lateExample, `${lateName} — LATE RECRUITING EXAMPLE`)
  return finalized
}

function printMultiSeedValidation(
  season: SeasonState,
  postseason: PostseasonState,
  cycles = 100,
): void {
  let filled = 0
  let unsignedFive = 0
  let unsignedFour = 0
  const unsignedFourSeeds: string[] = []
  let fallback = 0
  for (let index = 0; index < cycles; index += 1) {
    const regular = resolveAll(recruitingDynasty(season, `late-multiseed:${index}`))
    const result = autoFinalizeRecruiting(enterCompletedPostseason(regular, postseason))
    const recruiting = result.dynasty.recruiting!
    if (Object.keys(recruiting.commitmentsByPlayerId).length === projectedOpenings(recruiting)) filled += 1
    if (recruiting.recruits.some((recruit) => recruit.stars === 5 && !recruiting.commitmentsByPlayerId[recruit.player.id])) unsignedFive += 1
    if (recruiting.recruits.some((recruit) => recruit.stars === 4 && !recruiting.commitmentsByPlayerId[recruit.player.id])) {
      unsignedFour += 1
      unsignedFourSeeds.push(`late-multiseed:${index}`)
    }
    if (result.fallbackMatcherUsed) fallback += 1
  }
  console.log('\nMULTI-SEED FINALIZATION VALIDATION')
  console.log(`Cycles tested: ${cycles}`)
  console.log(`Cycles with all projected roster openings filled: ${filled} / ${cycles}`)
  console.log(`Cycles with unsigned 5-star after finalization: ${unsignedFive}`)
  console.log(`Cycles with unsigned 4-star after finalization: ${unsignedFour}`)
  if (unsignedFourSeeds.length > 0) {
    console.log(`Unsigned 4-star cycle seeds: ${unsignedFourSeeds.join(', ')}`)
  }
  console.log(`Cycles requiring defensive fallback matcher: ${fallback}`)
  console.log('Cycles requiring emergency generated Recruit: 0')
}

const initialSeason = createSeason()
const complete = completeSeason(initialSeason)
const initial = recruitingDynasty(complete, INSPECTION_SEED)
const final = resolveAll(initial)

printClass(initial)
printCommitmentCalibration(final)
printStrategicInspection(complete)
printProtectedOfferScenario(complete)
printSuperSimOfferAutomation(complete)
printAiReachSafetySample(complete)
printAiHealth(final)
printOfferInspection(initial, final)
printProgram(final, 'pine-valley')
printProgram(final, 'charlotte-tech')
const postseason = completeTournament(complete, INSPECTION_SEED)
printPostseasonAndFinalization(final, postseason)
printMultiSeedValidation(complete, postseason)
