import type { PlayerGameLogEntry } from '../season'
import type { ProgramDefinition } from '../universe'
import { formatOpponentLine } from '../app/seasonFormatters'

interface PlayerGameLogTableProps {
  readonly entries: readonly PlayerGameLogEntry[]
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
}

/** The Player's completed-game log, DNPs included, straight from the canonical projection. */
export function PlayerGameLogTable({
  entries,
  programsById,
}: PlayerGameLogTableProps) {
  if (entries.length === 0) {
    return <p className="league-empty-state">No regular-season games played yet.</p>
  }

  return (
    <div className="table-scroll">
      <table className="data-table game-log-table">
        <caption className="visually-hidden">Player game log</caption>
        <thead>
          <tr>
            <th scope="col">Rnd</th>
            <th scope="col">Opponent</th>
            <th scope="col">Result</th>
            <th scope="col">Min</th>
            <th scope="col">Pts</th>
            <th scope="col">Reb</th>
            <th scope="col">Ast</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const opponent = programsById.get(entry.opponentProgramId)
            const isHome = entry.location === 'home'

            return (
              <tr
                key={entry.scheduledGameId}
                data-status={entry.result === 'W' ? 'win' : 'loss'}
                data-dnp={!entry.didPlay}
              >
                <td>{entry.round}</td>
                <td className="player-name-cell">
                  {formatOpponentLine(isHome, opponent?.name ?? entry.opponentProgramId)}
                </td>
                <td>
                  {entry.result} {entry.teamScore}-{entry.opponentScore}
                </td>
                {entry.didPlay ? (
                  <>
                    <td>{entry.stats.minutes}</td>
                    <td>{entry.stats.points}</td>
                    <td>{entry.stats.rebounds}</td>
                    <td>{entry.stats.assists}</td>
                  </>
                ) : (
                  <>
                    <td colSpan={4}>DNP</td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
