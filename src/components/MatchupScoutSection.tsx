import type { CSSProperties } from 'react'
import {
  formatPercentage,
  formatRating,
  formatSignedRating,
} from '../app/formatters'
import { formatOrdinal } from '../app/seasonFormatters'
import type {
  MatchupScoutObservation,
  MatchupScoutReport,
} from '../matchupScout'
import type { ProgramDefinition } from '../universe'

interface MatchupScoutSectionProps {
  readonly report: MatchupScoutReport
  readonly opponentAccentColor: string
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly onSelectPlayer: (playerId: string) => void
}

function formatObservationValue(observation: MatchupScoutObservation): string {
  if (observation.format === 'percentage') {
    return formatPercentage(observation.value)
  }
  if (observation.format === 'signed-number') {
    return formatSignedRating(observation.value)
  }
  return formatRating(observation.value)
}

function OpponentProfile({ report }: { readonly report: MatchupScoutReport }) {
  if (report.sampleStatus === 'no-data') {
    return (
      <p className="matchup-scout__empty">
        No Season results yet. Statistical profile unavailable.
      </p>
    )
  }

  if (report.sampleStatus === 'limited') {
    return (
      <p className="matchup-scout__empty">
        Limited Season data · {report.gamesPlayed} completed game{report.gamesPlayed === 1 ? '' : 's'}.
      </p>
    )
  }

  if (report.observations.length === 0) {
    return (
      <p className="matchup-scout__empty">
        No clear league-relative tendencies yet.
      </p>
    )
  }

  return (
    <>
      {report.sampleStatus === 'early' && (
        <p className="matchup-scout__sample-note">
          Early-Season profile · {report.gamesPlayed} games
        </p>
      )}
      <ul className="matchup-scout__observations">
        {report.observations.map((observation) => (
          <li key={observation.key} data-polarity={observation.polarity}>
            <span className="matchup-scout__observation-label">
              {observation.label}
            </span>
            <span className="matchup-scout__evidence">
              {formatOrdinal(observation.rank)} of {observation.leagueSize} ·{' '}
              {formatObservationValue(observation)} {observation.unit}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function PlayersToWatch({
  report,
  onSelectPlayer,
}: Pick<MatchupScoutSectionProps, 'report' | 'onSelectPlayer'>) {
  return (
    <div className="matchup-scout__players">
      {report.playersToWatch.map((player) => (
        <button
          key={player.playerId}
          type="button"
          className="matchup-scout__player"
          onClick={() => onSelectPlayer(player.playerId)}
        >
          <span className="matchup-scout__player-identity">
            <span className="matchup-scout__player-name">
              {player.firstName} {player.lastName}
            </span>
            <span className="matchup-scout__player-meta">
              {player.position} · {player.classYear} · {player.gamesPlayed} GP
            </span>
          </span>
          <span className="matchup-scout__player-production">
            {formatRating(player.pointsPerGame)} PPG ·{' '}
            {formatRating(player.reboundsPerGame)} RPG ·{' '}
            {formatRating(player.assistsPerGame)} APG
          </span>
          {player.topTenRanks.length > 0 && (
            <span className="matchup-scout__distinctions">
              {player.topTenRanks.map(({ category, rank }) => `#${rank} ${category}`).join(' · ')}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function GameContext({
  report,
  programsById,
}: Pick<MatchupScoutSectionProps, 'report' | 'programsById'>) {
  const meeting = report.priorMeeting

  return (
    <div className="matchup-scout__context">
      {report.currentStreak && (
        <p className="matchup-scout__streak">
          {report.currentStreak.count}-game {report.currentStreak.outcome === 'W' ? 'winning' : 'losing'} streak
        </p>
      )}

      {report.recentForm.length > 0 ? (
        <ul className="matchup-scout__form-list" aria-label="Opponent recent form">
          {report.recentForm.map((game) => {
            const opponentName = programsById.get(game.opponentProgramId)?.name ?? game.opponentProgramId
            const location = game.location === 'neutral'
              ? 'vs'
              : game.location === 'home' ? 'vs' : 'at'
            return (
              <li key={`${game.competition}:${game.gameId}`} data-outcome={game.outcome.toLowerCase()}>
                <span className="matchup-scout__form-outcome">{game.outcome}</span>
                <span className="matchup-scout__form-score">{game.teamScore}-{game.opponentScore}</span>
                <span className="matchup-scout__form-opponent">{location} {opponentName}</span>
                {game.competition === 'tournament' && (
                  <span className="matchup-scout__form-tag">Tournament</span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="matchup-scout__empty">No completed games yet.</p>
      )}

      {meeting && (
        <div className="matchup-scout__meeting">
          <span className="matchup-scout__context-label">Previous Meeting</span>
          <span>
            {programsById.get(meeting.homeProgramId)?.name ?? meeting.homeProgramId}{' '}
            {meeting.homeScore}, {' '}
            {programsById.get(meeting.awayProgramId)?.name ?? meeting.awayProgramId}{' '}
            {meeting.awayScore}
          </span>
        </div>
      )}
    </div>
  )
}

/** Shared compact Scout presentation for regular-season and Tournament Game Prep. */
export function MatchupScoutSection({
  report,
  opponentAccentColor,
  programsById,
  onSelectPlayer,
}: MatchupScoutSectionProps) {
  const style = { '--team-accent': opponentAccentColor } as CSSProperties

  return (
    <section className="section matchup-scout" style={style} aria-labelledby="matchup-scout-heading">
      <div className="section-heading matchup-scout__heading">
        <div>
          <h2 id="matchup-scout-heading" className="section-title">Matchup Scout</h2>
          <p className="section-hint">Opponent identity, key Players, and recent form.</p>
        </div>
      </div>
      <div className="matchup-scout__grid">
        <div className="matchup-scout__column">
          <h3 className="matchup-scout__subheading">Opponent Profile</h3>
          <OpponentProfile report={report} />
        </div>
        <div className="matchup-scout__column">
          <h3 className="matchup-scout__subheading">Players to Watch</h3>
          <PlayersToWatch report={report} onSelectPlayer={onSelectPlayer} />
        </div>
        <div className="matchup-scout__column">
          <h3 className="matchup-scout__subheading">Game Context</h3>
          <GameContext report={report} programsById={programsById} />
        </div>
      </div>
    </section>
  )
}
