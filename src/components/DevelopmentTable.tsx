import type { DevelopmentRow } from '../app/offseasonFormatters'

interface DevelopmentTableProps {
  readonly rows: readonly DevelopmentRow[]
}

/** Returning Players' before/after development — the Offseason's strongest section. */
export function DevelopmentTable({ rows }: DevelopmentTableProps) {
  if (rows.length === 0) {
    return <p className="league-empty-state">No returning Players to develop.</p>
  }

  return (
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
            <th scope="col">Pot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, summary }) => (
            <tr key={player.id}>
              <td className="player-name-cell">
                {player.firstName} {player.lastName}
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
              <td>{player.potential}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
