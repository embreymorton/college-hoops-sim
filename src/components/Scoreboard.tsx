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
  /**
   * Override the "Home"/"Away" side badges — Postseason games are neutral
   * site, so Tournament callers pass seed labels instead to avoid implying
   * home-court advantage that the simulation itself never applies.
   */
  readonly homeLabel?: string
  readonly awayLabel?: string
  /** Optional context chip above the matchup (e.g. "Round 4"), for callers that fold their heading into the hero. */
  readonly contextTag?: string
}

export function PregameScoreboard({
  home,
  away,
  onAction,
  actionLabel = 'Simulate Game',
  actionDisabled = false,
  actionDisabledReason = null,
  homeLabel = 'Home',
  awayLabel = 'Away',
  contextTag,
}: PregameScoreboardProps) {
  const showReason = actionDisabled && Boolean(actionDisabledReason)

  return (
    <div className="scoreboard scoreboard--pregame">
      <ScoreboardCorners />
      {contextTag && (
        <div className="scoreboard-tag-row">
          <span className="scoreboard-tag">{contextTag}</span>
        </div>
      )}
      <div className="scoreboard-grid">
        <StrengthSide side="home" label={homeLabel} team={home} />
        <div className="scoreboard-divider">
          <span className="scoreboard-vs">VS</span>
        </div>
        <StrengthSide side="away" label={awayLabel} team={away} />
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
  label,
  team,
}: {
  side: ScoreboardSideKey
  label: string
  team: ScoreboardStrengthTeam
}) {
  return (
    <div className={`scoreboard-side scoreboard-side--${side}`}>
      <span className="scoreboard-side__label">{label}</span>
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
  /** Overrides the "Home"/"Away" side badges — see PregameScoreboard for why. */
  readonly homeLabel?: string
  readonly awayLabel?: string
}

export function FinalScoreboard({
  home,
  away,
  winnerName,
  overtimeTag,
  roundLabel,
  primaryAction,
  secondaryAction,
  homeLabel = 'Home',
  awayLabel = 'Away',
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
        <ScoreSide side="home" label={homeLabel} team={home} />
        <div className="scoreboard-divider">
          <span className="scoreboard-vs">–</span>
        </div>
        <ScoreSide side="away" label={awayLabel} team={away} />
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
  label,
  team,
}: {
  side: ScoreboardSideKey
  label: string
  team: ScoreboardScoreTeam
}) {
  const winnerClass = team.isWinner ? ' scoreboard-side--winner' : ''

  return (
    <div className={`scoreboard-side scoreboard-side--${side}${winnerClass}`}>
      <span className="scoreboard-side__label">
        {label}
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
