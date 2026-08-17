import {
  deriveCompletedSeasonIndex,
  type HistoricalTournamentOutcome,
} from '../dynasty'
import { useDynastyStore } from '../store'
import { formatTournamentRoundName } from './postseasonFormatters'

function formatTournamentOutcome(outcome: HistoricalTournamentOutcome): string {
  switch (outcome.status) {
    case 'did-not-qualify':
      return 'Did not qualify'
    case 'national-champion':
      return `National Champion · #${outcome.seed}`
    case 'runner-up':
      return `Runner-up · #${outcome.seed}`
    case 'eliminated':
      return `${formatTournamentRoundName(outcome.round)} · #${outcome.seed}`
  }
}

/** League-owned index of canonical completed Seasons. */
export function HistoryScreen() {
  const view = useDynastyStore((state) => state.view)
  const explorationViewHistory = useDynastyStore((state) => state.explorationViewHistory)
  const goBackFromExploration = useDynastyStore((state) => state.goBackFromExploration)
  const dynasty = useDynastyStore((state) => state.dynasty)
  const openArchivedSeason = useDynastyStore(
    (state) => state.openArchivedSeason,
  )

  if (!dynasty) return null

  let seasons
  try {
    seasons = deriveCompletedSeasonIndex(dynasty)
  } catch (error) {
    return (
      <div className="history-screen">
        {view === 'history' ? <ExplorationBackButton destination={explorationViewHistory.at(-1) ?? 'league'} onClick={goBackFromExploration} /> : null}
        <section className="section">
          <h1 className="section-title">History</h1>
          <p className="league-empty-state">
            {error instanceof Error
              ? error.message
              : 'Completed Season history could not be loaded.'}
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="history-screen">
      {view === 'history' ? <ExplorationBackButton destination={explorationViewHistory.at(-1) ?? 'league'} onClick={goBackFromExploration} /> : null}
      <header className="section">
        <p className="eyebrow-tag">League Archive</p>
        <h1 className="section-title">History</h1>
        <p className="section-hint">Revisit the completed Seasons of this Dynasty.</p>
      </header>
      <section className="section" aria-labelledby="completed-seasons-heading">
        <h2 id="completed-seasons-heading" className="section-title">
          Completed Seasons
        </h2>
        {seasons.length === 0 ? (
          <p className="league-empty-state">
            Completed Seasons will appear here after the Tournament ends and the Dynasty advances through rollover.
          </p>
        ) : (
          <div className="history-season-list">
            {seasons.map((season) => (
              <button
                key={season.seasonNumber}
                type="button"
                className="history-season-card"
                onClick={() => openArchivedSeason(season.seasonNumber)}
              >
                <span className="history-season-card__season">Season {season.seasonNumber}</span>
                <span className="history-season-card__detail">
                  Champion: {season.nationalChampion.name}
                </span>
                <span className="history-season-card__detail">
                  Your Program: {season.controlledProgramRecord.wins}-{season.controlledProgramRecord.losses}
                  {' · '}{formatTournamentOutcome(season.controlledTournamentOutcome)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
import { ExplorationBackButton } from '../components'
