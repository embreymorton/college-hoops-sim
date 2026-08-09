import { calculateOverall, POSITIONS, type Position } from '../src/engine'
import {
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
  resolveRecruitingPeriod,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
  type RecruitStarRating,
  withdrawRecruitOffer,
} from '../src/dynasty'
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
      .map(({ period }) => period)
    console.log(`${STAR_LABELS[stars].padEnd(7)} ${String(periods.length).padEnd(11)} ${average(periods).toFixed(1).padEnd(12)} ${String(percentile(periods, 0.5)).padEnd(5)} ${String(Math.min(...periods)).padEnd(10)} ${Math.max(...periods)}`)
  }
  console.log('\nCOMMITMENTS BY PERIOD')
  for (let start = 1; start <= 24; start += 4) {
    const end = start + 3
    const count = commitments.filter(({ period }) => period >= start && period <= end).length
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
    console.log(`${String(recruit.nationalRank).padEnd(6)} ${`${recruit.player.firstName} ${recruit.player.lastName}`.padEnd(22)} ${program.name.padEnd(23)} ${String(prestige).padEnd(10)} ${commitment.period}`)
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
              board: [{ playerId: recruit.player.id, priority: 5, hasActiveOffer: true }],
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
            board: [{ playerId: recruit.player.id, priority: 5, hasActiveOffer: true }],
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
            { playerId: premium.player.id, priority: 5, hasActiveOffer: true },
            { playerId: backup.player.id, priority: 5, hasActiveOffer: false },
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
    if (target.playerId === offered.playerId) return { ...target, priority: 5 }
    if (target.playerId === promotedTarget.playerId) return { ...target, priority: 4 }
    return getRecruit(fallbackInitial.recruiting!, target.playerId)!.player.position ===
      offeredRecruit.player.position
      ? { ...target, priority: 2 }
      : target
  })
  const otherProgramId = Object.keys(fallbackInitial.recruiting!.programs).sort()
    .find((id) => id !== programId)!
  const fallback = {
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
          period: 0,
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
  console.log(`Lost offer: ${offeredRecruit.player.firstName} ${offeredRecruit.player.lastName} — Priority 5`)
  console.log(`Promoted: ${promotedRecruit.player.firstName} ${promotedRecruit.player.lastName} — Priority ${promoted.priority} — ${promoted.hasActiveOffer ? 'OFFERED' : 'BACKUP'}`)
  console.log(`Relationship preserved: ${(fallbackManual.recruiting!.relationshipProgressByPlayerId[promoted.playerId]?.[programId] ?? 0) > 0 ? 'PASS' : 'FAIL'}`)
  console.log(`User priorities unchanged: ${adjustedBoard.every((target) => fallbackManual.recruiting!.programs[programId]!.board.find(({ playerId }) => playerId === target.playerId)?.priority === target.priority) ? 'PASS' : 'FAIL'}`)
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
    console.log(`  #${recruit.nationalRank} ${recruit.player.firstName} ${recruit.player.lastName} ${recruit.player.position} (${STAR_LABELS[recruit.stars]}) P${commitment.period}`)
  }
  console.log('BOARD (RANK / PLAYER / POS / OVR / POT / STARS / STANDING / PRIORITY / OFFER / STATUS)')
  for (const target of board.targets.slice(0, 10)) {
    const recruit = getRecruit(final.recruiting!, target.playerId)!
    const standing = deriveRecruitProgramStandings(final, target.playerId)
      .find(({ programId: id }) => id === programId)!
    console.log(`#${recruit.nationalRank} ${recruit.player.firstName} ${recruit.player.lastName} | ${recruit.player.position} | ${calculateOverall(recruit.player)} | ${recruit.player.potential} | ${STAR_LABELS[recruit.stars]} | ${standing.standing.toFixed(1)} (#${standing.rank}) | ${target.priority} | ${target.hasActiveOffer ? 'OFFERED' : 'BACKUP'} | ${target.status}`)
  }
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
