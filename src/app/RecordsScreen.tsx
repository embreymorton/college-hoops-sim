import { useMemo, useState } from 'react'
import {
  deriveDynastyRecordBook,
  deriveTournamentRecordBook,
  RECORD_CATEGORIES,
  type RecordBookEntry,
  type RecordCategory,
} from '../dynasty'
import { useDynastyStore } from '../store'

const LABELS: Record<RecordCategory, string> = {
  points: 'PTS', rebounds: 'REB', assists: 'AST', steals: 'STL', blocks: 'BLK',
}
const RATE_LABELS: Record<RecordCategory, string> = {
  points: 'PPG', rebounds: 'RPG', assists: 'APG', steals: 'SPG', blocks: 'BPG',
}

interface RecordPanelProps {
  readonly title: string
  readonly unit: string
  readonly rows: readonly RecordBookEntry[]
  readonly kind: 'game' | 'season' | 'tournament-run' | 'career'
  readonly onSelectPlayer: (programId: string, playerId: string) => void
}

function context(row: RecordBookEntry, kind: RecordPanelProps['kind']): string {
  if (kind === 'game') return `S${row.seasonNumber} · vs ${row.opponentProgramName}`
  if (kind === 'season' || kind === 'tournament-run') return `S${row.seasonNumber} · ${row.gamesPlayed} GP`
  const span = row.firstSeasonNumber === row.lastSeasonNumber
    ? `S${row.firstSeasonNumber}`
    : `S${row.firstSeasonNumber}–${row.lastSeasonNumber}`
  return `${span} · ${row.gamesPlayed} GP`
}

function RecordPanel({ title, unit, rows, kind, onSelectPlayer }: RecordPanelProps) {
  return <article className="leader-board records-panel">
    <div className="leader-board__header">
      <span className="leader-board__title">{title}</span>
      <span className="leader-board__unit">{unit}</span>
    </div>
    {rows.length === 0 ? <p className="league-empty-state">No completed Season records yet.</p> :
      <div className="table-scroll"><table className="data-table leader-board__table records-panel__table">
        <caption className="visually-hidden">Top ten {title} {unit} records</caption>
        <thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Program</th><th scope="col">{unit}</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.rank}-${row.playerId}-${row.seasonNumber ?? 'career'}-${row.opponentProgramName ?? ''}`}>
          <td className="leader-board__rank">{row.rank}</td>
          <td className="player-name-cell">
            <button type="button" className="text-link-button" onClick={() => onSelectPlayer(row.programId, row.playerId)}>{row.firstName} {row.lastName}</button>
            <span className="records-panel__context">{context(row, kind)}{row.isLive ? <span className="records-panel__live">Live</span> : null}</span>
          </td>
          <td title={row.programName}>{row.programAbbreviation}</td>
          <td>{kind === 'season' ? row.value.toFixed(1) : row.value}</td>
        </tr>)}</tbody>
      </table></div>}
  </article>
}

export function RecordsScreen() {
  const [scope, setScope] = useState<'regular-season' | 'tournament'>('regular-season')
  const history = useDynastyStore((state) => state.dynasty!.history)
  const universe = useDynastyStore((state) => state.dynasty!.universe)
  const activeSeason = useDynastyStore((state) => state.dynasty!.activeSeason)
  const activePostseason = useDynastyStore((state) => state.dynasty!.activePostseason)
  const category = useDynastyStore((state) => state.recordCategory)
  const setCategory = useDynastyStore((state) => state.setRecordCategory)
  const openPlayer = useDynastyStore((state) => state.openPlayerDetails)
  const recordBook = useMemo(
    () => deriveDynastyRecordBook({ history, universe, activeSeason }),
    [history, universe, activeSeason],
  )
  const tournamentBook = useMemo(
    () => deriveTournamentRecordBook({ history, universe, activeSeason, activePostseason }),
    [history, universe, activeSeason, activePostseason],
  )
  const selected = recordBook[category]
  const selectedTournament = tournamentBook[category]

  return <section className="records-screen" aria-labelledby="records-heading">
    <header className="records-screen__header">
      <div className="records-screen__title"><h2 id="records-heading" className="section-title">Dynasty Record Book</h2><p className="section-hint">{scope === 'regular-season' ? 'Regular-season records across your Dynasty, including the current Season.' : 'Tournament records across completed games in your Dynasty.'}</p></div>
      <div role="group" aria-label="Record scope" className="tab-list records-screen__scope-tabs">
        <button type="button" className="tab" aria-pressed={scope === 'regular-season'} onClick={() => setScope('regular-season')}>Regular Season</button>
        <button type="button" className="tab" aria-pressed={scope === 'tournament'} onClick={() => setScope('tournament')}>Tournament</button>
      </div>
      <div role="group" aria-label="Statistical category" className="tab-list records-category-tabs">
        {RECORD_CATEGORIES.map((key) => <button key={key} type="button" className="tab" aria-pressed={category === key} onClick={() => setCategory(key)}>{LABELS[key]}</button>)}
      </div>
    </header>
    <div className="records-panel-grid">
      <RecordPanel title="Single Game" unit={LABELS[category]} rows={scope === 'regular-season' ? selected.singleGame : selectedTournament.singleGame} kind="game" onSelectPlayer={openPlayer} />
      {scope === 'regular-season'
        ? <RecordPanel title="Single Season" unit={RATE_LABELS[category]} rows={selected.singleSeason} kind="season" onSelectPlayer={openPlayer} />
        : <RecordPanel title="Tournament Run" unit={LABELS[category]} rows={selectedTournament.tournamentRun} kind="tournament-run" onSelectPlayer={openPlayer} />}
      <RecordPanel title="Career" unit={LABELS[category]} rows={scope === 'regular-season' ? selected.career : selectedTournament.career} kind="career" onSelectPlayer={openPlayer} />
    </div>
  </section>
}
