import { deriveDynastyRecordBook, type RecordCategory, type RecordScope } from '../dynasty'
import { useDynastyStore } from '../store'

const CATEGORIES: readonly RecordCategory[] = ['points', 'rebounds', 'assists', 'steals', 'blocks']
const LABELS: Record<RecordCategory, string> = { points: 'PTS', rebounds: 'REB', assists: 'AST', steals: 'STL', blocks: 'BLK' }

export function RecordsScreen() {
  const dynasty = useDynastyStore((s) => s.dynasty)!
  const scope = useDynastyStore((s) => s.recordScope)
  const category = useDynastyStore((s) => s.recordCategory)
  const setScope = useDynastyStore((s) => s.setRecordScope)
  const setCategory = useDynastyStore((s) => s.setRecordCategory)
  const openPlayer = useDynastyStore((s) => s.openPlayerDetails)
  const book = deriveDynastyRecordBook(dynasty, scope, category)
  const unit = scope === 'season' ? `${LABELS[category][0]}PG`.replace('RPG', 'RPG').replace('APG', 'APG').replace('SPG', 'SPG').replace('BPG', 'BPG') : LABELS[category]

  return <section className="records-screen" aria-labelledby="records-heading">
    <div className="records-selectors">
      <label>Record scope
        <select value={scope} onChange={(e) => setScope(e.target.value as RecordScope)}>
          <option value="game">Single Game</option><option value="season">Season</option><option value="career">Career</option>
        </select>
      </label>
      <label>Statistical category
        <select value={category} onChange={(e) => setCategory(e.target.value as RecordCategory)}>
          {CATEGORIES.map((key) => <option key={key} value={key}>{scope === 'season' ? ({ points: 'PPG', rebounds: 'RPG', assists: 'APG', steals: 'SPG', blocks: 'BPG' } as const)[key] : LABELS[key]}</option>)}
        </select>
      </label>
    </div>
    <h2 id="records-heading" className="section-title">Dynasty Record Book</h2>
    {book.entries.length === 0 ? <p className="league-empty-state">No completed Season records are available yet.</p> :
      <div className="records-table-wrap"><table className="data-table records-table">
        <caption className="visually-hidden">Top ten {unit} {scope} records</caption>
        <thead><tr><th>Rank</th><th>Player</th><th>{unit}</th><th>Program</th><th>Context</th></tr></thead>
        <tbody>{book.entries.map((row) => <tr key={`${row.rank}-${row.playerId}-${row.seasonNumber ?? 'career'}`}>
          <td>{row.rank}</td><td><button type="button" className="text-button" onClick={() => openPlayer(row.programId, row.playerId)}>{row.firstName} {row.lastName}</button></td>
          <td>{scope === 'season' ? row.value.toFixed(1) : row.value}</td><td>{row.programAbbreviation}</td>
          <td>{scope === 'game' ? `Season ${row.seasonNumber} · vs ${row.opponentProgramName}` : scope === 'season' ? `Season ${row.seasonNumber} · ${row.gamesPlayed} GP` : `${row.firstSeasonNumber === row.lastSeasonNumber ? `Season ${row.firstSeasonNumber}` : `Seasons ${row.firstSeasonNumber}–${row.lastSeasonNumber}`} · ${row.gamesPlayed} GP`}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>
}
