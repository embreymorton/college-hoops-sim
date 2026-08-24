import { formatPercentage, formatRating } from '../app/formatters'
import { formatTournamentRoundName } from '../app/postseasonFormatters'
import {
  RECORD_CATEGORIES,
  type PlayerTournamentCareer,
  type PlayerTournamentCareerHighs,
  type RecordCategory,
  type TournamentRunFinish,
} from '../dynasty'
import type { ProgramDefinition } from '../universe'

const LABELS: Readonly<Record<RecordCategory, string>> = {
  points: 'PTS', rebounds: 'REB', assists: 'AST', steals: 'STL', blocks: 'BLK',
}

function finishLabel(finish: TournamentRunFinish): string {
  switch (finish.status) {
    case 'in-progress': return 'In progress'
    case 'runner-up': return 'National runner-up'
    case 'national-champion': return 'National champion'
    case 'eliminated': return `Eliminated · ${formatTournamentRoundName(finish.round)}`
  }
}

export function PlayerTournamentLegacy({
  career,
  highs,
  programsById,
  onSelectProgram,
}: {
  readonly career: PlayerTournamentCareer
  readonly highs: PlayerTournamentCareerHighs
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly onSelectProgram: (programId: string) => void
}) {
  if (career.runs.length === 0) {
    return <section className="section"><h2 className="section-title">Tournament Legacy</h2><p className="league-empty-state">No Tournament history.</p></section>
  }
  const stats = career.stats
  return <section className="section tournament-legacy" aria-labelledby="tournament-legacy-heading">
    <h2 id="tournament-legacy-heading" className="section-title">Tournament Legacy</h2>
    <div className="tournament-legacy__summary">
      <div className="tournament-legacy__group tournament-legacy__group--performance">
        <span className="tournament-legacy__group-label">Performance</span>
        <div className="stat-trio">
          <div className="stat-trio__item"><span className="stat-trio__value">{stats.gamesPlayed}</span><span className="stat-trio__label">GP</span></div>
          <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(stats.pointsPerGame)}</span><span className="stat-trio__label">PPG</span></div>
          <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(stats.reboundsPerGame)}</span><span className="stat-trio__label">RPG</span></div>
          <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(stats.assistsPerGame)}</span><span className="stat-trio__label">APG</span></div>
          <div className="stat-trio__item"><span className="stat-trio__value">{formatPercentage(stats.fieldGoalPercentage)}</span><span className="stat-trio__label">FG%</span></div>
        </div>
      </div>
      <div className="tournament-legacy__divider" aria-hidden="true" />
      <div className="tournament-legacy__group tournament-legacy__group--achievement">
        <span className="tournament-legacy__group-label">Achievement</span>
        <div className="stat-trio">
          <div className="stat-trio__item"><span className="stat-trio__value">{career.tournamentAppearances}</span><span className="stat-trio__label">Appearances</span></div>
          <div className="stat-trio__item"><span className="stat-trio__value">{career.finalFourAppearances}</span><span className="stat-trio__label">Final Fours</span></div>
          <div className="stat-trio__item"><span className="stat-trio__value">{career.championshipGameAppearances}</span><span className="stat-trio__label">Title Games</span></div>
          <div className="stat-trio__item tournament-legacy__championships"><span className="stat-trio__value">{career.nationalChampionships}</span><span className="stat-trio__label">Championships</span></div>
        </div>
      </div>
    </div>

    <h3 className="section-subtitle">Tournament Runs</h3>
    <div className="table-scroll"><table className="data-table tournament-runs-table"><thead><tr><th>Season</th><th>Program</th><th>Finish</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
      <tbody>{career.runs.slice().reverse().map((run) => <tr key={run.seasonNumber} data-champion={run.finish.status === 'national-champion' || undefined}>
        <td>S{run.seasonNumber}</td><td><button className="text-link-button" type="button" onClick={() => onSelectProgram(run.programId)}>#{run.seed} {programsById.get(run.programId)?.abbreviation ?? run.programId}</button></td>
        <td className="tournament-runs-table__finish">{finishLabel(run.finish)}{run.isMop ? <span className="tournament-runs-table__mop"> · MOP</span> : ''}</td><td>{run.stats.gamesPlayed}</td><td>{run.stats.points}</td><td>{run.stats.rebounds}</td><td>{run.stats.assists}</td>
      </tr>)}</tbody></table></div>

    <h3 className="section-subtitle">Tournament Career Highs</h3>
    {!highs.hasAppearances ? <p className="league-empty-state">No Tournament appearances yet.</p> : <dl className="player-career-highs">
      {RECORD_CATEGORIES.map((category) => {
        const high = highs.categories[category]
        return <div className="player-career-highs__item" key={category}><dt>{LABELS[category]}</dt><dd>{high ? <><strong>{high.value}</strong><span>S{high.seasonNumber} · {formatTournamentRoundName(high.round)} · vs {high.opponentProgramName}</span>{high.occurrenceCount > 1 ? <small>{high.occurrenceCount}×</small> : null}</> : '—'}</dd></div>
      })}
    </dl>}

    <details className="tournament-game-history">
      <summary className="section-subtitle">Tournament Game History</summary>
      <div className="table-scroll"><table className="data-table game-log-table game-log-table--dense"><thead><tr><th>Season</th><th>Round</th><th>Opponent</th><th>Result</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th></tr></thead>
        <tbody>{career.runs.slice().reverse().flatMap((run) => run.games.slice().reverse()).map((game) => <tr key={`${game.seasonNumber}:${game.gameId}`} data-status={game.result === 'W' ? 'win' : 'loss'} data-dnp={!game.didPlay}>
          <td>S{game.seasonNumber}</td><td>{formatTournamentRoundName(game.round)}</td><td><button className="text-link-button" type="button" onClick={() => onSelectProgram(game.opponentProgramId)}>{programsById.get(game.opponentProgramId)?.name ?? game.opponentProgramId}</button></td><td>{game.result} {game.teamScore}-{game.opponentScore}{game.overtimePeriods > 0 ? ` · ${game.overtimePeriods === 1 ? 'OT' : `${game.overtimePeriods}OT`}` : ''}</td>{game.didPlay ? <><td>{game.stats.minutes}</td><td>{game.stats.points}</td><td>{game.stats.rebounds}</td><td>{game.stats.assists}</td></> : <td colSpan={4}>DNP</td>}
        </tr>)}</tbody></table></div>
    </details>
  </section>
}
