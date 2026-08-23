import type { CSSProperties } from 'react'
import { calculateOverall, type Player } from '../engine'
import { formatHeight } from '../app/formatters'
import { FollowPlayerButton } from './FollowPlayerButton'
import type { PlayerWorkEthic } from '../dynasty'

interface PlayerDetailsHeaderProps {
  readonly player: Player
  readonly programName: string
  readonly accentColor: string
  readonly onSelectTeam: () => void
  readonly workEthic: PlayerWorkEthic
}

/** A Player's identity, Program, and ratings — works for any current-roster Player. */
export function PlayerDetailsHeader({
  player,
  programName,
  accentColor,
  onSelectTeam,
  workEthic,
}: PlayerDetailsHeaderProps) {
  const accentStyle = { '--team-accent': accentColor } as CSSProperties

  return (
    <div className="season-header" style={accentStyle}>
      <div className="season-header__identity">
        <span
          className="season-header__dot"
          style={{ background: accentColor }}
          aria-hidden="true"
        />
        <div>
          <h1 className="season-header__name">
            {player.firstName} {player.lastName}
          </h1>
          <p className="season-header__meta">
            <button
              type="button"
              className="text-link-button"
              onClick={onSelectTeam}
            >
              {programName}
            </button>
            {' · '}
            {player.position} · {player.classYear} · {formatHeight(player.height)}
          </p>
          <FollowPlayerButton playerId={player.id} />
        </div>
      </div>
      <div className="stat-trio season-header__stats">
        <div className="stat-trio__item">
          <span className="stat-trio__value">{calculateOverall(player)}</span>
          <span className="stat-trio__label">Ovr</span>
        </div>
        <div className="stat-trio__item player-work-ethic">
          <span className="stat-trio__value">{workEthic.label}</span>
          <span className="stat-trio__label">Work Ethic</span>
          {workEthic.status === 'unknown' ? <span className="player-work-ethic__hint">Evaluated after first offseason</span> : null}
        </div>
        <div className="stat-trio__item">
          <span className="stat-trio__value">{player.potential}</span>
          <span className="stat-trio__label">Pot</span>
        </div>
      </div>
    </div>
  )
}
