import type { ProgramPrestigeHistory as ProgramPrestigeHistoryProjection } from '../dynasty'

interface ProgramPrestigeHistoryProps {
  readonly history: ProgramPrestigeHistoryProjection
}

function signedChange(change: number): string {
  return change > 0 ? `+${change}` : String(change)
}

function rowChange(change: number): string {
  return change === 0 ? '—' : signedChange(change)
}

export function ProgramPrestigeHistory({ history }: ProgramPrestigeHistoryProps) {
  return (
    <div className="program-prestige-history">
      <div className="program-prestige-history__summary">
        <div>
          <span>Prestige</span>
          <strong>{history.currentPrestige}</strong>
        </div>
        <p>
          Started {history.startingPrestige} · {signedChange(history.dynastyChange)} Dynasty · Peak {history.peakPrestige}
        </p>
      </div>
      <details className="program-prestige-history__details">
        <summary>Season-by-Season Prestige</summary>
        <div className="program-prestige-history__table" role="table" aria-label="Season-by-Season Prestige">
          <div role="row" className="program-prestige-history__row program-prestige-history__row--header">
            <span role="columnheader">Season</span>
            <span role="columnheader">Prestige</span>
            <span role="columnheader">Change</span>
          </div>
          {history.rows.map((row) => (
            <div role="row" className="program-prestige-history__row" key={row.label}>
              <span role="cell">{row.label}{row.current ? ' · Current' : ''}</span>
              <span role="cell">{row.prestige}</span>
              <span role="cell">{row.change === null ? '—' : rowChange(row.change)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
