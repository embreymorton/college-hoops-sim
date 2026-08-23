import {
  RECORD_CATEGORIES,
  type PlayerCareerHighs as PlayerCareerHighsProjection,
  type RecordCategory,
} from '../dynasty'

const LABELS: Readonly<Record<RecordCategory, string>> = {
  points: 'PTS',
  rebounds: 'REB',
  assists: 'AST',
  steals: 'STL',
  blocks: 'BLK',
}

interface PlayerCareerHighsProps {
  readonly highs: PlayerCareerHighsProjection
}

export function PlayerCareerHighs({ highs }: PlayerCareerHighsProps) {
  if (!highs.hasAppearances) {
    return <p className="league-empty-state">No regular-season appearances yet.</p>
  }

  return (
    <dl className="player-career-highs">
      {RECORD_CATEGORIES.map((category) => {
        const high = highs.categories[category]!
        return (
          <div className="player-career-highs__item" key={category}>
            <dt>{LABELS[category]}</dt>
            <dd>
              <strong>{high.value}</strong>
              <span>S{high.seasonNumber} · vs {high.opponentProgramName}</span>
              {high.occurrenceCount > 1 ? (
                <small aria-label={`${high.occurrenceCount} occurrences`}>
                  {high.occurrenceCount}×
                </small>
              ) : null}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
