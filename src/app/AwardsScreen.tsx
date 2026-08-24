import { AwardsHonors, ExplorationBackButton } from '../components'
import { areRegularSeasonAwardsRevealed, deriveAnnouncedSeasonHonors, deriveTournamentMopSummary } from '../dynasty'
import { useDynastyStore } from '../store'

export function AwardsScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const goBack = useDynastyStore((state) => state.goBackFromExploration)
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)
  const explorationHistory = useDynastyStore((state) => state.explorationViewHistory)
  if (!dynasty?.activeSeason || !dynasty.activePostseason) return null
  if (!areRegularSeasonAwardsRevealed(dynasty.activePostseason)) return null
  const controlledProgram = dynasty.universe.programs.find(
    ({ id }) => id === dynasty.controlledProgramId,
  )!
  const honors = deriveAnnouncedSeasonHonors(dynasty)
  const mopSummary = deriveTournamentMopSummary(dynasty)

  return (
    <main className="awards-screen">
      <ExplorationBackButton
        destination={explorationHistory.at(-1) ?? 'postseasonHub'}
        onClick={goBack}
      />
      <header className="awards-page-heading">
        <p className="eyebrow-tag">Season {dynasty.activeSeason.seasonNumber}</p>
        <h1 className="section-title awards-page-heading__title">Awards &amp; Honors</h1>
        <p className="section-hint">The season’s national and conference honorees.</p>
      </header>
      <AwardsHonors
        honors={honors}
        conferences={dynasty.universe.conferences}
        controlledProgramId={controlledProgram.id}
        controlledConferenceId={controlledProgram.conferenceId}
        showMopPending
        mopSummary={mopSummary}
        onSelectPlayer={openPlayerDetails}
      />
    </main>
  )
}
