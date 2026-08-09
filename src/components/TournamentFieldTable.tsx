import type { TournamentBidType } from '../postseason'
import { formatBidType, formatSeedLabel } from '../app/postseasonFormatters'
import { formatRecord } from '../app/seasonFormatters'

export interface TournamentFieldRow {
  readonly programId: string
  readonly programName: string
  readonly conferenceName: string
  readonly seed: number
  readonly bidType: TournamentBidType
  readonly record: { readonly wins: number; readonly losses: number }
}

interface TournamentFieldTableProps {
  /** Already in canonical seed order (1–16); rendered as-is, never re-sorted or re-rated. */
  readonly rows: readonly TournamentFieldRow[]
  readonly controlledProgramId: string | null
}

/** The canonical 16-team field. Seeds and bids are presented as selected — never re-derived here. */
export function TournamentFieldTable({
  rows,
  controlledProgramId,
}: TournamentFieldTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table standings-table">
        <caption className="visually-hidden">National Tournament field</caption>
        <thead>
          <tr>
            <th scope="col">Seed</th>
            <th scope="col">Program</th>
            <th scope="col">Conference</th>
            <th scope="col">Record</th>
            <th scope="col">Bid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isControlled = row.programId === controlledProgramId

            return (
              <tr key={row.programId} data-controlled={isControlled}>
                <td>{formatSeedLabel(row.seed)}</td>
                <td className="player-name-cell">
                  {row.programName}
                  {isControlled && (
                    <span className="standings-you-tag"> · You</span>
                  )}
                </td>
                <td className="player-pos-cell">{row.conferenceName}</td>
                <td>{formatRecord(row.record.wins, row.record.losses)}</td>
                <td className="player-pos-cell">{formatBidType(row.bidType)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
