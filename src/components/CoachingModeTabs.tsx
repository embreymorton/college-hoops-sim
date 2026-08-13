export type CoachingMode = 'roster' | 'rotation'

interface CoachingModeTabsProps {
  readonly mode: CoachingMode
  readonly onSelectMode: (mode: CoachingMode) => void
}

/** Roster ↔ Rotation — Coaching's own internal mode switch. */
export function CoachingModeTabs({ mode, onSelectMode }: CoachingModeTabsProps) {
  return (
    <div role="group" aria-label="Coaching mode" className="tab-list">
      <button
        type="button"
        className="tab"
        aria-pressed={mode === 'roster'}
        onClick={() => onSelectMode('roster')}
      >
        Roster
      </button>
      <button
        type="button"
        className="tab"
        aria-pressed={mode === 'rotation'}
        onClick={() => onSelectMode('rotation')}
      >
        Rotation
      </button>
    </div>
  )
}
