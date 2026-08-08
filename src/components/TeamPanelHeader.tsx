import type { ReactNode } from 'react'
import type { Team } from '../engine'

interface TeamPanelHeaderProps {
  readonly team: Team
  readonly headingId: string
  readonly right?: ReactNode
}

/** Shared identity header for both the read-only roster panel and the home Rotation editor. */
export function TeamPanelHeader({ team, headingId, right }: TeamPanelHeaderProps) {
  return (
    <div className="team-panel__header">
      <div className="team-panel__identity">
        <h3 id={headingId} className="team-panel__name">
          {team.name}
        </h3>
        <span className="team-panel__abbr">{team.abbreviation}</span>
      </div>
      {right}
    </div>
  )
}
