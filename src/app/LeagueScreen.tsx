import { useState } from 'react'
import {
  DynastySectionNav,
  ExplorationBackButton,
  LeagueTeamsDirectory,
  NationalLeadersSection,
} from '../components'
import { deriveNationalPlayerLeaders } from '../season'
import {
  selectActivePostseason,
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

type LeagueTab = 'leaders' | 'teams'

/** The League destination: national statistical leaders and the full 32-Program directory. */
export function LeagueScreen() {
  const [tab, setTab] = useState<LeagueTab>('leaders')
  const season = useDynastyStore(selectActiveSeason)
  const postseason = useDynastyStore(selectActivePostseason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const explorationViewHistory = useDynastyStore(
    (state) => state.explorationViewHistory,
  )
  const goBackFromExploration = useDynastyStore(
    (state) => state.goBackFromExploration,
  )
  const goToHub = useDynastyStore((state) => state.goToHub)
  const goToPostseasonHub = useDynastyStore((state) => state.goToPostseasonHub)
  const goToRecruiting = useDynastyStore((state) => state.goToRecruiting)
  const goToLeague = useDynastyStore((state) => state.goToLeague)
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)

  if (!season) {
    return null
  }

  const backDestination = explorationViewHistory.at(-1) ?? 'hub'
  const leaderboards = deriveNationalPlayerLeaders(season)

  return (
    <>
      <DynastySectionNav
        competitionLabel={postseason ? 'Tournament' : 'Season'}
        activeSection="league"
        onSelectCompetition={postseason ? goToPostseasonHub : goToHub}
        onSelectRecruiting={goToRecruiting}
        onSelectLeague={goToLeague}
      />
      <ExplorationBackButton
        destination={backDestination}
        onClick={goBackFromExploration}
      />

      <section className="section" aria-labelledby="league-heading">
        <div className="section-heading">
          <h1 id="league-heading" className="section-title">
            League
          </h1>
        </div>

        <div role="group" aria-label="League section" className="tab-list">
          <button
            type="button"
            className="tab"
            aria-pressed={tab === 'leaders'}
            onClick={() => setTab('leaders')}
          >
            Leaders
          </button>
          <button
            type="button"
            className="tab"
            aria-pressed={tab === 'teams'}
            onClick={() => setTab('teams')}
          >
            Teams
          </button>
        </div>

        {tab === 'leaders' ? (
          <NationalLeadersSection
            leaderboards={leaderboards}
            season={season}
            programsById={PROGRAMS_BY_ID}
            onSelectPlayer={openPlayerDetails}
            onSelectProgram={openTeamDetails}
          />
        ) : (
          <LeagueTeamsDirectory
            universe={UNIVERSE_V0}
            season={season}
            controlledProgramId={controlledProgramId}
            onSelectProgram={openTeamDetails}
          />
        )}
      </section>
    </>
  )
}
