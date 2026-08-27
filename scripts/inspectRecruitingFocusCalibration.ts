import { calculateOverall } from '../src/engine'
import {
  addRecruitingBoardTarget,
  autoFinalizeRecruiting,
  initializeDynastyState,
  initializeRecruiting,
  offerRecruit,
  resolveRecruitingPeriod,
  setRecruitingFocus,
  syncRecruitingThroughCompletedPostseasonRounds,
  type DynastyState,
  type Recruit,
} from '../src/dynasty'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../src/postseason'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason, simulatePendingGamesInRound } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const PINE_VALLEY = 'pine-valley'
const CHARLOTTE_TECH = 'charlotte-tech'
const NORTHBRIDGE = 'northbridge'
const LOWER_FOUR_TRIALS = Number(process.env.LOWER_FOUR_TRIALS ?? 200)
const COMPARISON_TRIALS = Number(process.env.COMPARISON_TRIALS ?? 50)
const HIGH_FOUR_TRIALS = Number(process.env.HIGH_FOUR_TRIALS ?? 25)

const TIERS = {
  lowerFour: { label: 'Lower 4★', matches: (recruit: Recruit) => recruit.stars === 4 && recruit.nationalRank >= 35 && recruit.nationalRank <= 60 },
  highFour: { label: 'High 4★', matches: (recruit: Recruit) => recruit.stars === 4 && recruit.nationalRank >= 15 && recruit.nationalRank <= 35 },
} as const

type Tier = (typeof TIERS)[keyof typeof TIERS]
type Timing = 'regular' | 'postseason' | 'late' | 'loss' | 'unsigned'

interface Outcome {
  readonly signed: boolean
  readonly timing: Timing
  readonly commitmentPeriod?: number
}

interface Competition {
  readonly offerCount: number
  readonly highestPrestige: number
}

interface Pair {
  readonly recruit: Recruit
  readonly competition: Competition
  readonly noFocus: Outcome
  readonly focus: Outcome
}

interface Totals {
  attempts: number
  noFocusSigns: number
  focusSigns: number
  both: number
  focusOnly: number
  noFocusOnly: number
  neither: number
  noFocusTiming: Record<Timing, number>
  focusTiming: Record<Timing, number>
  noFocusCommitmentPeriods: number[]
  focusCommitmentPeriods: number[]
}

interface Audit {
  focusLimitViolations: number
  invalidFocuses: number
  duplicateCommitments: number
  lifecycleFailures: number
  deterministicMismatch: number
}

function emptyTiming(): Record<Timing, number> {
  return { regular: 0, postseason: 0, late: 0, loss: 0, unsigned: 0 }
}

function emptyTotals(): Totals {
  return {
    attempts: 0, noFocusSigns: 0, focusSigns: 0, both: 0, focusOnly: 0,
    noFocusOnly: 0, neither: 0, noFocusTiming: emptyTiming(), focusTiming: emptyTiming(),
    noFocusCommitmentPeriods: [], focusCommitmentPeriods: [],
  }
}

function emptyAudit(): Audit {
  return { focusLimitViolations: 0, invalidFocuses: 0, duplicateCommitments: 0, lifecycleFailures: 0, deterministicMismatch: 0 }
}

function percent(value: number, total: number): string {
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

const baseBySeed = new Map<string, DynastyState>()

function baseDynasty(trial: number, controlledProgramId: string): DynastyState {
  const seed = `focus-calibration:${trial}`
  let base = baseBySeed.get(seed)
  if (!base) {
    base = initializeRecruiting(initializeDynastyState({
      dynastyId: `focus-calibration:${seed}`,
      dynastySeed: seed,
      controlledProgramId: PINE_VALLEY,
      universe: UNIVERSE_V0,
      activeSeason: completeSeason(seed),
    }))
    baseBySeed.set(seed, base)
  }
  return controlledProgramId === PINE_VALLEY ? base : { ...base, controlledProgramId }
}

function clearControlledBoard(dynasty: DynastyState): DynastyState {
  const program = dynasty.recruiting!.programs[dynasty.controlledProgramId!]!
  return {
    ...dynasty,
    recruiting: {
      ...dynasty.recruiting!,
      programs: { ...dynasty.recruiting!.programs, [program.programId]: { ...program, board: [] } },
    },
  }
}

function targetFor(base: DynastyState, tier: Tier): Recruit | undefined {
  const program = base.recruiting!.programs[base.controlledProgramId!]!
  return base.recruiting!.recruits.filter((recruit) =>
    tier.matches(recruit) && program.projectedOpeningsByPosition[recruit.player.position] > 0,
  ).sort((first, second) => first.nationalRank - second.nationalRank || first.player.id.localeCompare(second.player.id))[0]
}

function auditState(dynasty: DynastyState, audit: Audit): void {
  const recruiting = dynasty.recruiting!
  for (const program of Object.values(recruiting.programs)) {
    const focused = program.board.filter(({ isFocused }) => isFocused)
    audit.focusLimitViolations += Number(focused.length > 3)
    audit.invalidFocuses += focused.filter(({ playerId }) => recruiting.commitmentsByPlayerId[playerId]).length
  }
  const commitments = Object.values(recruiting.commitmentsByPlayerId)
  audit.duplicateCommitments += commitments.length - new Set(commitments.map(({ playerId }) => playerId)).size
}

function resolveLifecycle(dynasty: DynastyState): DynastyState {
  let current = dynasty
  for (let period = 1; period <= 24; period += 1) current = resolveRecruitingPeriod(current, period)
  let postseason = initializePostseason({ universe: current.universe, season: current.activeSeason! })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({ postseason, round, simulationSeed: `${current.dynastySeed}:postseason` })
  }
  return autoFinalizeRecruiting(
    syncRecruitingThroughCompletedPostseasonRounds({ ...current, activePostseason: postseason }),
  ).dynasty
}

function competition(base: DynastyState, recruit: Recruit): Competition {
  const programs = Object.values(base.recruiting!.programs).filter(({ programId, board }) =>
    programId !== base.controlledProgramId! && board.some(({ playerId, hasActiveOffer }) =>
      playerId === recruit.player.id && hasActiveOffer,
    ),
  )
  return {
    offerCount: programs.length,
    highestPrestige: Math.max(0, ...programs.map(({ programId }) => base.activeSeason!.programStates[programId]!.team.prestige)),
  }
}

function runOutcome(base: DynastyState, recruit: Recruit, focused: boolean, audit: Audit): Outcome {
  let configured = addRecruitingBoardTarget({ dynasty: clearControlledBoard(base), playerId: recruit.player.id })
  configured = offerRecruit({ dynasty: configured, playerId: recruit.player.id })
  if (focused) configured = setRecruitingFocus({ dynasty: configured, playerId: recruit.player.id, isFocused: true })
  auditState(configured, audit)
  try {
    const final = resolveLifecycle(configured)
    auditState(final, audit)
    const commitment = final.recruiting!.commitmentsByPlayerId[recruit.player.id]
    if (!commitment) return { signed: false, timing: 'unsigned' }
    if (commitment.programId !== configured.controlledProgramId!) return { signed: false, timing: 'loss' }
    if (commitment.timing.kind === 'late') return { signed: true, timing: 'late' }
    return {
      signed: true,
      timing: commitment.timing.period <= 24 ? 'regular' : 'postseason',
      commitmentPeriod: commitment.timing.period,
    }
  } catch {
    audit.lifecycleFailures += 1
    throw new Error('Recruiting lifecycle failed in matched Focus diagnostic.')
  }
}

function runPair(base: DynastyState, tier: Tier, audit: Audit): Pair | undefined {
  const recruit = targetFor(base, tier)
  if (!recruit) return undefined
  return {
    recruit,
    competition: competition(base, recruit),
    noFocus: runOutcome(base, recruit, false, audit),
    focus: runOutcome(base, recruit, true, audit),
  }
}

function add(totals: Totals, pair: Pair): void {
  totals.attempts += 1
  totals.noFocusSigns += Number(pair.noFocus.signed)
  totals.focusSigns += Number(pair.focus.signed)
  totals.noFocusTiming[pair.noFocus.timing] += 1
  totals.focusTiming[pair.focus.timing] += 1
  if (pair.noFocus.commitmentPeriod !== undefined) totals.noFocusCommitmentPeriods.push(pair.noFocus.commitmentPeriod)
  if (pair.focus.commitmentPeriod !== undefined) totals.focusCommitmentPeriods.push(pair.focus.commitmentPeriod)
  if (pair.noFocus.signed && pair.focus.signed) totals.both += 1
  else if (pair.focus.signed) totals.focusOnly += 1
  else if (pair.noFocus.signed) totals.noFocusOnly += 1
  else totals.neither += 1
}

function collect(programId: string, tier: Tier, trials: number, audit: Audit): Pair[] {
  const pairs: Pair[] = []
  for (let trial = 0; trial < trials; trial += 1) {
    const pair = runPair(baseDynasty(trial, programId), tier, audit)
    if (pair) pairs.push(pair)
  }
  return pairs
}

function summarize(pairs: readonly Pair[]): Totals {
  const totals = emptyTotals()
  for (const pair of pairs) add(totals, pair)
  return totals
}

function signedRate(pairs: readonly Pair[], focused: boolean): string {
  return percent(pairs.filter((pair) => (focused ? pair.focus : pair.noFocus).signed).length, pairs.length)
}

function filterPairs(pairs: readonly Pair[], predicate: (competition: Competition) => boolean): Pair[] {
  return pairs.filter(({ competition: current }) => predicate(current))
}

function printPairRow(program: string, tier: Tier, pairs: readonly Pair[]): void {
  const totals = summarize(pairs)
  const noFocus = totals.noFocusSigns * 100 / Math.max(1, totals.attempts)
  const focus = totals.focusSigns * 100 / Math.max(1, totals.attempts)
  console.log(`${program.padEnd(17)} ${tier.label.padEnd(12)} ${percent(totals.noFocusSigns, totals.attempts).padStart(8)} ${percent(totals.focusSigns, totals.attempts).padStart(8)} ${`${(focus - noFocus).toFixed(1)} pp`.padStart(9)} ${String(totals.attempts).padStart(9)}`)
}

function average(values: readonly number[]): string {
  return values.length === 0 ? '—' : (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
}

const audit = emptyAudit()
console.log(`MATCHED FOCUS CALIBRATION — Pine lower 4★ ${LOWER_FOUR_TRIALS} paired trials`)
const pineLower = collect(PINE_VALLEY, TIERS.lowerFour, LOWER_FOUR_TRIALS, audit)
const pineHigh = collect(PINE_VALLEY, TIERS.highFour, HIGH_FOUR_TRIALS, audit)
const charlotteLower = collect(CHARLOTTE_TECH, TIERS.lowerFour, COMPARISON_TRIALS, audit)
const northbridgeLower = collect(NORTHBRIDGE, TIERS.lowerFour, COMPARISON_TRIALS, audit)

console.log('\nFOCUS EFFECTIVENESS')
console.log('Program           Tier          No Focus    Focus      Lift  Attempts')
printPairRow('Pine Valley', TIERS.lowerFour, pineLower)
printPairRow('Pine Valley', TIERS.highFour, pineHigh)
printPairRow('Charlotte Tech', TIERS.lowerFour, charlotteLower)
printPairRow('Northbridge', TIERS.lowerFour, northbridgeLower)
const pineTotals = summarize(pineLower)
console.log(`Pine lower-4★ pairs — both: ${pineTotals.both}, Focus only: ${pineTotals.focusOnly}, No-Focus only: ${pineTotals.noFocusOnly}, neither: ${pineTotals.neither}`)
console.log(`Pine lower-4★ timing (No Focus): R${pineTotals.noFocusTiming.regular}/P${pineTotals.noFocusTiming.postseason}/L${pineTotals.noFocusTiming.late}/loss${pineTotals.noFocusTiming.loss}/unsigned${pineTotals.noFocusTiming.unsigned}`)
console.log(`Pine lower-4★ timing (Focus): R${pineTotals.focusTiming.regular}/P${pineTotals.focusTiming.postseason}/L${pineTotals.focusTiming.late}/loss${pineTotals.focusTiming.loss}/unsigned${pineTotals.focusTiming.unsigned}`)
console.log(`Pine lower-4★ average commitment period: No Focus ${average(pineTotals.noFocusCommitmentPeriods)}; Focus ${average(pineTotals.focusCommitmentPeriods)}.`)

console.log('\nPINE VALLEY COMPETITION BREAKDOWN — LOWER 4★')
console.log('Segment                         Attempts  No Focus   Focus')
for (const [label, predicate] of [
  ['0 competing offers', (value: Competition) => value.offerCount === 0],
  ['1 competing offer', (value: Competition) => value.offerCount === 1],
  ['2+ competing offers', (value: Competition) => value.offerCount >= 2],
  ['No competitor', (value: Competition) => value.offerCount === 0],
  ['Strongest: 1–39', (value: Competition) => value.highestPrestige >= 1 && value.highestPrestige <= 39],
  ['Strongest: 40–59', (value: Competition) => value.highestPrestige >= 40 && value.highestPrestige <= 59],
  ['Strongest: 60–79', (value: Competition) => value.highestPrestige >= 60 && value.highestPrestige <= 79],
  ['Strongest: 80–100', (value: Competition) => value.highestPrestige >= 80 && value.highestPrestige <= 100],
  ['No elite offer', (value: Competition) => value.highestPrestige < 80],
  ['Elite 80–100 offer', (value: Competition) => value.highestPrestige >= 80],
] as const) {
  const segment = filterPairs(pineLower, predicate)
  console.log(`${label.padEnd(30)} ${String(segment.length).padStart(8)} ${signedRate(segment, false).padStart(9)} ${signedRate(segment, true).padStart(8)}`)
}
const offerCounts = [0, 1, 2].map((count) => count === 2
  ? filterPairs(pineLower, ({ offerCount }) => offerCount >= 2).length
  : filterPairs(pineLower, ({ offerCount }) => offerCount === count).length)
console.log(`AI coverage: 0 offers ${percent(offerCounts[0]!, pineLower.length)}, 1 offer ${percent(offerCounts[1]!, pineLower.length)}, 2+ offers ${percent(offerCounts[2]!, pineLower.length)}, 60+ offer ${percent(filterPairs(pineLower, ({ highestPrestige }) => highestPrestige >= 60).length, pineLower.length)}, 80+ offer ${percent(filterPairs(pineLower, ({ highestPrestige }) => highestPrestige >= 80).length, pineLower.length)}.`)
console.log(`Average Pine lower-4★ target: rank ${(pineLower.reduce((sum, pair) => sum + pair.recruit.nationalRank, 0) / Math.max(1, pineLower.length)).toFixed(1)}, OVR ${(pineLower.reduce((sum, pair) => sum + calculateOverall(pair.recruit.player), 0) / Math.max(1, pineLower.length)).toFixed(1)}, POT ${(pineLower.reduce((sum, pair) => sum + pair.recruit.player.potential, 0) / Math.max(1, pineLower.length)).toFixed(1)}.`)

// One exact configuration is replayed to prove paired determinism directly.
const deterministicBase = baseDynasty(0, PINE_VALLEY)
const first = runPair(deterministicBase, TIERS.lowerFour, emptyAudit())
const second = runPair(deterministicBase, TIERS.lowerFour, emptyAudit())
audit.deterministicMismatch += Number(JSON.stringify(first) !== JSON.stringify(second))
console.log('\nSTRUCTURAL AUDIT')
console.log(`Focus > 3: ${audit.focusLimitViolations}; invalid Focus: ${audit.invalidFocuses}; duplicate commitments: ${audit.duplicateCommitments}; lifecycle failures: ${audit.lifecycleFailures}; deterministic mismatch: ${audit.deterministicMismatch}`)
