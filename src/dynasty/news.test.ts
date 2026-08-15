import { describe, expect, it } from 'vitest'
import { initializePostseason, simulatePendingGamesInTournamentRound } from '../postseason'
import { deriveNewsFeed, type PlayerPerformanceNewsStory } from './news'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

function withCompletedRounds(seed: string, rounds: number) {
  const dynasty = createRecruitingDynasty(seed)
  return { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, rounds) }
}

function performanceFixture(stat: 'points' | 'rebounds' | 'assists' | 'blocks' | 'steals', value: number) {
  const dynasty = withCompletedRounds(`news-${stat}-${value}`, 1)
  const season = dynasty.activeSeason!
  const game = season.schedule.games.find(({ round }) => round === 1)!
  const result = season.resultsByGameId[game.id]!
  const playerId = result.homePlayerStats[0]!.playerId
  const homePlayerStats = result.homePlayerStats.map((row, index) => index === 0
    ? { ...row, points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0, [stat]: value }
    : { ...row, points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0 })
  const quietResults = Object.fromEntries(Object.entries(season.resultsByGameId).map(([id, current]) => [id, {
    ...current,
    homePlayerStats: id === game.id ? homePlayerStats : current.homePlayerStats.map((row) => ({ ...row, points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0 })),
    awayPlayerStats: current.awayPlayerStats.map((row) => ({ ...row, points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0 })),
  }]))
  return { dynasty: { ...dynasty, activeSeason: { ...season, resultsByGameId: quietResults } }, playerId, gameId: game.id }
}

function playerStories(dynasty: ReturnType<typeof createRecruitingDynasty>): PlayerPerformanceNewsStory[] {
  return deriveNewsFeed(dynasty, []).groups.flatMap(({ stories }) => stories).filter((story): story is PlayerPerformanceNewsStory => story.kind === 'player-performance')
}

describe('Around the Country V1 projection', () => {
  it.each([
    ['points', 34, false], ['points', 35, true], ['rebounds', 17, false], ['rebounds', 18, true],
    ['assists', 11, false], ['assists', 12, true], ['blocks', 5, false], ['blocks', 6, true],
    ['steals', 4, false], ['steals', 5, true],
  ] as const)('%s threshold at %i has accepted qualification %s', (stat, value, qualifies) => {
    const fixture = performanceFixture(stat, value)
    expect(playerStories(fixture.dynasty)).toHaveLength(qualifies ? 1 : 0)
  })

  it('publishes no partial round and publishes after its final result', () => {
    const complete = withCompletedRounds('news-publication', 1)
    const season = complete.activeSeason!
    const lastGame = season.schedule.games.filter(({ round }) => round === 1).at(-1)!
    const partialResults = Object.fromEntries(Object.entries(season.resultsByGameId).filter(([id]) => id !== lastGame.id))
    expect(deriveNewsFeed({ ...complete, activeSeason: { ...season, resultsByGameId: partialResults } }, []).groups).toEqual([])
    expect(deriveNewsFeed(complete, []).groups.every(({ checkpoint }) => checkpoint.kind === 'regular-season-round')).toBe(true)
  })

  it('combines achievements, normalizes tiers, chooses primary variant, and annotates Follow', () => {
    const fixture = performanceFixture('points', 51)
    const season = fixture.dynasty.activeSeason!
    const result = season.resultsByGameId[fixture.gameId]!
    const homePlayerStats = result.homePlayerStats.map((row) => row.playerId === fixture.playerId
      ? { ...row, points: 51, rebounds: 20, assists: 15 }
      : row)
    const dynasty = { ...fixture.dynasty, activeSeason: { ...season, resultsByGameId: { ...season.resultsByGameId, [fixture.gameId]: { ...result, homePlayerStats } } } }
    const story = deriveNewsFeed(dynasty, [fixture.playerId]).groups.flatMap(({ stories }) => stories).find((candidate) => candidate.kind === 'player-performance') as PlayerPerformanceNewsStory
    expect(story.id).toBe(`news:v1:player-performance:${fixture.gameId}:${fixture.playerId}`)
    expect(story.achievements).toEqual(['points-50', 'rebounds-20', 'assists-15', 'triple-double'])
    expect(story.primaryVariant).toBe('fifty-point')
    expect(story.importance).toBe('major')
    expect(story.isFollowed).toBe(true)
  })

  it('accepts exactly five-star commitments and upgrades No. 1 in the completed checkpoint', () => {
    const dynasty = withCompletedRounds('news-recruiting', 1)
    const recruiting = dynasty.recruiting!
    const first = { ...recruiting.recruits[0]!, stars: 5 as const, nationalRank: 1 }
    const second = { ...recruiting.recruits[1]!, stars: 4 as const }
    const commitmentsByPlayerId = Object.fromEntries([first, second].map((recruit) => [recruit.player.id, { playerId: recruit.player.id, programId: dynasty.controlledProgramId, timing: { kind: 'period' as const, period: 1 }, targetSeasonNumber: recruiting.targetSeasonNumber }]))
    const feed = deriveNewsFeed({ ...dynasty, recruiting: { ...recruiting, recruits: [first, second, ...recruiting.recruits.slice(2)], commitmentsByPlayerId } }, [])
    const commitments = feed.groups.flatMap(({ stories }) => stories).filter(({ kind }) => kind === 'recruit-commitment')
    expect(commitments).toHaveLength(1)
    expect(commitments[0]).toMatchObject({ id: `news:v1:recruit-commitment:${recruiting.targetSeasonNumber}:${first.player.id}`, importance: 'major', nationalRank: 1 })
  })

  it('requires a completed Tournament round and applies gap 4 / gap 8 importance', () => {
    const dynasty = withCompletedRounds('news-tournament', 24)
    let postseason = initializePostseason({ universe: dynasty.universe, season: dynasty.activeSeason! })
    postseason = simulatePendingGamesInTournamentRound({ postseason, round: 'round-of-16', simulationSeed: 'news-tournament-games' })
    const game = postseason.bracket.games.find(({ round }) => round === 'round-of-16')!
    const result = postseason.resultsByGameId[game.id]!
    const entries = [postseason.field.find(({ programId }) => programId === result.homeTeamId)!, postseason.field.find(({ programId }) => programId === result.awayTeamId)!].sort((a, b) => b.seed - a.seed)
    const [underdog, favorite] = entries
    const forced = { ...result, winnerId: underdog!.programId, homeScore: result.homeTeamId === underdog!.programId ? 80 : 70, awayScore: result.awayTeamId === underdog!.programId ? 80 : 70 }
    const complete = { ...dynasty, activePostseason: { ...postseason, resultsByGameId: { ...postseason.resultsByGameId, [game.id]: forced }, field: postseason.field.map((entry) => entry.programId === underdog!.programId ? { ...entry, seed: 12 } : entry.programId === favorite!.programId ? { ...entry, seed: 8 } : entry) } }
    const notable = deriveNewsFeed(complete, []).groups.flatMap(({ stories }) => stories).find((story) => story.kind === 'tournament-upset' && story.gameId === game.id)
    expect(notable).toMatchObject({ importance: 'notable', seedGap: 4, id: `news:v1:tournament-upset:${game.id}` })
    const majorState = { ...complete, activePostseason: { ...complete.activePostseason!, field: complete.activePostseason!.field.map((entry) => entry.programId === favorite!.programId ? { ...entry, seed: 2 } : entry) } }
    expect(deriveNewsFeed(majorState, []).groups.flatMap(({ stories }) => stories).find((story) => story.kind === 'tournament-upset' && story.gameId === game.id)).toMatchObject({ importance: 'major', seedGap: 10 })
    const omittedGameId = postseason.bracket.games.filter(({ round }) => round === 'round-of-16').at(-1)!.id
    const partial = Object.fromEntries(Object.entries(complete.activePostseason!.resultsByGameId).filter(([id]) => id !== omittedGameId))
    expect(deriveNewsFeed({ ...complete, activePostseason: { ...complete.activePostseason!, resultsByGameId: partial } }, []).groups.some(({ checkpoint }) => checkpoint.kind === 'tournament-round')).toBe(false)
  })

  it('emits the 10th straight once and an undefeated first loss only after 8–0', () => {
    const dynasty = withCompletedRounds('news-team-stories', 11)
    const season = dynasty.activeSeason!
    const programId = Object.keys(season.programStates)[0]!
    const results = { ...season.resultsByGameId }
    for (const game of season.schedule.games.filter((candidate) => candidate.round <= 11 && (candidate.homeProgramId === programId || candidate.awayProgramId === programId))) {
      const result = results[game.id]!
      const shouldWin = game.round <= 10
      const opponentId = game.homeProgramId === programId ? game.awayProgramId : game.homeProgramId
      const winnerId = shouldWin ? programId : opponentId
      results[game.id] = { ...result, winnerId, homeScore: game.homeProgramId === winnerId ? 80 : 70, awayScore: game.awayProgramId === winnerId ? 80 : 70 }
    }
    const stories = deriveNewsFeed({ ...dynasty, activeSeason: { ...season, resultsByGameId: results } }, []).groups.flatMap(({ stories }) => stories)
    expect(stories.filter(({ kind }) => kind === 'winning-streak' && kind).map(({ id }) => id)).toHaveLength(1)
    expect(stories.find(({ kind }) => kind === 'undefeated-run-ended')).toMatchObject({ undefeatedWins: 10, importance: 'standard' })
  })

  it('is reproducible across insertion order and JSON round trips without mutation', () => {
    const dynasty = withCompletedRounds('news-determinism', 3)
    const before = JSON.stringify(dynasty)
    const reversed = { ...dynasty, activeSeason: { ...dynasty.activeSeason!, resultsByGameId: Object.fromEntries(Object.entries(dynasty.activeSeason!.resultsByGameId).reverse()) } }
    const expected = deriveNewsFeed(dynasty, [])
    expect(deriveNewsFeed(reversed, [])).toEqual(expected)
    expect(deriveNewsFeed(JSON.parse(JSON.stringify(dynasty)), [])).toEqual(expected)
    expect(JSON.stringify(dynasty)).toBe(before)
  })
})
