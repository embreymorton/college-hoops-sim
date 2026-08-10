import {
  addRecruitingBoardTarget,
  autoFinalizeRecruiting,
  deriveBaseRecruitAttraction,
  deriveRecruitProgramStandings,
  initializeDynastyState,
  initializeRecruiting,
  offerRecruit,
  resolveRecruitingPeriod,
  setRecruitingFocus,
  syncRecruitingThroughCompletedPostseasonRounds,
  type DynastyState,
  type Recruit,
} from '../src/dynasty'
import { calculateOverall } from '../src/engine'
import { PRESTIGE_SENSITIVITY } from '../src/dynasty/recruiting/constants'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../src/postseason'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason, simulatePendingGamesInRound } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const TRIALS = Number(process.env.TRIALS ?? 200)
const CONTEXT_TRIALS = Number(process.env.CONTEXT_TRIALS ?? 10)
const PINE_VALLEY = 'pine-valley'
const CHARLOTTE_TECH = 'charlotte-tech'
const NORTHBRIDGE = 'northbridge'

const TIERS = [
  { label: '5★ / elite', matches: (recruit: Recruit) => recruit.stars === 5 && recruit.nationalRank <= 15 },
  { label: 'High 4★', matches: (recruit: Recruit) => recruit.stars === 4 && recruit.nationalRank >= 15 && recruit.nationalRank <= 35 },
  { label: 'Lower 4★', matches: (recruit: Recruit) => recruit.stars === 4 && recruit.nationalRank >= 35 && recruit.nationalRank <= 60 },
  { label: 'Strong 3★', matches: (recruit: Recruit) => recruit.stars === 3 && recruit.nationalRank >= 60 && recruit.nationalRank <= 100 },
] as const

type Tier = (typeof TIERS)[number]

interface Attempt {
  readonly signed: boolean
  readonly recruit: Recruit
  readonly competitors: number
  readonly competitorPrestige: number
  readonly highestCompetitorPrestige: number
  readonly controlledStanding: number
  readonly bestCompetitorStanding: number
  readonly controlledAffinity: number
  readonly timing: 'regular' | 'postseason' | 'late' | 'loss' | 'unsigned'
}

interface Summary {
  attempts: number
  signed: number
  rank: number[]
  overall: number[]
  potential: number[]
  competitors: number[]
  competitorPrestige: number[]
  highestCompetitorPrestige: number[]
  controlledStanding: number[]
  bestCompetitorStanding: number[]
  affinity: number[]
  winningAffinity: number[]
  regular: number
  postseason: number
  late: number
  losses: number
  unsigned: number
}

interface StructuralAudit {
  focusLimitViolations: number
  invalidFocuses: number
  duplicateCommitments: number
  finalizationFailures: number
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function emptySummary(): Summary {
  return {
    attempts: 0, signed: 0, rank: [], overall: [], potential: [], competitors: [],
    competitorPrestige: [], highestCompetitorPrestige: [], controlledStanding: [],
    bestCompetitorStanding: [], affinity: [], winningAffinity: [], regular: 0,
    postseason: 0, late: 0, losses: 0, unsigned: 0,
  }
}

function emptyAudit(): StructuralAudit {
  return { focusLimitViolations: 0, invalidFocuses: 0, duplicateCommitments: 0, finalizationFailures: 0 }
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

function createBaseDynasty(seed: string, controlledProgramId: string): DynastyState {
  return initializeRecruiting(initializeDynastyState({
    dynastyId: `premium-upset:${seed}:${controlledProgramId}`,
    dynastySeed: seed,
    controlledProgramId,
    universe: UNIVERSE_V0,
    activeSeason: completeSeason(seed),
  }))
}

const baseDynasties = new Map<string, DynastyState>()

function baseDynasty(trial: number, controlledProgramId: string): DynastyState {
  const seed = `premium-upset:${trial}`
  let base = baseDynasties.get(seed)
  if (!base) {
    base = createBaseDynasty(seed, PINE_VALLEY)
    baseDynasties.set(seed, base)
  }
  return controlledProgramId === PINE_VALLEY
    ? base
    : { ...base, controlledProgramId }
}

function clearControlledBoard(dynasty: DynastyState): DynastyState {
  const controlled = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
  return {
    ...dynasty,
    recruiting: {
      ...dynasty.recruiting!,
      programs: {
        ...dynasty.recruiting!.programs,
        [controlled.programId]: { ...controlled, board: [] },
      },
    },
  }
}

function resolveLifecycle(dynasty: DynastyState): DynastyState {
  let current = dynasty
  for (let period = 1; period <= 24; period += 1) current = resolveRecruitingPeriod(current, period)
  let postseason = initializePostseason({ universe: current.universe, season: current.activeSeason! })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `${current.dynastySeed}:postseason`,
    })
  }
  current = syncRecruitingThroughCompletedPostseasonRounds({ ...current, activePostseason: postseason })
  return autoFinalizeRecruiting(current).dynasty
}

function auditFocus(dynasty: DynastyState, audit: StructuralAudit): void {
  const recruiting = dynasty.recruiting!
  for (const program of Object.values(recruiting.programs)) {
    const focused = program.board.filter(({ isFocused }) => isFocused)
    audit.focusLimitViolations += Number(focused.length > 3)
    audit.invalidFocuses += focused.filter(({ playerId }) =>
      recruiting.commitmentsByPlayerId[playerId] !== undefined,
    ).length
  }
  const commitments = Object.values(recruiting.commitmentsByPlayerId)
  audit.duplicateCommitments += commitments.length - new Set(commitments.map(({ playerId }) => playerId)).size
}

function targetCandidates(dynasty: DynastyState, tier: Tier): Recruit[] {
  const recruiting = dynasty.recruiting!
  const program = recruiting.programs[dynasty.controlledProgramId]!
  return recruiting.recruits.filter((recruit) =>
    tier.matches(recruit) && program.projectedOpeningsByPosition[recruit.player.position] > 0,
  ).sort((first, second) => first.nationalRank - second.nationalRank || first.player.id.localeCompare(second.player.id))
}

function attempt(base: DynastyState, tier: Tier, focused: boolean, audit: StructuralAudit): Attempt | undefined {
  for (const recruit of targetCandidates(base, tier)) {
    try {
      let configured = addRecruitingBoardTarget({ dynasty: clearControlledBoard(base), playerId: recruit.player.id })
      configured = offerRecruit({ dynasty: configured, playerId: recruit.player.id })
      if (focused) configured = setRecruitingFocus({ dynasty: configured, playerId: recruit.player.id, isFocused: true })
      auditFocus(configured, audit)
      const recruiting = configured.recruiting!
      const programs = Object.values(recruiting.programs).filter(({ programId, board }) =>
        programId !== configured.controlledProgramId && board.some(({ playerId }) => playerId === recruit.player.id),
      )
      const standings = deriveRecruitProgramStandings(configured, recruit.player.id)
      const controlled = standings.find(({ programId }) => programId === configured.controlledProgramId)!
      const competitors = standings.filter(({ programId }) => programs.some((program) => program.programId === programId))
      const team = configured.activeSeason!.programStates[configured.controlledProgramId]!.team
      const controlledAffinity = deriveBaseRecruitAttraction(configured, recruit, controlled.programId) -
        (20 + team.prestige * PRESTIGE_SENSITIVITY[recruit.stars])
      let final: DynastyState
      try {
        final = resolveLifecycle(configured)
      } catch {
        audit.finalizationFailures += 1
        throw new Error('Recruiting lifecycle failed during the upset diagnostic.')
      }
      auditFocus(final, audit)
      const commitment = final.recruiting!.commitmentsByPlayerId[recruit.player.id]
      const signed = commitment?.programId === configured.controlledProgramId
      const timing = !commitment
        ? 'unsigned'
        : !signed
          ? 'loss'
          : commitment.timing.kind === 'late'
            ? 'late'
            : commitment.timing.period <= 24 ? 'regular' : 'postseason'
      return {
        signed,
        recruit,
        competitors: competitors.length,
        competitorPrestige: average(competitors.map(({ programId }) => configured.activeSeason!.programStates[programId]!.team.prestige)),
        highestCompetitorPrestige: Math.max(0, ...competitors.map(({ programId }) => configured.activeSeason!.programStates[programId]!.team.prestige)),
        controlledStanding: controlled.standing,
        bestCompetitorStanding: Math.max(0, ...competitors.map(({ standing }) => standing)),
        controlledAffinity,
        timing,
      }
    } catch {
      // Legal target/offer eligibility is part of the diagnostic selection.
    }
  }
  return undefined
}

function record(summary: Summary, result: Attempt): void {
  summary.attempts += 1
  summary.signed += Number(result.signed)
  summary.rank.push(result.recruit.nationalRank)
  summary.overall.push(calculateOverall(result.recruit.player))
  summary.potential.push(result.recruit.player.potential)
  summary.competitors.push(result.competitors)
  summary.competitorPrestige.push(result.competitorPrestige)
  summary.highestCompetitorPrestige.push(result.highestCompetitorPrestige)
  summary.controlledStanding.push(result.controlledStanding)
  summary.bestCompetitorStanding.push(result.bestCompetitorStanding)
  summary.affinity.push(result.controlledAffinity)
  if (result.signed) summary.winningAffinity.push(result.controlledAffinity)
  if (result.timing === 'regular') summary.regular += 1
  else if (result.timing === 'postseason') summary.postseason += 1
  else if (result.timing === 'late') summary.late += 1
  else if (result.timing === 'loss') summary.losses += 1
  else summary.unsigned += 1
}

function run(programId: string, tier: Tier, focused: boolean, trials: number, audit: StructuralAudit): Summary {
  const summary = emptySummary()
  for (let trial = 0; trial < trials; trial += 1) {
    const result = attempt(
      baseDynasty(trial, programId),
      tier,
      focused,
      audit,
    )
    if (result) record(summary, result)
  }
  return summary
}

function percent(numerator: number, denominator: number): string {
  return `${(denominator === 0 ? 0 : numerator * 100 / denominator).toFixed(1)}%`
}

function printPineRow(tier: Tier, focused: Summary, plain?: Summary): void {
  const focusVsPlain = plain
    ? `${percent(focused.signed, focused.attempts)} / ${percent(plain.signed, plain.attempts)}`
    : '—'
  console.log(`${tier.label.padEnd(14)} ${String(focused.attempts).padStart(8)} ${percent(focused.signed, focused.attempts).padStart(8)} ${focusVsPlain.padStart(16)}`)
}

const audit = emptyAudit()
const pineFocused = new Map(TIERS.map((tier) => [tier.label, emptySummary()]))
const pinePlain = new Map(TIERS.map((tier) => [tier.label, emptySummary()]))

console.log(`UNDERDOG PREMIUM-RECRUIT UPSET DIAGNOSTIC — ${TRIALS} deterministic trials`)
// A trial is one complete canonical Recruiting lifecycle. Tier rotation keeps
// the requested 200-world sample bounded while preserving matched Focus/no-Focus
// worlds for both 4-star tiers.
for (let trial = 0; trial < TRIALS; trial += 1) {
  const tier = TIERS[trial % TIERS.length]!
  const matchedTier = tier.label === 'High 4★' || tier.label === 'Lower 4★'
  const focused = !matchedTier || Math.floor(trial / TIERS.length) % 2 === 0
  const result = attempt(baseDynasty(trial, PINE_VALLEY), tier, focused, audit)
  if (result) record((focused ? pineFocused : pinePlain).get(tier.label)!, result)
}

console.log('\nPINE VALLEY UPSET RATES')
console.log('Tier             Attempts   Sign %   Focus / No Focus')
for (const tier of TIERS) printPineRow(tier, pineFocused.get(tier.label)!, pinePlain.get(tier.label))

console.log('\nPINE VALLEY FOCUSED DETAIL')
console.log('Tier             Rank   OVR*   POT  Pursuers  Avg Opp Prest  High Opp  Ctrl Stand  Best Opp  Affinity / Win Affinity  Reg/Post/Late/Loss/Unsigned')
for (const tier of TIERS) {
  const summary = pineFocused.get(tier.label)!
  console.log(`${tier.label.padEnd(14)} ${average(summary.rank).toFixed(1).padStart(5)} ${average(summary.overall).toFixed(1).padStart(6)} ${average(summary.potential).toFixed(1).padStart(5)} ${average(summary.competitors).toFixed(1).padStart(9)} ${average(summary.competitorPrestige).toFixed(1).padStart(14)} ${average(summary.highestCompetitorPrestige).toFixed(1).padStart(9)} ${average(summary.controlledStanding).toFixed(1).padStart(10)} ${average(summary.bestCompetitorStanding).toFixed(1).padStart(9)} ${`${average(summary.affinity).toFixed(1)} / ${average(summary.winningAffinity).toFixed(1)}`.padStart(23)} ${`${summary.regular}/${summary.postseason}/${summary.late}/${summary.losses}/${summary.unsigned}`.padStart(27)}`)
}

console.log(`\nPRESTIGE COMPARISON — ${CONTEXT_TRIALS} trials each, focused High/Lower 4★`) 
console.log('Program           Tier          Sign %  Attempts')
for (const programId of [PINE_VALLEY, CHARLOTTE_TECH, NORTHBRIDGE]) {
  const program = UNIVERSE_V0.programs.find(({ id }) => id === programId)!
  for (const tier of TIERS.filter(({ label }) => label === 'High 4★' || label === 'Lower 4★')) {
    const summary = run(programId, tier, true, CONTEXT_TRIALS, audit)
    console.log(`${program.name.padEnd(17)} ${tier.label.padEnd(13)} ${percent(summary.signed, summary.attempts).padStart(7)} ${String(summary.attempts).padStart(9)}`)
  }
}

console.log('\nSTRUCTURAL AUDIT')
console.log(`Focus > 3: ${audit.focusLimitViolations}`)
console.log(`Focused committed/unavailable target: ${audit.invalidFocuses}`)
console.log(`Duplicate commitments: ${audit.duplicateCommitments}`)
console.log(`Finalization failures: ${audit.finalizationFailures}`)
