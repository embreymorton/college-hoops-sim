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
  /** Colors the result tag — positive (accent) for a win/advance/title, muted for a loss/elimination. */
  readonly resultTone: 'positive' | 'negative'
  readonly leaders: CompletedGameTeamLeaders
  readonly onViewBoxScore: () => void
}

/**
 * Concise Hub presentation of one already-recorded canonical GameResult. The
 * result tag lives in the header, next to the round — not a separate block —
 * so this card's height stays close to the pre-game matchup card it replaces.
 */
export function CompletedMatchupCard({
  roundLabel,
  siteLabel,
  overtimeTag,
  home,
  away,
  resultLabel,
  resultTone,
  leaders,
  onViewBoxScore,
}: CompletedMatchupCardProps) {
  return (
    <div className="next-game-card next-game-card--final" aria-live="polite">
      <div className="next-game-card__eyebrow">
        <span className="next-game-card__eyebrow-left">
          <span className="eyebrow">{roundLabel}</span>
          <span className="next-game-card__result-tag" data-tone={resultTone}>
            {resultLabel}
          </span>
        </span>
        <span className="next-game-card__home-away">
          {siteLabel} · Final{overtimeTag ? `/${overtimeTag}` : ''}
        </span>
      </div>
      <div className="next-game-card__final-scores">
        <CompletedTeamRow team={away} />
        <CompletedTeamRow team={home} />
      </div>
      <div className="game-leaders" aria-label="Game leaders">
        <p className="game-leaders__heading">Game Leaders</p>
        <ul className="game-leaders__list">
          <GameLeaderRow
            label="PTS"
            leader={leaders.points}
            teamColor={getLeaderTeamColor(leaders.points, home, away)}
          />
          <GameLeaderRow
            label="REB"
            leader={leaders.rebounds}
            teamColor={getLeaderTeamColor(leaders.rebounds, home, away)}
          />
          <GameLeaderRow
            label="AST"
            leader={leaders.assists}
            teamColor={getLeaderTeamColor(leaders.assists, home, away)}
          />
        </ul>
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

/**
 * One dense row per stat — "PTS 27 · Mason Webb" plus the scoring Program —
 * rather than three oversized bordered columns, so the completed card's
 * footprint stays close to the pregame card it replaces.
 */
function GameLeaderRow({
  label,
  leader,
  teamColor,
}: {
  readonly label: 'PTS' | 'REB' | 'AST'
  readonly leader: CompletedGameStatLeader | null
  readonly teamColor: string | undefined
}) {
  return (
    <li className="game-leaders__row" data-stat={label.toLowerCase()}>
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
    </li>
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
