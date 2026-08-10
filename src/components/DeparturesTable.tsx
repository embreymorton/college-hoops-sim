import { calculateOverall, type Player } from '../engine'

interface DeparturesTableProps {
  readonly programName: string
  readonly departures: readonly Player[]
}

/** Graduating Seniors leaving the Program — empty state when nobody graduated. */
export function DeparturesTable({ programName, departures }: DeparturesTableProps) {
  if (departures.length === 0) {
    return (
      <p className="league-empty-state">
        No Seniors graduated from {programName} this year.
      </p>
    )
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Graduating Seniors</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Pos</th>
            <th scope="col">Class</th>
            <th scope="col">Ovr</th>
          </tr>
        </thead>
        <tbody>
          {departures.map((player) => (
            <tr key={player.id}>
              <td className="player-name-cell">
                {player.firstName} {player.lastName}
              </td>
              <td>{player.position}</td>
              <td>{player.classYear}</td>
              <td>{calculateOverall(player)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
