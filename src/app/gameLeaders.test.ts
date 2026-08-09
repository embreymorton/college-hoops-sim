import { describe, expect, it } from 'vitest'
import type { GameResult, Player, PlayerGameStats, Team } from '../engine'
import { deriveGameLeaders, formatControlledMargin } from './gameLeaders'

function player(id: string, firstName: string, lastName: string): Player {
  return {
    id,
    firstName,
    lastName,
    position: 'PG',
    classYear: 'SO',
    height: 74,
    attributes: {
      finishing: 70,
      shooting: 70,
      playmaking: 70,
      ballHandling: 70,
      perimeterDefense: 70,
      interiorDefense: 70,
      rebounding: 70,
      athleticism: 70,
      stamina: 70,
    },
    potential: 80,
  }
}

function stats(
  playerId: string,
  values: Partial<PlayerGameStats> = {},
): PlayerGameStats {
  return {
    playerId,
    minutes: 20,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    ...values,
  }
}

const homeTeam: Team = {
  id: 'opponent',
  name: 'Opponent State',
  abbreviation: 'OPS',
  prestige: 70,
  roster: [
    player('delta', 'Drew', 'Delta'),
    player('echo', 'Evan', 'Echo'),
  ],
}

const awayTeam: Team = {
  id: 'controlled',
  name: 'Controlled College',
  abbreviation: 'CC',
  prestige: 70,
  roster: [
    player('alpha', 'Alex', 'Alpha'),
    player('bravo', 'Blake', 'Bravo'),
    player('charlie', 'Casey', 'Charlie'),
  ],
}

function result(
  homePlayerStats: PlayerGameStats[],
  awayPlayerStats: PlayerGameStats[],
  homeScore = 70,
  awayScore = 75,
): GameResult {
  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeScore,
    awayScore,
    winnerId: homeScore > awayScore ? homeTeam.id : awayTeam.id,
    overtimePeriods: 0,
    seed: 'leaders-test',
    homePlayerStats,
    awayPlayerStats,
  }
}

describe('deriveGameLeaders', () => {
  it('derives PTS, REB, and AST leaders across both Programs', () => {
    const leaders = deriveGameLeaders(
      result(
        [
          stats('delta', { points: 31, rebounds: 4, assists: 2 }),
          stats('echo', { points: 8, rebounds: 12, assists: 1 }),
        ],
        [
          stats('alpha', { points: 24, rebounds: 3, assists: 8 }),
          stats('bravo', { points: 12, rebounds: 11, assists: 1 }),
          stats('charlie', { points: 8, rebounds: 4, assists: 7 }),
        ],
      ),
      homeTeam,
      awayTeam,
    )

    expect(leaders.points).toMatchObject({
      playerId: 'delta',
      programId: homeTeam.id,
      programName: homeTeam.name,
      programAbbreviation: homeTeam.abbreviation,
      value: 31,
    })
    expect(leaders.rebounds).toMatchObject({
      playerId: 'echo',
      programId: homeTeam.id,
      value: 12,
    })
    expect(leaders.assists).toMatchObject({
      playerId: 'alpha',
      programId: awayTeam.id,
      programAbbreviation: awayTeam.abbreviation,
      value: 8,
    })
  })

  it('does not prefer the controlled Program and resolves ties by minutes then Player ID', () => {
    const leaders = deriveGameLeaders(
      result(
        [stats('delta', { points: 10, rebounds: 5, assists: 2, minutes: 32 })],
        [
          stats('bravo', { points: 10, rebounds: 5, assists: 2, minutes: 32 }),
          stats('alpha', { points: 10, rebounds: 5, assists: 2, minutes: 30 }),
        ],
      ),
      homeTeam,
      awayTeam,
    )

    expect(leaders.points?.playerId).toBe('bravo')
    expect(leaders.rebounds?.playerId).toBe('bravo')
    expect(leaders.assists?.playerId).toBe('bravo')
  })

  it('returns no arbitrary leader when a whole-game category high is zero', () => {
    const leaders = deriveGameLeaders(
      result(
        [stats('delta', { points: 8 })],
        [stats('alpha', { points: 7 })],
      ),
      homeTeam,
      awayTeam,
    )

    expect(leaders.rebounds).toBeNull()
    expect(leaders.assists).toBeNull()
  })
})

describe('formatControlledMargin', () => {
  it('formats canonical win and loss margins from either orientation', () => {
    expect(formatControlledMargin(result([], [], 70, 73), awayTeam.id)).toBe(
      '3-Point Victory',
    )
    expect(formatControlledMargin(result([], [], 89, 70), awayTeam.id)).toBe(
      '19-Point Defeat',
    )
  })
})
