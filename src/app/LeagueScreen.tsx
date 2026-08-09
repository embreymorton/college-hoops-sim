import { useState } from 'react'
import {
  ExplorationBackButton,
  LeagueTeamsDirectory,
  NationalLeadersSection,
} from '../components'
import { deriveNationalPlayerLeaders } from '../season'
import { useSeasonStore } from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

type LeagueTab = 'leaders' | 'teams'

/** The League destination: national statistical leaders and the full 32-Program directory. */
export function LeagueScreen() {
  const [tab, setTab] = useState<LeagueTab>('leaders')
  const season = useSeasonStore((state) => state.season)
  const controlledProgramId = useSeasonStore((state) => state.controlledProgramId)
  const explorationViewHistory = useSeasonStore(
    (state) => state.explorationViewHistory,
  )
  const goBackFromExploration = useSeasonStore(
    (state) => state.goBackFromExploration,
  )
  const openTeamDetails = useSeasonStore((state) => state.openTeamDetails)
  const openPlayerDetails = useSeasonStore((state) => state.openPlayerDetails)

  if (!season) {
    return null
  }

  const backDestination = explorationViewHistory.at(-1) ?? 'hub'
  const leaderboards = deriveNationalPlayerLeaders(season)

  return (
    <>
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
