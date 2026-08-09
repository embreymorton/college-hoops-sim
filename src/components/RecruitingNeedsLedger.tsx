import { POSITIONS } from '../engine'
import { RECRUITING_BOARD_LIMIT, type ProgramRecruitingBoard } from '../dynasty'

interface RecruitingNeedsLedgerProps {
  readonly board: ProgramRecruitingBoard
}

/** Positional openings, signed counts, and active-offer capacity — the Recruiting page's signature ledger. */
export function RecruitingNeedsLedger({ board }: RecruitingNeedsLedgerProps) {
  const projectedTotal = POSITIONS.reduce(
    (sum, position) => sum + board.projectedOpeningsByPosition[position],
    0,
  )
  const remainingTotal = POSITIONS.reduce(
    (sum, position) => sum + board.remainingOpeningsByPosition[position],
    0,
  )
  const signedTotal = projectedTotal - remainingTotal

  return (
    <div className="recruiting-needs">
      <div className="table-scroll">
        <table className="data-table recruiting-needs__table">
          <caption className="visually-hidden">Positional recruiting needs</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Metric</span>
              </th>
              {POSITIONS.map((position) => (
                <th key={position} scope="col">
                  {position}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Openings</th>
              {POSITIONS.map((position) => (
                <td key={position}>{board.remainingOpeningsByPosition[position]}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Signed</th>
              {POSITIONS.map((position) => {
                const projected = board.projectedOpeningsByPosition[position]
                const remaining = board.remainingOpeningsByPosition[position]
                return (
                  <td key={position}>
                    {projected === 0 ? '—' : `${projected - remaining}/${projected}`}
                  </td>
                )
              })}
            </tr>
            <tr>
              <th scope="row">Offers</th>
              {POSITIONS.map((position) => {
                const remaining = board.remainingOpeningsByPosition[position]
                return (
                  <td key={position}>
                    {remaining === 0
                      ? '—'
                      : `${board.activeOfferCountsByPosition[position]}/${remaining}`}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="stat-trio recruiting-needs__summary">
        <div className="stat-trio__item">
          <span className="stat-trio__value">
            {board.targets.length}/{RECRUITING_BOARD_LIMIT}
          </span>
          <span className="stat-trio__label">Board</span>
        </div>
        <div className="stat-trio__item">
          <span className="stat-trio__value">
            {signedTotal}/{projectedTotal}
          </span>
          <span className="stat-trio__label">Signed</span>
        </div>
        <div className="stat-trio__item">
          <span className="stat-trio__value">{remainingTotal}</span>
          <span className="stat-trio__label">Openings</span>
        </div>
      </div>

      {remainingTotal === 0 && (
        <p className="section-hint">All positional needs are currently filled.</p>
      )}
    </div>
  )
}
