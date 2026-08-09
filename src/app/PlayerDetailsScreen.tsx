import {
  ExplorationBackButton,
  PlayerDetailsHeader,
  PlayerGameLogTable,
} from '../components'
import { derivePlayerSeasonStats, getPlayerGameLog } from '../season'
import { useSeasonStore } from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { formatPercentage, formatRating } from './formatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Player Details: identity/ratings plus regular-season stats and game log, for any Player. */
export function PlayerDetailsScreen() {
  const season = useSeasonStore((state) => state.season)
  const selectedPlayerProgramId = useSeasonStore(
    (state) => state.selectedPlayerProgramId,
  )
  const selectedPlayerId = useSeasonStore((state) => state.selectedPlayerId)
  const explorationViewHistory = useSeasonStore(
    (state) => state.explorationViewHistory,
  )
  const goBackFromExploration = useSeasonStore(
    (state) => state.goBackFromExploration,
  )
  const openTeamDetails = useSeasonStore((state) => state.openTeamDetails)

  if (!season || !selectedPlayerProgramId || !selectedPlayerId) {
    return null
  }

  const programState = season.programStates[selectedPlayerProgramId]
  const program = PROGRAMS_BY_ID.get(selectedPlayerProgramId)
  const player = programState?.team.roster.find(
    (candidate) => candidate.id === selectedPlayerId,
  )

  if (!programState || !program || !player) {
    return null
  }

  const stats = derivePlayerSeasonStats(
    season,
    selectedPlayerProgramId,
    selectedPlayerId,
  )
  const gameLog = getPlayerGameLog(season, selectedPlayerProgramId, selectedPlayerId)
  const backDestination = explorationViewHistory.at(-1) ?? 'hub'

  return (
    <>
      <ExplorationBackButton
        destination={backDestination}
        onClick={goBackFromExploration}
      />

      <PlayerDetailsHeader
        player={player}
        programName={program.name}
        accentColor={program.branding.primaryColor}
        onSelectTeam={() => openTeamDetails(selectedPlayerProgramId)}
      />

      <section className="section" aria-labelledby="player-stats-heading">
        <div className="section-heading">
          <p className="eyebrow-tag">Regular Season</p>
        </div>
        {stats.gamesPlayed === 0 ? (
          <p className="section-hint">No regular-season games played yet.</p>
        ) : null}
        <div className="player-stat-block">
          <div className="stat-trio player-stat-block__row">
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {formatRating(stats.pointsPerGame)}
              </span>
              <span className="stat-trio__label">PPG</span>
            </div>
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {formatRating(stats.reboundsPerGame)}
              </span>
              <span className="stat-trio__label">RPG</span>
            </div>
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {formatRating(stats.assistsPerGame)}
              </span>
              <span className="stat-trio__label">APG</span>
            </div>
          </div>
          <div className="stat-trio player-stat-block__row player-stat-block__row--secondary">
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {formatRating(stats.stealsPerGame)}
              </span>
              <span className="stat-trio__label">SPG</span>
            </div>
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {formatRating(stats.blocksPerGame)}
              </span>
              <span className="stat-trio__label">BPG</span>
            </div>
          </div>
          <div className="stat-trio player-stat-block__row player-stat-block__row--secondary">
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {formatPercentage(stats.fieldGoalPercentage)}
              </span>
              <span className="stat-trio__label">FG%</span>
            </div>
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {formatPercentage(stats.threePointPercentage)}
              </span>
              <span className="stat-trio__label">3P%</span>
            </div>
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {formatPercentage(stats.freeThrowPercentage)}
              </span>
              <span className="stat-trio__label">FT%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="player-game-log-heading">
        <h2 id="player-game-log-heading" className="section-title">
          Game Log
        </h2>
        <PlayerGameLogTable entries={gameLog} programsById={PROGRAMS_BY_ID} />
      </section>
    </>
  )
}
