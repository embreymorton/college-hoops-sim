import type { DynastyState, NewsCheckpoint, NewsStory } from '../dynasty'
import { formatTournamentRoundName } from './postseasonFormatters'

export type NewsPresentationPart =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'player'; readonly text: string; readonly playerId: string; readonly programId: string }
  | { readonly kind: 'program'; readonly text: string; readonly programId: string }
  | { readonly kind: 'recruit'; readonly text: string }

export interface NewsStoryPresentation {
  readonly label: string
  readonly headline: readonly NewsPresentationPart[]
  readonly support: string
}

function text(value: string): NewsPresentationPart { return { kind: 'text', text: value } }

function programName(dynasty: DynastyState, programId: string): string {
  return dynasty.universe.programs.find(({ id }) => id === programId)?.name ?? programId
}

function playerName(dynasty: DynastyState, programId: string, playerId: string): string {
  const team = dynasty.activeSeason?.programStates[programId]?.team
    ?? dynasty.activePostseason?.programStates[programId]?.team
  const player = team?.roster.find(({ id }) => id === playerId)
  return player ? `${player.firstName} ${player.lastName}` : playerId
}

function programPart(dynasty: DynastyState, programId: string): NewsPresentationPart {
  return { kind: 'program', text: programName(dynasty, programId), programId }
}

function playerPart(dynasty: DynastyState, programId: string, playerId: string): NewsPresentationPart {
  return { kind: 'player', text: playerName(dynasty, programId, playerId), playerId, programId }
}

function scoreLine(dynasty: DynastyState, winnerId: string, winnerScore: number, loserId: string, loserScore: number): string {
  return `${programName(dynasty, winnerId)} ${winnerScore} · ${programName(dynasty, loserId)} ${loserScore}`
}

function playerSupport(story: Extract<NewsStory, { kind: 'player-performance' }>): string {
  const values = [`${story.stats.points} PTS`, `${story.stats.rebounds} REB`, `${story.stats.assists} AST`]
  if (story.achievements.some((value) => value.startsWith('steals-'))) values.push(`${story.stats.steals} STL`)
  if (story.achievements.some((value) => value.startsWith('blocks-'))) values.push(`${story.stats.blocks} BLK`)
  return values.join(' · ')
}

type PlayerPerformanceStory = Extract<NewsStory, { kind: 'player-performance' }>

function secondaryPerformancePhrase(story: PlayerPerformanceStory): string {
  if (story.achievements.includes('triple-double')) {
    if (story.primaryVariant === 'fifty-point') return ' and records a triple-double'
    return ''
  }
  const primaryCategory = story.primaryVariant === 'fifty-point' || story.primaryVariant === 'forty-point' || story.primaryVariant === 'scoring'
    ? 'points'
    : story.primaryVariant
  const candidates = [
    { achievement: 'points-40', category: 'points', phrase: ` and scores ${story.stats.points} points` },
    { achievement: 'rebounds-20', category: 'rebounding', phrase: ` and pulls down ${story.stats.rebounds} rebounds` },
    { achievement: 'assists-15', category: 'assists', phrase: ` and hands out ${story.stats.assists} assists` },
    { achievement: 'blocks-7', category: 'blocks', phrase: ` and blocks ${story.stats.blocks} shots` },
    { achievement: 'steals-6', category: 'steals', phrase: ` and records ${story.stats.steals} steals` },
  ] as const
  return candidates.find(({ achievement, category }) => category !== primaryCategory && story.achievements.includes(achievement))?.phrase ?? ''
}

function playerPerformanceHeadline(story: PlayerPerformanceStory, dynasty: DynastyState): readonly NewsPresentationPart[] {
  const player = playerPart(dynasty, story.programId, story.playerId)
  const program = programPart(dynasty, story.programId)
  const opponent = programPart(dynasty, story.opponentProgramId)
  const tripleDouble = story.achievements.includes('triple-double')
  const action = story.primaryVariant === 'fifty-point' ? ` erupts for ${story.stats.points} points`
    : story.primaryVariant === 'triple-double' ? (story.stats.points >= 40 ? ` records a triple-double in a ${story.stats.points}-point performance` : ' records a triple-double')
      : story.primaryVariant === 'forty-point' ? ` pours in ${story.stats.points} points`
        : story.primaryVariant === 'rebounding' ? ` pulls down ${story.stats.rebounds} rebounds`
          : story.primaryVariant === 'assists' ? ` hands out ${story.stats.assists} assists`
            : story.primaryVariant === 'blocks' ? ` blocks ${story.stats.blocks} shots`
              : story.primaryVariant === 'steals' ? ` records ${story.stats.steals} steals`
                : ` scores ${story.stats.points}`
  const achievementContext = tripleDouble && story.primaryVariant === 'triple-double' ? '' : secondaryPerformancePhrase(story)
  if (story.checkpoint.kind === 'tournament-round' && story.checkpoint.round === 'championship') {
    return story.won
      ? [player, text(`${action}${achievementContext} as `), program, text(' wins the national championship.')]
      : [player, text(`${action}${achievementContext}, but `), program, text(' falls in the national championship.')]
  }
  return story.won
    ? [player, text(`${action}${achievementContext} as `), program, text(' defeats '), opponent, text('.')]
    : [player, text(`${action}${achievementContext}, but `), program, text(' falls to '), opponent, text('.')]
}

export function formatNewsCheckpoint(checkpoint: NewsCheckpoint): string {
  if (checkpoint.kind === 'regular-season-round') return `Round ${checkpoint.round}`
  if (checkpoint.kind === 'tournament-round') return formatTournamentRoundName(checkpoint.round)
  return 'Late Recruiting'
}

/** Deterministic factual copy assembled from projected facts and current identities. */
export function presentNewsStory(story: NewsStory, dynasty: DynastyState): NewsStoryPresentation {
  if (story.kind === 'player-performance') {
    const labels = { 'fifty-point': '50-POINT PERFORMANCE', 'triple-double': 'TRIPLE-DOUBLE', 'forty-point': 'MONSTER NIGHT', rebounding: 'GLASS WORK', assists: 'PLAYMAKER', blocks: 'RIM PROTECTOR', steals: 'DEFENSIVE DISRUPTION', scoring: 'BIG NIGHT' } as const
    return { label: labels[story.primaryVariant], headline: playerPerformanceHeadline(story, dynasty), support: playerSupport(story) }
  }

  if (story.kind === 'recruit-commitment') {
    const recruit = dynasty.recruiting?.recruits.find(({ player }) => player.id === story.recruitId)?.player
    const recruitName = recruit ? `${recruit.firstName} ${recruit.lastName}` : story.recruitId
    const destination = programPart(dynasty, story.destinationProgramId)
    return story.nationalRank === 1
      ? { label: 'NO. 1 RECRUIT COMMITS', headline: [{ kind: 'recruit', text: recruitName }, text(`, the nation's No. 1 recruit and a five-star ${story.position}, commits to `), destination, text('.')], support: `Class of Season ${story.targetSeasonNumber}` }
      : { label: '5★ COMMITMENT', headline: [{ kind: 'recruit', text: recruitName }, text(`, the No. ${story.nationalRank} overall recruit and a five-star ${story.position}, commits to `), destination, text('.')], support: `Class of Season ${story.targetSeasonNumber}` }
  }

  if (story.kind === 'tournament-upset') {
    return {
      label: story.importance === 'major' ? 'MAJOR UPSET' : 'UPSET',
      headline: [text(`#${story.winnerSeed} `), programPart(dynasty, story.winnerProgramId), text(story.importance === 'major' ? ' knocks off ' : ' defeats '), text(`#${story.loserSeed} `), programPart(dynasty, story.loserProgramId), text('.')],
      support: scoreLine(dynasty, story.winnerProgramId, story.winnerScore, story.loserProgramId, story.loserScore),
    }
  }

  if (story.kind === 'winning-streak') {
    return { label: '10 STRAIGHT', headline: [programPart(dynasty, story.programId), text(' earns its 10th consecutive win.')], support: scoreLine(dynasty, story.programId, story.programScore, story.opponentProgramId, story.opponentScore) }
  }

  const longRun = story.undefeatedWins >= 12
  return {
    label: 'PERFECT NO MORE',
    headline: longRun
      ? [programPart(dynasty, story.winnerProgramId), text(' ends '), programPart(dynasty, story.losingProgramId), text(`'s ${story.undefeatedWins}–0 start.`)]
      : [programPart(dynasty, story.winnerProgramId), text(' hands '), programPart(dynasty, story.losingProgramId), text(` its first loss after an ${story.undefeatedWins}–0 start.`)],
    support: scoreLine(dynasty, story.winnerProgramId, story.winnerScore, story.losingProgramId, story.loserScore),
  }
}
