import { calculateOverall } from '../engine'
import {
  formatSeniorCareerContext,
  type DepartureRow,
} from '../app/offseasonFormatters'

interface DeparturesTableProps {
  readonly programName: string
  readonly departures: readonly DepartureRow[]
}

/** Graduating Seniors leaving the Program — empty state when nobody graduated. */
export function DeparturesTable({ programName, departures }: DeparturesTableProps) {
  if (departures.length === 0) {
    return (
      <p className="league-empty-state">
        No Seniors graduated from {programName} this year.
      </p>
    )
  }

  return (
    <div className="table-scroll">
      <table className="data-table departures-table">
        <caption className="visually-hidden">Graduating Seniors</caption>
        <colgroup>
          <col className="departures-table__player" />
          <col className="departures-table__position" />
          <col className="departures-table__overall" />
          <col className="departures-table__career" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Pos</th>
            <th scope="col">Ovr</th>
            <th scope="col">Career</th>
          </tr>
        </thead>
        <tbody>
          {departures.map(({ player, seniorCareer }) => (
            <tr key={player.id}>
              <td className="player-name-cell">
                {player.firstName} {player.lastName}
              </td>
              <td>{player.position}</td>
              <td>{calculateOverall(player)}</td>
              <td className="departure-career">
                {seniorCareer
                  ? formatSeniorCareerContext(seniorCareer, programName)
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
