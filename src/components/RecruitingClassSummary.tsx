import { calculateOverall } from '../engine'
import {
  formatAverage,
  formatCommitTimingLabel,
  type ClassAverages,
  type IncomingRecruitRow,
  type PositionCounts,
} from '../app/offseasonFormatters'
import { formatRankLabel } from '../app/recruitingFormatters'
import { RecruitStars } from './RecruitStars'

interface RecruitingClassSummaryProps {
  readonly programName: string
  readonly targetSeasonNumber: number
  readonly signees: readonly IncomingRecruitRow[]
  readonly averages: ClassAverages
  readonly positionCounts: readonly PositionCounts[]
  readonly onBeginOffseason: () => void
  readonly embedded?: boolean
}

/** The season-long Recruiting payoff: the finalized, archived incoming class. */
export function RecruitingClassSummary({
  programName,
  targetSeasonNumber,
  signees,
  averages,
  positionCounts,
  onBeginOffseason,
  embedded = false,
}: RecruitingClassSummaryProps) {
  return (
    <div className="recruiting-class-summary">
      {!embedded && <div className="season-header recruiting-class-summary__header">
        <div>
          <p className="eyebrow-tag">Recruiting Class Complete</p>
          <h1 className="season-header__name">{programName}</h1>
          <p className="season-header__meta">Class of Season {targetSeasonNumber}</p>
        </div>
        <div className="stat-trio recruiting-class-summary__stats">
          <div className="stat-trio__item">
            <span className="stat-trio__value">{averages.signeeCount}</span>
            <span className="stat-trio__label">Signees</span>
          </div>
          <div className="stat-trio__item">
            <span className="stat-trio__value">{formatAverage(averages.averageOverall)}</span>
            <span className="stat-trio__label">Avg Ovr</span>
          </div>
          <div className="stat-trio__item">
            <span className="stat-trio__value">{formatAverage(averages.averagePotential)}</span>
            <span className="stat-trio__label">Avg Pot</span>
          </div>
        </div>
      </div>}

      {signees.length === 0 ? (
        <p className="league-empty-state">
          No Recruits signed with {programName} this class.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table recruiting-class-summary__table">
            <caption className="visually-hidden">Signed recruiting class</caption>
            <thead>
              <tr>
                <th scope="col">Rk</th>
                <th scope="col">Player</th>
                <th scope="col">Stars</th>
                <th scope="col">Ovr</th>
                <th scope="col">Pot</th>
                <th scope="col">Commit Timing</th>
              </tr>
            </thead>
            <tbody>
              {signees.map(({ recruit, timing }) => (
                <tr key={recruit.player.id}>
                  <td>{formatRankLabel(recruit.nationalRank)}</td>
                  <td className="player-name-cell">
                    {recruit.player.firstName} {recruit.player.lastName}
                    <span className="leader-board__pos">{recruit.player.position}</span>
                  </td>
                  <td>
                    <RecruitStars stars={recruit.stars} />
                  </td>
                  <td>{calculateOverall(recruit.player)}</td>
                  <td>{recruit.player.potential}</td>
                  <td>{formatCommitTimingLabel(timing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="recruiting-class-summary__positions">
        <p className="recruiting-hub-summary__needs-label">Signed by Position</p>
        <div className="table-scroll">
          <table className="data-table recruiting-needs__table">
            <caption className="visually-hidden">Signed class by position</caption>
            <thead>
              <tr>
                {positionCounts.map(({ position }) => (
                  <th key={position} scope="col">
                    {position}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {positionCounts.map(({ position, count }) => (
                  <td key={position}>{count === 0 ? '—' : count}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {!embedded && <div className="recruiting-class-summary__action">
        <button type="button" className="button button--primary" onClick={onBeginOffseason}>
          Begin Offseason
        </button>
      </div>}
    </div>
  )
}
