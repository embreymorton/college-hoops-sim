import type { PlayerCareerSeasonRow } from '../dynasty'
import { formatRating } from '../app/formatters'

interface PlayerCareerProgressionTableProps {
  readonly seasons: readonly PlayerCareerSeasonRow[]
}

function formatDevelopmentGain(gain: number | null): string {
  if (gain === null) {
    return '—'
  }

  return gain > 0 ? `+${gain}` : `${gain}`
}

/** Season-by-Season OVR, offseason development gain, and production — the Player's career story. */
export function PlayerCareerProgressionTable({
  seasons,
}: PlayerCareerProgressionTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table career-progression-table">
        <caption className="visually-hidden">Player career progression</caption>
        <thead>
          <tr>
            <th scope="col">Season</th>
            <th scope="col">Class</th>
            <th scope="col">Ovr</th>
            <th scope="col">Dev</th>
            <th scope="col">PPG</th>
            <th scope="col">RPG</th>
            <th scope="col">APG</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((row) => (
            <tr key={row.seasonNumber} data-active={row.isActive}>
              <td>
                {row.seasonNumber}
                {row.isActive ? <span className="career-progression-table__current"> (current)</span> : null}
              </td>
              <td>{row.classYear}</td>
              <td>{row.overall}</td>
              <td
                className="career-progression-table__dev"
                data-positive={row.developmentGain !== null && row.developmentGain > 0}
                data-negative={row.developmentGain !== null && row.developmentGain < 0}
              >
                {formatDevelopmentGain(row.developmentGain)}
              </td>
              <td>{formatRating(row.stats.pointsPerGame)}</td>
              <td>{formatRating(row.stats.reboundsPerGame)}</td>
              <td>{formatRating(row.stats.assistsPerGame)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
