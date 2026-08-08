import { describe, expect, it } from 'vitest'
import type { GameResult, PlayerGameStats } from '../engine'
import type { RegularSeasonSchedule, ScheduledGame } from '../schedule'
import type { ProgramDefinition, UniverseDefinition } from '../universe'
import { UNIVERSE_V0 } from '../universe'
import {
  deriveConferenceRecord,
  deriveConferenceStandings,
  deriveProgramRecord,
  type SeasonState,
} from './index'

const CONFERENCE_ID = 'test-conference'
const OTHER_CONFERENCE_ID = 'other-conference'

interface GameFixture {
  readonly home: string
  readonly away: string
  readonly winner: string
  readonly type?: 'conference' | 'nonconference'
}

function program(id: string, conferenceId: string): ProgramDefinition {
  return {
    id,
    name: `${id} University`,
    abbreviation: id.slice(0, 4).toUpperCase(),
    conferenceId,
    location: { city: id, stateCode: 'TS' },
    basePrestige: 50,
    branding: { primaryColor: '#000000', secondaryColor: '#ffffff' },
    identity: `${id} test program.`,
  }
}

function createUniverse(
  conferenceProgramIds: readonly string[],
  includeOutsider = false,
): UniverseDefinition {
  const programs = conferenceProgramIds.map((id) => program(id, CONFERENCE_ID))

  if (includeOutsider) {
    programs.push(program('outsider', OTHER_CONFERENCE_ID))
  }

  return {
    id: 'standings-test-universe',
    version: 'v0',
    rosterGenerationVersion: 'v0',
    configuration: {
      programCount: programs.length,
      conferenceCount: includeOutsider ? 2 : 1,
      programsPerConference: conferenceProgramIds.length,
    },
    conferences: [
      { id: CONFERENCE_ID, name: 'Test Conference', identity: 'Test.' },
      ...(includeOutsider
        ? [
            {
              id: OTHER_CONFERENCE_ID,
              name: 'Other Conference',
              identity: 'Other.',
            },
          ]
        : []),
    ],
    programs,
  }
}

function playerStats(playerId: string, points: number): PlayerGameStats {
  return {
    playerId,
    minutes: 40,
    points,
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
  }
}

function resultForGame(game: ScheduledGame, winnerId: string): GameResult {
  const homeWon = winnerId === game.homeProgramId
  const homeScore = homeWon ? 70 : 60
  const awayScore = homeWon ? 60 : 70

  return {
    homeTeamId: game.homeProgramId,
    awayTeamId: game.awayProgramId,
    homeScore,
    awayScore,
    winnerId,
    overtimePeriods: 0,
    seed: `standings:${game.id}`,
    homePlayerStats: [playerStats(`${game.homeProgramId}:player`, homeScore)],
    awayPlayerStats: [playerStats(`${game.awayProgramId}:player`, awayScore)],
  }
}

function createSeason(
  universe: UniverseDefinition,
  fixtures: readonly GameFixture[],
  reverseResultInsertion = false,
): SeasonState {
  const games: ScheduledGame[] = fixtures.map(
    ({ home, away, type = 'conference' }, index) => ({
      id: `game-${index}`,
      index,
      round: index + 1,
      homeProgramId: home,
      awayProgramId: away,
      type,
    }),
  )
  const schedule: RegularSeasonSchedule = {
    version: 'v0',
    universeId: universe.id,
    universeVersion: universe.version,
    seed: 'standings-schedule',
    configuration: {
      conferenceFormat: 'double-round-robin',
      nonConferenceGamesPerProgram: 0,
      targetHomeGamesPerProgram: 0,
      targetAwayGamesPerProgram: 0,
    },
    roundCount: Math.max(1, games.length),
    games,
  }
  const entries = games.map((game, index) => [
    game.id,
    resultForGame(game, fixtures[index]!.winner),
  ] as const)

  if (reverseResultInsertion) {
    entries.reverse()
  }

  return {
    id: 'season:standings-test-universe:v0:number-1',
    seasonNumber: 1,
    universeId: universe.id,
    universeVersion: universe.version,
    schedule,
    programStates: {},
    resultsByGameId: Object.fromEntries(entries),
  }
}

describe('deriveConferenceStandings', () => {
  it('returns only Conference members with neutral finite percentages before games', () => {
    const universe = createUniverse(['delta', 'alpha', 'charlie', 'bravo'])
    const season = createSeason(universe, [])
    const before = JSON.parse(JSON.stringify(season)) as SeasonState
    const rows = deriveConferenceStandings(universe, season, CONFERENCE_ID)

    expect(rows.map(({ programId }) => programId)).toEqual([
      'alpha',
      'bravo',
      'charlie',
      'delta',
    ])
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      expect(row).toMatchObject({
        wins: 0,
        losses: 0,
        conferenceWins: 0,
        conferenceLosses: 0,
        winPercentage: 0,
        conferenceWinPercentage: 0,
      })
      expect(Number.isNaN(row.winPercentage)).toBe(false)
      expect(Number.isNaN(row.conferenceWinPercentage)).toBe(false)
    }
    expect(season).toEqual(before)
  })

  it('matches existing records and sorts by Conference win percentage', () => {
    const universe = createUniverse(['alpha', 'bravo', 'charlie', 'delta'])
    const season = createSeason(universe, [
      { home: 'alpha', away: 'bravo', winner: 'alpha' },
      { home: 'charlie', away: 'alpha', winner: 'charlie' },
      { home: 'bravo', away: 'delta', winner: 'bravo' },
    ])
    const rows = deriveConferenceStandings(universe, season, CONFERENCE_ID)

    expect(rows.map(({ programId }) => programId)).toEqual([
      'charlie',
      'alpha',
      'bravo',
      'delta',
    ])
    for (const row of rows) {
      const overall = deriveProgramRecord(season, row.programId)
      const conference = deriveConferenceRecord(season, row.programId)

      expect({ wins: row.wins, losses: row.losses }).toEqual(overall)
      expect({
        wins: row.conferenceWins,
        losses: row.conferenceLosses,
      }).toEqual(conference)
    }
  })

  it('uses decisive head-to-head for an exact two-Team Conference tie', () => {
    const universe = createUniverse(
      ['alpha', 'bravo', 'charlie', 'delta'],
      true,
    )
    const season = createSeason(universe, [
      { home: 'alpha', away: 'bravo', winner: 'alpha' },
      { home: 'charlie', away: 'alpha', winner: 'charlie' },
      { home: 'bravo', away: 'delta', winner: 'bravo' },
      {
        home: 'bravo',
        away: 'outsider',
        winner: 'bravo',
        type: 'nonconference',
      },
    ])
    const rows = deriveConferenceStandings(universe, season, CONFERENCE_ID)

    expect(rows.map(({ programId }) => programId)).toEqual([
      'charlie',
      'alpha',
      'bravo',
      'delta',
    ])
    expect(rows.find(({ programId }) => programId === 'bravo')?.winPercentage)
      .toBeGreaterThan(
        rows.find(({ programId }) => programId === 'alpha')!.winPercentage,
      )
  })

  it('falls through a split head-to-head tie to overall win percentage', () => {
    const universe = createUniverse(['alpha', 'bravo'], true)
    const season = createSeason(universe, [
      { home: 'alpha', away: 'bravo', winner: 'alpha' },
      { home: 'bravo', away: 'alpha', winner: 'bravo' },
      {
        home: 'bravo',
        away: 'outsider',
        winner: 'bravo',
        type: 'nonconference',
      },
    ])

    expect(
      deriveConferenceStandings(universe, season, CONFERENCE_ID).map(
        ({ programId }) => programId,
      ),
    ).toEqual(['bravo', 'alpha'])
  })

  it('skips head-to-head for a three-Team tie, then uses overall and ID', () => {
    const universe = createUniverse(['alpha', 'bravo', 'charlie'], true)
    const season = createSeason(universe, [
      { home: 'alpha', away: 'bravo', winner: 'alpha' },
      { home: 'bravo', away: 'charlie', winner: 'bravo' },
      { home: 'charlie', away: 'alpha', winner: 'charlie' },
      {
        home: 'bravo',
        away: 'outsider',
        winner: 'bravo',
        type: 'nonconference',
      },
    ])

    expect(
      deriveConferenceStandings(universe, season, CONFERENCE_ID).map(
        ({ programId }) => programId,
      ),
    ).toEqual(['bravo', 'alpha', 'charlie'])
  })

  it('is independent of result insertion order and rejects identity errors', () => {
    const universe = createUniverse(['alpha', 'bravo', 'charlie'])
    const fixtures: GameFixture[] = [
      { home: 'alpha', away: 'bravo', winner: 'alpha' },
      { home: 'bravo', away: 'charlie', winner: 'bravo' },
      { home: 'charlie', away: 'alpha', winner: 'charlie' },
    ]
    const forward = createSeason(universe, fixtures)
    const reverse = createSeason(universe, fixtures, true)

    expect(
      deriveConferenceStandings(universe, reverse, CONFERENCE_ID),
    ).toEqual(deriveConferenceStandings(universe, forward, CONFERENCE_ID))
    expect(() =>
      deriveConferenceStandings(universe, forward, 'unknown-conference'),
    ).toThrow(/Unknown Conference/)
    expect(() =>
      deriveConferenceStandings(
        UNIVERSE_V0,
        forward,
        UNIVERSE_V0.conferences[0]!.id,
      ),
    ).toThrow(/does not match/)
  })
})
