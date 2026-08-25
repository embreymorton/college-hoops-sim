import { RECRUITING_BOARD_LIMIT, type ProgramRecruitingBoard } from '../dynasty'
import { deriveRecruitingHubTotals } from '../app/recruitingFormatters'

interface RecruitingOverviewProps {
  readonly board: ProgramRecruitingBoard
  /** Condenses the stat row and Needs line onto one strip — used inside the Offseason shell, which already establishes context. */
  readonly compact?: boolean
}

/**
 * One compact snapshot of Board/Signed/Openings/Offers/Needs — replaces the
 * heavier Positional Needs ledger and the duplicate Board count that used to
 * sit beside Fill Remaining Board. Pure arithmetic over the existing
 * `ProgramRecruitingBoard` via `deriveRecruitingHubTotals`; derives nothing new.
 */
export function RecruitingOverview({ board, compact = false }: RecruitingOverviewProps) {
  const totals = deriveRecruitingHubTotals(board)

  return (
    <div className={compact ? 'recruiting-overview recruiting-overview--compact' : 'recruiting-overview'}>
      <dl className="recruiting-overview__stats">
        <div className="recruiting-overview__stat">
          <dt>Board</dt>
          <dd>
            {board.targets.length} / {RECRUITING_BOARD_LIMIT}
          </dd>
        </div>
        <div className="recruiting-overview__stat">
          <dt>Signed</dt>
          <dd>
            {totals.signedTotal} / {totals.projectedTotal}
          </dd>
        </div>
        <div className="recruiting-overview__stat">
          <dt>Openings</dt>
          <dd>{totals.remainingTotal}</dd>
        </div>
        <div className="recruiting-overview__stat">
          <dt>Offers</dt>
          <dd>
            {totals.offersTotal} / {totals.remainingTotal}
          </dd>
        </div>
      </dl>
      <p className="recruiting-overview__needs">
        <span className="recruiting-overview__needs-label">Required</span>
        {totals.needsByPosition.length > 0 ? (
          totals.needsByPosition
            .map(({ position, remaining }) => `${position} ${remaining}`)
            .join(' · ')
        ) : (
          <span className="recruiting-overview__needs-empty">None</span>
        )}
        <span className="recruiting-overview__capacity-divider" aria-hidden="true" />
        <span className="recruiting-overview__needs-label">Flexible</span>
        <strong className="recruiting-overview__capacity-value">{totals.flexibleTotal}</strong>
      </p>
    </div>
  )
}
