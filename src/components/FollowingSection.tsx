import { formatRating } from '../app/formatters'
import type { FollowingViewProjection } from '../store'

interface FollowingSectionProps {
  readonly projection: FollowingViewProjection
  readonly onSelectPlayer: (programId: string, playerId: string) => void
  readonly onSelectProgram: (programId: string) => void
}

/** League → Following: a compact scan of the user's followed active Players. */
export function FollowingSection({
  projection,
  onSelectPlayer,
  onSelectProgram,
}: FollowingSectionProps) {
  const { totalFollowed, activePlayers, unresolvedPlayerIds } = projection

  if (totalFollowed === 0) {
    return (
      <p className="league-empty-state">
        You haven&rsquo;t followed anyone yet. Follow a Player from his Player
        Details page to track him here.
      </p>
    )
  }

  if (activePlayers.length === 0) {
    return (
      <p className="league-empty-state">
        The Player{unresolvedPlayerIds.length === 1 ? '' : 's'} you followed
        {unresolvedPlayerIds.length === 1 ? ' is' : ' are'} no longer active
        in the current universe.
      </p>
    )
  }

  return (
    <div>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="visually-hidden">Followed Players</caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Program</th>
              <th scope="col">Pos</th>
              <th scope="col">Cl</th>
              <th scope="col">Ovr</th>
              <th scope="col">PPG</th>
              <th scope="col">RPG</th>
              <th scope="col">APG</th>
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((row) => (
              <tr key={row.playerId} data-zero-minutes={row.seasonStats.gamesPlayed === 0}>
                <td className="player-name-cell">
                  <button
                    type="button"
                    className="text-link-button"
                    onClick={() => onSelectPlayer(row.program.id, row.playerId)}
                  >
                    {row.player.firstName} {row.player.lastName}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="text-link-button"
                    onClick={() => onSelectProgram(row.program.id)}
                  >
                    {row.program.name}
                  </button>
                </td>
                <td className="player-pos-cell">{row.player.position}</td>
                <td>{row.player.classYear}</td>
                <td>{row.overall}</td>
                <td>{formatRating(row.seasonStats.pointsPerGame)}</td>
                <td>{formatRating(row.seasonStats.reboundsPerGame)}</td>
                <td>{formatRating(row.seasonStats.assistsPerGame)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unresolvedPlayerIds.length > 0 ? (
        <p className="following-unresolved-note">
          {unresolvedPlayerIds.length} followed Player
          {unresolvedPlayerIds.length === 1 ? '' : 's'} no longer active.
        </p>
      ) : null}
    </div>
  )
}
