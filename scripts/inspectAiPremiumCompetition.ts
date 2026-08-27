import { calculateOverall } from '../src/engine'
import {
  addRecruitingBoardTarget,
  autoFinalizeRecruiting,
  deriveRecruitProgramStandings,
  initializeDynastyState,
  initializeRecruiting,
  offerRecruit,
  resolveRecruitingPeriod,
  setRecruitingFocus,
  syncRecruitingThroughCompletedPostseasonRounds,
  type DynastyState,
  type Recruit,
  type RecruitingBoardTarget,
} from '../src/dynasty'
import { initializePostseason, simulatePendingGamesInTournamentRound, TOURNAMENT_ROUNDS } from '../src/postseason'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason, simulatePendingGamesInRound } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const PINE_VALLEY = 'pine-valley'
const CHARLOTTE_TECH = 'charlotte-tech'
const COVERAGE_TRIALS = Number(process.env.COVERAGE_TRIALS ?? 200)
const HEAD_TO_HEAD_TRIALS = Number(process.env.HEAD_TO_HEAD_TRIALS ?? 200)
const CHARLOTTE_TRIALS = Number(process.env.CHARLOTTE_TRIALS ?? 50)

const TIERS = [
  { label: 'Lower 4★', matches: (recruit: Recruit) => recruit.stars === 4 && recruit.nationalRank >= 35 && recruit.nationalRank <= 60 },
  { label: 'High 4★', matches: (recruit: Recruit) => recruit.stars === 4 && recruit.nationalRank >= 15 && recruit.nationalRank <= 35 },
  { label: '5★', matches: (recruit: Recruit) => recruit.stars === 5 },
] as const

type Tier = (typeof TIERS)[number]
type PursuitState = 'board-only' | 'offer-only' | 'focus-only' | 'focus-offer'

interface Audit {
  focusLimitViolations: number
  focusOffBoard: number
  offerCapacityViolations: number
  duplicateCommitments: number
  lifecycleFailures: number
  deterministicMismatch: number
}

interface Coverage {
  targets: number
  zeroOffers: number
  oneOffer: number
  twoPlusOffers: number
  prestige60Offer: number
  prestige80Offer: number
  prestige60FocusOffer: number
  prestige80FocusOffer: number
}

interface Allocation {
  programs: number
  boards: number[]
  offers: number[]
  focuses: number[]
  boardRanks: number[]
  offerRanks: number[]
  focusRanks: number[]
  focusOvrs: number[]
  focusPots: number[]
  focusOffered: number
  focusUnoffered: number
  focusNeeds: number
  focusNoNeeds: number
  focusStars: Record<2 | 3 | 4 | 5, number>
  premiumOffered: number
  premiumOfferedUnfocused: number
}

interface Outcome {
  winner: 'controlled' | 'elite' | 'other' | 'unsigned'
  eliteMinusControlledStanding?: number
}

interface HeadToHead {
  attempts: number
  initialBothPriority: number
  elitePriorityAfterFirstPeriod: number
  elitePriorityAfterFourPeriods: number
  retainedPeriodsThroughFour: number[]
  controlled: number
  elite: number
  other: number
  unsigned: number
  margins: number[]
}

function emptyAudit(): Audit {
  return { focusLimitViolations: 0, focusOffBoard: 0, offerCapacityViolations: 0, duplicateCommitments: 0, lifecycleFailures: 0, deterministicMismatch: 0 }
}

function emptyCoverage(): Coverage {
  return { targets: 0, zeroOffers: 0, oneOffer: 0, twoPlusOffers: 0, prestige60Offer: 0, prestige80Offer: 0, prestige60FocusOffer: 0, prestige80FocusOffer: 0 }
}

function emptyAllocation(): Allocation {
  return {
    programs: 0, boards: [], offers: [], focuses: [], boardRanks: [], offerRanks: [], focusRanks: [], focusOvrs: [], focusPots: [],
    focusOffered: 0, focusUnoffered: 0, focusNeeds: 0, focusNoNeeds: 0, focusStars: { 2: 0, 3: 0, 4: 0, 5: 0 }, premiumOffered: 0, premiumOfferedUnfocused: 0,
  }
}

function emptyHeadToHead(): HeadToHead {
  return { attempts: 0, initialBothPriority: 0, elitePriorityAfterFirstPeriod: 0, elitePriorityAfterFourPeriods: 0, retainedPeriodsThroughFour: [], controlled: 0, elite: 0, other: 0, unsigned: 0, margins: [] }
}

function average(values: readonly number[]): string {
  return values.length === 0 ? '—' : (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
}

function percentage(value: number, total: number): string {
  return `${(total === 0 ? 0 : value * 100 / total).toFixed(1)}%`
}

function completeSeason(seed: string) {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  let season = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }),
    seasonNumber: 1,
  })
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    season = simulatePendingGamesInRound({ season, round, simulationSeed: `${seed}:games` })
  }
  return season
}

const baseBySeed = new Map<number, DynastyState>()

function baseDynasty(trial: number): DynastyState {
  const cached = baseBySeed.get(trial)
  if (cached) return cached
  const seed = `ai-premium-competition:${trial}`
  const base = initializeRecruiting(initializeDynastyState({
    dynastyId: `ai-premium-competition:${trial}`,
    dynastySeed: seed,
    controlledProgramId: PINE_VALLEY,
    universe: UNIVERSE_V0,
    activeSeason: completeSeason(seed),
  }))
  baseBySeed.set(trial, base)
  return base
}

function prestige(dynasty: DynastyState, programId: string): number {
  return dynasty.activeSeason!.programStates[programId]!.team.prestige
}

function band(value: number): '80–100' | '60–79' | '40–59' | '1–39' {
  if (value >= 80) return '80–100'
  if (value >= 60) return '60–79'
  if (value >= 40) return '40–59'
  return '1–39'
}

function auditState(dynasty: DynastyState, audit: Audit): void {
  const recruiting = dynasty.recruiting!
  for (const program of Object.values(recruiting.programs)) {
    const focused = program.board.filter(({ isFocused }) => isFocused)
    audit.focusLimitViolations += Number(focused.length > 3)
    audit.focusOffBoard += focused.filter(({ playerId }) => !program.board.some((target) => target.playerId === playerId)).length
    const activeOffersByPosition = new Map<string, number>()
    for (const target of program.board.filter(({ hasActiveOffer }) => hasActiveOffer)) {
      const recruit = recruiting.recruits.find(({ player }) => player.id === target.playerId)
      if (!recruit) continue
      activeOffersByPosition.set(recruit.player.position, (activeOffersByPosition.get(recruit.player.position) ?? 0) + 1)
    }
    for (const [position, offers] of activeOffersByPosition) {
      audit.offerCapacityViolations += Number(offers > program.projectedOpeningsByPosition[position as keyof typeof program.projectedOpeningsByPosition])
    }
  }
  const commitments = Object.values(recruiting.commitmentsByPlayerId)
  audit.duplicateCommitments += commitments.length - new Set(commitments.map(({ playerId }) => playerId)).size
}

function competitors(dynasty: DynastyState, recruit: Recruit) {
  return Object.values(dynasty.recruiting!.programs).filter(({ programId, board }) =>
    programId !== dynasty.controlledProgramId! && board.some(({ playerId }) => playerId === recruit.player.id),
  )
}

function stateFor(target: RecruitingBoardTarget): PursuitState {
  if (target.isFocused && target.hasActiveOffer) return 'focus-offer'
  if (target.hasActiveOffer) return 'offer-only'
  if (target.isFocused) return 'focus-only'
  return 'board-only'
}

const pursuitPriority: Record<PursuitState, number> = {
  'board-only': 1, 'focus-only': 2, 'offer-only': 3, 'focus-offer': 4,
}

function strongestState(dynasty: DynastyState, recruit: Recruit, minPrestige: number, maxPrestige: number): PursuitState | undefined {
  return competitors(dynasty, recruit)
    .filter(({ programId }) => prestige(dynasty, programId) >= minPrestige && prestige(dynasty, programId) <= maxPrestige)
    .map(({ board }) => stateFor(board.find(({ playerId }) => playerId === recruit.player.id)!))
    .sort((first, second) => pursuitPriority[second] - pursuitPriority[first])[0]
}

function configureControlled(dynasty: DynastyState, programId: string, recruit: Recruit): DynastyState {
  const program = dynasty.recruiting!.programs[programId]!
  let current: DynastyState = {
    ...dynasty,
    controlledProgramId: programId,
    recruiting: { ...dynasty.recruiting!, programs: { ...dynasty.recruiting!.programs, [programId]: { ...program, board: [] } } },
  }
  current = addRecruitingBoardTarget({ dynasty: current, playerId: recruit.player.id })
  current = offerRecruit({ dynasty: current, playerId: recruit.player.id })
  return setRecruitingFocus({ dynasty: current, playerId: recruit.player.id, isFocused: true })
}

function configureElitePriority(dynasty: DynastyState, eliteId: string, recruit: Recruit): DynastyState {
  const program = dynasty.recruiting!.programs[eliteId]!
  const replacement = { playerId: recruit.player.id, origin: 'assistant' as const, isFocused: true, hasActiveOffer: true }
  return {
    ...dynasty,
    recruiting: { ...dynasty.recruiting!, programs: { ...dynasty.recruiting!.programs, [eliteId]: { ...program, board: [replacement] } } },
  }
}

function resolveLifecycle(dynasty: DynastyState): DynastyState {
  let current = dynasty
  for (let period = current.recruiting!.lastResolvedPeriod + 1; period <= 24; period += 1) current = resolveRecruitingPeriod(current, period)
  let postseason = initializePostseason({ universe: current.universe, season: current.activeSeason! })
  for (const round of TOURNAMENT_ROUNDS) postseason = simulatePendingGamesInTournamentRound({ postseason, round, simulationSeed: `${current.dynastySeed}:postseason` })
  return autoFinalizeRecruiting(syncRecruitingThroughCompletedPostseasonRounds({ ...current, activePostseason: postseason })).dynasty
}

function targetFor(dynasty: DynastyState, programId: string, tier: Tier, eliteRequired = false): Recruit | undefined {
  const program = dynasty.recruiting!.programs[programId]!
  return dynasty.recruiting!.recruits.filter((recruit) => {
    if (!tier.matches(recruit) || program.projectedOpeningsByPosition[recruit.player.position] === 0) return false
    return !eliteRequired || Object.keys(dynasty.recruiting!.programs).some((id) =>
      prestige(dynasty, id) >= 80 && dynasty.recruiting!.programs[id]!.projectedOpeningsByPosition[recruit.player.position] > 0,
    )
  }).sort((first, second) => first.nationalRank - second.nationalRank || first.player.id.localeCompare(second.player.id))[0]
}

function addCoverage(dynasty: DynastyState, tier: Tier, coverage: Coverage): void {
  const pine = dynasty.recruiting!.programs[PINE_VALLEY]!
  for (const recruit of dynasty.recruiting!.recruits) {
    if (!tier.matches(recruit) || pine.projectedOpeningsByPosition[recruit.player.position] === 0) continue
    coverage.targets += 1
    const rivals = competitors(dynasty, recruit).map((program) => ({
      program,
      target: program.board.find(({ playerId }) => playerId === recruit.player.id)!,
      prestige: prestige(dynasty, program.programId),
    }))
    const offers = rivals.filter(({ target }) => target.hasActiveOffer)
    if (offers.length === 0) coverage.zeroOffers += 1
    else if (offers.length === 1) coverage.oneOffer += 1
    else coverage.twoPlusOffers += 1
    coverage.prestige60Offer += Number(offers.some(({ prestige: value }) => value >= 60))
    coverage.prestige80Offer += Number(offers.some(({ prestige: value }) => value >= 80))
    coverage.prestige60FocusOffer += Number(offers.some(({ prestige: value, target }) => value >= 60 && target.isFocused))
    coverage.prestige80FocusOffer += Number(offers.some(({ prestige: value, target }) => value >= 80 && target.isFocused))
  }
}

function addAllocation(dynasty: DynastyState, allocations: Record<ReturnType<typeof band>, Allocation>): void {
  const recruiting = dynasty.recruiting!
  for (const program of Object.values(recruiting.programs)) {
    if (program.programId === PINE_VALLEY) continue
    const allocation = allocations[band(prestige(dynasty, program.programId))]
    allocation.programs += 1
    allocation.boards.push(program.board.length)
    allocation.offers.push(program.board.filter(({ hasActiveOffer }) => hasActiveOffer).length)
    const focused = program.board.filter(({ isFocused }) => isFocused)
    allocation.focuses.push(focused.length)
    for (const target of program.board) {
      const recruit = recruiting.recruits.find(({ player }) => player.id === target.playerId)!
      allocation.boardRanks.push(recruit.nationalRank)
      if (target.hasActiveOffer) {
        allocation.offerRanks.push(recruit.nationalRank)
        if (recruit.stars >= 4) {
          allocation.premiumOffered += 1
          allocation.premiumOfferedUnfocused += Number(!target.isFocused)
        }
      }
    }
    for (const target of focused) {
      const recruit = recruiting.recruits.find(({ player }) => player.id === target.playerId)!
      allocation.focusRanks.push(recruit.nationalRank)
      allocation.focusOvrs.push(calculateOverall(recruit.player))
      allocation.focusPots.push(recruit.player.potential)
      allocation.focusStars[recruit.stars] += 1
      if (target.hasActiveOffer) allocation.focusOffered += 1
      else allocation.focusUnoffered += 1
      if (program.projectedOpeningsByPosition[recruit.player.position] > 0) allocation.focusNeeds += 1
      else allocation.focusNoNeeds += 1
    }
  }
}

function recordHeadToHead(final: DynastyState, recruit: Recruit, controlledId: string, eliteId: string, totals: HeadToHead): Outcome {
  const winner = final.recruiting!.commitmentsByPlayerId[recruit.player.id]?.programId
  const outcome: Outcome = winner === controlledId ? { winner: 'controlled' }
    : winner === eliteId ? { winner: 'elite' }
      : winner ? { winner: 'other' } : { winner: 'unsigned' }
  const standings = deriveRecruitProgramStandings(final, recruit.player.id)
  const controlled = standings.find(({ programId }) => programId === controlledId)!
  const elite = standings.find(({ programId }) => programId === eliteId)!
  outcome.eliteMinusControlledStanding = elite.standing - controlled.standing
  totals.attempts += 1
  totals[outcome.winner] += 1
  totals.margins.push(outcome.eliteMinusControlledStanding)
  return outcome
}

function eligibleElite(dynasty: DynastyState, recruit: Recruit): string | undefined {
  return Object.keys(dynasty.recruiting!.programs).filter((programId) =>
    prestige(dynasty, programId) >= 80 && dynasty.recruiting!.programs[programId]!.projectedOpeningsByPosition[recruit.player.position] > 0,
  ).sort((first, second) => prestige(dynasty, second) - prestige(dynasty, first) || first.localeCompare(second))[0]
}

function runPriorityBattle(base: DynastyState, controlledId: string, tier: Tier, totals: HeadToHead, audit: Audit): boolean {
  const recruit = targetFor(base, controlledId, tier, true)
  if (!recruit) return false
  const eliteId = eligibleElite(base, recruit)
  if (!eliteId) return false
  let configured = configureControlled(base, controlledId, recruit)
  configured = configureElitePriority(configured, eliteId, recruit)
  totals.initialBothPriority += Number(
    configured.recruiting!.programs[controlledId]!.board.some((target) =>
      target.playerId === recruit.player.id && target.isFocused && target.hasActiveOffer,
    ) && configured.recruiting!.programs[eliteId]!.board.some((target) =>
      target.playerId === recruit.player.id && target.isFocused && target.hasActiveOffer,
    ),
  )
  auditState(configured, audit)
  try {
    const hasElitePriority = (state: DynastyState) =>
      state.recruiting!.programs[eliteId]!.board.some((target) =>
        target.playerId === recruit.player.id && target.isFocused && target.hasActiveOffer,
      )
    let current = resolveRecruitingPeriod(configured, 1)
    let retainedPeriods = Number(hasElitePriority(current))
    totals.elitePriorityAfterFirstPeriod += retainedPeriods
    for (let period = 2; period <= 4; period += 1) {
      current = resolveRecruitingPeriod(current, period)
      if (retainedPeriods === period - 1 && hasElitePriority(current)) retainedPeriods += 1
    }
    totals.elitePriorityAfterFourPeriods += Number(retainedPeriods === 4)
    totals.retainedPeriodsThroughFour.push(retainedPeriods)
    const final = resolveLifecycle(current)
    recordHeadToHead(final, recruit, controlledId, eliteId, totals)
    auditState(final, audit)
  } catch {
    audit.lifecycleFailures += 1
    throw new Error('Canonical lifecycle failed during priority-battle diagnostic.')
  }
  return true
}

function printCoverage(tier: Tier, coverage: Coverage): void {
  console.log(`${tier.label.padEnd(10)} ${String(coverage.targets).padStart(7)} ${percentage(coverage.zeroOffers, coverage.targets).padStart(7)} ${percentage(coverage.oneOffer, coverage.targets).padStart(7)} ${percentage(coverage.twoPlusOffers, coverage.targets).padStart(7)} ${percentage(coverage.prestige60Offer, coverage.targets).padStart(8)} ${percentage(coverage.prestige80Offer, coverage.targets).padStart(8)} ${percentage(coverage.prestige60FocusOffer, coverage.targets).padStart(10)} ${percentage(coverage.prestige80FocusOffer, coverage.targets).padStart(10)}`)
}

function printAllocation(label: string, allocation: Allocation): void {
  console.log(`${label.padEnd(7)} ${String(allocation.programs).padStart(8)} ${average(allocation.boards).padStart(7)} ${average(allocation.offers).padStart(7)} ${average(allocation.focuses).padStart(7)} ${average(allocation.boardRanks).padStart(9)} ${average(allocation.offerRanks).padStart(10)} ${average(allocation.focusRanks).padStart(10)}`)
  console.log(`  Focus: 2★ ${percentage(allocation.focusStars[2], allocation.focusRanks.length)}, 3★ ${percentage(allocation.focusStars[3], allocation.focusRanks.length)}, 4★ ${percentage(allocation.focusStars[4], allocation.focusRanks.length)}, 5★ ${percentage(allocation.focusStars[5], allocation.focusRanks.length)}; offered ${percentage(allocation.focusOffered, allocation.focusRanks.length)}; opening need ${percentage(allocation.focusNeeds, allocation.focusRanks.length)}; OVR ${average(allocation.focusOvrs)}, POT ${average(allocation.focusPots)}; premium offered but unfocused ${percentage(allocation.premiumOfferedUnfocused, allocation.premiumOffered)}.`)
}

const audit = emptyAudit()
const coverage = Object.fromEntries(TIERS.map((tier) => [tier.label, emptyCoverage()])) as Record<Tier['label'], Coverage>
const allocations: Record<ReturnType<typeof band>, Allocation> = { '80–100': emptyAllocation(), '60–79': emptyAllocation(), '40–59': emptyAllocation(), '1–39': emptyAllocation() }
const pursuitStateCounts: Record<ReturnType<typeof band>, Record<PursuitState, number>> = {
  '80–100': { 'board-only': 0, 'offer-only': 0, 'focus-only': 0, 'focus-offer': 0 },
  '60–79': { 'board-only': 0, 'offer-only': 0, 'focus-only': 0, 'focus-offer': 0 },
  '40–59': { 'board-only': 0, 'offer-only': 0, 'focus-only': 0, 'focus-offer': 0 },
  '1–39': { 'board-only': 0, 'offer-only': 0, 'focus-only': 0, 'focus-offer': 0 },
}
const pursuitTotals: Record<string, Record<string, { attempts: number; signs: number }>> = {}
const universeBandCounts = Object.values(UNIVERSE_V0.programs).reduce<Record<ReturnType<typeof band>, number>>(
  (counts, program) => ({ ...counts, [band(program.basePrestige)]: counts[band(program.basePrestige)] + 1 }),
  { '80–100': 0, '60–79': 0, '40–59': 0, '1–39': 0 },
)

console.log(`AI PREMIUM RECRUITING COMPETITION — ${COVERAGE_TRIALS} deterministic world snapshots`)
for (let trial = 0; trial < COVERAGE_TRIALS; trial += 1) {
  const base = baseDynasty(trial)
  auditState(base, audit)
  for (const tier of TIERS) addCoverage(base, tier, coverage[tier.label])
  const pine = base.recruiting!.programs[PINE_VALLEY]!
  for (const recruit of base.recruiting!.recruits) {
    if (pine.projectedOpeningsByPosition[recruit.player.position] === 0) continue
    for (const rival of competitors(base, recruit)) {
      const target = rival.board.find(({ playerId }) => playerId === recruit.player.id)!
      pursuitStateCounts[band(prestige(base, rival.programId))][stateFor(target)] += 1
    }
  }
  addAllocation(base, allocations)
  const recruit = targetFor(base, PINE_VALLEY, TIERS[0])
  if (!recruit) continue
  const configured = configureControlled(base, PINE_VALLEY, recruit)
  const eliteState = strongestState(base, recruit, 80, 100) ?? 'no-elite'
  const midState = strongestState(base, recruit, 60, 79) ?? 'none'
  const lowerState = strongestState(base, recruit, 40, 59) ?? 'none'
  for (const [label, state] of [['Elite', eliteState], ['60–79', midState], ['40–59', lowerState]] as const) {
    pursuitTotals[label] ??= {}
    pursuitTotals[label]![state] ??= { attempts: 0, signs: 0 }
    pursuitTotals[label]![state]!.attempts += 1
  }
  try {
    const final = resolveLifecycle(configured)
    const signed = final.recruiting!.commitmentsByPlayerId[recruit.player.id]?.programId === PINE_VALLEY
    for (const [label, state] of [['Elite', eliteState], ['60–79', midState], ['40–59', lowerState]] as const) pursuitTotals[label]![state]!.signs += Number(signed)
    auditState(final, audit)
  } catch {
    audit.lifecycleFailures += 1
    throw new Error('Canonical lifecycle failed during Pine pursuit diagnostic.')
  }
}

const pineHeadToHead = emptyHeadToHead()
for (let trial = 0; trial < HEAD_TO_HEAD_TRIALS; trial += 1) runPriorityBattle(baseDynasty(trial), PINE_VALLEY, TIERS[0], pineHeadToHead, audit)
const charlotteLower = emptyHeadToHead()
const charlotteHigh = emptyHeadToHead()
for (let trial = 0; trial < CHARLOTTE_TRIALS; trial += 1) {
  runPriorityBattle(baseDynasty(trial), CHARLOTTE_TECH, TIERS[0], charlotteLower, audit)
  runPriorityBattle(baseDynasty(trial), CHARLOTTE_TECH, TIERS[1], charlotteHigh, audit)
}

const replayBase = baseDynasty(0)
const replayRecruit = targetFor(replayBase, PINE_VALLEY, TIERS[0], true)
if (replayRecruit) {
  const replayElite = eligibleElite(replayBase, replayRecruit)!
  const first = resolveLifecycle(configureElitePriority(configureControlled(replayBase, PINE_VALLEY, replayRecruit), replayElite, replayRecruit))
  const second = resolveLifecycle(configureElitePriority(configureControlled(replayBase, PINE_VALLEY, replayRecruit), replayElite, replayRecruit))
  audit.deterministicMismatch += Number(JSON.stringify(first.recruiting) !== JSON.stringify(second.recruiting))
}

console.log('\nAI PREMIUM-MARKET COVERAGE (legal Pine Valley targets)')
console.log('Tier        Targets  0 offer  1 offer  2+ offer  60+ offer  80+ offer  60+ F+O  80+ F+O')
for (const tier of TIERS) printCoverage(tier, coverage[tier.label])

console.log('\nAI FOCUS AND BOARD ALLOCATION')
console.log(`Universe V0 prestige audit: 80–100 ${universeBandCounts['80–100']}, 60–79 ${universeBandCounts['60–79']}, 40–59 ${universeBandCounts['40–59']}, 1–39 ${universeBandCounts['1–39']} (Pine Valley base Prestige ${UNIVERSE_V0.programs.find(({ id }) => id === PINE_VALLEY)!.basePrestige}; excluded from AI allocation because it is the controlled Program in this diagnostic).`)
console.log('Band     Programs   Board   Offer   Focus  Board rank  Offer rank  Focus rank')
for (const value of ['80–100', '60–79', '40–59', '1–39'] as const) printAllocation(value, allocations[value])

console.log('\nAI PURSUIT STATES ACROSS LEGAL PINE TARGETS')
console.log('Band     Board only  Offer only  Focus only  Focus + offer')
for (const value of ['80–100', '60–79', '40–59', '1–39'] as const) {
  const counts = pursuitStateCounts[value]
  console.log(`${value.padEnd(7)} ${String(counts['board-only']).padStart(10)} ${String(counts['offer-only']).padStart(11)} ${String(counts['focus-only']).padStart(11)} ${String(counts['focus-offer']).padStart(14)}`)
}

console.log('\nPINE VALLEY FOCUSED + OFFERED LOWER-4★ PURSUITS')
for (const label of ['Elite', '60–79', '40–59']) {
  console.log(label)
  for (const [state, totals] of Object.entries(pursuitTotals[label] ?? {}).sort(([first], [second]) => first.localeCompare(second))) {
    console.log(`  ${state.padEnd(14)} ${String(totals.attempts).padStart(4)} attempts  ${percentage(totals.signs, totals.attempts)} Pine signs`)
  }
}

function printHeadToHead(label: string, totals: HeadToHead): void {
  console.log(`${label.padEnd(25)} ${String(totals.attempts).padStart(4)} attempts  initial both F+O ${percentage(totals.initialBothPriority, totals.attempts)}  elite F+O after 1 ${percentage(totals.elitePriorityAfterFirstPeriod, totals.attempts)}  after 4 ${percentage(totals.elitePriorityAfterFourPeriods, totals.attempts)}  avg retained periods ${average(totals.retainedPeriodsThroughFour)}  controlled ${percentage(totals.controlled, totals.attempts)}  elite ${percentage(totals.elite, totals.attempts)}  other ${percentage(totals.other, totals.attempts)}  unsigned ${percentage(totals.unsigned, totals.attempts)}  elite-minus-controlled standing ${average(totals.margins)}`)
}

console.log('\nCONSTRUCTED MATCHED FOCUS + OFFER HEAD-TO-HEAD')
console.log('Both programs start Focus + Offer; retention records whether the AI-managed elite remains Focus + Offer through canonical refreshes.')
printHeadToHead('Pine Valley lower 4★', pineHeadToHead)
printHeadToHead('Charlotte Tech lower 4★', charlotteLower)
printHeadToHead('Charlotte Tech high 4★', charlotteHigh)

console.log('\nSTRUCTURAL AUDIT')
console.log(`Focus > 3: ${audit.focusLimitViolations}; Focus off Board: ${audit.focusOffBoard}; offer-capacity violations: ${audit.offerCapacityViolations}; duplicate commitments: ${audit.duplicateCommitments}; lifecycle failures: ${audit.lifecycleFailures}; deterministic mismatch: ${audit.deterministicMismatch}`)
