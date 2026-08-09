import type { CompletedSeasonGame } from '../season'
import type { ProgramDefinition } from '../universe'
import {
  formatControlledOutcome,
  formatControlledScoreLine,
  formatOpponentLine,
} from '../app/seasonFormatters'

interface RecentResultsSectionProps {
  /** One Program's most recent completed games, newest first. */
  readonly games: readonly CompletedSeasonGame[]
  readonly programId: string
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  /** When supplied, opens the recorded historical result. */
  readonly onSelectGame?: (scheduledGameId: string) => void
}

/** Compact recent-form strip derived from Schedule + recorded GameResults. */
export function RecentResultsSection({
  games,
  programId,
  programsById,
  onSelectGame,
}: RecentResultsSectionProps) {
  const wins = games.filter(
    ({ result }) => result.winnerId === programId,
  ).length

  if (games.length === 0) {
    return <p className="league-empty-state">No completed games yet.</p>
  }

  return (
    <div className="recent-results">
      <ul className="recent-results__list">
        {games.map(({ game, result }) => {
          const isProgramHome = game.homeProgramId === programId
          const opponentId = isProgramHome
            ? game.awayProgramId
            : game.homeProgramId
          const opponent = programsById.get(opponentId)
          const outcome = formatControlledOutcome(isProgramHome, result)
          const content = (
            <>
              <span className="recent-results__outcome">{outcome}</span>
              <span className="recent-results__score">
                {formatControlledScoreLine(isProgramHome, result)}
              </span>
              <span className="recent-results__opponent">
                {formatOpponentLine(
                  isProgramHome,
                  opponent?.name ?? opponentId,
                )}
              </span>
            </>
          )

          return (
            <li key={game.id}>
              {onSelectGame ? (
                <button
                  type="button"
                  className="recent-results__row"
                  data-outcome={outcome === 'W' ? 'win' : 'loss'}
                  onClick={() => onSelectGame(game.id)}
                >
                  {content}
                </button>
              ) : (
                <div
                  className="recent-results__row"
                  data-outcome={outcome === 'W' ? 'win' : 'loss'}
                  data-interactive="false"
                >
                  {content}
                </div>
              )}
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
