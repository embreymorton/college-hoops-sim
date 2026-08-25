import { POSITIONS } from '../src/engine'
import {
  autoFinalizeRecruiting,
  cleanupInvalidRecruitingOffers,
  deriveLateRecruitResolutionOrder,
  deriveMandatoryNeedsByPosition,
  deriveRecruitProgramStandings,
  deriveRemainingScholarships,
  generateRecruitingClass,
  manageProgramRecruitingOffers,
  prepareLateRecruiting,
  preparePremiumLateMarket,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
  type RecruitingCommitment,
  type RecruitingState,
} from '../src/dynasty'
import { canRecruitUseRemainingOpening, getRecruit } from '../src/dynasty/recruiting/queries'
import { completeRounds, createRecruitingDynasty } from '../src/dynasty/recruiting/testSupport'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../src/postseason'

interface CycleVerification {
  readonly seed: string
  readonly matcherInvoked: boolean
  readonly assistedPrograms: number
  readonly mandatoryFilled: number
  readonly flexibleFilled: number
  readonly fallbackFilled: number
  readonly totalIncoming: number
  readonly baselineClassSize: number
  readonly b2ClassSize: number
}

function readyForLate(seed: string): DynastyState {
  let dynasty = createRecruitingDynasty(seed)
  dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!) }
  dynasty = syncRecruitingThroughCompletedRounds(dynasty)
  let postseason = initializePostseason({
    universe: dynasty.universe,
    season: dynasty.activeSeason!,
  })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `${seed}:postseason`,
    })
  }
  return syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
}

function fillFlexibleOffers(
  dynasty: DynastyState,
  recruiting: RecruitingState,
): RecruitingState {
  let current = cleanupInvalidRecruitingOffers(recruiting)
  for (const programId of Object.keys(current.programs).sort()) {
    const program = manageProgramRecruitingOffers(dynasty, current, programId)
    current = {
      ...current,
      programs: { ...current.programs, [programId]: program },
    }
  }
  return cleanupInvalidRecruitingOffers(current)
}

function resolveLateOffers(
  dynasty: DynastyState,
  recruiting: RecruitingState,
): { recruiting: RecruitingState; commitments: number } {
  let current = recruiting
  let commitments = 0
  for (const playerId of deriveLateRecruitResolutionOrder(current)) {
    if (!getRecruit(current, playerId)) {
      throw new RangeError(`Unknown Recruit Player ID "${playerId}".`)
    }
    if (current.commitmentsByPlayerId[playerId]) continue
    const candidates = Object.keys(current.programs).sort().filter((programId) => {
      const program = current.programs[programId]!
      return program.board.some((target) =>
        target.playerId === playerId && target.hasActiveOffer,
      ) && canRecruitUseRemainingOpening(current, program, playerId)
    })
    if (candidates.length === 0) continue
    const candidateSet = new Set(candidates)
    const winner = deriveRecruitProgramStandings(
      { ...dynasty, recruiting: current },
      playerId,
    ).find(({ programId }) => candidateSet.has(programId))!
    const commitment: RecruitingCommitment = {
      playerId,
      programId: winner.programId,
      timing: { kind: 'late' },
      targetSeasonNumber: current.targetSeasonNumber,
    }
    current = cleanupInvalidRecruitingOffers({
      ...current,
      commitmentsByPlayerId: {
        ...current.commitmentsByPlayerId,
        [playerId]: commitment,
      },
    })
    commitments += 1
  }
  return { recruiting: current, commitments }
}

function verifyCycle(seed: string): CycleVerification {
  const ready = readyForLate(seed)
  const season = ready.activeSeason!
  const baselineClassSize = generateRecruitingClass({
    dynastySeed: ready.dynastySeed,
    targetSeasonNumber: season.seasonNumber + 1,
    season,
    capacityModel: 'exact-v0',
  }).length
  const b2ClassSize = generateRecruitingClass({
    dynastySeed: ready.dynastySeed,
    targetSeasonNumber: season.seasonNumber + 1,
    season,
    capacityModel: 'flexible-v1',
  }).length

  let current = prepareLateRecruiting(ready)
  let fallbackState: RecruitingState | null = null
  while (Object.values(current.recruiting!.programs).some((program) =>
    deriveRemainingScholarships(current.recruiting!, program) > 0,
  )) {
    let offered = fillFlexibleOffers(current, current.recruiting!)
    offered = preparePremiumLateMarket(current, offered)
    const resolved = resolveLateOffers(current, offered)
    current = { ...current, recruiting: resolved.recruiting }
    if (resolved.commitments > 0) continue
    fallbackState = current.recruiting!
    break
  }

  const mandatoryFilled = fallbackState === null ? 0 : Object.values(fallbackState.programs)
    .reduce((total, program) => total + POSITIONS.reduce(
      (sum, position) => sum + deriveMandatoryNeedsByPosition(fallbackState!, program)[position],
      0,
    ), 0)
  const fallbackFilled = fallbackState === null ? 0 : Object.values(fallbackState.programs)
    .reduce((total, program) => total + deriveRemainingScholarships(fallbackState!, program), 0)
  const assistedPrograms = fallbackState === null ? 0 : Object.values(fallbackState.programs)
    .filter((program) => deriveRemainingScholarships(fallbackState!, program) > 0).length
  const finalized = autoFinalizeRecruiting(current)
  if (finalized.fallbackMatcherUsed !== (fallbackState !== null)) {
    throw new RangeError(`Diagnostic fallback observation diverged for ${seed}.`)
  }
  return {
    seed,
    matcherInvoked: finalized.fallbackMatcherUsed,
    assistedPrograms,
    mandatoryFilled,
    flexibleFilled: fallbackFilled - mandatoryFilled,
    fallbackFilled,
    totalIncoming: Object.keys(finalized.dynasty.recruiting!.commitmentsByPlayerId).length,
    baselineClassSize,
    b2ClassSize,
  }
}

const cyclesArgument = process.argv.find((value) => value.startsWith('--cycles='))
const cycles = cyclesArgument ? Number(cyclesArgument.split('=')[1]) : 100
if (!Number.isSafeInteger(cycles) || cycles <= 0) throw new RangeError('--cycles must be a positive integer.')
const prefixArgument = process.argv.find((value) => value.startsWith('--prefix='))
const prefix = prefixArgument?.split('=')[1] ?? 'b2-production-verification'
const results = Array.from({ length: cycles }, (_, index) =>
  verifyCycle(`${prefix}-${String(index).padStart(4, '0')}`),
)
const affected = results.filter(({ matcherInvoked }) => matcherInvoked)
const fallbackCounts = affected.map(({ fallbackFilled }) => fallbackFilled)
const totalFallback = fallbackCounts.reduce((sum, count) => sum + count, 0)
const totalIncoming = results.reduce((sum, result) => sum + result.totalIncoming, 0)
console.log(JSON.stringify({
  cycles,
  matcherInvocations: affected.length,
  cyclesRequiringMatcher: affected.length,
  assistedProgramsByAffectedCycle: affected.map(({ assistedPrograms }) => assistedPrograms),
  assistedProgramsTotal: affected.reduce((sum, result) => sum + result.assistedPrograms, 0),
  mandatoryFilled: affected.reduce((sum, result) => sum + result.mandatoryFilled, 0),
  flexibleFilled: affected.reduce((sum, result) => sum + result.flexibleFilled, 0),
  fallbackFilled: totalFallback,
  averageFallbackFilledPerAffectedCycle: affected.length === 0 ? 0 : totalFallback / affected.length,
  maximumFallbackFilledPerAffectedCycle: fallbackCounts.length === 0 ? 0 : Math.max(...fallbackCounts),
  fallbackShareOfIncoming: totalIncoming === 0 ? 0 : totalFallback / totalIncoming,
  baselineMeanClassSize: results.reduce((sum, result) => sum + result.baselineClassSize, 0) / results.length,
  b2MeanClassSize: results.reduce((sum, result) => sum + result.b2ClassSize, 0) / results.length,
  classSizeDifferences: results.filter((result) => result.baselineClassSize !== result.b2ClassSize),
  affectedCycles: affected,
}, null, 2))
