import { useState } from 'react'
import {
  RECORD_CATEGORIES,
  type ProgramPlayerRecords,
  type RecordBookEntry,
  type RecordCategory,
} from '../dynasty'

const LABELS: Readonly<Record<RecordCategory, string>> = {
  points: 'PTS', rebounds: 'REB', assists: 'AST', steals: 'STL', blocks: 'BLK',
}
const RATE_LABELS: Readonly<Record<RecordCategory, string>> = {
  points: 'PPG', rebounds: 'RPG', assists: 'APG', steals: 'SPG', blocks: 'BPG',
}

interface ProgramPlayerRecordsSectionProps {
  readonly records: ProgramPlayerRecords
  readonly onSelectPlayer: (playerId: string) => void
}

function context(row: RecordBookEntry, scope: 'game' | 'season' | 'career'): string {
  if (scope === 'game') return `S${row.seasonNumber} · vs ${row.opponentProgramName}`
  if (scope === 'season') return `S${row.seasonNumber} · ${row.gamesPlayed} GP`
  const span = row.firstSeasonNumber === row.lastSeasonNumber
    ? `S${row.firstSeasonNumber}`
    : `S${row.firstSeasonNumber}–${row.lastSeasonNumber}`
  return `${span} · ${row.gamesPlayed} GP`
}

export function ProgramPlayerRecordsSection({
  records,
  onSelectPlayer,
}: ProgramPlayerRecordsSectionProps) {
  const [category, setCategory] = useState<RecordCategory>('points')

  if (!records.hasAppearances) {
    return <p className="league-empty-state">No regular-season player records yet.</p>
  }

  const selected = records.categories[category]
  const rows = [
    { label: 'Single Game', unit: LABELS[category], row: selected.singleGame, scope: 'game' },
    { label: 'Single Season', unit: RATE_LABELS[category], row: selected.singleSeason, scope: 'season' },
    { label: 'Career', unit: LABELS[category], row: selected.career, scope: 'career' },
  ] as const

  return (
    <div className="program-player-records">
      <div className="program-player-records__header">
        <p className="eyebrow-tag">Regular Season</p>
        <div role="group" aria-label="Program record category" className="tab-list program-player-records__tabs">
          {RECORD_CATEGORIES.map((key) => (
            <button
              key={key}
              type="button"
              className="tab"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              {LABELS[key]}
            </button>
          ))}
        </div>
      </div>
      <div className="program-player-records__rows">
        {rows.map(({ label, unit, row, scope }) => (
          <div className="program-player-records__row" key={label}>
            <span className="program-player-records__scope">{label}</span>
            {row ? (
              <>
                <button type="button" className="text-link-button" onClick={() => onSelectPlayer(row.playerId)}>
                  {row.firstName} {row.lastName}
                </button>
                <strong>{scope === 'season' ? row.value.toFixed(1) : row.value} {unit}</strong>
                <span className="program-player-records__context">
                  {context(row, scope)}
                  {row.isLive ? <small className="records-panel__live">Live</small> : null}
                </span>
              </>
            ) : <span className="program-player-records__unavailable">No qualified record yet</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
