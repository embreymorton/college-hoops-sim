import { describe, expect, it } from 'vitest'
import type {
  GameResult,
  Player,
  PlayerGameStats,
  RotationV1,
  Team,
} from '../engine'
import type { RegularSeasonSchedule, ScheduledGame } from '../schedule'
import type { PostseasonState } from '../postseason'
import type { SeasonState } from '../season'
import { deriveMatchupScout } from './matchupScout'

interface TeamProfile {
  readonly points: number
  readonly rebounds: number
  readonly assists: number
  readonly turnovers: number
  readonly blocks: number
  readonly fieldGoalsMade: number
  readonly fieldGoalsAttempted: number
  readonly threePointersMade: number
  readonly threePointersAttempted: number
}

const DEFAULT_PROFILE: TeamProfile = {
  points: 70,
  rebounds: 30,
  assists: 12,
  turnovers: 12,
  blocks: 3,
  fieldGoalsMade: 25,
  fieldGoalsAttempted: 55,
  threePointersMade: 7,
  threePointersAttempted: 20,
}

function player(id: string, position: Player['position']): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
    position,
    classYear: 'JR',
    height: 76,
    attributes: {
      finishing: 70, shooting: 70, playmaking: 70, ballHandling: 70,
      perimeterDefense: 70, interiorDefense: 70, rebounding: 70,
      athleticism: 70, stamina: 70,
    },
    potential: 80,
  }
}

function team(programId: string): Team {
  return {
    id: programId,
    name: programId,
    abbreviation: programId.slice(0, 3).toUpperCase(),
    prestige: 50,
    roster: [
      player(`${programId}-scorer`, 'SG'),
      player(`${programId}-rebounder`, 'C'),
      player(`${programId}-playmaker`, 'PG'),
    ],
  }
}

function rotation(programId: string): RotationV1 {
  return {
    minutesByPosition: {
      PG: { [`${programId}-playmaker`]: 40 },
      SG: { [`${programId}-scorer`]: 40 },
      SF: { [`${programId}-scorer`]: 20, [`${programId}-playmaker`]: 20 },
      PF: { [`${programId}-rebounder`]: 40 },
      C: { [`${programId}-rebounder`]: 40 },
    },
  }
}

function row(
  playerId: string,
  values: Partial<Omit<PlayerGameStats, 'playerId'>>,
): PlayerGameStats {
  return {
    playerId,
    minutes: 40,
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

function boxScore(programId: string, profile: TeamProfile): PlayerGameStats[] {
  return [
    row(`${programId}-scorer`, {
      points: profile.points - 30,
      rebounds: 4,
      assists: 2,
      turnovers: Math.max(0, profile.turnovers - 5),
      fieldGoalsMade: profile.fieldGoalsMade - 10,
      fieldGoalsAttempted: profile.fieldGoalsAttempted - 22,
      threePointersMade: profile.threePointersMade,
      threePointersAttempted: profile.threePointersAttempted,
    }),
    row(`${programId}-rebounder`, {
      points: 16,
      rebounds: profile.rebounds - 10,
      assists: 1,
      blocks: profile.blocks,
      turnovers: 2,
      fieldGoalsMade: 7,
      fieldGoalsAttempted: 14,
    }),
    row(`${programId}-playmaker`, {
      points: 14,
      rebounds: 6,
      assists: profile.assists - 3,
      turnovers: 3,
      fieldGoalsMade: 3,
      fieldGoalsAttempted: 8,
    }),
  ]
}

function buildSeason(
  profiles: Readonly<Record<string, TeamProfile>>,
  gameCount = 6,
  winnersByGameId: Readonly<Record<string, string>> = {},
): SeasonState {
  const programIds = Object.keys(profiles).sort()
  const games: ScheduledGame[] = []
  const resultsByGameId: Record<string, GameResult> = {}

  for (let round = 1; round <= gameCount; round += 1) {
    for (let pairIndex = 0; pairIndex < programIds.length; pairIndex += 2) {
      const homeProgramId = programIds[pairIndex]!
      const awayProgramId = programIds[pairIndex + 1]!
      const id = `round-${round}-pair-${pairIndex / 2}`
      const homeProfile = profiles[homeProgramId]!
      const awayProfile = profiles[awayProgramId]!
      const homePlayerStats = boxScore(homeProgramId, homeProfile)
      const awayPlayerStats = boxScore(awayProgramId, awayProfile)
      const requestedWinner = winnersByGameId[id]
      const homeScore = requestedWinner
        ? requestedWinner === homeProgramId ? 80 : 70
        : homeProfile.points
      const awayScore = requestedWinner
        ? requestedWinner === awayProgramId ? 80 : 70
        : awayProfile.points

      games.push({
        id,
        index: games.length,
        round,
        homeProgramId,
        awayProgramId,
        type: 'nonconference',
      })
      resultsByGameId[id] = {
        homeTeamId: homeProgramId,
        awayTeamId: awayProgramId,
        homeScore,
        awayScore,
        winnerId: homeScore > awayScore ? homeProgramId : awayProgramId,
        overtimePeriods: 0,
        seed: id,
        homePlayerStats,
        awayPlayerStats,
      }
    }
  }

  const schedule: RegularSeasonSchedule = {
    version: 'test-v0',
    universeId: 'test-universe',
    universeVersion: 'v0',
    seed: 'scout-test',
    configuration: {
      conferenceFormat: 'double-round-robin',
      nonConferenceGamesPerProgram: 0,
      targetHomeGamesPerProgram: 3,
      targetAwayGamesPerProgram: 3,
    },
    roundCount: Math.max(1, gameCount),
    games,
  }

  return {
    id: 'scout-season',
    seasonNumber: 1,
    universeId: 'test-universe',
    universeVersion: 'v0',
    schedule,
    programStates: Object.fromEntries(programIds.map((programId) => [
      programId,
      { team: team(programId), rotation: rotation(programId) },
    ])),
    resultsByGameId,
  }
}

function leagueProfiles(
  override: (index: number, profile: TeamProfile) => TeamProfile = (_index, profile) => profile,
): Record<string, TeamProfile> {
  return Object.fromEntries(Array.from({ length: 32 }, (_, index) => {
    const profile = {
      ...DEFAULT_PROFILE,
      points: 55 + index,
      assists: 6 + index,
      turnovers: 5 + index,
      blocks: 1 + index,
      fieldGoalsMade: 15 + index,
      fieldGoalsAttempted: 60,
      threePointersMade: 2 + index,
      threePointersAttempted: 40,
      rebounds: 20 + index,
    }
    return [`team-${String(index).padStart(2, '0')}`, override(index, profile)]
  }))
}

describe('deriveMatchupScout Opponent Profile', () => {
  it('selects distinctive strengths and weaknesses, limits output, and suppresses differential redundancy', () => {
    const season = buildSeason(leagueProfiles())
    const elite = deriveMatchupScout({
      season,
      controlledProgramId: 'team-00',
      opponentProgramId: 'team-31',
    })

    expect(elite.observations).toHaveLength(3)
    expect(elite.observations.some(({ polarity }) => polarity === 'strength')).toBe(true)
    expect(elite.observations.filter(({ family }) => family === 'scoring')).toHaveLength(1)
    expect(elite.observations.some(({ family }) => family === 'differential')).toBe(false)

    const weak = deriveMatchupScout({
      season,
      controlledProgramId: 'team-31',
      opponentProgramId: 'team-00',
    })
    expect(weak.observations.some(({ polarity }) => polarity === 'weakness')).toBe(true)
  })

  it('ranks inverse metrics in the correct direction', () => {
    const profiles = leagueProfiles((index) => ({
      ...DEFAULT_PROFILE,
      turnovers: 5 + index,
      points: DEFAULT_PROFILE.points,
    }))
    const report = deriveMatchupScout({
      season: buildSeason(profiles),
      controlledProgramId: 'team-31',
      opponentProgramId: 'team-00',
    })

    expect(report.observations.find(({ key }) => key === 'turnoversPerGame')).toMatchObject({
      rank: 1,
      polarity: 'strength',
    })
  })

  it('omits middle and broadly tied metrics and does not force a third observation', () => {
    const profiles = leagueProfiles((index) => ({
      ...DEFAULT_PROFILE,
      points: index === 31 ? 95 : 70,
      fieldGoalsMade: DEFAULT_PROFILE.fieldGoalsMade,
      fieldGoalsAttempted: DEFAULT_PROFILE.fieldGoalsAttempted,
      threePointersMade: DEFAULT_PROFILE.threePointersMade,
      threePointersAttempted: DEFAULT_PROFILE.threePointersAttempted,
      rebounds: DEFAULT_PROFILE.rebounds,
      assists: DEFAULT_PROFILE.assists,
      turnovers: DEFAULT_PROFILE.turnovers,
      blocks: DEFAULT_PROFILE.blocks,
    }))
    const report = deriveMatchupScout({
      season: buildSeason(profiles),
      controlledProgramId: 'team-00',
      opponentProgramId: 'team-31',
    })

    expect(report.observations.map(({ key }) => key)).toEqual(['pointsPerGame'])
  })

  it('uses competition ranks for exact ties without stable IDs fabricating different ranks', () => {
    const profiles = leagueProfiles((index, profile) => ({
      ...profile,
      points: index >= 30 ? 100 : profile.points,
    }))
    const season = buildSeason(profiles)
    const first = deriveMatchupScout({ season, controlledProgramId: 'team-00', opponentProgramId: 'team-30' })
    const second = deriveMatchupScout({ season, controlledProgramId: 'team-00', opponentProgramId: 'team-31' })

    expect(first.observations.find(({ key }) => key === 'pointsPerGame')?.rank).toBe(1)
    expect(second.observations.find(({ key }) => key === 'pointsPerGame')?.rank).toBe(1)
  })

  it('uses point differential as a fallback when neither scoring side qualifies', () => {
    const profiles = leagueProfiles((index) => {
      const points = index <= 7
        ? 88 - index
        : index === 16 ? 80
        : index === 17 ? 60
        : index >= 24 ? 27 + index
        : 70
      return { ...DEFAULT_PROFILE, points }
    })
    const report = deriveMatchupScout({
      season: buildSeason(profiles),
      controlledProgramId: 'team-00',
      opponentProgramId: 'team-16',
    })

    expect(report.observations).toEqual([
      expect.objectContaining({ key: 'pointDifferentialPerGame', rank: 1 }),
    ])
  })

  it('handles zero, limited, early, and established samples without authoritative early ranks', () => {
    const profiles = leagueProfiles()
    const zero = deriveMatchupScout({
      season: buildSeason(profiles, 0),
      controlledProgramId: 'team-00', opponentProgramId: 'team-31',
    })
    const limited = deriveMatchupScout({
      season: buildSeason(profiles, 2),
      controlledProgramId: 'team-00', opponentProgramId: 'team-31',
    })
    const early = deriveMatchupScout({
      season: buildSeason(profiles, 3),
      controlledProgramId: 'team-00', opponentProgramId: 'team-31',
    })

    expect(zero).toMatchObject({ sampleStatus: 'no-data', observations: [] })
    expect(zero.playersToWatch).toHaveLength(2)
    expect(limited).toMatchObject({ sampleStatus: 'limited', observations: [] })
    expect(early.sampleStatus).toBe('early')
    expect(early.observations.length).toBeLessThanOrEqual(2)
  })
})

describe('deriveMatchupScout Players to Watch and Game Context', () => {
  it('deduplicates category leaders, preserves production selection, and adds only Top-10 distinctions', () => {
    const profiles = leagueProfiles()
    const report = deriveMatchupScout({
      season: buildSeason(profiles),
      controlledProgramId: 'team-00',
      opponentProgramId: 'team-31',
    })

    expect(report.playersToWatch.map(({ playerId }) => playerId)).toEqual([
      'team-31-scorer',
      'team-31-rebounder',
      'team-31-playmaker',
    ])
    expect(report.playersToWatch[0]!.topTenRanks).toContainEqual({ category: 'PPG', rank: 1 })
    expect(report.playersToWatch[1]!.topTenRanks).toContainEqual({ category: 'RPG', rank: 1 })
    expect(report.playersToWatch[2]!.topTenRanks).toContainEqual({ category: 'APG', rank: 1 })
    expect(report.playersToWatch.every(({ topTenRanks }) =>
      topTenRanks.every(({ rank }) => rank <= 10),
    )).toBe(true)
  })

  it('returns newest five, a meaningful streak, and the most recent prior meeting', () => {
    const profiles = leagueProfiles()
    const winners = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [
      `round-${index + 1}-pair-15`,
      'team-31',
    ]))
    const report = deriveMatchupScout({
      season: buildSeason(profiles, 6, winners),
      controlledProgramId: 'team-30',
      opponentProgramId: 'team-31',
    })

    expect(report.recentForm).toHaveLength(5)
    expect(report.recentForm.map(({ round }) => round)).toEqual([6, 5, 4, 3, 2])
    expect(report.currentStreak).toEqual({ outcome: 'W', count: 6 })
    expect(report.priorMeeting).toMatchObject({ round: 6, homeProgramId: 'team-30', awayProgramId: 'team-31' })
  })

  it('can show multiple Top-10 distinctions on one production leader without forcing a third Player', () => {
    const season = buildSeason(leagueProfiles())
    for (const result of Object.values(season.resultsByGameId)) {
      const rows = result.homeTeamId === 'team-31'
        ? result.homePlayerStats
        : result.awayTeamId === 'team-31' ? result.awayPlayerStats : null
      if (!rows) continue
      const scorer = rows.find(({ playerId }) => playerId === 'team-31-scorer')!
      const rebounder = rows.find(({ playerId }) => playerId === 'team-31-rebounder')!
      const playmaker = rows.find(({ playerId }) => playerId === 'team-31-playmaker')!
      scorer.rebounds = 50
      scorer.assists = 40
      rebounder.rebounds = 1
      playmaker.assists = 1
    }

    const report = deriveMatchupScout({
      season,
      controlledProgramId: 'team-00',
      opponentProgramId: 'team-31',
    })

    expect(report.playersToWatch).toHaveLength(2)
    expect(report.playersToWatch[0]!.topTenRanks).toEqual([
      { category: 'PPG', rank: 1 },
      { category: 'RPG', rank: 1 },
      { category: 'APG', rank: 1 },
    ])
  })

  it('places completed Tournament results before regular-season recent form', () => {
    const season = buildSeason(leagueProfiles())
    const tournamentGameId = 'tournament-opponent-game'
    const postseason: PostseasonState = {
      id: 'postseason',
      seasonId: season.id,
      universeId: season.universeId,
      universeVersion: season.universeVersion,
      field: [
        { programId: 'team-31', seed: 1, bidType: 'at-large' },
        { programId: 'team-29', seed: 16, bidType: 'at-large' },
      ],
      bracket: {
        version: 'v0',
        games: [{
          id: tournamentGameId,
          index: 0,
          round: 'round-of-16',
          participantSources: [
            { type: 'seed', seed: 1 },
            { type: 'seed', seed: 16 },
          ],
        }],
      },
      programStates: {},
      resultsByGameId: {
        [tournamentGameId]: {
          homeTeamId: 'team-31',
          awayTeamId: 'team-29',
          homeScore: 82,
          awayScore: 71,
          winnerId: 'team-31',
          overtimePeriods: 0,
          seed: 'tournament-result',
          homePlayerStats: boxScore('team-31', leagueProfiles()['team-31']!),
          awayPlayerStats: boxScore('team-29', leagueProfiles()['team-29']!),
        },
      },
    }

    const report = deriveMatchupScout({
      season,
      postseason,
      controlledProgramId: 'team-00',
      opponentProgramId: 'team-31',
    })

    expect(report.recentForm[0]).toMatchObject({
      gameId: tournamentGameId,
      competition: 'tournament',
      location: 'neutral',
    })
    expect(report.recentForm[1]).toMatchObject({ competition: 'regular-season', round: 6 })
  })

  it('omits a one-game streak and returns no prior meeting when teams have not played', () => {
    const report = deriveMatchupScout({
      season: buildSeason(leagueProfiles(), 1),
      controlledProgramId: 'team-00',
      opponentProgramId: 'team-03',
    })

    expect(report.currentStreak).toBeNull()
    expect(report.priorMeeting).toBeNull()
  })
})
