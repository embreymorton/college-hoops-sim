import type { CommitmentActivityDescription } from '../app/recruitingBattleFormatters'
import { formatRankLabel } from '../app/recruitingFormatters'
import { RecruitStars } from './RecruitStars'

interface RecruitingCommitmentAlertsProps {
  readonly activity: readonly CommitmentActivityDescription[]
  readonly onDismiss: () => void
}

/**
 * Difficult-to-miss commitment feedback for whatever happened across the
 * most recent Quick Sim / Super Sim simulation boundary. Only ever shows
 * commitment events the canonical selector already proves — no interest,
 * standing-movement, or "moved into first" language, because no historical
 * standing snapshots exist.
 */
export function RecruitingCommitmentAlerts({
  activity,
  onDismiss,
}: RecruitingCommitmentAlertsProps) {
  if (activity.length === 0) {
    return null
  }

  return (
    <section
      className="recruiting-commitment-alerts"
      role="status"
      aria-live="polite"
      aria-labelledby="recruiting-commitment-alerts-heading"
    >
      <div className="recruiting-commitment-alerts__header">
        <p id="recruiting-commitment-alerts-heading" className="eyebrow-tag">
          Recruiting Update
        </p>
        <button
          type="button"
          className="text-link-button recruiting-commitment-alerts__dismiss"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
      <ul className="recruiting-commitment-alerts__list">
        {activity.map((entry) => (
          <li
            key={entry.playerId}
            className="recruiting-commitment-alert"
            data-kind={entry.kind}
          >
            <span className="recruiting-commitment-alert__tag">
              {entry.kind === 'committed-to-controlled'
                ? 'Committed To Us'
                : 'Committed Elsewhere'}
            </span>
            {entry.wasFocused && (
              <span className="recruiting-commitment-alert__focus">
                Focus Target
              </span>
            )}
            <span className="recruiting-commitment-alert__name">
              {formatRankLabel(entry.nationalRank)} {entry.playerName} ·{' '}
              {entry.position} · <RecruitStars stars={entry.stars} />
            </span>
            {entry.kind === 'tracked-committed-elsewhere' && (
              <span className="recruiting-commitment-alert__detail">
                to {entry.programName}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
