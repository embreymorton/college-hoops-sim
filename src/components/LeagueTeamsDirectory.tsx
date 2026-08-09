import type { CSSProperties } from 'react'
import { calculateTeamStrength } from '../engine'
import { deriveConferenceStandings, type SeasonState } from '../season'
import type { UniverseDefinition } from '../universe'
import { formatRecord } from '../app/seasonFormatters'

interface LeagueTeamsDirectoryProps {
  readonly universe: UniverseDefinition
  readonly season: SeasonState
  readonly controlledProgramId: string | null
  readonly onSelectProgram: (programId: string) => void
}

/** Every Program in the Universe, grouped by Conference and ranked by the same standings order as the Hub. */
export function LeagueTeamsDirectory({
  universe,
  season,
  controlledProgramId,
  onSelectProgram,
}: LeagueTeamsDirectoryProps) {
  const programsById = new Map(
    universe.programs.map((program) => [program.id, program] as const),
  )

  return (
    <div className="league-teams-directory">
      {universe.conferences.map((conference) => {
        const rows = deriveConferenceStandings(universe, season, conference.id)

        return (
          <div key={conference.id}>
            <h3 className="league-teams-directory__conference-name">
              {conference.name}
            </h3>
            <ul className="league-teams-directory__list">
              {rows.map((row) => {
                const program = programsById.get(row.programId)

                if (!program) {
                  return null
                }

                const programState = season.programStates[row.programId]
                const strength = programState
                  ? calculateTeamStrength(programState.team, programState.rotation)
                  : undefined
                const isControlled = row.programId === controlledProgramId

                return (
                  <li key={row.programId}>
                    <button
                      type="button"
                      className="league-teams-directory__row"
                      style={
                        {
                          '--team-accent': program.branding.primaryColor,
                        } as CSSProperties
                      }
                      onClick={() => onSelectProgram(row.programId)}
                    >
                      <span
                        className="team-color-dot"
                        style={{ background: program.branding.primaryColor }}
                        aria-hidden="true"
                      />
                      <span className="league-teams-directory__name">
                        {program.name}
                        {isControlled && (
                          <span className="standings-you-tag"> · You</span>
                        )}
                      </span>
                      <span className="league-teams-directory__record">
                        {formatRecord(row.wins, row.losses)}
                      </span>
                      <span className="league-teams-directory__conf-record">
                        {formatRecord(row.conferenceWins, row.conferenceLosses)} Conf
                      </span>
                      <span className="league-teams-directory__ovr">
                        {strength ? Math.round(strength.overall) : '—'} OVR
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
