interface HubSectionTabsProps {
  /** "Season" or "Tournament" — the Hub currently on screen. */
  readonly activeLabel: string
  readonly onSelectLeague: () => void
}

/** Lightweight Hub ↔ League switch; not a permanent app-wide navigation shell. */
export function HubSectionTabs({ activeLabel, onSelectLeague }: HubSectionTabsProps) {
  return (
    <div
      className="tab-list hub-section-tabs"
      role="group"
      aria-label="Section"
    >
      <span className="tab" aria-pressed="true">
        {activeLabel}
      </span>
      <button
        type="button"
        className="tab"
        aria-pressed="false"
        onClick={onSelectLeague}
      >
        League
      </button>
    </div>
  )
}
