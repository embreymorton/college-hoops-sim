import type { RecruitingMode } from '../store'

export type { RecruitingMode } from '../store'

interface RecruitingModeTabsProps {
  readonly mode: RecruitingMode
  readonly onSelectMode: (mode: RecruitingMode) => void
}

/** Recruiting's compact sibling-mode switch; root navigation still defaults to Board. */
export function RecruitingModeTabs({ mode, onSelectMode }: RecruitingModeTabsProps) {
  return (
    <div
      role="group"
      aria-label="Recruiting mode"
      className="tab-list recruiting-mode-tabs"
    >
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
        aria-pressed={mode === 'battles'}
        onClick={() => onSelectMode('battles')}
      >
        Battles
      </button>
      <button
        type="button"
        className="tab"
        aria-pressed={mode === 'national'}
        onClick={() => onSelectMode('national')}
      >
        National Class
      </button>
      <button
        type="button"
        className="tab"
        aria-pressed={mode === 'following'}
        onClick={() => onSelectMode('following')}
      >
        Following
      </button>
      <button
        type="button"
        className="tab"
        aria-pressed={mode === 'guide'}
        onClick={() => onSelectMode('guide')}
      >
        Guide
      </button>
    </div>
  )
}
