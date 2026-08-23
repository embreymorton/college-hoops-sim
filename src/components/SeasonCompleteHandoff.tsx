interface SeasonCompleteHandoffProps {
  readonly onContinue: () => void
}

/**
 * The final-inspection checkpoint directly beneath the Tournament outcome
 * banner in the same lifecycle column. Deliberately quieter than that
 * banner — it confirms the Season is complete and hands the Dynasty off to
 * Late Recruiting without restating the Tournament result above it.
 */
export function SeasonCompleteHandoff({ onContinue }: SeasonCompleteHandoffProps) {
  return (
    <div className="season-complete-panel season-complete-panel--secondary">
      <p className="eyebrow-tag">Season Complete</p>
      <p className="season-complete-panel__body">
        One final Recruiting window remains before the Season turns over to
        the Offseason.
      </p>
      <button
        type="button"
        className="button button--primary season-complete-panel__action"
        onClick={onContinue}
      >
        Begin Offseason
      </button>
    </div>
  )
}
