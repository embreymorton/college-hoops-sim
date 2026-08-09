import type { CompletedSeasonGame } from '../season'
import type { ProgramDefinition } from '../universe'
import {
  formatControlledOutcome,
  formatControlledScoreLine,
  formatOpponentLine,
} from '../app/seasonFormatters'

interface RecentResultsSectionProps {
  /** The controlled Program's most recent completed games, newest first. */
  readonly games: readonly CompletedSeasonGame[]
  readonly controlledProgramId: string
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  /** Opens the recorded historical result for a completed ScheduledGame. */
  readonly onSelectGame: (scheduledGameId: string) => void
}

/** Compact recent-form strip derived from Schedule + recorded GameResults. */
export function RecentResultsSection({
  games,
  controlledProgramId,
  programsById,
  onSelectGame,
}: RecentResultsSectionProps) {
  const wins = games.filter(
    ({ result }) => result.winnerId === controlledProgramId,
  ).length

  return (
    <div className="recent-results">
      <ul className="recent-results__list">
        {games.map(({ game, result }) => {
          const isControlledHome = game.homeProgramId === controlledProgramId
          const opponentId = isControlledHome
            ? game.awayProgramId
            : game.homeProgramId
          const opponent = programsById.get(opponentId)
          const outcome = formatControlledOutcome(isControlledHome, result)

          return (
            <li key={game.id}>
              <button
                type="button"
                className="recent-results__row"
                data-outcome={outcome === 'W' ? 'win' : 'loss'}
                onClick={() => onSelectGame(game.id)}
              >
                <span className="recent-results__outcome">{outcome}</span>
                <span className="recent-results__score">
                  {formatControlledScoreLine(isControlledHome, result)}
                </span>
                <span className="recent-results__opponent">
                  {formatOpponentLine(
                    isControlledHome,
                    opponent?.name ?? opponentId,
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="recent-results__summary">
        Last {games.length}: {wins}-{games.length - wins}
      </p>
    </div>
  )
}
