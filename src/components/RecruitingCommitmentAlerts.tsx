import { formatControlledPositionLabel, formatReadinessLabel, type RecruitingPulseDescription } from '../app/recruitingBattleFormatters'

interface RecruitingCommitmentAlertsProps {
  readonly activity: readonly RecruitingPulseDescription[]
}

/**
 * A compact recap of what happened during the most recent progression /
 * simulation action — not an inbox notification. Commitments and at most two
 * other material market changes share this one ranked surface. There is deliberately no
 * Dismiss control: the caller replaces this activity on the next relevant
 * simulation boundary (`recruitingActivityBaselinePeriod` in the session
 * store), so a quiet later action naturally clears it without an explicit
 * acknowledgement step. Ephemeral movement is proven by the player-safe
 * transient pre-progression snapshot; canonical Recruiting remains unchanged.
 */
export function RecruitingCommitmentAlerts({ activity }: RecruitingCommitmentAlertsProps) {
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
      <p id="recruiting-commitment-alerts-heading" className="recruiting-commitment-alerts__heading">
        Recruiting Update · {activity.length} {activity.length === 1 ? 'Change' : 'Changes'}
      </p>
      <ul className="recruiting-commitment-alerts__list">
        {activity.map((entry) => (
          <li
            key={entry.playerId}
            className="recruiting-commitment-alert"
            data-kind={entry.kind}
          >
            {entry.kind === 'committed-to-controlled' ? (
              <>
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>{' '}
                committed to us
              </>
            ) : entry.kind === 'focused-committed-elsewhere' || entry.kind === 'tracked-committed-elsewhere' ? (
              <>
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>
                {' → '}
                {entry.programName}
              </>
            ) : entry.kind === 'readiness-escalated' ? (
              <><span className="recruiting-commitment-alert__name">{entry.playerName}</span>{' · '}{formatReadinessLabel(entry.to as Parameters<typeof formatReadinessLabel>[0])}</>
            ) : entry.kind === 'position-fell' || entry.kind === 'position-improved' ? (
              <><span className="recruiting-commitment-alert__name">{entry.playerName}</span>{' · '}{formatControlledPositionLabel(entry.from as Parameters<typeof formatControlledPositionLabel>[0])} → {formatControlledPositionLabel(entry.to as Parameters<typeof formatControlledPositionLabel>[0])}</>
            ) : entry.kind === 'new-offer' ? (
              <><span className="recruiting-commitment-alert__name">{entry.playerName}</span>{' · '}{entry.programName} made an Offer</>
            ) : entry.kind === 'major-competitor-entered' ? (
              <><span className="recruiting-commitment-alert__name">{entry.playerName}</span>{' · '}{entry.programName} entered the recruitment</>
            ) : (
              <><span className="recruiting-commitment-alert__name">{entry.playerName}</span>{' · '}{entry.from} → {entry.to} market</>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
