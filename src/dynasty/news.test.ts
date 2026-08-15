import { describe, expect, it } from 'vitest'
import type { PlayerGameStats } from '../engine'
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

function quietStats(rows: readonly PlayerGameStats[]): PlayerGameStats[] {
  return rows.map((row) => ({ ...row, points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0 }))
}

function quietCompletedRounds(seed: string, rounds: number) {
  const dynasty = withCompletedRounds(seed, rounds)
  const season = dynasty.activeSeason!
  return {
    ...dynasty,
    activeSeason: {
      ...season,
      resultsByGameId: Object.fromEntries(Object.entries(season.resultsByGameId).map(([id, result]) => [id, { ...result, homePlayerStats: quietStats(result.homePlayerStats), awayPlayerStats: quietStats(result.awayPlayerStats) }])),
    },
  }
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
    expect(story.won).toBe(result.winnerId === story.programId)
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

  it('preserves Tournament qualification and makes gap 8 or a qualifying top-two elimination major', () => {
    const dynasty = withCompletedRounds('news-tournament', 24)
    let postseason = initializePostseason({ universe: dynasty.universe, season: dynasty.activeSeason! })
    postseason = simulatePendingGamesInTournamentRound({ postseason, round: 'round-of-16', simulationSeed: 'news-tournament-games' })
    const game = postseason.bracket.games.find(({ round }) => round === 'round-of-16')!
    const result = postseason.resultsByGameId[game.id]!
    const entries = [postseason.field.find(({ programId }) => programId === result.homeTeamId)!, postseason.field.find(({ programId }) => programId === result.awayTeamId)!].sort((a, b) => b.seed - a.seed)
    const [underdog, favorite] = entries
    const forced = { ...result, winnerId: underdog!.programId, homeScore: result.homeTeamId === underdog!.programId ? 80 : 70, awayScore: result.awayTeamId === underdog!.programId ? 80 : 70 }
    const complete = { ...dynasty, activePostseason: { ...postseason, resultsByGameId: { ...postseason.resultsByGameId, [game.id]: forced } } }
    const storyForSeeds = (winnerSeed: number, loserSeed: number) => {
      const state = { ...complete, activePostseason: { ...complete.activePostseason!, field: complete.activePostseason!.field.map((entry) => entry.programId === underdog!.programId ? { ...entry, seed: winnerSeed } : entry.programId === favorite!.programId ? { ...entry, seed: loserSeed } : entry) } }
      return deriveNewsFeed(state, []).groups.flatMap(({ stories }) => stories).find((story) => story.kind === 'tournament-upset' && story.gameId === game.id)
    }
    expect(storyForSeeds(6, 3)).toBeUndefined()
    expect(storyForSeeds(10, 5)).toMatchObject({ importance: 'notable', seedGap: 5 })
    expect(storyForSeeds(11, 3)).toMatchObject({ importance: 'major', seedGap: 8 })
    expect(storyForSeeds(8, 1)).toMatchObject({ importance: 'major', seedGap: 7 })
    expect(storyForSeeds(6, 2)).toMatchObject({ importance: 'major', seedGap: 4 })
    expect(storyForSeeds(3, 2)).toBeUndefined()
    const omittedGameId = postseason.bracket.games.filter(({ round }) => round === 'round-of-16').at(-1)!.id
    const partial = Object.fromEntries(Object.entries(complete.activePostseason!.resultsByGameId).filter(([id]) => id !== omittedGameId))
    expect(deriveNewsFeed({ ...complete, activePostseason: { ...complete.activePostseason!, resultsByGameId: partial } }, []).groups.some(({ checkpoint }) => checkpoint.kind === 'tournament-round')).toBe(false)
  })

  it('tracks the latest fully completed regular checkpoint without manufacturing empty groups', () => {
    expect(deriveNewsFeed(createRecruitingDynasty('news-no-checkpoint'), [])).toMatchObject({
      latestCompletedCompetitionCheckpoint: null,
      latestCompletedCompetitionCheckpointHasNews: false,
    })

    const roundOneEmpty = quietCompletedRounds('news-empty-checkpoint', 1)
    const emptyFeed = deriveNewsFeed(roundOneEmpty, [])
    expect(emptyFeed.groups).toEqual([])
    expect(emptyFeed.latestCompletedCompetitionCheckpoint).toMatchObject({ kind: 'regular-season-round', round: 1 })
    expect(emptyFeed.latestCompletedCompetitionCheckpointHasNews).toBe(false)

    const roundTwoEmpty = quietCompletedRounds('news-empty-checkpoint', 2)
    const season = roundTwoEmpty.activeSeason!
    const lastRoundTwoGame = season.schedule.games.filter(({ round }) => round === 2).at(-1)!
    const partialRoundTwo = { ...roundTwoEmpty, activeSeason: { ...season, resultsByGameId: Object.fromEntries(Object.entries(season.resultsByGameId).filter(([id]) => id !== lastRoundTwoGame.id)) } }
    expect(deriveNewsFeed(partialRoundTwo, []).latestCompletedCompetitionCheckpoint).toMatchObject({ kind: 'regular-season-round', round: 1 })

    const storyGame = season.schedule.games.find(({ round }) => round === 2)!
    const storyResult = season.resultsByGameId[storyGame.id]!
    const homePlayerStats = storyResult.homePlayerStats.map((row, index) => index === 0 ? { ...row, points: 35 } : row)
    const withNewStory = { ...roundTwoEmpty, activeSeason: { ...season, resultsByGameId: { ...season.resultsByGameId, [storyGame.id]: { ...storyResult, homePlayerStats } } } }
    const storyFeed = deriveNewsFeed(withNewStory, [])
    expect(storyFeed.latestCompletedCompetitionCheckpoint).toMatchObject({ kind: 'regular-season-round', round: 2 })
    expect(storyFeed.latestCompletedCompetitionCheckpointHasNews).toBe(true)
    expect(storyFeed.groups).toHaveLength(1)
    expect(storyFeed.groups[0]!.checkpoint).toMatchObject({ kind: 'regular-season-round', round: 2 })
  })

  it('tracks an empty completed Tournament checkpoint separately from regular-season News', () => {
    const canonicalDynasty = withCompletedRounds('news-empty-tournament-checkpoint', 24)
    const dynasty = quietCompletedRounds('news-empty-tournament-checkpoint', 24)
    let postseason = initializePostseason({ universe: canonicalDynasty.universe, season: canonicalDynasty.activeSeason! })
    postseason = simulatePendingGamesInTournamentRound({ postseason, round: 'round-of-16', simulationSeed: 'news-empty-tournament-games' })
    const seeds = new Map(postseason.field.map((entry) => [entry.programId, entry.seed]))
    const resultsByGameId = Object.fromEntries(Object.entries(postseason.resultsByGameId).map(([id, result]) => {
      const favoriteId = seeds.get(result.homeTeamId)! < seeds.get(result.awayTeamId)! ? result.homeTeamId : result.awayTeamId
      return [id, { ...result, winnerId: favoriteId, homeScore: result.homeTeamId === favoriteId ? 80 : 70, awayScore: result.awayTeamId === favoriteId ? 80 : 70, homePlayerStats: quietStats(result.homePlayerStats), awayPlayerStats: quietStats(result.awayPlayerStats) }]
    }))
    const feed = deriveNewsFeed({ ...dynasty, activePostseason: { ...postseason, resultsByGameId } }, [])
    expect(feed.latestCompletedCompetitionCheckpoint).toMatchObject({ kind: 'tournament-round', round: 'round-of-16' })
    expect(feed.latestCompletedCompetitionCheckpointHasNews).toBe(false)
    expect(feed.groups.some(({ checkpoint }) => checkpoint.kind === 'tournament-round')).toBe(false)
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
