import { formatReadinessLabel, type RecruitingPulseDescription } from '../app/recruitingBattleFormatters'

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
                committed to us.
              </>
            ) : entry.kind === 'focused-committed-elsewhere' || entry.kind === 'tracked-committed-elsewhere' ? (
              <>
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>{' '}
                committed to {entry.programName}.
              </>
            ) : entry.kind === 'readiness-escalated' ? (
              <>
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>{' '}
                {entry.to === 'decision-imminent'
                  ? 'is nearing a decision.'
                  : entry.to === 'decision-soon'
                    ? 'will decide soon.'
                    : `is now a ${formatReadinessLabel(entry.to as Parameters<typeof formatReadinessLabel>[0]).toLowerCase()}.`}
              </>
            ) : entry.kind === 'position-improved' ? (
              <>
                You moved into {entry.to === 'leading' ? 'the lead' : 'contention'} for{' '}
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>.
              </>
            ) : entry.kind === 'position-fell' ? (
              <>
                You {entry.to === 'trailing' ? 'fell behind' : 'slipped to competitive'} for{' '}
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>.
              </>
            ) : entry.kind === 'new-offer' ? (
              <>
                {entry.programName} offered{' '}
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>.
              </>
            ) : entry.kind === 'major-competitor-entered' ? (
              <>
                {entry.programName} entered the race for{' '}
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>.
              </>
            ) : (
              <>
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>
                {"'s recruitment is now "}{entry.to}.
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
