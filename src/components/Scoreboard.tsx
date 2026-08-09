import type { TeamStrength } from '../engine'
import { formatRating } from '../app/formatters'

type ScoreboardSideKey = 'home' | 'away'

function ScoreboardCorners() {
  return (
    <>
      <span className="scoreboard-corner scoreboard-corner--tl" aria-hidden="true" />
      <span className="scoreboard-corner scoreboard-corner--tr" aria-hidden="true" />
      <span className="scoreboard-corner scoreboard-corner--bl" aria-hidden="true" />
      <span className="scoreboard-corner scoreboard-corner--br" aria-hidden="true" />
    </>
  )
}

/* ---------------------------------------------------------------------- */
/* Pregame — Team Strength scoreboard                                     */
/* ---------------------------------------------------------------------- */

interface ScoreboardStrengthTeam {
  readonly name: string
  readonly accentColor: string
  readonly strength: TeamStrength
}

interface PregameScoreboardProps {
  readonly home: ScoreboardStrengthTeam
  readonly away: ScoreboardStrengthTeam
  /** Handles the primary action: simulate directly, or navigate to game prep. */
  readonly onAction: () => void
  /** Defaults to "Simulate Game"; Season reuses this for "Prepare for Game". */
  readonly actionLabel?: string
  readonly actionDisabled?: boolean
  readonly actionDisabledReason?: string | null
}

export function PregameScoreboard({
  home,
  away,
  onAction,
  actionLabel = 'Simulate Game',
  actionDisabled = false,
  actionDisabledReason = null,
}: PregameScoreboardProps) {
  const showReason = actionDisabled && Boolean(actionDisabledReason)

  return (
    <div className="scoreboard scoreboard--pregame">
      <ScoreboardCorners />
      <div className="scoreboard-grid">
        <StrengthSide side="home" team={home} />
        <div className="scoreboard-divider">
          <span className="scoreboard-vs">VS</span>
        </div>
        <StrengthSide side="away" team={away} />
      </div>
      <div className="scoreboard-cta">
        <button
          type="button"
          className="button button--primary"
          onClick={onAction}
          disabled={actionDisabled}
          aria-describedby={showReason ? 'action-disabled-reason' : undefined}
        >
          {actionLabel}
        </button>
        {showReason && (
          <p id="action-disabled-reason" className="scoreboard-cta-reason">
            {actionDisabledReason}
          </p>
        )}
      </div>
    </div>
  )
}

function StrengthSide({
  side,
  team,
}: {
  side: ScoreboardSideKey
  team: ScoreboardStrengthTeam
}) {
  return (
    <div className={`scoreboard-side scoreboard-side--${side}`}>
      <span className="scoreboard-side__label">
        {side === 'home' ? 'Home' : 'Away'}
      </span>
      <span className="scoreboard-side__name">{team.name}</span>
      <span
        className="scoreboard-side__accent-bar"
        style={{ background: team.accentColor }}
        aria-hidden="true"
      />
      <div className="stat-trio">
        <StatTrioItem label="Off" value={team.strength.offense} />
        <StatTrioItem label="Def" value={team.strength.defense} />
        <StatTrioItem label="Ovr" value={team.strength.overall} />
      </div>
    </div>
  )
}

export function StatTrioItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-trio__item">
      <span className="stat-trio__value">{formatRating(value)}</span>
      <span className="stat-trio__label">{label}</span>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* Postgame — Final scoreboard                                            */
/* ---------------------------------------------------------------------- */

interface ScoreboardScoreTeam {
  readonly name: string
  readonly accentColor: string
  readonly score: number
  readonly isWinner: boolean
}

export interface FinalScoreboardAction {
  readonly label: string
  readonly onClick: () => void
}

interface FinalScoreboardProps {
  readonly home: ScoreboardScoreTeam
  readonly away: ScoreboardScoreTeam
  readonly winnerName: string
  readonly overtimeTag: string | null
  /** e.g. "Round 8" — round context for both live and historical results. */
  readonly roundLabel?: string
  /** Null when there is nothing left to act on (e.g. no round games remain). */
  readonly primaryAction: FinalScoreboardAction | null
  readonly secondaryAction: FinalScoreboardAction
}

export function FinalScoreboard({
  home,
  away,
  winnerName,
  overtimeTag,
  roundLabel,
  primaryAction,
  secondaryAction,
}: FinalScoreboardProps) {
  return (
    <div className="scoreboard scoreboard--final" aria-live="polite">
      <ScoreboardCorners />
      <div className="final-tag-row">
        {roundLabel && <span className="final-tag">{roundLabel}</span>}
        <span className="final-tag final-tag--headline">Final</span>
        {overtimeTag && <span className="final-tag">{overtimeTag}</span>}
      </div>
      <div className="scoreboard-grid">
        <ScoreSide side="home" team={home} />
        <div className="scoreboard-divider">
          <span className="scoreboard-vs">–</span>
        </div>
        <ScoreSide side="away" team={away} />
      </div>
      <p className="final-result-line">{winnerName} wins</p>
      <div className="scoreboard-actions">
        {primaryAction && (
          <button
            type="button"
            className="button button--primary"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </button>
        )}
        <button
          type="button"
          className="button button--ghost"
          onClick={secondaryAction.onClick}
        >
          {secondaryAction.label}
        </button>
      </div>
    </div>
  )
}

function ScoreSide({
  side,
  team,
}: {
  side: ScoreboardSideKey
  team: ScoreboardScoreTeam
}) {
  const winnerClass = team.isWinner ? ' scoreboard-side--winner' : ''

  return (
    <div className={`scoreboard-side scoreboard-side--${side}${winnerClass}`}>
      <span className="scoreboard-side__label">
        {side === 'home' ? 'Home' : 'Away'}
        {team.isWinner ? ' · Winner' : ''}
      </span>
      <span className="scoreboard-side__name">{team.name}</span>
      <span className="scoreboard-side__score">{team.score}</span>
      <span
        className="scoreboard-side__win-bar"
        style={{ background: team.isWinner ? team.accentColor : 'transparent' }}
        aria-hidden="true"
      />
    </div>
  )
}
