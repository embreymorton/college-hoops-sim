import type { CSSProperties } from 'react'
import {
  ExplorationBackButton,
  FollowPlayerButton,
  PlayerCareerProgressionTable,
  PlayerDetailsHeader,
  PlayerGameLogTable,
  PlayerRatingsGrid,
  PlayerRecruitingOrigin,
} from '../components'
import {
  derivePlayerCareerSummary,
  resolveDynastyPlayer,
} from '../dynasty'
import { derivePlayerSeasonStats, getPlayerGameLog } from '../season'
import { selectActiveSeason, useDynastyStore } from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { formatHeight, formatPercentage, formatRating } from './formatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Player Details: identity/ratings, career progression, Recruiting origin, regular-season stats, and game log, for any Player. */
export function PlayerDetailsScreen() {
  const season = useDynastyStore(selectActiveSeason)
  const dynasty = useDynastyStore((state) => state.dynasty)
  const selectedPlayerProgramId = useDynastyStore(
    (state) => state.selectedPlayerProgramId,
  )
  const selectedPlayerId = useDynastyStore((state) => state.selectedPlayerId)
  const explorationViewHistory = useDynastyStore(
    (state) => state.explorationViewHistory,
  )
  const goBackFromExploration = useDynastyStore(
    (state) => state.goBackFromExploration,
  )
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)

  if (!dynasty || !selectedPlayerId) {
    return null
  }

  const resolution = resolveDynastyPlayer(dynasty, selectedPlayerId)
  if (resolution.status === 'unknown') return null

  const program = PROGRAMS_BY_ID.get(resolution.programId)
  if (!program) return null

  const { player, careerHistory } = resolution
  const backDestination = explorationViewHistory.at(-1) ?? 'hub'
  const committedProgram = careerHistory.recruitingOrigin?.committedProgramId
    ? (PROGRAMS_BY_ID.get(careerHistory.recruitingOrigin.committedProgramId) ?? null)
    : null

  if (resolution.status === 'former') {
    const summary = derivePlayerCareerSummary(careerHistory)
    const careerRange =
      summary.firstSeasonNumber === summary.lastSeasonNumber
        ? `Season ${summary.firstSeasonNumber}`
        : `Seasons ${summary.firstSeasonNumber}–${summary.lastSeasonNumber}`
    const accentStyle = {
      '--team-accent': program.branding.primaryColor,
    } as CSSProperties

    return (
      <>
        <ExplorationBackButton destination={backDestination} onClick={goBackFromExploration} />
        <div className="player-legacy">
          <div className="season-header" style={accentStyle}>
            <div className="season-header__identity">
              <div>
                <h1 className="season-header__name">{player.firstName} {player.lastName}</h1>
                <p className="eyebrow-tag">Former Player</p>
                <p className="season-header__meta">
                  <span className="team-color-dot" style={{ background: program.branding.primaryColor }} aria-hidden="true" />
                  <button type="button" className="text-link-button" onClick={() => openTeamDetails(resolution.programId)}>{program.name}</button>
                  {' · '}{player.position} · {formatHeight(player.height)} · {careerRange}
                </p>
                <FollowPlayerButton playerId={player.id} />
              </div>
            </div>
            <div className="stat-trio season-header__stats season-header__stats--legacy">
              <div className="stat-trio__item"><span className="stat-trio__value">{summary.finalOverall}</span><span className="stat-trio__label">Final Ovr</span></div>
              <div className="stat-trio__item"><span className="stat-trio__value">{summary.peakOverall}</span><span className="stat-trio__label">Peak Ovr</span></div>
            </div>
          </div>

          <section className="section" aria-labelledby="player-career-summary-heading">
            <h2 id="player-career-summary-heading" className="section-title">College Career · Regular Season</h2>
            <div className="player-stat-block player-stat-block--legacy">
              <div className="stat-trio player-stat-block__row">
                <div className="stat-trio__item"><span className="stat-trio__value">{summary.gamesPlayed}</span><span className="stat-trio__label">GP</span></div>
                <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(summary.pointsPerGame)}</span><span className="stat-trio__label">PPG</span></div>
                <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(summary.reboundsPerGame)}</span><span className="stat-trio__label">RPG</span></div>
                <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(summary.assistsPerGame)}</span><span className="stat-trio__label">APG</span></div>
              </div>
              <div className="stat-trio player-stat-block__row player-stat-block__row--secondary">
                <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(summary.stealsPerGame)}</span><span className="stat-trio__label">SPG</span></div>
                <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(summary.blocksPerGame)}</span><span className="stat-trio__label">BPG</span></div>
                <div className="stat-trio__item"><span className="stat-trio__value">{formatPercentage(summary.fieldGoalPercentage)}</span><span className="stat-trio__label">FG%</span></div>
                <div className="stat-trio__item"><span className="stat-trio__value">{formatPercentage(summary.threePointPercentage)}</span><span className="stat-trio__label">3P%</span></div>
                <div className="stat-trio__item"><span className="stat-trio__value">{formatPercentage(summary.freeThrowPercentage)}</span><span className="stat-trio__label">FT%</span></div>
              </div>
            </div>
          </section>

          <section className="section" aria-labelledby="player-final-ratings-heading">
            <h2 id="player-final-ratings-heading" className="section-title">Final Ratings</h2>
            <PlayerRatingsGrid player={player} />
          </section>

          <section className="section" aria-labelledby="player-career-heading">
            <h2 id="player-career-heading" className="section-title">Career Progression</h2>
            <PlayerCareerProgressionTable seasons={careerHistory.seasons} />
          </section>

          {careerHistory.recruitingOrigin ? (
            <section className="section" aria-labelledby="player-recruiting-origin-heading">
              <h2 id="player-recruiting-origin-heading" className="section-title">Recruiting Origin</h2>
              <PlayerRecruitingOrigin origin={careerHistory.recruitingOrigin} committedProgram={committedProgram} />
            </section>
          ) : null}
        </div>
      </>
    )
  }

  if (!season || !selectedPlayerProgramId) {
    return null
  }

  const stats = derivePlayerSeasonStats(
    season,
    resolution.programId,
    selectedPlayerId,
  )
  const gameLog = getPlayerGameLog(season, resolution.programId, selectedPlayerId)

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
        onSelectTeam={() => openTeamDetails(resolution.programId)}
      />

      <section className="section" aria-labelledby="player-ratings-heading">
        <h2 id="player-ratings-heading" className="section-title">
          Ratings
        </h2>
        <PlayerRatingsGrid player={player} />
      </section>

      {careerHistory.recruitingOrigin ? (
        <section className="section" aria-labelledby="player-recruiting-origin-heading">
          <h2 id="player-recruiting-origin-heading" className="section-title">
            Recruiting Origin
          </h2>
          <PlayerRecruitingOrigin
            origin={careerHistory.recruitingOrigin}
            committedProgram={committedProgram}
          />
        </section>
      ) : null}

      <section className="section" aria-labelledby="player-career-heading">
        <h2 id="player-career-heading" className="section-title">
          Career Progression
        </h2>
        <PlayerCareerProgressionTable seasons={careerHistory.seasons} />
      </section>

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
        <PlayerGameLogTable
          entries={gameLog}
          programsById={PROGRAMS_BY_ID}
          onSelectProgram={openTeamDetails}
        />
      </section>
    </>
  )
}
