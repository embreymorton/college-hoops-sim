export type RotationMode = 'simple' | 'advanced'

interface RotationModeTabsProps {
  readonly mode: RotationMode
  readonly onSelectMode: (mode: RotationMode) => void
}

/** Simple ↔ Advanced — which Rotation editor the Coaching Rotation tab shows. */
export function RotationModeTabs({ mode, onSelectMode }: RotationModeTabsProps) {
  return (
    <div role="group" aria-label="Rotation editor mode" className="tab-list">
      <button
        type="button"
        className="tab"
        aria-pressed={mode === 'simple'}
        onClick={() => onSelectMode('simple')}
      >
        Simple
      </button>
      <button
        type="button"
        className="tab"
        aria-pressed={mode === 'advanced'}
        onClick={() => onSelectMode('advanced')}
      >
        Advanced
      </button>
    </div>
  )
}
