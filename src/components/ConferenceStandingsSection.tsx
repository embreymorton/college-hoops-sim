import { deriveConferenceStandings, type SeasonState } from '../season'
import type { UniverseDefinition } from '../universe'
import { StandingsTable } from './StandingsTable'

interface ConferenceStandingsSectionProps {
  readonly universe: UniverseDefinition
  readonly season: SeasonState
  readonly controlledProgramId: string
  readonly conferenceId: string
  readonly onSelectProgram: (programId: string) => void
  readonly highlightedLabel?: string
}

/**
 * The controlled Program's own Conference standings only — the Season Hub
 * needs this coaching context, not a league-wide switcher (League → Teams
 * already covers every Conference).
 */
export function ConferenceStandingsSection({
  universe,
  season,
  controlledProgramId,
  conferenceId,
  onSelectProgram,
  highlightedLabel,
}: ConferenceStandingsSectionProps) {
  const programsById = new Map(
    universe.programs.map((program) => [program.id, program] as const),
  )
  const rows = deriveConferenceStandings(universe, season, conferenceId)

  return (
    <StandingsTable
      rows={rows}
      programsById={programsById}
      controlledProgramId={controlledProgramId}
      onSelectProgram={onSelectProgram}
      highlightedLabel={highlightedLabel}
    />
  )
}
