import { formatPercentage, formatRating, formatSignedRating } from '../app/formatters'
import type { TeamSeasonStats } from '../season'

interface TeamAveragesProps {
  readonly stats: TeamSeasonStats
}

/** Compact regular-season Team rates, using the established score/stat hierarchy. */
export function TeamAverages({ stats }: TeamAveragesProps) {
  const rows = [
    { label: 'PPG', value: formatRating(stats.pointsPerGame) },
    { label: 'Opp PPG', value: formatRating(stats.opponentPointsPerGame) },
    { label: 'Margin', value: formatSignedRating(stats.pointDifferentialPerGame) },
    { label: 'RPG', value: formatRating(stats.reboundsPerGame) },
    { label: 'APG', value: formatRating(stats.assistsPerGame) },
    { label: 'TOPG', value: formatRating(stats.turnoversPerGame) },
    { label: 'FG', value: formatPercentage(stats.fieldGoalPercentage) },
    { label: '3P', value: formatPercentage(stats.threePointPercentage) },
    { label: 'FT', value: formatPercentage(stats.freeThrowPercentage) },
  ]

  return (
    <div className="team-averages">
      {rows.map((row) => (
        <div key={row.label} className="stat-trio__item">
          <span className="stat-trio__value">{row.value}</span>
          <span className="stat-trio__label">{row.label}</span>
        </div>
      ))}
    </div>
  )
}
