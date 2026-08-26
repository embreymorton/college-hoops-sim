import { beforeAll, describe, expect, it } from 'vitest'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  deriveProgramReputation,
  deriveProgramReputationFromSeasonEvidence,
  deriveProgramReputationSeasonScore,
  deriveProgramReputationTier,
  deriveProgramReputationTrajectory,
  deriveProgramReputationTrend,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
  type ProgramReputationSeasonEvidence,
  type ProgramReputationTournamentFinish,
} from './index'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

function evidence(
  seasonNumber: number,
  wins: number,
  conferenceFinish = 4,
  tournamentFinish: ProgramReputationTournamentFinish = 'none',
): ProgramReputationSeasonEvidence {
  return {
    seasonNumber,
    wins,
    losses: 24 - wins,
    conferenceFinish,
    tournamentFinish,
  }
}

function completeSeasonAndBeginOffseason(source: DynastyState): DynastyState {
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({ ...source, activeSeason: season })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `program-reputation:${season.seasonNumber}:${round}`,
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  dynasty = autoFinalizeRecruiting(dynasty).dynasty
  return beginOffseason(dynasty)
}

let canonical: DynastyState

beforeAll(() => {
  canonical = completeSeasonAndBeginOffseason(
    createRecruitingDynasty('program-reputation-foundation'),
  )
})

describe('Program Reputation scoring', () => {
  it('maps regular-season percentage anchors without schedule assumptions', () => {
    expect(deriveProgramReputationSeasonScore({
      wins: 12, losses: 12, conferenceFinish: 8, tournamentFinish: 'none',
    })).toBeCloseTo(31)
    expect(deriveProgramReputationSeasonScore({
      wins: 22, losses: 2, conferenceFinish: 8, tournamentFinish: 'none',
    })).toBeCloseTo(56)
    expect(deriveProgramReputationSeasonScore({
      wins: 24, losses: 0, conferenceFinish: 8, tournamentFinish: 'none',
    })).toBeCloseTo(61)
    expect(() => deriveProgramReputationSeasonScore({
      wins: 0, losses: 0, conferenceFinish: 1, tournamentFinish: 'none',
    })).toThrow(/at least one game/)
  })

  it.each([
    [1, 100], [2, 80], [3, 60], [4, 60], [5, 35], [7, 35], [8, 10],
  ])('maps Conference finish %i to %i', (conferenceFinish, expected) => {
    const score = deriveProgramReputationSeasonScore({
      wins: 0, losses: 24, conferenceFinish, tournamentFinish: 'none',
    })
    expect(score).toBeCloseTo(expected * 0.1)
  })

  it.each<[ProgramReputationTournamentFinish, number]>([
    ['none', 0],
    ['round-of-16', 5],
    ['elite-eight', 30],
    ['final-four', 65],
    ['runner-up', 82],
    ['champion', 100],
  ])('maps Tournament finish %s to %i', (tournamentFinish, expected) => {
    const score = deriveProgramReputationSeasonScore({
      wins: 0, losses: 24, conferenceFinish: 8, tournamentFinish,
    })
    expect(score).toBeCloseTo(1 + expected * 0.3)
  })

  it('composes the selected 60/10/30 completed-Season score', () => {
    expect(deriveProgramReputationSeasonScore({
      wins: 18, losses: 6, conferenceFinish: 2, tournamentFinish: 'elite-eight',
    })).toBeCloseTo(62)
  })

  it.each([
    [34.999, 'low'], [35, 'regional'], [47.999, 'regional'], [48, 'emerging'],
    [54.999, 'emerging'], [55, 'national'], [65.999, 'national'],
    [66, 'national-power'], [70.999, 'national-power'], [71, 'elite'],
  ] as const)('maps score %s to tier %s', (score, expected) => {
    expect(deriveProgramReputationTier(score)).toBe(expected)
  })

  it.each([
    [null, null], [3.999, 'steady'], [4, 'rising'], [4.001, 'rising'],
    [-3.999, 'steady'], [-4, 'falling'], [-4.001, 'falling'],
  ] as const)('maps delta %s to trend %s', (delta, expected) => {
    expect(deriveProgramReputationTrend(delta)).toBe(expected)
  })
})

describe('Program Reputation era and history semantics', () => {
  it('returns Unestablished with no facts for no qualifying completed history', () => {
    expect(deriveProgramReputationFromSeasonEvidence('program', [], 0)).toEqual({
      programId: 'program',
      asOfCompletedSeasonNumber: null,
      completedSeasons: 0,
      score: null,
      tier: 'unestablished',
      trend: null,
      facts: [],
    })
  })

  it('renormalizes available weights before applying maturity at Seasons 1–5', () => {
    const seasons = Array.from({ length: 5 }, (_, index) => evidence(index + 1, 24, 1, 'champion'))
    for (const [count, maturity] of [[1, 0.4], [2, 0.65], [3, 0.9], [4, 0.96], [5, 1]] as const) {
      const snapshot = deriveProgramReputationFromSeasonEvidence('program', seasons.slice(0, count))
      expect(snapshot.score).toBeCloseTo(100 * maturity + 50 * (1 - maturity))
      expect(snapshot.completedSeasons).toBe(count)
    }
  })

  it('uses only the newest five Seasons and excludes the sixth-oldest', () => {
    const first = evidence(1, 0, 8)
    const recent = Array.from({ length: 5 }, (_, index) => evidence(index + 2, 24, 1, 'champion'))
    const withOldFailure = deriveProgramReputationFromSeasonEvidence('program', [first, ...recent])
    const withoutOldFailure = deriveProgramReputationFromSeasonEvidence('program', recent)
    expect(withOldFailure.score).toBeCloseTo(withoutOldFailure.score!)
  })

  it('reconstructs historical cutoffs without future leakage and clamps future cutoffs', () => {
    const seasons = [evidence(1, 0, 8), evidence(2, 12, 4), evidence(3, 24, 1, 'champion')]
    const historical = deriveProgramReputationFromSeasonEvidence('program', seasons, 2)
    const isolated = deriveProgramReputationFromSeasonEvidence('program', seasons.slice(0, 2))
    expect(historical).toEqual(isolated)
    expect(deriveProgramReputationFromSeasonEvidence('program', seasons, 99)).toEqual(
      deriveProgramReputationFromSeasonEvidence('program', seasons),
    )
    expect(historical.asOfCompletedSeasonNumber).toBe(2)
  })

  it('does not inspect a future malformed archive for an earlier historical cutoff', () => {
    const source = canonical.history[0]!
    const first = { ...structuredClone(source), seasonNumber: 1, season: { ...structuredClone(source.season), seasonNumber: 1 } }
    const malformedFuture = { ...structuredClone(source), seasonNumber: 3 }
    expect(deriveProgramReputation(
      { ...canonical, history: [first, malformedFuture] },
      canonical.controlledProgramId,
      1,
    ).asOfCompletedSeasonNumber).toBe(1)
  })

  it('uses no active Season/Postseason or Prestige and supports every Program', () => {
    const activeOnly = { ...canonical, history: [] }
    for (const program of canonical.universe.programs) {
      expect(deriveProgramReputation(activeOnly, program.id).tier).toBe('unestablished')
      expect(deriveProgramReputation(canonical, program.id).completedSeasons).toBe(1)
    }
    const programId = canonical.universe.programs[0]!.id
    const changedPrestige = structuredClone(canonical)
    changedPrestige.history[0]!.season.programStates[programId]!.team.prestige = 1
    expect(deriveProgramReputation(changedPrestige, programId)).toEqual(
      deriveProgramReputation(canonical, programId),
    )
  })

  it('returns newest-first trajectory snapshots with historical trend isolation', () => {
    const source = canonical.history[0]!
    const history = [1, 2, 3].map((seasonNumber) => ({
      ...structuredClone(source),
      seasonNumber,
      season: { ...structuredClone(source.season), seasonNumber },
    }))
    const trajectory = deriveProgramReputationTrajectory(
      { ...canonical, history },
      canonical.controlledProgramId,
    )
    expect(trajectory.map((snapshot) => snapshot.asOfCompletedSeasonNumber)).toEqual([3, 2, 1])
    expect(trajectory.at(-1)!.trend).toBeNull()
  })

  it('fails clearly for invalid cutoffs, unknown Programs, duplicate Seasons, and malformed archives', () => {
    expect(() => deriveProgramReputation(canonical, 'unknown')).toThrow(/Unknown Program/)
    expect(() => deriveProgramReputation(canonical, canonical.controlledProgramId, -1)).toThrow(/cutoff/)
    expect(() => deriveProgramReputation(canonical, canonical.controlledProgramId, 1.5)).toThrow(/cutoff/)
    expect(() => deriveProgramReputationFromSeasonEvidence('program', [evidence(1, 10), evidence(1, 11)]))
      .toThrow(/duplicate Season/)
    const sourceArchive = structuredClone(canonical.history[0]!)
    const archive = { ...sourceArchive, seasonNumber: sourceArchive.seasonNumber + 1 }
    expect(() => deriveProgramReputation(
      { ...canonical, history: [archive] },
      canonical.controlledProgramId,
    )).toThrow(/number does not match/)
  })
})

describe('Program Reputation explanation facts', () => {
  it('ranks facts, suppresses redundant deep-run facts, and caps output at three', () => {
    const snapshot = deriveProgramReputationFromSeasonEvidence('program', [
      evidence(1, 21, 1, 'final-four'),
      evidence(2, 22, 1, 'runner-up'),
      evidence(3, 24, 1, 'champion'),
    ])
    expect(snapshot.facts).toEqual([
      { kind: 'recent-national-championship', seasonNumber: 3, seasonsAgo: 0 },
      { kind: 'multiple-deep-tournament-runs', count: 3, windowSeasons: 3 },
      { kind: 'repeated-tournament-appearances', count: 3, windowSeasons: 3 },
    ])
    expect(snapshot.facts.some(({ kind }) => kind === 'recent-deep-tournament-run')).toBe(false)
  })

  it('derives miss and losing streaks with stable priority', () => {
    const snapshot = deriveProgramReputationFromSeasonEvidence('program', [
      evidence(1, 20, 1, 'champion'),
      evidence(2, 8, 8), evidence(3, 7, 8), evidence(4, 6, 8),
    ])
    expect(snapshot.facts.map(({ kind }) => kind)).toEqual([
      'recent-national-championship',
      'consecutive-tournament-misses',
      'consecutive-losing-seasons',
    ])
  })

  it('derives a single recent deep run when no multiple-run fact applies', () => {
    const snapshot = deriveProgramReputationFromSeasonEvidence('program', [
      evidence(1, 18, 2, 'final-four'), evidence(2, 14, 5),
    ])
    expect(snapshot.facts).toContainEqual({
      kind: 'recent-deep-tournament-run',
      finish: 'final-four',
      seasonNumber: 1,
      seasonsAgo: 1,
    })
  })

  it('derives repeated appearances, 20-win Seasons, and Conference titles without duplicates', () => {
    const snapshot = deriveProgramReputationFromSeasonEvidence('program', [
      evidence(1, 20, 1, 'round-of-16'),
      evidence(2, 21, 1, 'elite-eight'),
      evidence(3, 22, 2, 'round-of-16'),
    ])
    expect(snapshot.facts.map(({ kind }) => kind)).toEqual([
      'repeated-tournament-appearances',
      'repeated-twenty-win-seasons',
      'recent-conference-championships',
    ])
    expect(snapshot.facts[2]).toMatchObject({ count: 2, mostRecentSeasonNumber: 2 })
  })

  it('derives strong and weak aggregate records and isolates them by cutoff', () => {
    const seasons = [
      evidence(1, 20, 2, 'round-of-16'), evidence(2, 18, 3),
      evidence(3, 4, 8), evidence(4, 5, 8),
    ]
    expect(deriveProgramReputationFromSeasonEvidence('program', seasons, 2).facts)
      .toContainEqual({ kind: 'strong-aggregate-record', wins: 38, losses: 10, seasons: 2 })
    expect(deriveProgramReputationFromSeasonEvidence('program', seasons, 4).facts)
      .toContainEqual({ kind: 'weak-aggregate-record', wins: 27, losses: 45, seasons: 3 })
  })
})
