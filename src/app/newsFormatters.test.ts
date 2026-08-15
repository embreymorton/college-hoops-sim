import { describe, expect, it } from 'vitest'
import type { NewsCheckpoint, PlayerPerformanceAchievement, PlayerPerformanceNewsStory, RecruitCommitmentNewsStory } from '../dynasty'
import { createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import { presentNewsStory, type NewsStoryPresentation } from './newsFormatters'

const dynasty = createRecruitingDynasty('news-formatters')
const [program, opponent] = dynasty.universe.programs
const player = dynasty.activeSeason!.programStates[program!.id]!.team.roster[0]!

function headlineText(presentation: NewsStoryPresentation): string {
  return presentation.headline.map(({ text }) => text).join('')
}

function performanceStory(options: {
  checkpoint?: NewsCheckpoint
  won?: boolean
  points?: number
  rebounds?: number
  assists?: number
  steals?: number
  blocks?: number
  achievements?: readonly PlayerPerformanceAchievement[]
  primaryVariant?: PlayerPerformanceNewsStory['primaryVariant']
  importance?: PlayerPerformanceNewsStory['importance']
} = {}): PlayerPerformanceNewsStory {
  return {
    kind: 'player-performance',
    id: 'news:v1:player-performance:test-game:test-player',
    checkpoint: options.checkpoint ?? { kind: 'regular-season-round', seasonId: dynasty.activeSeason!.id, round: 1 },
    importance: options.importance ?? 'standard',
    sourceOrder: 0,
    gameId: 'test-game',
    programId: program!.id,
    opponentProgramId: opponent!.id,
    playerId: player.id,
    stats: { points: options.points ?? 35, rebounds: options.rebounds ?? 4, assists: options.assists ?? 2, steals: options.steals ?? 0, blocks: options.blocks ?? 0 },
    achievements: options.achievements ?? ['points-35'],
    primaryVariant: options.primaryVariant ?? 'scoring',
    isFollowed: false,
    won: options.won ?? true,
  }
}

describe('News presentation polish', () => {
  it('separates overall national Recruit rank from position and preserves No. 1 treatment', () => {
    const recruit = dynasty.recruiting!.recruits[0]!
    const base: RecruitCommitmentNewsStory = {
      kind: 'recruit-commitment', id: 'news:v1:recruit-commitment:2:test', checkpoint: { kind: 'regular-season-round', seasonId: dynasty.activeSeason!.id, round: 1 },
      importance: 'standard', sourceOrder: 7, recruitId: recruit.player.id, destinationProgramId: program!.id,
      targetSeasonNumber: 2, nationalRank: 7, position: 'PG', stars: 5,
    }
    const standard = presentNewsStory(base, dynasty)
    expect(headlineText(standard)).toContain('the No. 7 overall recruit and a five-star PG')
    expect(headlineText(standard)).not.toContain('No. 7 PG nationally')
    expect(standard.headline.filter(({ kind }) => kind === 'recruit')).toHaveLength(1)
    expect(standard.headline.filter(({ kind }) => kind === 'program')).toEqual([expect.objectContaining({ programId: program!.id })])
    expect(headlineText(presentNewsStory({ ...base, nationalRank: 1, importance: 'major' }, dynasty))).toContain("the nation's No. 1 recruit and a five-star PG")
  })

  it.each([
    ['regular-season win', { kind: 'regular-season-round', seasonId: dynasty.activeSeason!.id, round: 1 } as NewsCheckpoint, true, `as ${program!.name} defeats ${opponent!.name}.`],
    ['regular-season loss', { kind: 'regular-season-round', seasonId: dynasty.activeSeason!.id, round: 1 } as NewsCheckpoint, false, `but ${program!.name} falls to ${opponent!.name}.`],
    ['Tournament win', { kind: 'tournament-round', seasonId: dynasty.activeSeason!.id, round: 'quarterfinals' } as NewsCheckpoint, true, `as ${program!.name} defeats ${opponent!.name}.`],
    ['Tournament loss', { kind: 'tournament-round', seasonId: dynasty.activeSeason!.id, round: 'semifinals' } as NewsCheckpoint, false, `but ${program!.name} falls to ${opponent!.name}.`],
    ['Championship win', { kind: 'tournament-round', seasonId: dynasty.activeSeason!.id, round: 'championship' } as NewsCheckpoint, true, `as ${program!.name} wins the national championship.`],
    ['Championship loss', { kind: 'tournament-round', seasonId: dynasty.activeSeason!.id, round: 'championship' } as NewsCheckpoint, false, `but ${program!.name} falls in the national championship.`],
  ] as const)('adds factual outcome context for a %s', (_label, checkpoint, won, expected) => {
    const presentation = presentNewsStory(performanceStory({ checkpoint, won, points: 41, achievements: ['points-40'], primaryVariant: 'forty-point', importance: 'notable' }), dynasty)
    expect(headlineText(presentation)).toContain(expected)
    expect(presentation.headline.filter(({ kind }) => kind === 'player')).toEqual([expect.objectContaining({ playerId: player.id, programId: program!.id })])
    expect(presentation.headline.filter(({ kind }) => kind === 'program').map(({ text }) => text)).toContain(program!.name)
    if (checkpoint.kind !== 'tournament-round' || checkpoint.round !== 'championship') {
      expect(presentation.headline.filter(({ kind }) => kind === 'program').map((part) => 'programId' in part ? part.programId : '')).toEqual([program!.id, opponent!.id])
    }
  })

  it('acknowledges at most one strong secondary category while keeping baseline combinations concise', () => {
    const dual = presentNewsStory(performanceStory({ rebounds: 23, blocks: 7, achievements: ['rebounds-20', 'blocks-7'], primaryVariant: 'rebounding', importance: 'notable' }), dynasty)
    expect(headlineText(dual)).toContain('pulls down 23 rebounds and blocks 7 shots')

    const single = headlineText(presentNewsStory(performanceStory(), dynasty))
    expect(single).toContain('scores 35')
    expect(single).not.toContain(' and ')

    const baselineCombination = headlineText(presentNewsStory(performanceStory({ rebounds: 18, achievements: ['points-35', 'rebounds-18'] }), dynasty))
    expect(baselineCombination).not.toContain('18 rebounds')
  })

  it('keeps triple-double and 50-point primary behavior while acknowledging both exceptional facts', () => {
    const fortyTriple = presentNewsStory(performanceStory({ points: 41, rebounds: 18, assists: 12, achievements: ['points-40', 'rebounds-18', 'assists-12', 'triple-double'], primaryVariant: 'triple-double', importance: 'major' }), dynasty)
    expect(fortyTriple.label).toBe('TRIPLE-DOUBLE')
    expect(headlineText(fortyTriple)).toContain('records a triple-double in a 41-point performance')

    const fiftyTriple = presentNewsStory(performanceStory({ points: 51, rebounds: 18, assists: 12, achievements: ['points-50', 'rebounds-18', 'assists-12', 'triple-double'], primaryVariant: 'fifty-point', importance: 'major' }), dynasty)
    expect(fiftyTriple.label).toBe('50-POINT PERFORMANCE')
    expect(headlineText(fiftyTriple)).toContain('erupts for 51 points and records a triple-double')
  })
})
