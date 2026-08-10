import { calculateOverall } from '../engine'
import type { IncomingRecruitRow } from '../app/offseasonFormatters'
import { formatRankLabel } from '../app/recruitingFormatters'
import { RecruitStars } from './RecruitStars'

interface IncomingClassTableProps {
  readonly programName: string
  readonly rows: readonly IncomingRecruitRow[]
}

/** The finalized incoming class, connecting back to the completed Recruiting summary. */
export function IncomingClassTable({ programName, rows }: IncomingClassTableProps) {
  if (rows.length === 0) {
    return (
      <p className="league-empty-state">
        No Recruits signed with {programName} this class.
      </p>
    )
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">Incoming recruiting class</caption>
        <thead>
          <tr>
            <th scope="col">Rk</th>
            <th scope="col">Player</th>
            <th scope="col">Pos</th>
            <th scope="col">Stars</th>
            <th scope="col">Ovr</th>
            <th scope="col">Pot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ recruit }) => (
            <tr key={recruit.player.id}>
              <td>{formatRankLabel(recruit.nationalRank)}</td>
              <td className="player-name-cell">
                {recruit.player.firstName} {recruit.player.lastName}
              </td>
              <td>{recruit.player.position}</td>
              <td>
                <RecruitStars stars={recruit.stars} />
              </td>
              <td>{calculateOverall(recruit.player)}</td>
              <td>{recruit.player.potential}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
