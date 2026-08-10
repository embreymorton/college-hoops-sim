interface SeasonCompleteHandoffProps {
  readonly onContinue: () => void
}

/**
 * The end-of-tournament continuation panel. Deliberately quieter than the
 * championship/elimination banner above it — it hands the Dynasty off to
 * Late Recruiting without competing with that result.
 */
export function SeasonCompleteHandoff({ onContinue }: SeasonCompleteHandoffProps) {
  return (
    <section
      className="season-complete-panel season-complete-panel--secondary"
      aria-labelledby="season-complete-handoff-heading"
    >
      <p id="season-complete-handoff-heading" className="eyebrow-tag">
        Season Complete
      </p>
      <p className="season-complete-panel__body">
        The national tournament is over. One final recruiting window remains
        before the offseason.
      </p>
      <button
        type="button"
        className="button button--primary season-complete-panel__action"
        onClick={onContinue}
      >
        Continue to Late Recruiting
      </button>
    </section>
  )
}
