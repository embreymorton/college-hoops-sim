import type { StandingRow } from '../season'
import type { ProgramDefinition } from '../universe'
import { formatRecord } from '../app/seasonFormatters'

interface StandingsTableProps {
  readonly rows: readonly StandingRow[]
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly controlledProgramId: string
}

/** One Conference table in the existing accepted V0 tiebreak order. */
export function StandingsTable({
  rows,
  programsById,
  controlledProgramId,
}: StandingsTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table standings-table">
        <caption className="visually-hidden">Conference standings</caption>
        <thead>
          <tr>
            <th scope="col">Pos</th>
            <th scope="col">Program</th>
            <th scope="col">W-L</th>
            <th scope="col">Conf</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const program = programsById.get(row.programId)
            const isControlled = row.programId === controlledProgramId

            return (
              <tr
                key={row.programId}
                data-controlled={isControlled}
                data-program-id={row.programId}
              >
                <td>{index + 1}</td>
                <td className="player-name-cell">
                  {program?.name ?? row.programId}
                  {isControlled && (
                    <span className="standings-you-tag"> · You</span>
                  )}
                </td>
                <td>{formatRecord(row.wins, row.losses)}</td>
                <td>{formatRecord(row.conferenceWins, row.conferenceLosses)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
