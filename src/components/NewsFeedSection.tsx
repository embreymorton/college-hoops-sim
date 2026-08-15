import { useState } from 'react'
import type { DynastyState, NewsFeed, NewsFeedGroup } from '../dynasty'
import { formatNewsCheckpoint, presentNewsStory, type NewsPresentationPart } from '../app/newsFormatters'

interface NewsFeedSectionProps {
  readonly feed: NewsFeed
  readonly dynasty: DynastyState
  readonly onSelectPlayer: (programId: string, playerId: string) => void
  readonly onSelectProgram: (programId: string) => void
}

const INITIAL_STORY_TARGET = 12

function selectInitiallyVisibleNewsGroups(groups: readonly NewsFeedGroup[]): readonly NewsFeedGroup[] {
  let count = 0
  let groupCount = 0
  while (groupCount < groups.length && count < INITIAL_STORY_TARGET) {
    count += groups[groupCount]!.stories.length
    groupCount += 1
  }
  return groups.slice(0, groupCount)
}

function StoryPart({ part, onSelectPlayer, onSelectProgram }: {
  readonly part: NewsPresentationPart
  readonly onSelectPlayer: NewsFeedSectionProps['onSelectPlayer']
  readonly onSelectProgram: NewsFeedSectionProps['onSelectProgram']
}) {
  if (part.kind === 'player') return <button type="button" className="text-link-button" onClick={() => onSelectPlayer(part.programId, part.playerId)}>{part.text}</button>
  if (part.kind === 'program') return <button type="button" className="text-link-button" onClick={() => onSelectProgram(part.programId)}>{part.text}</button>
  if (part.kind === 'recruit') return <strong>{part.text}</strong>
  return part.text
}

export function NewsFeedSection({ feed, dynasty, onSelectPlayer, onSelectProgram }: NewsFeedSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const initialGroups = selectInitiallyVisibleNewsGroups(feed.groups)
  const visibleGroups = showAll ? feed.groups : initialGroups
  const showLatestCheckpointEmpty = feed.latestCompletedCompetitionCheckpoint !== null && !feed.latestCompletedCompetitionCheckpointHasNews

  return (
    <div className="league-news">
      <div className="league-news__heading">
        <h1 className="section-title">Around the Country</h1>
        <p className="section-hint">Notable performances, commitments, streaks, and Tournament results from across the college basketball world.</p>
        {showLatestCheckpointEmpty ? <p className="league-news__checkpoint-status">{formatNewsCheckpoint(feed.latestCompletedCompetitionCheckpoint!)} complete · No notable news</p> : null}
      </div>
      {feed.storyCount === 0 ? (
        showLatestCheckpointEmpty ? null : <p className="league-empty-state">No News yet. Complete a full round to see notable stories from around the country.</p>
      ) : (
        <div className="news-feed">
          {visibleGroups.map((group) => (
            <section className="news-group" key={group.id} aria-labelledby={`${group.id}:heading`}>
              <h2 id={`${group.id}:heading`} className="news-group__heading">{formatNewsCheckpoint(group.checkpoint)}</h2>
              <div className="news-group__stories">
                {group.stories.map((story) => {
                  const presentation = presentNewsStory(story, dynasty)
                  return (
                    <article className="news-story" data-importance={story.importance} key={story.id}>
                      <div className="news-story__meta">
                        <p className="eyebrow-tag">{presentation.label}</p>
                        {story.kind === 'player-performance' && story.isFollowed ? <span className="news-story__following" aria-label="Following this player">★ Following</span> : null}
                      </div>
                      <p className="news-story__headline">{presentation.headline.map((part, index) => <StoryPart key={`${story.id}:part:${index}`} part={part} onSelectPlayer={onSelectPlayer} onSelectProgram={onSelectProgram} />)}</p>
                      <p className="news-story__support">{presentation.support}</p>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
          {!showAll && initialGroups.length < feed.groups.length ? (
            <button type="button" className="button button--ghost news-feed__show-all" onClick={() => setShowAll(true)}>Show All Season News ({feed.storyCount})</button>
          ) : null}
        </div>
      )}
    </div>
  )
}
