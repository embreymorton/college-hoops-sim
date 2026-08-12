import type { CommitmentActivityDescription } from '../app/recruitingBattleFormatters'

interface RecruitingCommitmentAlertsProps {
  readonly activity: readonly CommitmentActivityDescription[]
}

/**
 * A compact recap of what happened during the most recent progression /
 * simulation action — not an inbox notification. There is deliberately no
 * Dismiss control: the caller replaces this activity on the next relevant
 * simulation boundary (`recruitingActivityBaselinePeriod` in the session
 * store), so a quiet later action naturally clears it without an explicit
 * acknowledgement step. Only ever shows commitment events the canonical
 * selector already proves — no interest, standing-movement, or "moved into
 * first" language, because no historical standing snapshots exist.
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
        Recruiting Update · {activity.length} {activity.length === 1 ? 'Decision' : 'Decisions'}
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
            ) : (
              <>
                <span className="recruiting-commitment-alert__name">{entry.playerName}</span>
                {' → '}
                {entry.programName}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
