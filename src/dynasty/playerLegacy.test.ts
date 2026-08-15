import { beforeAll, describe, expect, it } from 'vitest'
import { calculateOverall } from '../engine'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import type { PlayerSeasonStats } from '../season'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  derivePlayerCareerSummary,
  resolveDynastyPlayer,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
  type PlayerCareerHistory,
} from './index'

function completeSeasonAndBeginOffseason(source: DynastyState): DynastyState {
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({ ...source, activeSeason: season })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `player-legacy:${round}`,
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({ ...dynasty, activePostseason: postseason })
  return beginOffseason(autoFinalizeRecruiting(dynasty).dynasty)
}

describe('resolveDynastyPlayer', () => {
  let active: DynastyState
  let offseason: DynastyState
  let seniorId: string

  beforeAll(() => {
    active = createRecruitingDynasty('player-legacy-resolver')
    seniorId = Object.values(active.activeSeason!.programStates)
      .flatMap(({ team }) => team.roster)
      .find(({ classYear }) => classYear === 'SR')!.id
    offseason = completeSeasonAndBeginOffseason(active)
  }, 20000)

  it('distinguishes active, former, and unknown without mutation', () => {
    const before = structuredClone(offseason)
    expect(resolveDynastyPlayer(active, seniorId).status).toBe('active')
    const former = resolveDynastyPlayer(offseason, seniorId)
    expect(former.status).toBe('former')
    if (former.status === 'former') {
      expect(former.careerHistory.seasons.map(({ seasonNumber }) => seasonNumber)).toEqual([1])
      expect(former.player.classYear).toBe('SR')
      expect(former.careerHistory.seasons[0]!.overall).toBe(calculateOverall(former.player))
    }
    expect(resolveDynastyPlayer(offseason, 'missing-player')).toEqual({
      status: 'unknown',
      playerId: 'missing-player',
    })
    expect(offseason).toEqual(before)
  })

  it('uses active identity before matching archived identity', () => {
    const withArchiveAndActive = { ...active, history: offseason.history }
    expect(resolveDynastyPlayer(withArchiveAndActive, seniorId).status).toBe('active')
  })

  it('rejects duplicate matches within one Season', () => {
    const player = active.activeSeason!.programStates['charlotte-tech']!.team.roster[0]!
    const malformed = structuredClone(active)
    malformed.activeSeason!.programStates['northbridge']!.team.roster.push(player)
    expect(() => resolveDynastyPlayer(malformed, player.id)).toThrow(/multiple times/)
  })

  it('survives a JSON round trip', () => {
    const parsed = JSON.parse(JSON.stringify(offseason)) as DynastyState
    expect(resolveDynastyPlayer(parsed, seniorId)).toEqual(
      resolveDynastyPlayer(offseason, seniorId),
    )
  })
})

function stats(overrides: Partial<PlayerSeasonStats>): PlayerSeasonStats {
  return {
    programId: 'program', playerId: 'player', gamesPlayed: 0,
    minutes: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
    fieldGoalsMade: 0, fieldGoalsAttempted: 0, threePointersMade: 0,
    threePointersAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0,
    minutesPerGame: 0, pointsPerGame: 0, reboundsPerGame: 0, assistsPerGame: 0,
    stealsPerGame: 0, blocksPerGame: 0, turnoversPerGame: 0,
    fieldGoalPercentage: 0, threePointPercentage: 0, freeThrowPercentage: 0,
    ...overrides,
  }
}

describe('derivePlayerCareerSummary', () => {
  it('derives rates and percentages from aggregate regular-season totals', () => {
    const career: PlayerCareerHistory = {
      playerId: 'player', recruitingOrigin: null,
      seasons: [
        { seasonNumber: 2, programId: 'program', classYear: 'SO', overall: 82, potential: 90, developmentGain: 4, isActive: false, stats: stats({ gamesPlayed: 3, minutes: 60, points: 30, rebounds: 12, assists: 9, steals: 3, blocks: 0, fieldGoalsMade: 10, fieldGoalsAttempted: 20, threePointersMade: 0, threePointersAttempted: 0, freeThrowsMade: 10, freeThrowsAttempted: 10, pointsPerGame: 10 }) },
        { seasonNumber: 1, programId: 'program', classYear: 'FR', overall: 78, potential: 90, developmentGain: null, isActive: false, stats: stats({ gamesPlayed: 1, minutes: 20, points: 20, rebounds: 8, assists: 1, steals: 1, blocks: 4, fieldGoalsMade: 8, fieldGoalsAttempted: 10, threePointersMade: 2, threePointersAttempted: 5, freeThrowsMade: 2, freeThrowsAttempted: 4, pointsPerGame: 20 }) },
      ],
    }
    const summary = derivePlayerCareerSummary(career)
    expect(summary).toMatchObject({
      firstSeasonNumber: 1, lastSeasonNumber: 2, gamesPlayed: 4,
      points: 50, pointsPerGame: 12.5, reboundsPerGame: 5,
      assistsPerGame: 2.5, stealsPerGame: 1, blocksPerGame: 1,
      fieldGoalPercentage: 0.6, threePointPercentage: 0.4,
      freeThrowPercentage: 12 / 14, finalOverall: 82, peakOverall: 82,
    })
  })

  it('returns safe zero rates and percentages', () => {
    const career: PlayerCareerHistory = {
      playerId: 'player', recruitingOrigin: null,
      seasons: [{ seasonNumber: 3, programId: 'program', classYear: 'SR', overall: 74, potential: 74, developmentGain: null, isActive: false, stats: stats({}) }],
    }
    expect(derivePlayerCareerSummary(career)).toMatchObject({
      firstSeasonNumber: 3, lastSeasonNumber: 3, gamesPlayed: 0,
      pointsPerGame: 0, fieldGoalPercentage: 0,
      threePointPercentage: 0, freeThrowPercentage: 0,
      finalOverall: 74, peakOverall: 74,
    })
  })
})
