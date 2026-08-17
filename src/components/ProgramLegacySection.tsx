import type { ProgramLegacy } from '../dynasty'
import { formatHistoricalTournamentOutcome } from '../app/programLegacyFormatters'
import { formatRecord } from '../app/seasonFormatters'

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
          <strong>{legacy.bestTournamentOutcome ? formatHistoricalTournamentOutcome(legacy.bestTournamentOutcome) : '—'}</strong>
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

      <div className="program-legacy__recent">
        <h3>Recent Seasons</h3>
        <div className="program-legacy__season-list" role="list">
          {legacy.recentSeasons.map((season) => (
            <div className="program-legacy__season" role="listitem" key={season.seasonNumber}>
              <strong>Season {season.seasonNumber}</strong>
              <span>{formatRecord(season.record.wins, season.record.losses)}</span>
              <span>{formatHistoricalTournamentOutcome(season.tournamentOutcome)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
