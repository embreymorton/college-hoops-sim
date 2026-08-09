import type { TeamStrength } from '../engine'
import type { ProgramRecord } from '../season'
import { formatOpponentLine, formatRecord } from '../app/seasonFormatters'
import { StatTrioItem } from './Scoreboard'

interface NextGameTeamInfo {
  readonly name: string
  readonly accentColor: string
  readonly strength: TeamStrength
}

interface NextGameCardProps {
  readonly round: number
  readonly isControlledHome: boolean
  readonly controlled: NextGameTeamInfo
  readonly opponent: NextGameTeamInfo
  readonly opponentConferenceName: string
  readonly opponentRecord: ProgramRecord
  readonly opponentConferenceRecord: ProgramRecord
  /** Dashboard Quick Sim: plays the game directly with the canonical Season Rotation. */
  readonly onSimulate: () => void
  /** Opens the Rotation Editor / Game Prep workflow instead of simulating immediately. */
  readonly onGamePrep: () => void
}

/** Compact preview of the controlled Program's next ScheduledGame. */
export function NextGameCard({
  round,
  isControlledHome,
  controlled,
  opponent,
  opponentConferenceName,
  opponentRecord,
  opponentConferenceRecord,
  onSimulate,
  onGamePrep,
}: NextGameCardProps) {
  return (
    <div className="next-game-card">
      <div className="next-game-card__eyebrow">
        <span className="eyebrow">Round {round}</span>
        <span className="next-game-card__home-away">
          {isControlledHome ? 'Home' : 'Away'}
        </span>
      </div>
      <h3 className="next-game-card__headline">
        {formatOpponentLine(isControlledHome, opponent.name)}
      </h3>
      <p className="next-game-card__opponent-meta">
        {opponentConferenceName} ·{' '}
        {formatRecord(opponentRecord.wins, opponentRecord.losses)} Overall ·{' '}
        {formatRecord(
          opponentConferenceRecord.wins,
          opponentConferenceRecord.losses,
        )}{' '}
        Conf
      </p>
      <div className="next-game-card__comparison">
        <NextGameTeamStats label="You" team={controlled} />
        <span className="next-game-card__vs" aria-hidden="true">
          vs
        </span>
        <NextGameTeamStats label={opponent.name} team={opponent} />
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
          onClick={onGamePrep}
        >
          Game Prep
        </button>
      </div>
    </div>
  )
}

function NextGameTeamStats({
  label,
  team,
}: {
  label: string
  team: NextGameTeamInfo
}) {
  return (
    <div className="next-game-card__team">
      <span className="next-game-card__team-label">
        <span
          className="team-color-dot"
          style={{ background: team.accentColor }}
          aria-hidden="true"
        />
        {label}
      </span>
      <div className="stat-trio">
        <StatTrioItem label="Off" value={team.strength.offense} />
        <StatTrioItem label="Def" value={team.strength.defense} />
        <StatTrioItem label="Ovr" value={team.strength.overall} />
      </div>
    </div>
  )
}
