import { formatRating } from '../app/formatters'
import type { NationalLeaderEntry, SeasonState } from '../season'
import { getSeasonPlayer } from '../season'
import type { ProgramDefinition } from '../universe'

interface LeaderBoardProps {
  readonly title: string
  readonly unitLabel: string
  readonly entries: readonly NationalLeaderEntry[]
  readonly season: SeasonState
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly onSelectPlayer: (programId: string, playerId: string) => void
}

/** One national leaderboard category — a compact ranked stat table, not a stat card. */
export function LeaderBoard({
  title,
  unitLabel,
  entries,
  season,
  programsById,
  onSelectPlayer,
}: LeaderBoardProps) {
  return (
    <div className="leader-board">
      <div className="leader-board__header">
        <span className="leader-board__title">{title}</span>
        <span className="leader-board__unit">{unitLabel}</span>
      </div>
      <div className="table-scroll">
        <table className="data-table leader-board__table">
          <caption className="visually-hidden">{`National ${title} leaders`}</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Player</th>
              <th scope="col">Program</th>
              <th scope="col">{unitLabel}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const player = getSeasonPlayer(season, entry.programId, entry.playerId)
              const program = programsById.get(entry.programId)

              return (
                <tr key={entry.playerId}>
                  <td className="leader-board__rank">{entry.rank}</td>
                  <td className="player-name-cell">
                    <button
                      type="button"
                      className="text-link-button"
                      onClick={() => onSelectPlayer(entry.programId, entry.playerId)}
                    >
                      {player.firstName} {player.lastName}
                    </button>
                    <span className="leader-board__pos">{player.position}</span>
                  </td>
                  <td>{program?.name ?? entry.programId}</td>
                  <td>{formatRating(entry.value)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
