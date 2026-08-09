import { formatRating } from '../app/formatters'
import type { TeamPlayerLeaders } from '../season'

interface TeamLeadersStripProps {
  readonly leaders: TeamPlayerLeaders
  readonly getPlayerName: (playerId: string) => string
  readonly onSelectPlayer: (playerId: string) => void
}

const ROWS = [
  { key: 'points', label: 'PPG' },
  { key: 'rebounds', label: 'RPG' },
  { key: 'assists', label: 'APG' },
] as const

/** A Program's top qualified scorer, rebounder, and assist producer. */
export function TeamLeadersStrip({
  leaders,
  getPlayerName,
  onSelectPlayer,
}: TeamLeadersStripProps) {
  const hasLeaders = ROWS.every(({ key }) => leaders[key] !== undefined)

  if (!hasLeaders) {
    return <p className="team-leaders__empty">No completed games yet.</p>
  }

  return (
    <div className="team-leaders">
      {ROWS.map(({ key, label }) => {
        const entry = leaders[key]!

        return (
          <button
            key={key}
            type="button"
            className="team-leaders__item"
            onClick={() => onSelectPlayer(entry.playerId)}
          >
            <span className="team-leaders__value">{formatRating(entry.value)}</span>
            <span className="team-leaders__unit">{label}</span>
            <span className="team-leaders__player">
              {getPlayerName(entry.playerId)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
