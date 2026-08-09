import { useState } from 'react'
import { deriveConferenceStandings, type SeasonState } from '../season'
import type { UniverseDefinition } from '../universe'
import { StandingsTable } from './StandingsTable'

interface ConferenceStandingsSectionProps {
  readonly universe: UniverseDefinition
  readonly season: SeasonState
  readonly controlledProgramId: string
  readonly defaultConferenceId: string
  readonly onSelectProgram: (programId: string) => void
}

/** Owns the lightweight Conference switch; standings themselves stay derived. */
export function ConferenceStandingsSection({
  universe,
  season,
  controlledProgramId,
  defaultConferenceId,
  onSelectProgram,
}: ConferenceStandingsSectionProps) {
  const [conferenceId, setConferenceId] = useState(defaultConferenceId)
  const programsById = new Map(
    universe.programs.map((program) => [program.id, program] as const),
  )
  const rows = deriveConferenceStandings(universe, season, conferenceId)

  return (
    <div>
      <div
        role="group"
        aria-label="Conference"
        className="tab-list standings-conference-tabs"
      >
        {universe.conferences.map((conference) => (
          <button
            key={conference.id}
            type="button"
            aria-pressed={conference.id === conferenceId}
            className="tab"
            onClick={() => setConferenceId(conference.id)}
          >
            {conference.name.replace(' Conference', '')}
          </button>
        ))}
      </div>
      <StandingsTable
        rows={rows}
        programsById={programsById}
        controlledProgramId={controlledProgramId}
        onSelectProgram={onSelectProgram}
      />
    </div>
  )
}
