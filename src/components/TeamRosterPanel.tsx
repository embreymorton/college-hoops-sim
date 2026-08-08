import type { CSSProperties } from 'react'
import type { Rotation, Team } from '../engine'
import type { DemoProgram } from '../app/demoPrograms'
import { RosterTable } from './RosterTable'

interface TeamRosterPanelProps {
  readonly team: Team
  readonly rotation: Rotation
  readonly program: DemoProgram
  readonly headingId: string
}

export function TeamRosterPanel({
  team,
  rotation,
  program,
  headingId,
}: TeamRosterPanelProps) {
  const accentStyle = {
    '--team-accent': program.primaryColor,
  } as CSSProperties

  return (
    <div className="team-panel" style={accentStyle}>
      <div className="team-panel__header">
        <div className="team-panel__identity">
          <h3 id={headingId} className="team-panel__name">
            {team.name}
          </h3>
          <span className="team-panel__abbr">{team.abbreviation}</span>
        </div>
        <div className="team-panel__prestige">
          <div className="team-panel__prestige-value">{team.prestige}</div>
          <div className="team-panel__prestige-label">Prestige</div>
        </div>
      </div>
      <RosterTable team={team} rotation={rotation} />
    </div>
  )
}
