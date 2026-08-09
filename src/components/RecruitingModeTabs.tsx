export type RecruitingMode = 'board' | 'national'

interface RecruitingModeTabsProps {
  readonly mode: RecruitingMode
  readonly onSelectMode: (mode: RecruitingMode) => void
}

/** Board ↔ National Class — the Recruiting view's own internal mode switch. */
export function RecruitingModeTabs({ mode, onSelectMode }: RecruitingModeTabsProps) {
  return (
    <div role="group" aria-label="Recruiting mode" className="tab-list">
      <button
        type="button"
        className="tab"
        aria-pressed={mode === 'board'}
        onClick={() => onSelectMode('board')}
      >
        Board
      </button>
      <button
        type="button"
        className="tab"
        aria-pressed={mode === 'national'}
        onClick={() => onSelectMode('national')}
      >
        National Class
      </button>
    </div>
  )
}
