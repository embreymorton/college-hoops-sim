import { describe, expect, it } from 'vitest'
import { calculateOverall, type Player } from '../src/engine'
import {
  developReturningPlayer,
  type CompletedRecruitingClass,
  type OffseasonState,
} from '../src/dynasty'
import { createRecruitingDynasty } from '../src/dynasty/recruiting/testSupport'
import type { PostseasonState } from '../src/postseason'
import { runLongRunCalibration } from './inspectDynastyLongRun'
import {
  auditIdentityCollisions,
  deriveChampionCounts,
  deriveDevelopmentRecords,
  extractSeasonTalentMetrics,
  extractSignedRecruitRecords,
  linearSlope,
  prestigeBand,
  serializedSizeBytes,
  summarizeDistribution,
} from './dynastyLongRunMetrics'

describe('Dynasty long-run calibration metrics', () => {
  it('extracts Team, Player-class, position, and high-end Season metrics', () => {
    const season = createRecruitingDynasty('calibration-season-metrics').activeSeason!
    const metrics = extractSeasonTalentMetrics(season)

    expect(metrics.seasonNumber).toBe(1)
    expect(metrics.teams).toHaveLength(32)
    expect(metrics.players).toHaveLength(384)
    expect(metrics.teamOverall.count).toBe(32)
    expect(Object.values(metrics.classOverall).reduce(
      (sum, summary) => sum + summary.count,
      0,
    )).toBe(384)
    expect(Object.values(metrics.positionCounts).reduce(
      (sum, count) => sum + count,
      0,
    )).toBe(384)
    expect(metrics.highEndCounts[80]).toBeGreaterThanOrEqual(
      metrics.highEndCounts[85],
    )
  })

  it('summarizes distributions and calculates an understandable linear slope', () => {
    expect(summarizeDistribution([1, 2, 3, 4])).toMatchObject({
      average: 2.5,
      median: 2.5,
      minimum: 1,
      maximum: 4,
    })
    expect(linearSlope([
      { x: 1, y: 10 },
      { x: 2, y: 12 },
      { x: 3, y: 14 },
    ])).toBe(2)
  })

  it('summarizes arrays larger than the JavaScript argument limit', () => {
    const values = Array.from({ length: 200_000 }, (_, index) => index - 100_000)

    expect(summarizeDistribution(values)).toMatchObject({
      count: 200_000,
      minimum: -100_000,
      maximum: 99_999,
      median: -0.5,
    })
  })

  it('derives actual OVR development deltas by previous class', () => {
    const dynasty = createRecruitingDynasty('calibration-development')
    const season = dynasty.activeSeason!
    const offseason: OffseasonState = {
      completedSeasonNumber: 1,
      targetSeasonNumber: 2,
      developmentExplosions: [],
      programs: Object.fromEntries(Object.entries(season.programStates).map(
        ([programId, { team }]) => [programId, {
          programId,
          prestige: team.prestige,
          returningPlayers: team.roster
            .filter(({ classYear }) => classYear !== 'SR')
            .map((player) => developReturningPlayer({
              player,
              dynastySeed: dynasty.dynastySeed,
              completedSeasonNumber: 1,
              programId,
            })),
        }],
      )),
    }
    const records = deriveDevelopmentRecords(season, offseason)

    expect(records).toHaveLength(
      Object.values(season.programStates).flatMap(({ team }) =>
        team.roster.filter(({ classYear }) => classYear !== 'SR'),
      ).length,
    )
    expect(records.every(({ overallGain }) => overallGain >= 0)).toBe(true)
    expect(new Set(records.map(({ transition }) => transition))).toEqual(
      new Set(['FR→SO', 'SO→JR', 'JR→SR']),
    )
  })

  it('aggregates signed Recruiting facts and assigns prestige bands', () => {
    const player: Player = {
      id: 'recruit-1',
      firstName: 'Test',
      lastName: 'Recruit',
      position: 'PG',
      classYear: 'FR',
      height: 72,
      attributes: {
        finishing: 70,
        shooting: 75,
        playmaking: 78,
        ballHandling: 79,
        perimeterDefense: 72,
        interiorDefense: 45,
        rebounding: 50,
        athleticism: 74,
        stamina: 73,
      },
      potential: 88,
    }
    const completed: CompletedRecruitingClass = {
      targetSeasonNumber: 2,
      recruitingState: {
        id: 'class-2',
        targetSeasonNumber: 2,
        phase: 'finalized',
        lastResolvedPeriod: 28,
        recruits: [{
          player,
          nationalRank: 12,
          positionRank: 3,
          stars: 4,
          qualityScore: 80,
          decisionReadyPeriod: 16,
          commitmentStandingThreshold: 50,
          commitmentSeparationThreshold: 4,
        }],
        programs: {},
        relationshipProgressByPlayerId: {},
        commitmentsByPlayerId: {
          'recruit-1': {
            playerId: 'recruit-1',
            programId: 'program-a',
            targetSeasonNumber: 2,
            timing: { kind: 'period', period: 20 },
          },
        },
      },
    }
    expect(extractSignedRecruitRecords(completed, { 'program-a': 82 })).toEqual([{
      playerId: 'recruit-1',
      programId: 'program-a',
      targetSeasonNumber: 2,
      prestige: 82,
      prestigeBand: '80–100',
      nationalRank: 12,
      stars: 4,
      overall: calculateOverall(player),
      potential: 88,
    }])
    expect([1, 40, 60, 80].map(prestigeBand)).toEqual([
      '1–39',
      '40–59',
      '60–79',
      '80–100',
    ])
  })

  it('aggregates champions from canonical championship results', () => {
    const postseason = {
      bracket: {
        games: [{ id: 'final', round: 'championship' }],
      },
      resultsByGameId: {
        final: { winnerId: 'program-a' },
      },
    } as unknown as PostseasonState
    expect(deriveChampionCounts([postseason, postseason])).toEqual({
      'program-a': 2,
    })
  })

  it('audits identity collisions without treating historical IDs as active duplicates', () => {
    expect(auditIdentityCollisions({
      activePlayerIds: ['active-1', 'active-2'],
      existingPersonIds: new Set(['active-1', 'historical-1']),
      newRecruitIds: ['new-1', 'new-2'],
    })).toEqual({
      duplicateActivePlayerIds: 0,
      duplicateNewRecruitIds: 0,
      newRecruitExistingPersonCollisions: 0,
    })
    expect(auditIdentityCollisions({
      activePlayerIds: ['active-1', 'active-1'],
      existingPersonIds: new Set(['historical-1']),
      newRecruitIds: ['new-1', 'new-1', 'historical-1'],
    })).toEqual({
      duplicateActivePlayerIds: 1,
      duplicateNewRecruitIds: 1,
      newRecruitExistingPersonCollisions: 1,
    })
  })

  it('measures deterministic serialized-state size', () => {
    expect(serializedSizeBytes({ value: 'abc' })).toBe(
      Buffer.byteLength(JSON.stringify({ value: 'abc' }), 'utf8'),
    )
  })

  it('reproduces a small multi-season calibration fixture exactly', () => {
    const options = {
      seasonsPerSeed: 2,
      seeds: ['calibration-determinism'],
    }
    const first = runLongRunCalibration(options)
    const second = runLongRunCalibration(options)

    expect(second).toEqual(first)
    expect(first.runs[0]!.seasons).toHaveLength(2)
    expect(first.runs[0]!.rollovers).toBe(2)
    expect(first.runs[0]!.health.lifecycleFailures).toBe(0)
  }, 15_000)
})
