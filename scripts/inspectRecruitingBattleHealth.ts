import {
  autoFinalizeRecruiting,
  alignGeneratedRecruitingFocus,
  beginOffseason,
  buildDefaultRecruitingBoard,
  initializeDynastyState,
  initializeRecruiting,
  manageProgramRecruitingOffers,
  resolveRecruitingPeriod,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  type DynastyState,
  type RecruitStarRating,
  type RecruitingReadiness,
} from '../src/dynasty'
import { initializePostseason, simulatePendingGamesInTournamentRound, TOURNAMENT_ROUNDS } from '../src/postseason'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason, simulatePendingGamesInRound } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { calibrationSeeds, resolveLongRunCliConfig } from './calibration/presets'
import {
  classifySparseCompetitionReason,
  countBucket,
  observePlanCoherence,
  observeReadinessBeforeCommitment,
  observeRecruitCompetition,
  type CompetitionObservation,
  type PlanCoherenceObservation,
  type ReadinessTransitionObservation,
  type SparseCompetitionReason,
} from './recruitingBattleHealthMetrics'

const CHECKPOINTS = [0, 4, 12, 20] as const
const STAR_TIERS = [5, 4, 3] as const

interface Diagnostic {
  plans: PlanCoherenceObservation[]
  transitions: ReadinessTransitionObservation[]
  competition: { checkpoint: number; observation: CompetitionObservation }[]
  sparse: { stars: RecruitStarRating; reason: SparseCompetitionReason }[]
}

function createDynasty(seed: string): DynastyState {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  const activeSeason = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:season-1:schedule`, gameIdNamespace: 'season-1' }),
    seasonNumber: 1,
  })
  return initializeRecruiting(initializeDynastyState({ dynastyId: `battle-health:${seed}`, dynastySeed: seed, controlledProgramId: 'charlotte-tech', universe: UNIVERSE_V0, activeSeason }))
}

function generatedControlledPlans(dynasty: DynastyState): {
  baseline: DynastyState
  candidate: DynastyState
} {
  const recruiting = dynasty.recruiting!
  const id = dynasty.controlledProgramId!
  const empty = { ...recruiting.programs[id]!, board: [] }
  const current = { ...dynasty, recruiting: { ...recruiting, programs: { ...recruiting.programs, [id]: empty } } }
  const board = buildDefaultRecruitingBoard(current, current.recruiting!, id)
  const withBoard = { ...empty, board }
  const program = manageProgramRecruitingOffers(current, { ...current.recruiting!, programs: { ...current.recruiting!.programs, [id]: withBoard } }, id)
  const baseline = { ...current, recruiting: { ...current.recruiting!, programs: { ...current.recruiting!.programs, [id]: program } } }
  const aligned = alignGeneratedRecruitingFocus(
    baseline,
    baseline.recruiting!,
    id,
    program,
  )
  return {
    baseline,
    candidate: {
      ...baseline,
      recruiting: {
        ...baseline.recruiting!,
        programs: { ...baseline.recruiting!.programs, [id]: aligned },
      },
    },
  }
}

function observeCheckpoint(dynasty: DynastyState, checkpoint: number, result: Diagnostic): void {
  for (const recruit of dynasty.recruiting!.recruits.filter(
    ({ player, stars }) =>
      stars >= 3 &&
      dynasty.recruiting!.commitmentsByPlayerId[player.id] === undefined,
  )) {
    const observation = observeRecruitCompetition(dynasty, recruit)
    result.competition.push({ checkpoint, observation })
    if (recruit.stars >= 4 && observation.offers <= 1) {
      result.sparse.push({ stars: recruit.stars, reason: classifySparseCompetitionReason(dynasty, recruit) })
    }
  }
}

function run(seed: string, seasons: number): Diagnostic {
  const result: Diagnostic = { plans: [], transitions: [], competition: [], sparse: [] }
  let dynasty = createDynasty(seed)
  for (let seasonIndex = 0; seasonIndex < seasons; seasonIndex += 1) {
    const generated = generatedControlledPlans(dynasty)
    result.plans.push(observePlanCoherence(generated.baseline, dynasty.controlledProgramId!, 'controlled-baseline'))
    dynasty = generated.candidate
    result.plans.push(observePlanCoherence(dynasty, dynasty.controlledProgramId!, 'controlled-candidate'))
    for (const id of Object.keys(dynasty.recruiting!.programs).sort().filter((id) => id !== dynasty.controlledProgramId!)) {
      result.plans.push(observePlanCoherence(dynasty, id, 'ai'))
    }
    observeCheckpoint(dynasty, 0, result)
    for (let period = 1; period <= 24; period += 1) {
      dynasty = { ...dynasty, activeSeason: simulatePendingGamesInRound({ season: dynasty.activeSeason!, round: period, simulationSeed: `${seed}:season-${dynasty.activeSeason!.seasonNumber}:games` }) }
      const before = dynasty
      dynasty = resolveRecruitingPeriod(dynasty, period)
      for (const commitment of Object.values(dynasty.recruiting!.commitmentsByPlayerId)) {
        if (!before.recruiting!.commitmentsByPlayerId[commitment.playerId]) {
          result.transitions.push(observeReadinessBeforeCommitment(before, commitment.playerId, period, commitment.programId))
        }
      }
      if ((CHECKPOINTS as readonly number[]).includes(period)) observeCheckpoint(dynasty, period, result)
    }
    let postseason = initializePostseason({ universe: dynasty.universe, season: dynasty.activeSeason! })
    for (const round of TOURNAMENT_ROUNDS) {
      const before = dynasty
      postseason = simulatePendingGamesInTournamentRound({ postseason, round, simulationSeed: `${seed}:season-${dynasty.activeSeason!.seasonNumber}:postseason` })
      dynasty = syncRecruitingThroughCompletedPostseasonRounds({ ...dynasty, activePostseason: postseason })
      for (const commitment of Object.values(dynasty.recruiting!.commitmentsByPlayerId)) {
        if (!before.recruiting!.commitmentsByPlayerId[commitment.playerId] && commitment.timing.kind === 'period') {
          result.transitions.push(observeReadinessBeforeCommitment(before, commitment.playerId, commitment.timing.period, commitment.programId))
        }
      }
    }
    const finalized = autoFinalizeRecruiting(dynasty).dynasty
    if (seasonIndex < seasons - 1) dynasty = rolloverDynastyToNextSeason(beginOffseason(finalized))
  }
  return result
}

function pct(n: number, d: number) { return `${(d ? n * 100 / d : 0).toFixed(1)}%` }
function summarize(results: Diagnostic[]): void {
  const plans = results.flatMap((r) => r.plans)
  console.log('GENERATED PLAN COHERENCE')
  for (const kind of ['controlled-baseline', 'controlled-candidate', 'ai'] as const) {
    const rows = plans.filter((r) => r.programKind === kind)
    const focused = rows.reduce((s, r) => s + r.focused, 0)
    const offered = rows.reduce((s, r) => s + r.focusedOffered, 0)
    const distribution = [3, 2, 1, 0].map((n) => `${n}/3 ${pct(rows.filter((r) => r.focused === 3 && r.focusedOffered === n).length, rows.filter((r) => r.focused === 3).length)}`).join(' | ')
    console.log(`${kind}: ${offered}/${focused} Focus offered (${pct(offered, focused)}); ${distribution}`)
  }
  const reasons: Record<string, number> = {}
  for (const row of plans.filter((r) => r.programKind === 'controlled-candidate')) for (const [reason, count] of Object.entries(row.missingOfferReasons)) reasons[reason] = (reasons[reason] ?? 0) + count
  console.log(`Candidate missing-Offer reasons: ${JSON.stringify(reasons)}\n`)

  const transitions = results.flatMap((r) => r.transitions)
  console.log('READINESS BEFORE COMMITMENT')
  for (const stars of ['all', 5, 4] as const) {
    const rows = stars === 'all' ? transitions : transitions.filter((r) => r.stars === stars)
    const counts = (['not-deciding', 'decision-soon', 'developing', 'serious', 'decision-imminent'] as RecruitingReadiness[]).map((state) => `${state} ${rows.filter((r) => r.readiness === state).length} (${pct(rows.filter((r) => r.readiness === state).length, rows.length)})`).join(' | ')
    const oldEarly = rows.filter((r) => r.legacyReadiness === 'early')
    console.log(`${stars}★: n=${rows.length}; ${counts}; old Early→Decision Soon ${pct(oldEarly.filter((r) => r.readiness === 'decision-soon').length, oldEarly.length)}; old Early→Not Deciding ${pct(oldEarly.filter((r) => r.readiness === 'not-deciding').length, oldEarly.length)}; invalid Decision Soon boundary ${rows.filter((r) => !r.decisionSoonBecomesEligibleNextPeriod).length}`)
  }

  console.log('\nCOMPETITION BY STAR TIER')
  const competition = results.flatMap((r) => r.competition)
  for (const checkpoint of CHECKPOINTS) for (const stars of STAR_TIERS) {
    const rows = competition.filter((r) => r.checkpoint === checkpoint && r.observation.stars === stars).map((r) => r.observation)
    const p = ['0', '1', '2', '3+'].map((bucket) => `${bucket}:${pct(rows.filter((r) => countBucket(r.pursuers) === bucket).length, rows.length)}`).join(' ')
    const o = ['0', '1', '2', '3+'].map((bucket) => `${bucket}:${pct(rows.filter((r) => countBucket(r.offers) === bucket).length, rows.length)}`).join(' ')
    console.log(`P${String(checkpoint).padStart(2)} ${stars}★ n=${rows.length} pursuits [${p}] offers [${o}]`)
  }

  console.log('\nSPARSE PREMIUM COMPETITION CAUSES (offers <= 1)')
  const sparse = results.flatMap((r) => r.sparse)
  for (const stars of [5, 4] as const) {
    const rows = sparse.filter((r) => r.stars === stars)
    const reasons = [...new Set(rows.map((r) => r.reason))].sort().map((reason) => `${reason} ${pct(rows.filter((r) => r.reason === reason).length, rows.length)}`).join(' | ')
    console.log(`${stars}★ n=${rows.length}: ${reasons}`)
  }
}

const config = resolveLongRunCliConfig(process.argv.slice(2))
const seeds = calibrationSeeds(config.seeds).map((seed) => `recruiting-battle-health:${seed}`)
console.log(`RECRUITING BATTLE HEALTH — ${config.seeds} seeds × ${config.seasons} Seasons — LIGHT production lifecycle\n`)
summarize(seeds.map((seed) => run(seed, config.seasons)))
