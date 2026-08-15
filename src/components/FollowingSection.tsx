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
  const { totalFollowed, activePlayers, formerPlayers, unresolvedPlayerIds } =
    projection

  if (totalFollowed === 0) {
    return (
      <p className="league-empty-state">
        You haven&rsquo;t followed anyone yet. Follow a Player from his Player
        Details page to track him here.
      </p>
    )
  }

  if (activePlayers.length === 0 && formerPlayers.length === 0) {
    return (
      <p className="league-empty-state">
        {unresolvedPlayerIds.length === 1
          ? 'That followed Player is unavailable in this Dynasty.'
          : 'Those followed Players are unavailable in this Dynasty.'}
      </p>
    )
  }

  return (
    <div className="following-groups">
      {activePlayers.length > 0 ? (
        <section aria-labelledby="following-active-heading">
          <h2 id="following-active-heading" className="section-title">
            Active Players
          </h2>
          <div className="table-scroll">
            <table className="data-table">
              <caption className="visually-hidden">Followed active Players</caption>
              <thead>
                <tr>
                  <th scope="col">Player</th><th scope="col">Program</th>
                  <th scope="col">Pos</th><th scope="col">Cl</th>
                  <th scope="col">Ovr</th><th scope="col">PPG</th>
                  <th scope="col">RPG</th><th scope="col">APG</th>
                </tr>
              </thead>
              <tbody>
                {activePlayers.map((row) => (
                  <tr key={row.playerId} data-zero-minutes={row.seasonStats.gamesPlayed === 0}>
                    <td className="player-name-cell"><button type="button" className="text-link-button" onClick={() => onSelectPlayer(row.program.id, row.playerId)}>{row.player.firstName} {row.player.lastName}</button></td>
                    <td><button type="button" className="text-link-button" onClick={() => onSelectProgram(row.program.id)}>{row.program.name}</button></td>
                    <td className="player-pos-cell">{row.player.position}</td>
                    <td>{row.player.classYear}</td><td>{row.overall}</td>
                    <td>{formatRating(row.seasonStats.pointsPerGame)}</td>
                    <td>{formatRating(row.seasonStats.reboundsPerGame)}</td>
                    <td>{formatRating(row.seasonStats.assistsPerGame)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {formerPlayers.length > 0 ? (
        <section aria-labelledby="following-former-heading">
          <h2 id="following-former-heading" className="section-title">
            Former Players
          </h2>
          <div className="table-scroll">
            <table className="data-table data-table--former">
              <caption className="visually-hidden">Followed former Players</caption>
              <thead><tr><th scope="col">Player</th><th scope="col">Program</th><th scope="col">Pos</th><th scope="col">Career</th><th scope="col">Final Ovr</th><th scope="col">Career PPG</th></tr></thead>
              <tbody>
                {formerPlayers.map((row) => (
                  <tr key={row.playerId}>
                    <td className="player-name-cell"><button type="button" className="text-link-button" onClick={() => onSelectPlayer(row.program.id, row.playerId)}>{row.player.firstName} {row.player.lastName}</button></td>
                    <td><button type="button" className="text-link-button" onClick={() => onSelectProgram(row.program.id)}>{row.program.name}</button></td>
                    <td className="player-pos-cell">{row.player.position}</td>
                    <td className="following-career-cell">{row.firstSeasonNumber === row.lastSeasonNumber ? `Season ${row.firstSeasonNumber}` : `Seasons ${row.firstSeasonNumber}–${row.lastSeasonNumber}`}</td>
                    <td>{row.finalOverall}</td>
                    <td>{formatRating(row.careerPointsPerGame)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {unresolvedPlayerIds.length > 0 ? (
        <p className="following-unresolved-note">
          {unresolvedPlayerIds.length} followed Player
          {unresolvedPlayerIds.length === 1 ? ' is' : 's are'} unavailable in this Dynasty.
        </p>
      ) : null}
    </div>
  )
}
