interface CompletedMatchupTeamInfo {
  readonly name: string
  readonly accentColor: string
  readonly score: number
  readonly label?: string
  readonly isWinner: boolean
}

interface CompletedMatchupCardProps {
  readonly roundLabel: string
  readonly overtimeTag?: string | null
  readonly home: CompletedMatchupTeamInfo
  readonly away: CompletedMatchupTeamInfo
  readonly resultLabel: string
  readonly onViewBoxScore: () => void
}

/** Concise Hub presentation of one already-recorded canonical GameResult. */
export function CompletedMatchupCard({
  roundLabel,
  overtimeTag,
  home,
  away,
  resultLabel,
  onViewBoxScore,
}: CompletedMatchupCardProps) {
  return (
    <div className="next-game-card next-game-card--final" aria-live="polite">
      <div className="next-game-card__eyebrow">
        <span className="eyebrow">{roundLabel}</span>
        <span className="next-game-card__home-away">
          Final{overtimeTag ? ` · ${overtimeTag}` : ''}
        </span>
      </div>
      <div className="next-game-card__final-scores">
        <CompletedTeamRow team={away} />
        <CompletedTeamRow team={home} />
      </div>
      <p className="next-game-card__result-line">{resultLabel}</p>
      <div className="next-game-card__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={onViewBoxScore}
        >
          View Box Score
        </button>
      </div>
    </div>
  )
}

function CompletedTeamRow({ team }: { team: CompletedMatchupTeamInfo }) {
  return (
    <div
      className="next-game-card__final-team"
      data-winner={team.isWinner ? 'true' : 'false'}
    >
      <span
        className="team-color-dot"
        style={{ background: team.accentColor }}
        aria-hidden="true"
      />
      <span className="next-game-card__final-name">
        {team.label && (
          <span className="next-game-card__final-seed">{team.label}</span>
        )}
        {team.name}
      </span>
      <span className="next-game-card__final-score">{team.score}</span>
    </div>
  )
}
