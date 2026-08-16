import { ExplorationBackButton } from '../components'
import { deriveCompletedSeasonYearbook } from '../dynasty'
import { useDynastyStore } from '../store'

/** Minimal selected-Season shell; full Yearbook sections land in the next checkpoint. */
export function SeasonYearbookScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const selectedSeasonNumber = useDynastyStore(
    (state) => state.selectedArchivedSeasonNumber,
  )
  const explorationViewHistory = useDynastyStore(
    (state) => state.explorationViewHistory,
  )
  const goBackFromExploration = useDynastyStore(
    (state) => state.goBackFromExploration,
  )
  const recoverHistoryIndex = useDynastyStore(
    (state) => state.recoverHistoryIndex,
  )

  if (!dynasty) return null

  let yearbook
  try {
    if (selectedSeasonNumber === null) {
      throw new RangeError('No completed Season is selected.')
    }
    yearbook = deriveCompletedSeasonYearbook(dynasty, selectedSeasonNumber)
  } catch (error) {
    return (
      <main className="season-yearbook-screen">
        <section className="section">
          <h1 className="section-title">Yearbook unavailable</h1>
          <p className="section-hint">
            {error instanceof Error ? error.message : 'That completed Season could not be loaded.'}
          </p>
          <button type="button" className="button button--ghost" onClick={recoverHistoryIndex}>
            Return to History
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="season-yearbook-screen">
      <ExplorationBackButton
        destination={explorationViewHistory.at(-1) ?? 'history'}
        onClick={goBackFromExploration}
      />
      <header className="section">
        <p className="eyebrow-tag">Completed Season</p>
        <h1 className="section-title">Season {yearbook.seasonNumber} Yearbook</h1>
        <p className="section-hint">
          National Champion: {yearbook.championship.nationalChampion.name}
        </p>
        <p className="section-hint">
          Your Program: {yearbook.controlledProgramSeason.program.name} ·{' '}
          {yearbook.controlledProgramSeason.overallRecord.wins}-
          {yearbook.controlledProgramSeason.overallRecord.losses}
        </p>
      </header>
    </main>
  )
}
