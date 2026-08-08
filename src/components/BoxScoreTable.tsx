import type { Player, PlayerGameStats, Team } from '../engine'
import { formatShootingLine } from '../app/formatters'

interface BoxScoreTableProps {
  readonly team: Team
  readonly stats: readonly PlayerGameStats[]
}

interface BoxScoreRow {
  readonly player: Player
  readonly stats: PlayerGameStats
}

export function BoxScoreTable({ team, stats }: BoxScoreTableProps) {
  const statsByPlayerId = new Map(
    stats.map((playerStats) => [playerStats.playerId, playerStats] as const),
  )
  const rows: BoxScoreRow[] = team.roster
    .map((player): BoxScoreRow | null => {
      const playerStats = statsByPlayerId.get(player.id)
      return playerStats ? { player, stats: playerStats } : null
    })
    .filter((row): row is BoxScoreRow => row !== null)
    .sort(
      (first, second) =>
        second.stats.minutes - first.stats.minutes ||
        second.stats.points - first.stats.points ||
        first.player.id.localeCompare(second.player.id),
    )

  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">
          {`${team.name} player box score`}
        </caption>
        <thead>
          <tr>
            <th scope="col">Pos</th>
            <th scope="col">Player</th>
            <th scope="col">Min</th>
            <th scope="col">Pts</th>
            <th scope="col">Reb</th>
            <th scope="col">Ast</th>
            <th scope="col">Stl</th>
            <th scope="col">Blk</th>
            <th scope="col">To</th>
            <th scope="col">Fg</th>
            <th scope="col">3pt</th>
            <th scope="col">Ft</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, stats: row }) => (
            <tr
              key={player.id}
              data-player-id={player.id}
              data-zero-minutes={row.minutes === 0}
            >
              <td className="player-pos-cell">{player.position}</td>
              <td className="player-name-cell">
                {player.firstName} {player.lastName}
              </td>
              <td>{row.minutes}</td>
              <td>{row.points}</td>
              <td>{row.rebounds}</td>
              <td>{row.assists}</td>
              <td>{row.steals}</td>
              <td>{row.blocks}</td>
              <td>{row.turnovers}</td>
              <td>{formatShootingLine(row.fieldGoalsMade, row.fieldGoalsAttempted)}</td>
              <td>
                {formatShootingLine(
                  row.threePointersMade,
                  row.threePointersAttempted,
                )}
              </td>
              <td>{formatShootingLine(row.freeThrowsMade, row.freeThrowsAttempted)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
