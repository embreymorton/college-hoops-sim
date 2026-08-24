interface NationalChampionshipRecapProps {
  readonly champion: {
    readonly name: string
    readonly score: number
  }
  readonly runnerUp: {
    readonly name: string
    readonly score: number
  }
  readonly overtimeTag: string | null
  readonly onViewBoxScore: () => void
  readonly mop?: {
    readonly playerName: string
    readonly programName: string
    readonly pointsPerGame: number
    readonly reboundsPerGame: number
    readonly assistsPerGame: number
    readonly onSelect: () => void
  }
}

function formatStat(value: number): string {
  return value.toFixed(1)
}

/** Canonical completed-Tournament result, independent of session game history. */
export function NationalChampionshipRecap({
  champion,
  runnerUp,
  overtimeTag,
  onViewBoxScore,
  mop,
}: NationalChampionshipRecapProps) {
  return (
    <div className="national-championship-recap">
      <div className="national-championship-recap__heading">
        <p className="eyebrow-tag">National Championship</p>
        <span className="national-championship-recap__final">
          Final{overtimeTag ? `/${overtimeTag}` : ''}
        </span>
      </div>
      <div className="national-championship-recap__scoreboard">
        <div className="national-championship-recap__team" data-winner="true">
          <strong>{champion.name}</strong>
          <strong className="national-championship-recap__score">{champion.score}</strong>
        </div>
        <div className="national-championship-recap__team">
          <span>{runnerUp.name}</span>
          <span className="national-championship-recap__score">{runnerUp.score}</span>
        </div>
      </div>
      <p className="national-championship-recap__champion">
        {champion.name} is your National Champion.
      </p>
      {mop && (
        <div className="national-championship-recap__mop">
          <p className="eyebrow-tag">Tournament Most Outstanding Player</p>
          <div className="national-championship-recap__mop-identity">
            <button type="button" className="text-link-button" onClick={mop.onSelect}>{mop.playerName}</button>
            <span>{mop.programName}</span>
          </div>
          <div className="stat-trio">
            <div className="stat-trio__item"><span className="stat-trio__value">{formatStat(mop.pointsPerGame)}</span><span className="stat-trio__label">PPG</span></div>
            <div className="stat-trio__item"><span className="stat-trio__value">{formatStat(mop.reboundsPerGame)}</span><span className="stat-trio__label">RPG</span></div>
            <div className="stat-trio__item"><span className="stat-trio__value">{formatStat(mop.assistsPerGame)}</span><span className="stat-trio__label">APG</span></div>
          </div>
        </div>
      )}
      <button
        type="button"
        className="button button--ghost national-championship-recap__action"
        onClick={onViewBoxScore}
      >
        View Box Score
      </button>
    </div>
  )
}
