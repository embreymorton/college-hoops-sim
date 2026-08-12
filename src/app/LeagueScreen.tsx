import { useState } from 'react'
import {
  DynastySectionNav,
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

/**
 * The League destination: national statistical leaders and the full
 * 32-Program directory. Primary Dynasty navigation already establishes
 * location (`SEASON / RECRUITING / LEAGUE`), so this root view carries no
 * separate Back action or duplicate title — only Team/Player Details, one
 * level deeper, need their own exploration Back navigation.
 */
export function LeagueScreen() {
  const [tab, setTab] = useState<LeagueTab>('leaders')
  const season = useDynastyStore(selectActiveSeason)
  const postseason = useDynastyStore(selectActivePostseason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const goToHub = useDynastyStore((state) => state.goToHub)
  const goToPostseasonHub = useDynastyStore((state) => state.goToPostseasonHub)
  const goToRecruiting = useDynastyStore((state) => state.goToRecruiting)
  const goToLeague = useDynastyStore((state) => state.goToLeague)
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)

  if (!season) {
    return null
  }

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

      <section className="section" aria-label="League">
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
