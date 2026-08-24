import { AwardsHonors, ExplorationBackButton } from '../components'
import { areRegularSeasonAwardsRevealed, deriveAnnouncedSeasonHonors } from '../dynasty'
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

  return (
    <main className="awards-screen">
      <ExplorationBackButton
        destination={explorationHistory.at(-1) ?? 'postseasonHub'}
        onClick={goBack}
      />
      <header className="season-header">
        <div className="season-header__identity">
          <div>
            <p className="eyebrow-tag">Season {dynasty.activeSeason.seasonNumber}</p>
            <h1 className="season-header__name">Awards &amp; Honors</h1>
            <p className="season-header__meta">The season’s national and conference honorees.</p>
          </div>
        </div>
      </header>
      <AwardsHonors
        honors={honors}
        conferences={dynasty.universe.conferences}
        controlledProgramId={controlledProgram.id}
        controlledProgramName={controlledProgram.name}
        controlledConferenceId={controlledProgram.conferenceId}
        showMopPending
        onSelectPlayer={openPlayerDetails}
      />
    </main>
  )
}
