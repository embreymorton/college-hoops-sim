interface DynastyProgressionBarProps {
  readonly onContinue: () => void
}

/** Route-independent fallback for the mandatory Tournament lifecycle handoff. */
export function DynastyProgressionBar({ onContinue }: DynastyProgressionBarProps) {
  return (
    <aside className="dynasty-progression-bar" aria-label="Dynasty progression">
      <div>
        <p className="eyebrow-tag">Season Complete</p>
        <p className="dynasty-progression-bar__text">
          Tournament complete. Continue when you are ready.
        </p>
      </div>
      <button type="button" className="button button--primary" onClick={onContinue}>
        Continue → Late Recruiting
      </button>
    </aside>
  )
}
