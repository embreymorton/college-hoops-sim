import { calculateOverall, type Player } from '../engine'

export interface NextSeasonRosterRow {
  readonly player: Player
  readonly status: 'returning' | 'incoming'
}

interface NextSeasonRosterTableProps {
  readonly rows: readonly NextSeasonRosterRow[]
}

/** The assembled 12-player roster that becomes the next Season's Team. */
export function NextSeasonRosterTable({ rows }: NextSeasonRosterTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Next season roster</caption>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Pos</th>
            <th scope="col">Class</th>
            <th scope="col">Ovr</th>
            <th scope="col">Pot</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, status }) => (
            <tr key={player.id} data-status={status}>
              <td className="player-name-cell">
                {player.firstName} {player.lastName}
              </td>
              <td>{player.position}</td>
              <td>{player.classYear}</td>
              <td>{calculateOverall(player)}</td>
              <td>{player.potential}</td>
              <td className="next-season-roster-table__status">
                {status === 'returning' ? 'Returning' : 'Incoming'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
