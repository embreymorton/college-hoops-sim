import type { TeamStrength } from '../engine'
import { formatSeedLabel } from '../app/postseasonFormatters'
import { StatTrioItem } from './Scoreboard'

interface TournamentMatchupTeamInfo {
  readonly name: string
  readonly accentColor: string
  readonly seed: number
  readonly strength: TeamStrength
}

interface TournamentMatchupCardProps {
  readonly roundLabel: string
  readonly controlled: TournamentMatchupTeamInfo
  readonly opponent: TournamentMatchupTeamInfo
  /** Tournament Quick Sim: plays the game through the existing Postseason simulation API. */
  readonly onSimulate: () => void
  readonly onManageRotation: () => void
}

/** Escalated Next-Game equivalent for a live Tournament matchup — always neutral site. */
export function TournamentMatchupCard({
  roundLabel,
  controlled,
  opponent,
  onSimulate,
  onManageRotation,
}: TournamentMatchupCardProps) {
  return (
    <div className="next-game-card">
      <div className="next-game-card__eyebrow">
        <span className="eyebrow">{roundLabel}</span>
        <span className="next-game-card__home-away">Neutral Site</span>
      </div>
      <h3 className="next-game-card__headline">
        vs {formatSeedLabel(opponent.seed)} {opponent.name}
      </h3>
      <div className="next-game-card__comparison">
        <TournamentTeamStats label="You" seed={controlled.seed} team={controlled} />
        <span className="next-game-card__vs" aria-hidden="true">
          vs
        </span>
        <TournamentTeamStats
          label={opponent.name}
          seed={opponent.seed}
          team={opponent}
        />
      </div>
      <div className="next-game-card__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={onSimulate}
        >
          Simulate Game
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={onManageRotation}
        >
          Manage Rotation
        </button>
      </div>
    </div>
  )
}

function TournamentTeamStats({
  label,
  seed,
  team,
}: {
  label: string
  seed: number
  team: TournamentMatchupTeamInfo
}) {
  return (
    <div className="next-game-card__team">
      <span className="next-game-card__team-label">
        <span
          className="team-color-dot"
          style={{ background: team.accentColor }}
          aria-hidden="true"
        />
        {formatSeedLabel(seed)} {label}
      </span>
      <div className="stat-trio">
        <StatTrioItem label="Off" value={team.strength.offense} />
        <StatTrioItem label="Def" value={team.strength.defense} />
        <StatTrioItem label="Ovr" value={team.strength.overall} />
      </div>
    </div>
  )
}
