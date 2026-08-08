import type { GameResult } from '../engine'
import type { ScheduledGame } from '../schedule'
import type { ProgramDefinition } from '../universe'
import {
  formatControlledResultLine,
  formatGameTypeTag,
  formatOpponentLine,
} from '../app/seasonFormatters'

interface ScheduleTableProps {
  /** The controlled Program's own games, in canonical schedule order. */
  readonly games: readonly ScheduledGame[]
  readonly controlledProgramId: string
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly resultsByGameId: Readonly<Record<string, GameResult>>
  readonly nextGameId: string | undefined
}

/** The controlled Program's 24-game regular-season schedule and results. */
export function ScheduleTable({
  games,
  controlledProgramId,
  programsById,
  resultsByGameId,
  nextGameId,
}: ScheduleTableProps) {
  return (
    <div className="table-scroll">
      <table className="data-table schedule-table">
        <caption className="visually-hidden">
          Season schedule and results
        </caption>
        <thead>
          <tr>
            <th scope="col">Rnd</th>
            <th scope="col">Opponent</th>
            <th scope="col">Type</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => {
            const isControlledHome = game.homeProgramId === controlledProgramId
            const opponentId = isControlledHome
              ? game.awayProgramId
              : game.homeProgramId
            const opponent = programsById.get(opponentId)
            const result = resultsByGameId[game.id]
            const isNext = game.id === nextGameId
            const status = result
              ? result.winnerId === controlledProgramId
                ? 'win'
                : 'loss'
              : isNext
                ? 'next'
                : 'pending'

            return (
              <tr key={game.id} data-status={status}>
                <td>{game.round}</td>
                <td className="player-name-cell">
                  {formatOpponentLine(
                    isControlledHome,
                    opponent?.name ?? opponentId,
                  )}
                </td>
                <td className="player-pos-cell">
                  {formatGameTypeTag(game.type)}
                </td>
                <td>
                  {result
                    ? formatControlledResultLine(isControlledHome, result)
                    : isNext
                      ? 'Next'
                      : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
