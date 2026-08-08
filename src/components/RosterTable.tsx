import {
  calculateOverall,
  calculatePlayerDefense,
  calculatePlayerOffense,
  getPlayersByMinutes,
  type Rotation,
  type Team,
} from '../engine'
import { formatHeight, formatRating } from '../app/formatters'

interface RosterTableProps {
  readonly team: Team
  readonly rotation: Rotation
}

export function RosterTable({ team, rotation }: RosterTableProps) {
  const rows = getPlayersByMinutes(team, rotation)

  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">
          {`${team.name} roster and default rotation minutes`}
        </caption>
        <thead>
          <tr>
            <th scope="col">Pos</th>
            <th scope="col">Player</th>
            <th scope="col">Yr</th>
            <th scope="col">Ht</th>
            <th scope="col">Off</th>
            <th scope="col">Def</th>
            <th scope="col">Ovr</th>
            <th scope="col">Pot</th>
            <th scope="col">Min</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, minutes }) => (
            <tr
              key={player.id}
              data-player-id={player.id}
              data-zero-minutes={minutes === 0}
            >
              <td className="player-pos-cell">{player.position}</td>
              <td className="player-name-cell">
                {player.firstName} {player.lastName}
              </td>
              <td>{player.classYear}</td>
              <td>{formatHeight(player.height)}</td>
              <td>{formatRating(calculatePlayerOffense(player))}</td>
              <td>{formatRating(calculatePlayerDefense(player))}</td>
              <td>{calculateOverall(player)}</td>
              <td>{player.potential}</td>
              <td>{minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
