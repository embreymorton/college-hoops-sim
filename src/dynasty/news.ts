import type { PlayerGameStats, Position } from '../engine'
import { TOURNAMENT_ROUNDS, type TournamentRound } from '../postseason'
import type { DynastyState } from './domain'

export type NewsImportance = 'standard' | 'notable' | 'major'
export type NewsCheckpoint =
  | { readonly kind: 'regular-season-round'; readonly seasonId: string; readonly round: number }
  | { readonly kind: 'tournament-round'; readonly seasonId: string; readonly round: TournamentRound }
  | { readonly kind: 'late-recruiting'; readonly seasonId: string; readonly targetSeasonNumber: number }

interface NewsStoryBase { readonly id: string; readonly checkpoint: NewsCheckpoint; readonly importance: NewsImportance; readonly sourceOrder: number }
export type PlayerPerformanceAchievement =
  | 'points-35' | 'points-40' | 'points-50' | 'rebounds-18' | 'rebounds-20'
  | 'assists-12' | 'assists-15' | 'blocks-6' | 'blocks-7' | 'steals-5' | 'steals-6' | 'triple-double'
export type PlayerPerformanceVariant = 'fifty-point' | 'triple-double' | 'forty-point' | 'rebounding' | 'assists' | 'blocks' | 'steals' | 'scoring'

export interface PlayerPerformanceNewsStory extends NewsStoryBase {
  readonly kind: 'player-performance'; readonly gameId: string; readonly programId: string; readonly opponentProgramId: string
  readonly playerId: string; readonly stats: Pick<PlayerGameStats, 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks'>
  readonly achievements: readonly PlayerPerformanceAchievement[]; readonly primaryVariant: PlayerPerformanceVariant; readonly isFollowed: boolean
}
export interface RecruitCommitmentNewsStory extends NewsStoryBase {
  readonly kind: 'recruit-commitment'; readonly recruitId: string; readonly destinationProgramId: string
  readonly targetSeasonNumber: number; readonly nationalRank: number; readonly position: Position; readonly stars: 5
}
interface ScoredGameStory extends NewsStoryBase { readonly gameId: string; readonly winnerScore: number; readonly loserScore: number }
export interface TournamentUpsetNewsStory extends ScoredGameStory {
  readonly kind: 'tournament-upset'; readonly winnerProgramId: string; readonly loserProgramId: string
  readonly winnerSeed: number; readonly loserSeed: number; readonly seedGap: number
}
export interface UndefeatedRunEndedNewsStory extends ScoredGameStory {
  readonly kind: 'undefeated-run-ended'; readonly losingProgramId: string; readonly winnerProgramId: string; readonly undefeatedWins: number
}
export interface WinningStreakNewsStory extends NewsStoryBase {
  readonly kind: 'winning-streak'; readonly gameId: string; readonly programId: string; readonly opponentProgramId: string
  readonly streakWins: 10; readonly programScore: number; readonly opponentScore: number
}
export type NewsStory = PlayerPerformanceNewsStory | RecruitCommitmentNewsStory | TournamentUpsetNewsStory | UndefeatedRunEndedNewsStory | WinningStreakNewsStory
export interface NewsFeedGroup { readonly id: string; readonly checkpoint: NewsCheckpoint; readonly stories: readonly NewsStory[] }
export interface NewsFeed { readonly seasonId: string; readonly groups: readonly NewsFeedGroup[]; readonly storyCount: number }

const IMPORTANCE_ORDER: Readonly<Record<NewsImportance, number>> = { major: 0, notable: 1, standard: 2 }
const FAMILY_ORDER: Readonly<Record<NewsStory['kind'], number>> = { 'tournament-upset': 0, 'player-performance': 1, 'undefeated-run-ended': 2, 'winning-streak': 3, 'recruit-commitment': 4 }

function groupId(checkpoint: NewsCheckpoint): string {
  if (checkpoint.kind === 'regular-season-round') return `news:v1:group:${checkpoint.seasonId}:regular:${checkpoint.round}`
  if (checkpoint.kind === 'tournament-round') return `news:v1:group:${checkpoint.seasonId}:tournament:${checkpoint.round}`
  return `news:v1:group:${checkpoint.seasonId}:late-recruiting:${checkpoint.targetSeasonNumber}`
}

function performanceFacts(stats: PlayerGameStats): Pick<PlayerPerformanceNewsStory, 'achievements' | 'primaryVariant' | 'importance'> | null {
  const achievements: PlayerPerformanceAchievement[] = []
  let importance: NewsImportance = 'standard'
  if (stats.points >= 50) { achievements.push('points-50'); importance = 'major' }
  else if (stats.points >= 40) { achievements.push('points-40'); importance = 'notable' }
  else if (stats.points >= 35) achievements.push('points-35')
  if (stats.rebounds >= 20) { achievements.push('rebounds-20'); if (importance === 'standard') importance = 'notable' }
  else if (stats.rebounds >= 18) achievements.push('rebounds-18')
  if (stats.assists >= 15) { achievements.push('assists-15'); if (importance === 'standard') importance = 'notable' }
  else if (stats.assists >= 12) achievements.push('assists-12')
  if (stats.blocks >= 7) { achievements.push('blocks-7'); if (importance === 'standard') importance = 'notable' }
  else if (stats.blocks >= 6) achievements.push('blocks-6')
  if (stats.steals >= 6) { achievements.push('steals-6'); if (importance === 'standard') importance = 'notable' }
  else if (stats.steals >= 5) achievements.push('steals-5')
  const tripleDouble = [stats.points, stats.rebounds, stats.assists, stats.steals, stats.blocks].filter((value) => value >= 10).length >= 3
  if (tripleDouble) { achievements.push('triple-double'); importance = 'major' }
  if (achievements.length === 0) return null
  const primaryVariant: PlayerPerformanceVariant = stats.points >= 50 ? 'fifty-point' : tripleDouble ? 'triple-double' : stats.points >= 40 ? 'forty-point' : stats.rebounds >= 20 ? 'rebounding' : stats.assists >= 15 ? 'assists' : stats.blocks >= 7 ? 'blocks' : stats.steals >= 6 ? 'steals' : stats.points >= 35 ? 'scoring' : stats.rebounds >= 18 ? 'rebounding' : stats.assists >= 12 ? 'assists' : stats.blocks >= 6 ? 'blocks' : 'steals'
  return { achievements, primaryVariant, importance }
}

function derivePerformanceStories(options: {
  gameId: string; sourceOrder: number; checkpoint: NewsCheckpoint; homeProgramId: string; awayProgramId: string
  homeStats: readonly PlayerGameStats[]; awayStats: readonly PlayerGameStats[]; followed: ReadonlySet<string>
}): PlayerPerformanceNewsStory[] {
  const { gameId, sourceOrder, checkpoint, homeProgramId, awayProgramId, homeStats, awayStats, followed } = options
  return [...homeStats.map((stats) => ({ stats, programId: homeProgramId, opponentProgramId: awayProgramId })), ...awayStats.map((stats) => ({ stats, programId: awayProgramId, opponentProgramId: homeProgramId }))].flatMap(({ stats, programId, opponentProgramId }) => {
    const facts = performanceFacts(stats)
    return facts ? [{ kind: 'player-performance' as const, id: `news:v1:player-performance:${gameId}:${stats.playerId}`, checkpoint, sourceOrder, gameId, programId, opponentProgramId, playerId: stats.playerId, stats: { points: stats.points, rebounds: stats.rebounds, assists: stats.assists, steals: stats.steals, blocks: stats.blocks }, ...facts, isFollowed: followed.has(stats.playerId) }] : []
  })
}

function winnerAndLoserScore(result: { homeTeamId: string; homeScore: number; awayScore: number; winnerId: string }) {
  return result.winnerId === result.homeTeamId ? { winnerScore: result.homeScore, loserScore: result.awayScore } : { winnerScore: result.awayScore, loserScore: result.homeScore }
}
function storySort(a: NewsStory, b: NewsStory): number { return IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] || FAMILY_ORDER[a.kind] - FAMILY_ORDER[b.kind] || a.sourceOrder - b.sourceOrder || a.id.localeCompare(b.id) }
function groupSort(a: NewsFeedGroup, b: NewsFeedGroup): number {
  const phase = (c: NewsCheckpoint) => c.kind === 'late-recruiting' ? 2 : c.kind === 'tournament-round' ? 1 : 0
  const difference = phase(b.checkpoint) - phase(a.checkpoint)
  if (difference) return difference
  if (a.checkpoint.kind === 'regular-season-round' && b.checkpoint.kind === 'regular-season-round') return b.checkpoint.round - a.checkpoint.round
  if (a.checkpoint.kind === 'tournament-round' && b.checkpoint.kind === 'tournament-round') return TOURNAMENT_ROUNDS.indexOf(b.checkpoint.round) - TOURNAMENT_ROUNDS.indexOf(a.checkpoint.round)
  return a.id.localeCompare(b.id)
}

/** Pure current-season News projection over completed canonical checkpoints. */
export function deriveNewsFeed(dynasty: DynastyState, followedPlayerIds: readonly string[]): NewsFeed {
  const season = dynasty.activeSeason
  if (!season) return { seasonId: '', groups: [], storyCount: 0 }
  const followed = new Set(followedPlayerIds)
  const grouped = new Map<string, { checkpoint: NewsCheckpoint; stories: NewsStory[] }>()
  const add = (story: NewsStory) => { const id = groupId(story.checkpoint); const value = grouped.get(id) ?? { checkpoint: story.checkpoint, stories: [] }; value.stories.push(story); grouped.set(id, value) }
  const records = new Map(Object.keys(season.programStates).map((id) => [id, { wins: 0, losses: 0, streak: 0 }]))
  const regularGames = [...season.schedule.games].sort((a, b) => a.round - b.round || a.index - b.index)
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    const games = regularGames.filter((game) => game.round === round)
    if (!games.every((game) => season.resultsByGameId[game.id] !== undefined)) break
    const checkpoint: NewsCheckpoint = { kind: 'regular-season-round', seasonId: season.id, round }
    for (const game of games) {
      const result = season.resultsByGameId[game.id]!
      derivePerformanceStories({ gameId: game.id, sourceOrder: game.index, checkpoint, homeProgramId: game.homeProgramId, awayProgramId: game.awayProgramId, homeStats: result.homePlayerStats, awayStats: result.awayPlayerStats, followed }).forEach(add)
      const winnerId = result.winnerId
      const loserId = winnerId === game.homeProgramId ? game.awayProgramId : game.homeProgramId
      const winner = records.get(winnerId)!
      const loser = records.get(loserId)!
      const scores = winnerAndLoserScore(result)
      if (loser.losses === 0 && loser.wins >= 8) add({ kind: 'undefeated-run-ended', id: `news:v1:undefeated-run-ended:${game.id}:${loserId}`, checkpoint, sourceOrder: game.index, importance: loser.wins >= 12 ? 'notable' : 'standard', gameId: game.id, losingProgramId: loserId, winnerProgramId: winnerId, undefeatedWins: loser.wins, ...scores })
      winner.wins += 1; winner.streak += 1; loser.losses += 1; loser.streak = 0
      if (winner.streak === 10) add({ kind: 'winning-streak', id: `news:v1:winning-streak:10:${game.id}:${winnerId}`, checkpoint, sourceOrder: game.index, importance: 'notable', gameId: game.id, programId: winnerId, opponentProgramId: loserId, streakWins: 10, programScore: scores.winnerScore, opponentScore: scores.loserScore })
    }
  }

  const postseason = dynasty.activePostseason
  if (postseason) {
    const seeds = new Map(postseason.field.map((entry) => [entry.programId, entry.seed]))
    for (const round of TOURNAMENT_ROUNDS) {
      const games = postseason.bracket.games.filter((game) => game.round === round).sort((a, b) => a.index - b.index)
      if (!games.every((game) => postseason.resultsByGameId[game.id] !== undefined)) break
      const checkpoint: NewsCheckpoint = { kind: 'tournament-round', seasonId: season.id, round }
      for (const game of games) {
        const result = postseason.resultsByGameId[game.id]!
        derivePerformanceStories({ gameId: game.id, sourceOrder: game.index, checkpoint, homeProgramId: result.homeTeamId, awayProgramId: result.awayTeamId, homeStats: result.homePlayerStats, awayStats: result.awayPlayerStats, followed }).forEach(add)
        const loserId = result.winnerId === result.homeTeamId ? result.awayTeamId : result.homeTeamId
        const winnerSeed = seeds.get(result.winnerId)!
        const loserSeed = seeds.get(loserId)!
        const seedGap = winnerSeed - loserSeed
        if (seedGap >= 4) add({ kind: 'tournament-upset', id: `news:v1:tournament-upset:${game.id}`, checkpoint, sourceOrder: game.index, importance: seedGap >= 8 ? 'major' : 'notable', gameId: game.id, winnerProgramId: result.winnerId, loserProgramId: loserId, winnerSeed, loserSeed, seedGap, ...winnerAndLoserScore(result) })
      }
    }
  }

  const recruiting = dynasty.recruiting
  if (recruiting) {
    const recruits = new Map(recruiting.recruits.map((recruit) => [recruit.player.id, recruit]))
    for (const commitment of Object.values(recruiting.commitmentsByPlayerId)) {
      const recruit = recruits.get(commitment.playerId)
      if (!recruit || recruit.stars !== 5) continue
      let checkpoint: NewsCheckpoint | null = null
      const timing = commitment.timing
      if (timing.kind === 'period' && timing.period <= 24) {
        const games = regularGames.filter((game) => game.round === timing.period)
        if (games.length > 0 && games.every((game) => season.resultsByGameId[game.id] !== undefined)) checkpoint = { kind: 'regular-season-round', seasonId: season.id, round: timing.period }
      } else if (timing.kind === 'period' && postseason) {
        const round = TOURNAMENT_ROUNDS[timing.period - 25]
        const games = round ? postseason.bracket.games.filter((game) => game.round === round) : []
        if (round && games.length > 0 && games.every((game) => postseason.resultsByGameId[game.id] !== undefined)) checkpoint = { kind: 'tournament-round', seasonId: season.id, round }
      } else if (timing.kind === 'late' && (recruiting.phase === 'late' || recruiting.phase === 'finalized')) checkpoint = { kind: 'late-recruiting', seasonId: season.id, targetSeasonNumber: commitment.targetSeasonNumber }
      if (checkpoint) add({ kind: 'recruit-commitment', id: `news:v1:recruit-commitment:${commitment.targetSeasonNumber}:${commitment.playerId}`, checkpoint, sourceOrder: recruit.nationalRank, importance: recruit.nationalRank === 1 ? 'major' : 'standard', recruitId: commitment.playerId, destinationProgramId: commitment.programId, targetSeasonNumber: commitment.targetSeasonNumber, nationalRank: recruit.nationalRank, position: recruit.player.position, stars: 5 })
    }
  }
  const groups = [...grouped.entries()].map(([id, value]) => ({ id, checkpoint: value.checkpoint, stories: value.stories.sort(storySort) })).sort(groupSort)
  return { seasonId: season.id, groups, storyCount: groups.reduce((sum, group) => sum + group.stories.length, 0) }
}
