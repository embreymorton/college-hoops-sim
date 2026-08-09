interface CompletedMatchupTeamInfo {
  readonly name: string
  readonly accentColor: string
  readonly score: number
  readonly label?: string
  readonly isWinner: boolean
}

interface CompletedGameStatLeader {
  readonly playerName: string
  readonly programName: string
  readonly value: number
}

interface CompletedGameTeamLeaders {
  readonly points: CompletedGameStatLeader | null
  readonly rebounds: CompletedGameStatLeader | null
  readonly assists: CompletedGameStatLeader | null
}

interface CompletedMatchupCardProps {
  readonly roundLabel: string
  readonly siteLabel: 'Home' | 'Away' | 'Neutral'
  readonly overtimeTag?: string | null
  readonly home: CompletedMatchupTeamInfo
  readonly away: CompletedMatchupTeamInfo
  readonly resultLabel: string
  readonly resultDetail?: string
  readonly leaders: CompletedGameTeamLeaders
  readonly onViewBoxScore: () => void
}

/** Concise Hub presentation of one already-recorded canonical GameResult. */
export function CompletedMatchupCard({
  roundLabel,
  siteLabel,
  overtimeTag,
  home,
  away,
  resultLabel,
  resultDetail,
  leaders,
  onViewBoxScore,
}: CompletedMatchupCardProps) {
  return (
    <div className="next-game-card next-game-card--final" aria-live="polite">
      <div className="next-game-card__eyebrow">
        <span className="eyebrow">{roundLabel}</span>
        <span className="next-game-card__home-away">
          {siteLabel} · Final{overtimeTag ? `/${overtimeTag}` : ''}
        </span>
      </div>
      <div className="next-game-card__final-scores">
        <CompletedTeamRow team={away} />
        <CompletedTeamRow team={home} />
      </div>
      <div className="next-game-card__result-summary">
        <p className="next-game-card__result-line">{resultLabel}</p>
        {resultDetail && (
          <p className="next-game-card__result-detail">{resultDetail}</p>
        )}
      </div>
      <div className="game-leaders" aria-label="Game leaders">
        <p className="game-leaders__heading">Game Leaders</p>
        <div className="game-leaders__grid">
          <GameLeaderColumn
            label="PTS"
            leader={leaders.points}
            teamColor={getLeaderTeamColor(leaders.points, home, away)}
          />
          <GameLeaderColumn
            label="REB"
            leader={leaders.rebounds}
            teamColor={getLeaderTeamColor(leaders.rebounds, home, away)}
          />
          <GameLeaderColumn
            label="AST"
            leader={leaders.assists}
            teamColor={getLeaderTeamColor(leaders.assists, home, away)}
          />
        </div>
      </div>
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

function GameLeaderColumn({
  label,
  leader,
  teamColor,
}: {
  readonly label: 'PTS' | 'REB' | 'AST'
  readonly leader: CompletedGameStatLeader | null
  readonly teamColor: string | undefined
}) {
  return (
    <div className="game-leaders__column" data-stat={label.toLowerCase()}>
      <span className="game-leaders__label">{label}</span>
      {leader ? (
        <>
          <span className="game-leaders__value">{leader.value}</span>
          <span className="game-leaders__name">{leader.playerName}</span>
          <span className="game-leaders__team">
            {teamColor && (
              <span
                className="team-color-dot"
                style={{ background: teamColor }}
                aria-hidden="true"
              />
            )}
            {leader.programName}
          </span>
        </>
      ) : (
        <span className="game-leaders__empty">—</span>
      )}
    </div>
  )
}

function getLeaderTeamColor(
  leader: CompletedGameStatLeader | null,
  home: CompletedMatchupTeamInfo,
  away: CompletedMatchupTeamInfo,
): string | undefined {
  if (!leader) return undefined
  if (leader.programName === home.name) return home.accentColor
  if (leader.programName === away.name) return away.accentColor
  return undefined
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
