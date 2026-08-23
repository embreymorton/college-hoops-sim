import { formatDevelopmentGains, type DevelopmentRow } from '../app/offseasonFormatters'

interface DevelopmentTableProps {
  readonly rows: readonly DevelopmentRow[]
  readonly biggestLeap: DevelopmentRow | null
}

/** Returning Players' before/after development — the Offseason's strongest section. */
export function DevelopmentTable({ rows, biggestLeap }: DevelopmentTableProps) {
  if (rows.length === 0) {
    return <p className="league-empty-state">No returning Players to develop.</p>
  }

  const biggestLeapLabel = biggestLeap?.explosion
    ? 'Explosive Offseason'
    : 'Biggest Leap'

  return (
    <>
      {biggestLeap && (
        <div className="biggest-leap" aria-label="Biggest Leap">
          <div className="biggest-leap__identity">
            <p className="biggest-leap__eyebrow">{biggestLeapLabel}</p>
            <p className="biggest-leap__name">
              {biggestLeap.player.firstName} {biggestLeap.player.lastName}
              <span className="biggest-leap__position">{biggestLeap.player.position}</span>
            </p>
          </div>
          <div className="biggest-leap__score">
            <span className="biggest-leap__ovr-prev">{biggestLeap.summary.previousOverall}</span>
            <span className="biggest-leap__arrow" aria-hidden="true">→</span>
            <span className="biggest-leap__ovr-curr">{biggestLeap.summary.currentOverall}</span>
            <span className="biggest-leap__delta">+{biggestLeap.summary.overallChange}</span>
          </div>
          <p className="biggest-leap__gains">
            {formatDevelopmentGains(biggestLeap.gains)}
          </p>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table development-table">
        <caption className="visually-hidden">Returning Player development</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Pos</th>
            <th scope="col">New Class</th>
            <th scope="col">Old Ovr</th>
            <th scope="col">New Ovr</th>
            <th scope="col">Change</th>
            <th scope="col">Top Gains</th>
            <th scope="col">Pot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, summary, gains, explosion, workEthicReveal }) => (
            <tr key={player.id} data-explosive={explosion !== null}>
              <td className="player-name-cell">
                {player.firstName} {player.lastName}
                {explosion ? <span className="development-table__explosion">Explosive Offseason</span> : null}
                {workEthicReveal ? <span className="development-table__work-ethic">Work Ethic Revealed: {workEthicReveal}</span> : null}
              </td>
              <td>{player.position}</td>
              <td>{summary.nextClass}</td>
              <td>{summary.previousOverall}</td>
              <td>{summary.currentOverall}</td>
              <td
                className="development-table__change"
                data-positive={summary.overallChange > 0}
              >
                {summary.overallChange > 0 ? `+${summary.overallChange}` : summary.overallChange}
              </td>
              <td className="development-gains">
                {formatDevelopmentGains(gains) || '—'}
              </td>
              <td>{player.potential}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </>
  )
}
