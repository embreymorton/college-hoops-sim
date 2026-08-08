import { useState } from 'react'
import type { PlayerGameStats, Team } from '../engine'
import type { DemoProgram } from '../app/demoPrograms'
import { BoxScoreTable } from './BoxScoreTable'

interface BoxScoreSide {
  readonly team: Team
  readonly stats: readonly PlayerGameStats[]
  readonly program: DemoProgram
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
      <div role="tablist" aria-label="Box score team" className="tab-list">
        <BoxScoreTab
          side="home"
          team={home.team}
          accentColor={home.program.primaryColor}
          isActive={activeSide === 'home'}
          onSelect={setActiveSide}
        />
        <BoxScoreTab
          side="away"
          team={away.team}
          accentColor={away.program.primaryColor}
          isActive={activeSide === 'away'}
          onSelect={setActiveSide}
        />
      </div>
      <div
        role="tabpanel"
        id="box-score-panel"
        aria-labelledby={`box-score-tab-${activeSide}`}
        className="box-score-panel"
      >
        <BoxScoreTable team={active.team} stats={active.stats} />
      </div>
    </div>
  )
}

function BoxScoreTab({
  side,
  team,
  accentColor,
  isActive,
  onSelect,
}: {
  side: ActiveSide
  team: Team
  accentColor: string
  isActive: boolean
  onSelect: (side: ActiveSide) => void
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`box-score-tab-${side}`}
      aria-selected={isActive}
      aria-controls="box-score-panel"
      className="tab"
      onClick={() => onSelect(side)}
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
