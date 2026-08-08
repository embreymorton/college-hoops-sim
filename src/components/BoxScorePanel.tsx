import { useState } from 'react'
import type { PlayerGameStats, Team } from '../engine'
import { BoxScoreTable } from './BoxScoreTable'
import type { BrandingSource } from './branding'

interface BoxScoreSide {
  readonly team: Team
  readonly stats: readonly PlayerGameStats[]
  readonly program: BrandingSource
}

interface BoxScorePanelProps {
  readonly home: BoxScoreSide
  readonly away: BoxScoreSide
}

type ActiveSide = 'home' | 'away'

export function BoxScorePanel({ home, away }: BoxScorePanelProps) {
  const [activeSide, setActiveSide] = useState<ActiveSide>('home')
  const active = activeSide === 'home' ? home : away

  return (
    <div>
      <div role="group" aria-label="Box score team" className="tab-list">
        <BoxScoreToggle
          team={home.team}
          accentColor={home.program.primaryColor}
          isActive={activeSide === 'home'}
          onSelect={() => setActiveSide('home')}
        />
        <BoxScoreToggle
          team={away.team}
          accentColor={away.program.primaryColor}
          isActive={activeSide === 'away'}
          onSelect={() => setActiveSide('away')}
        />
      </div>
      <div className="box-score-panel">
        <BoxScoreTable team={active.team} stats={active.stats} />
      </div>
    </div>
  )
}

function BoxScoreToggle({
  team,
  accentColor,
  isActive,
  onSelect,
}: {
  team: Team
  accentColor: string
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      className="tab"
      onClick={onSelect}
    >
      <span
        className="team-color-dot"
        style={{ background: accentColor }}
        aria-hidden="true"
      />
      {team.abbreviation}
    </button>
  )
}
