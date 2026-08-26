import { deriveConferenceStandings, deriveProgramRecord } from '../season'
import type { TournamentRound } from '../postseason'
import type { DynastyState } from './domain'
import {
  deriveHistoricalTournamentOutcome,
  type HistoricalTournamentOutcome,
} from './seasonYearbook'

export const PROGRAM_REPUTATION_ERA_WEIGHTS = [25, 22, 20, 18, 15] as const
export const PROGRAM_REPUTATION_NEUTRAL_PRIOR = 50
export const PROGRAM_REPUTATION_MATURITY = [0, 0.4, 0.65, 0.9, 0.96, 1] as const
export const PROGRAM_REPUTATION_TREND_THRESHOLD = 4

export type ProgramReputationTier =
  | 'unestablished'
  | 'low'
  | 'regional'
  | 'emerging'
  | 'national'
  | 'national-power'
  | 'elite'

export type ProgramReputationTrend = 'rising' | 'steady' | 'falling' | null

export type ProgramReputationTournamentFinish =
  | 'none'
  | 'round-of-16'
  | 'elite-eight'
  | 'final-four'
  | 'runner-up'
  | 'champion'

export interface ProgramReputationSeasonEvidence {
  readonly seasonNumber: number
  readonly wins: number
  readonly losses: number
  readonly conferenceFinish: number
  readonly tournamentFinish: ProgramReputationTournamentFinish
}

export type ProgramReputationFact =
  | {
      readonly kind: 'recent-national-championship'
      readonly seasonNumber: number
      readonly seasonsAgo: number
    }
  | {
      readonly kind: 'multiple-deep-tournament-runs'
      readonly count: number
      readonly windowSeasons: number
    }
  | {
      readonly kind: 'consecutive-tournament-misses'
      readonly count: number
    }
  | {
      readonly kind: 'consecutive-losing-seasons'
      readonly count: number
    }
  | {
      readonly kind: 'recent-deep-tournament-run'
      readonly finish: 'final-four' | 'runner-up'
      readonly seasonNumber: number
      readonly seasonsAgo: number
    }
  | {
      readonly kind: 'repeated-tournament-appearances'
      readonly count: number
      readonly windowSeasons: number
    }
  | {
      readonly kind: 'repeated-twenty-win-seasons'
      readonly count: number
      readonly windowSeasons: number
    }
  | {
      readonly kind: 'recent-conference-championships'
      readonly count: number
      readonly mostRecentSeasonNumber: number
      readonly windowSeasons: number
    }
  | {
      readonly kind: 'strong-aggregate-record'
      readonly wins: number
      readonly losses: number
      readonly seasons: number
    }
  | {
      readonly kind: 'weak-aggregate-record'
      readonly wins: number
      readonly losses: number
      readonly seasons: number
    }

export interface ProgramReputationSnapshot {
  readonly programId: string
  readonly asOfCompletedSeasonNumber: number | null
  readonly completedSeasons: number
  /** Internal derivation value. Player-facing surfaces must render only tier/trend/facts. */
  readonly score: number | null
  readonly tier: ProgramReputationTier
  readonly trend: ProgramReputationTrend
  readonly facts: readonly ProgramReputationFact[]
}

const TOURNAMENT_SCORES: Readonly<Record<ProgramReputationTournamentFinish, number>> = {
  none: 0,
  'round-of-16': 5,
  'elite-eight': 30,
  'final-four': 65,
  'runner-up': 82,
  champion: 100,
}

function conferenceScore(finish: number): number {
  if (finish === 1) return 100
  if (finish === 2) return 80
  if (finish <= 4) return 60
  if (finish <= 7) return 35
  return 10
}

function tournamentFinish(outcome: HistoricalTournamentOutcome): ProgramReputationTournamentFinish {
  switch (outcome.status) {
    case 'did-not-qualify':
      return 'none'
    case 'runner-up':
      return 'runner-up'
    case 'national-champion':
      return 'champion'
    case 'eliminated':
      return tournamentRoundFinish(outcome.round)
  }
}

function tournamentRoundFinish(round: TournamentRound): ProgramReputationTournamentFinish {
  switch (round) {
    case 'round-of-16':
      return 'round-of-16'
    case 'quarterfinals':
      return 'elite-eight'
    case 'semifinals':
      return 'final-four'
    case 'championship':
      return 'runner-up'
  }
}

export function deriveProgramReputationSeasonScore(
  season: Omit<ProgramReputationSeasonEvidence, 'seasonNumber'>,
): number {
  if (
    !Number.isInteger(season.wins) || season.wins < 0 ||
    !Number.isInteger(season.losses) || season.losses < 0
  ) {
    throw new RangeError('Program Reputation wins and losses must be non-negative integers.')
  }
  const games = season.wins + season.losses
  if (games <= 0) {
    throw new RangeError('Completed Program Reputation evidence must include at least one game.')
  }
  if (!Number.isInteger(season.conferenceFinish) || season.conferenceFinish < 1) {
    throw new RangeError('Program Reputation Conference finish must be a positive integer.')
  }
  if (TOURNAMENT_SCORES[season.tournamentFinish] === undefined) {
    throw new RangeError('Program Reputation Tournament finish is invalid.')
  }
  return (
    0.6 * (100 * season.wins / games) +
    0.1 * conferenceScore(season.conferenceFinish) +
    0.3 * TOURNAMENT_SCORES[season.tournamentFinish]
  )
}

export function deriveProgramReputationTier(score: number): ProgramReputationTier {
  if (score < 35) return 'low'
  if (score < 48) return 'regional'
  if (score < 55) return 'emerging'
  if (score < 66) return 'national'
  if (score < 71) return 'national-power'
  return 'elite'
}

export function deriveProgramReputationTrend(delta: number | null): ProgramReputationTrend {
  if (delta === null) return null
  if (delta >= PROGRAM_REPUTATION_TREND_THRESHOLD) return 'rising'
  if (delta <= -PROGRAM_REPUTATION_TREND_THRESHOLD) return 'falling'
  return 'steady'
}

function reputationScore(history: readonly ProgramReputationSeasonEvidence[]): number | null {
  if (history.length === 0) return null
  const recent = history.slice(-5).reverse()
  const weights = PROGRAM_REPUTATION_ERA_WEIGHTS.slice(0, recent.length)
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)
  const earned = recent.reduce(
    (total, season, index) => total + deriveProgramReputationSeasonScore(season) * weights[index]!,
    0,
  ) / totalWeight
  const maturity = PROGRAM_REPUTATION_MATURITY[Math.min(history.length, 5)]!
  return earned * maturity + PROGRAM_REPUTATION_NEUTRAL_PRIOR * (1 - maturity)
}

function consecutiveCount(
  newestFirst: readonly ProgramReputationSeasonEvidence[],
  matches: (season: ProgramReputationSeasonEvidence) => boolean,
): number {
  let count = 0
  for (const season of newestFirst) {
    if (!matches(season)) break
    count += 1
  }
  return count
}

function deriveFacts(history: readonly ProgramReputationSeasonEvidence[]): ProgramReputationFact[] {
  if (history.length === 0) return []
  const recentFive = history.slice(-5).reverse()
  const recentThree = recentFive.slice(0, 3)
  const currentSeasonNumber = recentFive[0]!.seasonNumber
  const facts: ProgramReputationFact[] = []

  const champion = recentFive.find(({ tournamentFinish: finish }) => finish === 'champion')
  if (champion) {
    facts.push({
      kind: 'recent-national-championship',
      seasonNumber: champion.seasonNumber,
      seasonsAgo: currentSeasonNumber - champion.seasonNumber,
    })
  }

  const deepRuns = recentThree.filter(({ tournamentFinish: finish }) =>
    finish === 'final-four' || finish === 'runner-up' || finish === 'champion')
  if (deepRuns.length >= 2) {
    facts.push({
      kind: 'multiple-deep-tournament-runs',
      count: deepRuns.length,
      windowSeasons: recentThree.length,
    })
  }

  const tournamentMisses = consecutiveCount(recentFive, ({ tournamentFinish: finish }) => finish === 'none')
  if (tournamentMisses >= 2) {
    facts.push({ kind: 'consecutive-tournament-misses', count: tournamentMisses })
  }

  const losingSeasons = consecutiveCount(recentFive, ({ wins, losses }) => wins < losses)
  if (losingSeasons >= 2) {
    facts.push({ kind: 'consecutive-losing-seasons', count: losingSeasons })
  }

  if (deepRuns.length < 2) {
    const deepRun = recentThree.find(({ tournamentFinish: finish }) =>
      finish === 'runner-up' || finish === 'final-four')
    if (deepRun && (deepRun.tournamentFinish === 'runner-up' || deepRun.tournamentFinish === 'final-four')) {
      facts.push({
        kind: 'recent-deep-tournament-run',
        finish: deepRun.tournamentFinish,
        seasonNumber: deepRun.seasonNumber,
        seasonsAgo: currentSeasonNumber - deepRun.seasonNumber,
      })
    }
  }

  const appearances = recentFive.filter(({ tournamentFinish: finish }) => finish !== 'none').length
  if (appearances >= 3) {
    facts.push({
      kind: 'repeated-tournament-appearances',
      count: appearances,
      windowSeasons: recentFive.length,
    })
  }

  const twentyWinSeasons = recentThree.filter(({ wins }) => wins >= 20).length
  if (twentyWinSeasons >= 2) {
    facts.push({
      kind: 'repeated-twenty-win-seasons',
      count: twentyWinSeasons,
      windowSeasons: recentThree.length,
    })
  }

  const conferenceChampions = recentThree.filter(({ conferenceFinish }) => conferenceFinish === 1)
  if (conferenceChampions.length > 0) {
    facts.push({
      kind: 'recent-conference-championships',
      count: conferenceChampions.length,
      mostRecentSeasonNumber: conferenceChampions[0]!.seasonNumber,
      windowSeasons: recentThree.length,
    })
  }

  if (recentThree.length >= 2) {
    const wins = recentThree.reduce((total, season) => total + season.wins, 0)
    const losses = recentThree.reduce((total, season) => total + season.losses, 0)
    const winPercentage = wins / (wins + losses)
    if (winPercentage >= 0.75) {
      facts.push({ kind: 'strong-aggregate-record', wins, losses, seasons: recentThree.length })
    } else if (winPercentage <= 0.4) {
      facts.push({ kind: 'weak-aggregate-record', wins, losses, seasons: recentThree.length })
    }
  }

  return facts.slice(0, 3)
}

function validateCutoff(asOfCompletedSeasonNumber: number | undefined): void {
  if (
    asOfCompletedSeasonNumber !== undefined &&
    (!Number.isInteger(asOfCompletedSeasonNumber) || asOfCompletedSeasonNumber < 0)
  ) {
    throw new RangeError('Program Reputation completed-Season cutoff must be a non-negative integer.')
  }
}

function validateEvidence(history: readonly ProgramReputationSeasonEvidence[]): ProgramReputationSeasonEvidence[] {
  const seen = new Set<number>()
  return [...history]
    .sort((first, second) => first.seasonNumber - second.seasonNumber)
    .map((season) => {
      if (!Number.isInteger(season.seasonNumber) || season.seasonNumber < 1) {
        throw new RangeError('Program Reputation evidence must have a positive integer Season number.')
      }
      if (seen.has(season.seasonNumber)) {
        throw new RangeError(`Program Reputation contains duplicate Season ${season.seasonNumber} evidence.`)
      }
      seen.add(season.seasonNumber)
      deriveProgramReputationSeasonScore(season)
      return season
    })
}

/** Pure score/tier/trend/fact projection used by production archives and diagnostics. */
export function deriveProgramReputationFromSeasonEvidence(
  programId: string,
  evidence: readonly ProgramReputationSeasonEvidence[],
  asOfCompletedSeasonNumber?: number,
): ProgramReputationSnapshot {
  validateCutoff(asOfCompletedSeasonNumber)
  const ordered = validateEvidence(evidence)
  const throughCutoff = asOfCompletedSeasonNumber === undefined
    ? ordered
    : ordered.filter(({ seasonNumber }) => seasonNumber <= asOfCompletedSeasonNumber)
  if (throughCutoff.length === 0) {
    return {
      programId,
      asOfCompletedSeasonNumber: null,
      completedSeasons: 0,
      score: null,
      tier: 'unestablished',
      trend: null,
      facts: [],
    }
  }

  const score = reputationScore(throughCutoff)!
  const previousScore = reputationScore(throughCutoff.slice(0, -1))
  const delta = previousScore === null ? null : score - previousScore
  return {
    programId,
    asOfCompletedSeasonNumber: throughCutoff.at(-1)!.seasonNumber,
    completedSeasons: throughCutoff.length,
    score,
    tier: deriveProgramReputationTier(score),
    trend: deriveProgramReputationTrend(delta),
    facts: deriveFacts(throughCutoff),
  }
}

function deriveSeasonEvidence(
  dynasty: Pick<DynastyState, 'history' | 'universe'>,
  programId: string,
  asOfCompletedSeasonNumber?: number,
): ProgramReputationSeasonEvidence[] {
  const program = dynasty.universe.programs.find(({ id }) => id === programId)
  if (!program) {
    throw new RangeError(`Unknown Program ID "${programId}" for Program Reputation.`)
  }

  const qualifyingArchives = asOfCompletedSeasonNumber === undefined
    ? dynasty.history
    : dynasty.history.filter(({ seasonNumber }) => seasonNumber <= asOfCompletedSeasonNumber)
  return qualifyingArchives.map((archive) => {
    if (archive.seasonNumber !== archive.season.seasonNumber) {
      throw new RangeError('Completed Season archive number does not match its Season.')
    }
    if (!archive.season.programStates[programId]) {
      throw new RangeError(`Completed Season ${archive.seasonNumber} is missing Program "${programId}".`)
    }
    const record = deriveProgramRecord(archive.season, programId)
    const conferenceFinish = deriveConferenceStandings(
      dynasty.universe,
      archive.season,
      program.conferenceId,
    ).findIndex(({ programId: standingProgramId }) => standingProgramId === programId) + 1
    if (conferenceFinish === 0) {
      throw new RangeError(
        `Completed Season ${archive.seasonNumber} Conference standings are missing Program "${programId}".`,
      )
    }
    return {
      seasonNumber: archive.seasonNumber,
      wins: record.wins,
      losses: record.losses,
      conferenceFinish,
      tournamentFinish: tournamentFinish(deriveHistoricalTournamentOutcome(archive, programId)),
    }
  })
}

/** Recent earned standing derived only from canonical completed Dynasty archives. */
export function deriveProgramReputation(
  dynasty: Pick<DynastyState, 'history' | 'universe'>,
  programId: string,
  asOfCompletedSeasonNumber?: number,
): ProgramReputationSnapshot {
  validateCutoff(asOfCompletedSeasonNumber)
  return deriveProgramReputationFromSeasonEvidence(
    programId,
    deriveSeasonEvidence(dynasty, programId, asOfCompletedSeasonNumber),
    asOfCompletedSeasonNumber,
  )
}

/** Newest-first historical snapshots using the same completed-Season cutoff semantics. */
export function deriveProgramReputationTrajectory(
  dynasty: Pick<DynastyState, 'history' | 'universe'>,
  programId: string,
): ProgramReputationSnapshot[] {
  const evidence = deriveSeasonEvidence(dynasty, programId)
  return validateEvidence(evidence)
    .map(({ seasonNumber }) =>
      deriveProgramReputationFromSeasonEvidence(programId, evidence, seasonNumber))
    .reverse()
}
