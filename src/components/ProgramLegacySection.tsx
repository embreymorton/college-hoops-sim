import type { ProgramLegacy } from '../dynasty'
import { formatHistoricalTournamentOutcome } from '../app/programLegacyFormatters'
import { formatOrdinal, formatRecord } from '../app/seasonFormatters'

interface ProgramLegacySectionProps {
  readonly legacy: ProgramLegacy
}

export function ProgramLegacySection({ legacy }: ProgramLegacySectionProps) {
  if (legacy.completedSeasons === 0) {
    return (
      <p className="league-empty-state">
        Dynasty history will appear after this Season is completed.
      </p>
    )
  }

  return (
    <div className="program-legacy">
      <dl className="program-legacy__resume">
        <div><dt>Completed Seasons</dt><dd>{legacy.completedSeasons}</dd></div>
        <div><dt>Dynasty Record</dt><dd>{formatRecord(legacy.wins, legacy.losses)}</dd></div>
        <div><dt>Tournament Appearances</dt><dd>{legacy.tournamentAppearances}</dd></div>
        <div><dt>Championships</dt><dd>{legacy.championships}</dd></div>
        <div><dt>Runner-Up Finishes</dt><dd>{legacy.runnerUpFinishes}</dd></div>
      </dl>

      <div className="program-legacy__highlights">
        <p>
          <span>Best Tournament Finish</span>
          <strong className={legacy.bestTournamentOutcome?.status === 'national-champion' ? 'program-legacy__champion' : undefined}>
            {legacy.tournamentAppearances === 0 || !legacy.bestTournamentOutcome
              ? 'No Tournament Appearances'
              : formatHistoricalTournamentOutcome(legacy.bestTournamentOutcome)}
          </strong>
        </p>
        <p>
          <span>Best Regular Season</span>
          <strong>
            {legacy.bestRegularSeason
              ? `Season ${legacy.bestRegularSeason.seasonNumber} · ${formatRecord(legacy.bestRegularSeason.record.wins, legacy.bestRegularSeason.record.losses)}`
              : '—'}
          </strong>
        </p>
      </div>

      <div className="program-legacy__trajectory">
        <h3>Program Trajectory</h3>
        <div className="program-legacy__trajectory-header" aria-hidden="true">
          <span>Season</span><span>Team OVR</span><span>Record</span><span>Conference</span><span>Tournament</span><span>Incoming</span>
        </div>
        <div className="program-legacy__season-list" role="list">
          {legacy.trajectorySeasons.map((season) => (
            <div className="program-legacy__season" role="listitem" key={season.seasonNumber}>
              <strong><span className="program-legacy__mobile-label">Season </span>{season.seasonNumber}</strong>
              <span><span className="program-legacy__mobile-label">Team OVR </span>{Math.round(season.teamOverall)}<span className="program-legacy__mobile-label"> OVR</span></span>
              <span><span className="program-legacy__mobile-label">Record </span>{formatRecord(season.record.wins, season.record.losses)}</span>
              <span><span className="program-legacy__mobile-label">Conference </span>{formatOrdinal(season.conferencePlace)}</span>
              <span className={season.tournamentOutcome.status === 'national-champion' ? 'program-legacy__champion' : undefined}>
                <span className="program-legacy__mobile-label">Tournament </span>
                {season.tournamentOutcome.status === 'did-not-qualify'
                  ? formatHistoricalTournamentOutcome(season.tournamentOutcome)
                  : `#${season.tournamentOutcome.seed} · ${formatHistoricalTournamentOutcome(season.tournamentOutcome)}`}
              </span>
              <span>
                <span className="program-legacy__mobile-label">Incoming </span>
                {season.incomingClass === null
                  ? '—'
                  : season.incomingClass.signeeCount === 0
                    ? '0 signees'
                    : `${season.incomingClass.signeeCount} · ${season.incomingClass.averageOverall!.toFixed(1)} OVR`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
