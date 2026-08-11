import { describe, expect, it } from 'vitest'
import type { GameResult, Player, PlayerGameStats, Team } from '../engine'
import type { RegularSeasonSchedule, ScheduledGame } from '../schedule'
import {
  deriveNationalPlayerLeaders,
  deriveTeamPlayerLeaders,
  derivePlayerSeasonStats,
  getMinimumQualifyingGamesPlayed,
  type SeasonState,
} from './index'

function player(id: string): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
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

function team(id: string, playerIds: readonly string[]): Team {
  return {
    id,
    name: `${id} University`,
    abbreviation: id.slice(0, 3).toUpperCase(),
    prestige: 50,
    roster: playerIds.map(player),
  }
}

function stats(
  playerId: string,
  values: Partial<Omit<PlayerGameStats, 'playerId'>> = {},
): PlayerGameStats {
  return {
    playerId,
    minutes: 0,
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

interface GameSpec {
  readonly id: string
  readonly round: number
  readonly homeProgramId: string
  readonly awayProgramId: string
  readonly homeStats: readonly PlayerGameStats[]
  readonly awayStats: readonly PlayerGameStats[]
}

function buildSeason(
  programRosters: Record<string, readonly string[]>,
  games: readonly GameSpec[],
): SeasonState {
  const scheduleGames: ScheduledGame[] = games.map((game, index) => ({
    id: game.id,
    index,
    round: game.round,
    homeProgramId: game.homeProgramId,
    awayProgramId: game.awayProgramId,
    type: 'nonconference',
  }))
  const resultsByGameId: Record<string, GameResult> = {}

  for (const game of games) {
    const homeScore = game.homeStats.reduce((sum, row) => sum + row.points, 0) + 1
    const awayScore = game.awayStats.reduce((sum, row) => sum + row.points, 0)

    resultsByGameId[game.id] = {
      homeTeamId: game.homeProgramId,
      awayTeamId: game.awayProgramId,
      homeScore,
      awayScore,
      winnerId: homeScore > awayScore ? game.homeProgramId : game.awayProgramId,
      overtimePeriods: 0,
      seed: `fixture:${game.id}`,
      homePlayerStats: [...game.homeStats],
      awayPlayerStats: [...game.awayStats],
    }
  }

  const schedule: RegularSeasonSchedule = {
    version: 'test-v0',
    universeId: 'test-universe',
    universeVersion: 'v0',
    seed: 'test-schedule',
    configuration: {
      conferenceFormat: 'double-round-robin',
      nonConferenceGamesPerProgram: 3,
      targetHomeGamesPerProgram: 2,
      targetAwayGamesPerProgram: 1,
    },
    roundCount: Math.max(1, ...games.map((game) => game.round)),
    games: scheduleGames,
  }

  return {
    id: 'test-season',
    seasonNumber: 1,
    universeId: 'test-universe',
    universeVersion: 'v0',
    schedule,
    programStates: Object.fromEntries(
      Object.entries(programRosters).map(([programId, playerIds]) => [
        programId,
        {
          team: team(programId, playerIds),
          rotation: { minutesByPosition: { PG: {}, SG: {}, SF: {}, PF: {}, C: {} } },
        },
      ]),
    ),
    resultsByGameId,
  }
}

/** Ten games for `programId` vs a disposable opponent, with a fixed per-game box score for each named starter. */
function repeatedGames(
  programId: string,
  opponentId: string,
  count: number,
  perGameStatsByPlayerId: Record<string, Partial<Omit<PlayerGameStats, 'playerId'>>>,
  activePlayerIdsPerGame: readonly (readonly string[])[],
): GameSpec[] {
  return Array.from({ length: count }, (_, gameIndex) => {
    const activeIds = activePlayerIdsPerGame[gameIndex] ?? Object.keys(perGameStatsByPlayerId)
    const homeStats = Object.entries(perGameStatsByPlayerId).map(([playerId, values]) =>
      activeIds.includes(playerId)
        ? stats(playerId, values)
        : stats(playerId),
    )

    return {
      id: `${programId}-vs-${opponentId}-${gameIndex}`,
      round: gameIndex + 1,
      homeProgramId: programId,
      awayProgramId: opponentId,
      homeStats,
      awayStats: [stats(`${opponentId}-filler`, { minutes: 40, points: 10 })],
    }
  })
}

describe('getMinimumQualifyingGamesPlayed', () => {
  it('scales as at least half of completed games, rounded up, deterministically', () => {
    expect(getMinimumQualifyingGamesPlayed(0)).toBe(0)
    expect(getMinimumQualifyingGamesPlayed(1)).toBe(1)
    expect(getMinimumQualifyingGamesPlayed(4)).toBe(2)
    expect(getMinimumQualifyingGamesPlayed(10)).toBe(5)
    expect(getMinimumQualifyingGamesPlayed(24)).toBe(12)
  })
})

describe('deriveNationalPlayerLeaders', () => {
  // national-a: 10 completed games. star-a plays every game (qualifies, GP=10,
  // min=5); bench-a plays only 2 (GP=2 < min=5, excluded despite huge rates).
  const nationalAGames = repeatedGames(
    'national-a',
    'opp-a',
    10,
    {
      'star-a': {
        minutes: 32,
        points: 30,
        rebounds: 8,
        assists: 5,
        steals: 2,
        blocks: 1,
        fieldGoalsMade: 10,
        fieldGoalsAttempted: 20,
      },
      'bench-a': {
        minutes: 8,
        points: 99,
        rebounds: 20,
        assists: 20,
        steals: 20,
        blocks: 20,
        fieldGoalsMade: 30,
        fieldGoalsAttempted: 30,
      },
    },
    Array.from({ length: 10 }, (_, index) =>
      index < 2 ? ['star-a', 'bench-a'] : ['star-a'],
    ),
  )

  // national-b: 1 completed game. one-game-b qualifies immediately (GP=1, min=1).
  const nationalBGames = repeatedGames(
    'national-b',
    'opp-b',
    1,
    {
      'one-game-b': {
        minutes: 30,
        points: 25,
        rebounds: 15,
        assists: 2,
        steals: 1,
        blocks: 3,
        fieldGoalsMade: 10,
        fieldGoalsAttempted: 18,
      },
    },
    [['one-game-b']],
  )

  // national-d: 4 completed games (min=2). half-d plays exactly 2 (qualifies);
  // under-d plays only 1 (excluded).
  const nationalDGames = repeatedGames(
    'national-d',
    'opp-d',
    4,
    {
      'half-d': { minutes: 20, points: 12, rebounds: 4, assists: 1 },
      'under-d': { minutes: 20, points: 12, rebounds: 4, assists: 1 },
    },
    [['half-d', 'under-d'], ['half-d'], [], []],
  )

  // Tie fixture: equal PPG across two Programs whose Program-ID order would
  // otherwise place "b-player" first; the tie-break must resolve by Player ID.
  const tieGames = [
    ...repeatedGames('aaa', 'opp-tie-1', 1, { 'b-player': { minutes: 20, points: 20 } }, [
      ['b-player'],
    ]),
    ...repeatedGames('zzz', 'opp-tie-2', 1, { 'a-player': { minutes: 20, points: 20 } }, [
      ['a-player'],
    ]),
  ]

  const season = buildSeason(
    {
      'national-a': ['star-a', 'bench-a'],
      'opp-a': ['opp-a-filler'],
      'national-b': ['one-game-b'],
      'opp-b': ['opp-b-filler'],
      'national-d': ['half-d', 'under-d'],
      'opp-d': ['opp-d-filler'],
      aaa: ['b-player'],
      'opp-tie-1': ['opp-tie-1-filler'],
      zzz: ['a-player'],
      'opp-tie-2': ['opp-tie-2-filler'],
    },
    [...nationalAGames, ...nationalBGames, ...nationalDGames, ...tieGames],
  )

  it('derives leaderboard values from canonical Player Season Stats', () => {
    const leaders = deriveNationalPlayerLeaders(season)
    const starEntry = leaders.points.find((entry) => entry.playerId === 'star-a')!
    const canonical = derivePlayerSeasonStats(season, 'national-a', 'star-a')

    expect(starEntry.value).toBe(canonical.pointsPerGame)
    expect(starEntry.gamesPlayed).toBe(canonical.gamesPlayed)
  })

  it('ranks PPG correctly and excludes unqualified small-sample Players', () => {
    const [first, second] = deriveNationalPlayerLeaders(season).points
    expect(first).toMatchObject({ playerId: 'star-a', rank: 1 })
    expect(second).toMatchObject({ playerId: 'one-game-b', rank: 2 })
    expect(
      deriveNationalPlayerLeaders(season).points.some(
        (entry) => entry.playerId === 'bench-a',
      ),
    ).toBe(false)
  })

  it('ranks RPG correctly, independent of the PPG order', () => {
    const [first, second] = deriveNationalPlayerLeaders(season).rebounds
    expect(first).toMatchObject({ playerId: 'one-game-b' })
    expect(second).toMatchObject({ playerId: 'star-a' })
  })

  it('ranks APG correctly', () => {
    const [first] = deriveNationalPlayerLeaders(season).assists
    expect(first).toMatchObject({ playerId: 'star-a' })
  })

  it('ranks SPG correctly', () => {
    const [first] = deriveNationalPlayerLeaders(season).steals
    expect(first).toMatchObject({ playerId: 'star-a' })
  })

  it('ranks BPG correctly', () => {
    const [first] = deriveNationalPlayerLeaders(season).blocks
    expect(first).toMatchObject({ playerId: 'one-game-b' })
  })

  it('applies the minimum-GP qualification rule', () => {
    const points = deriveNationalPlayerLeaders(season).points
    expect(points.some((entry) => entry.playerId === 'bench-a')).toBe(false)
    expect(points.some((entry) => entry.playerId === 'under-d')).toBe(false)
    expect(points.some((entry) => entry.playerId === 'half-d')).toBe(true)
  })

  it('scales qualification during a partial Season (4 completed games → 2 GP minimum)', () => {
    const points = deriveNationalPlayerLeaders(season).points
    const halfD = points.find((entry) => entry.playerId === 'half-d')
    expect(halfD).toBeDefined()
    expect(halfD!.gamesPlayed).toBe(2)
  })

  it('resolves equal values with a stable, deterministic Player-ID tie-break', () => {
    const points = deriveNationalPlayerLeaders(season).points
    const aIndex = points.findIndex((entry) => entry.playerId === 'a-player')
    const bIndex = points.findIndex((entry) => entry.playerId === 'b-player')
    expect(aIndex).toBeGreaterThanOrEqual(0)
    expect(bIndex).toBeGreaterThan(aIndex)
  })

  it('produces a safe empty leaderboard for a Season with zero completed games', () => {
    const zeroGameSeason = buildSeason(
      { 'z-a': ['z-player'], 'z-b': ['z-opponent'] },
      [],
    )
    const leaders = deriveNationalPlayerLeaders(zeroGameSeason)

    expect(leaders.points).toEqual([])
    expect(leaders.rebounds).toEqual([])
    expect(leaders.assists).toEqual([])
    expect(leaders.steals).toEqual([])
    expect(leaders.blocks).toEqual([])
  })
})

describe('deriveTeamPlayerLeaders', () => {
  it('derives the Program PTS/REB/AST leaders from qualified Players only', () => {
    const games = repeatedGames(
      'team-x',
      'opp-x',
      4,
      {
        scorer: { minutes: 30, points: 20, rebounds: 3, assists: 2 },
        boarder: { minutes: 28, points: 8, rebounds: 12, assists: 1 },
        facilitator: { minutes: 26, points: 10, rebounds: 2, assists: 9 },
        walkOn: { minutes: 4, points: 40, rebounds: 40, assists: 40 },
      },
      [
        ['scorer', 'boarder', 'facilitator', 'walkOn'],
        ['scorer', 'boarder', 'facilitator'],
        ['scorer', 'boarder', 'facilitator'],
        ['scorer', 'boarder', 'facilitator'],
      ],
    )
    const season = buildSeason(
      { 'team-x': ['scorer', 'boarder', 'facilitator', 'walkOn'], 'opp-x': ['opp-x-filler'] },
      games,
    )

    const leaders = deriveTeamPlayerLeaders(season, 'team-x')

    expect(leaders.points?.playerId).toBe('scorer')
    expect(leaders.rebounds?.playerId).toBe('boarder')
    expect(leaders.assists?.playerId).toBe('facilitator')
    expect(leaders.points?.playerId).not.toBe('walkOn')
  })

  it('returns undefined leaders for a Program with zero completed games', () => {
    const season = buildSeason({ 'team-z': ['someone'], 'opp-z': ['filler'] }, [])
    const leaders = deriveTeamPlayerLeaders(season, 'team-z')

    expect(leaders).toEqual({
      points: undefined,
      rebounds: undefined,
      assists: undefined,
    })
  })
})
