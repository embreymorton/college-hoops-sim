import type { RecruitingPositionNeed } from '../app/recruitingFormatters'

interface RecruitingBoardEmptyStateProps {
  readonly lastResolvedPeriod: number
  readonly needsByPosition: readonly RecruitingPositionNeed[]
  readonly remainingTotal: number
  readonly mandatoryTotal: number
  readonly flexibleTotal: number
  readonly onGenerateDraftBoard: () => void
  readonly onFillRemainingBoard: () => void
  readonly onBrowseNationalClass: () => void
}

function formatNeedsList(needs: readonly RecruitingPositionNeed[]): string {
  return needs.map(({ position, remaining }) => `${position} ${remaining}`).join('   ')
}

/**
 * Replaces the Board table entirely while the controlled Program's board has
 * no targets. Preseason gets full onboarding; an empty board later in the
 * Season gets a lighter, non-alarming resume prompt — 6B.1 intentionally
 * permits an empty board after Period 1.
 */
export function RecruitingBoardEmptyState({
  lastResolvedPeriod,
  needsByPosition,
  remainingTotal,
  mandatoryTotal,
  flexibleTotal,
  onGenerateDraftBoard,
  onFillRemainingBoard,
  onBrowseNationalClass,
}: RecruitingBoardEmptyStateProps) {
  if (lastResolvedPeriod > 0) {
    return (
      <div className="recruiting-board-empty">
        <p className="recruiting-board-empty__title">No Active Targets</p>
        <p className="recruiting-board-empty__body">
          Your recruiting board is currently empty. Add recruits from the National Class to
          resume recruiting.
        </p>
        <div className="recruiting-board-empty__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={onFillRemainingBoard}
          >
            Fill Remaining Board
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onBrowseNationalClass}
          >
            Browse National Class
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="recruiting-board-empty">
      <p className="recruiting-board-empty__title">Your Recruiting Board</p>
      <p className="recruiting-board-empty__body">
        {remainingTotal} {remainingTotal === 1 ? 'scholarship' : 'scholarships'} available ·{' '}
        {mandatoryTotal} required · {flexibleTotal} flexible
      </p>
      {needsByPosition.length > 0 && (
        <p className="recruiting-board-empty__needs">
          <span>Required:</span> {formatNeedsList(needsByPosition)}
        </p>
      )}
      <p className="recruiting-board-empty__body">
        Build your board from the national class, or generate a suggested one.
      </p>
      <div className="recruiting-board-empty__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={onGenerateDraftBoard}
        >
          Generate Draft Board
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={onFillRemainingBoard}
        >
          Fill Remaining Board
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={onBrowseNationalClass}
        >
          Browse National Class
        </button>
      </div>
    </div>
  )
}
