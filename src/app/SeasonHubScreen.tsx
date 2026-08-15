import { calculateTeamStrength, type Team, type TeamStrength } from '../engine'
import {
  CompletedMatchupCard,
  ConferenceStandingsSection,
  DynastySectionNav,
  NextGameCard,
  RecentResultsSection,
  RecruitingHubSummary,
  ScheduleTable,
  SeasonHeader,
  SeasonPreviewPromotion,
  SuperSimConfirmDialog,
  SuperSimMenu,
  SuperSimSummaryDialog,
} from '../components'
import { deriveProgramRecruitingBoard, shouldPromoteSeasonPreview } from '../dynasty'
import {
  MIDSEASON_ROUND,
  selectActivePostseason,
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { selectNationalTournamentField } from '../postseason'
import {
  deriveConferenceRecord,
  deriveConferenceStandings,
  deriveProgramRecord,
  getCompletedGamesForProgram,
  getCurrentRound,
  getNextGameForProgram,
  getPendingGamesForRound,
  getScheduleForProgram,
  isRegularSeasonComplete,
  type SeasonState,
} from '../season'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { formatOvertimeTag } from './formatters'
import { deriveGameLeaders } from './gameLeaders'
import { formatTournamentQualification } from './postseasonFormatters'
import {
  deriveFocusTargetSummaries,
  deriveHubCommitSummaries,
  deriveRecruitingActivityDescriptions,
} from './recruitingBattleFormatters'
import { describeRoundProgress, formatRecord } from './seasonFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Compact recent-form strip; 3–5 games keeps the Hub from feeling like a full log. */
const RECENT_RESULTS_COUNT = 5

function buildTeamInfo(
  season: SeasonState,
  programId: string,
  accentColor: string,
): { name: string; accentColor: string; strength: TeamStrength } {
  const programState = season.programStates[programId]
  const team = programState?.team as Team

  return {
    name: team.name,
    accentColor,
    strength: calculateTeamStrength(team, programState!.rotation),
  }
}

export function SeasonHubScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const openSeasonPreview = useDynastyStore((state) => state.openSeasonPreview)
  const season = useDynastyStore(selectActiveSeason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const goToGamePrep = useDynastyStore((state) => state.goToGamePrep)
  const goToHub = useDynastyStore((state) => state.goToHub)
  const goToCoaching = useDynastyStore((state) => state.goToCoaching)
  const simulateNextGame = useDynastyStore((state) => state.simulateNextGame)
  const simulateRestOfRound = useDynastyStore(
    (state) => state.simulateRestOfRound,
  )
  const viewCompletedGame = useDynastyStore((state) => state.viewCompletedGame)
  const lastPlayedGameId = useDynastyStore((state) => state.lastPlayedGameId)
  const pendingSuperSim = useDynastyStore((state) => state.pendingSuperSim)
  const pendingRecruitingSetupIntent = useDynastyStore(
    (state) => state.pendingRecruitingSetupIntent,
  )
  const superSimSummary = useDynastyStore((state) => state.superSimSummary)
  const requestSuperSim = useDynastyStore((state) => state.requestSuperSim)
  const cancelSuperSim = useDynastyStore((state) => state.cancelSuperSim)
  const confirmSuperSim = useDynastyStore((state) => state.confirmSuperSim)
  const dismissSuperSimSummary = useDynastyStore(
    (state) => state.dismissSuperSimSummary,
  )
  const postseason = useDynastyStore(selectActivePostseason)
  const enterPostseason = useDynastyStore((state) => state.enterPostseason)
  const goToLeague = useDynastyStore((state) => state.goToLeague)
  const goToRecruiting = useDynastyStore((state) => state.goToRecruiting)
  const generateControlledDraftBoard = useDynastyStore(
    (state) => state.generateControlledDraftBoard,
  )
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)
  const recruitingActivityBaselinePeriod = useDynastyStore(
    (state) => state.recruitingActivityBaselinePeriod,
  )

  if (!season || !controlledProgramId) {
    return null
  }

  const controlledProgram = PROGRAMS_BY_ID.get(controlledProgramId)
  const controlledConference = UNIVERSE_V0.conferences.find(
    (conference) => conference.id === controlledProgram?.conferenceId,
  )

  if (!controlledProgram || !controlledConference) {
    return null
  }

  const recruiting = dynasty?.recruiting
  const recruitingBoard =
    dynasty && recruiting ? deriveProgramRecruitingBoard(dynasty, controlledProgramId) : undefined
  const focusTargets =
    dynasty && recruitingBoard ? deriveFocusTargetSummaries(dynasty, recruitingBoard) : []
  const recruitingCommits =
    dynasty && recruitingBoard ? deriveHubCommitSummaries(dynasty, recruitingBoard) : []
  const recruitingActivity =
    dynasty && recruiting && recruitingActivityBaselinePeriod !== null
      ? deriveRecruitingActivityDescriptions(
          dynasty,
          recruitingActivityBaselinePeriod,
          PROGRAMS_BY_ID,
        )
      : []

  const overallRecord = deriveProgramRecord(season, controlledProgramId)
  const conferenceRecord = deriveConferenceRecord(season, controlledProgramId)
  const currentRound = getCurrentRound(season)
  const seasonComplete = isRegularSeasonComplete(season)
  const nextGame = getNextGameForProgram(season, controlledProgramId)
  const pendingRoundGames =
    currentRound !== undefined
      ? getPendingGamesForRound(season, currentRound)
      : []
  const roundGameCount =
    currentRound !== undefined
      ? season.schedule.games.filter((game) => game.round === currentRound)
          .length
      : 0
  const hasSimulatableRoundGames = pendingRoundGames.some(
    (game) =>
      game.homeProgramId !== controlledProgramId &&
      game.awayProgramId !== controlledProgramId,
  )
  const opponentId = nextGame
    ? nextGame.homeProgramId === controlledProgramId
      ? nextGame.awayProgramId
      : nextGame.homeProgramId
    : undefined
  const opponentProgram = opponentId ? PROGRAMS_BY_ID.get(opponentId) : undefined
  const opponentConference = opponentProgram
    ? UNIVERSE_V0.conferences.find(
        (conference) => conference.id === opponentProgram.conferenceId,
      )
    : undefined
  const recentGames = getCompletedGamesForProgram(season, controlledProgramId)
    .slice()
    .sort(
      (first, second) =>
        second.game.round - first.game.round ||
        second.game.index - first.game.index,
    )
    .slice(0, RECENT_RESULTS_COUNT)
  // Midseason is only a meaningful checkpoint while Round 12 has not yet
  // fully resolved; once the Season has moved past it, offering it again
  // would be a confusing no-op rather than hiding a stale option.
  const showMidseason =
    currentRound !== undefined && currentRound <= MIDSEASON_ROUND
  const isSuperSimDialogOpen = Boolean(pendingSuperSim) || Boolean(superSimSummary)
  const controlledStandingIndex = deriveConferenceStandings(
    UNIVERSE_V0,
    season,
    controlledProgram.conferenceId,
  ).findIndex((row) => row.programId === controlledProgramId)
  const controlledConferenceStanding =
    controlledStandingIndex === -1 ? undefined : controlledStandingIndex + 1
  const tournamentField = seasonComplete
    ? postseason?.field ?? selectNationalTournamentField(UNIVERSE_V0, season).field
    : []
  const controlledTournamentEntry = tournamentField.find(
    (entry) => entry.programId === controlledProgramId,
  )
  const lastPlayedGame = lastPlayedGameId
    ? season.schedule.games.find((game) => game.id === lastPlayedGameId)
    : undefined
  const lastPlayedResult = lastPlayedGameId
    ? season.resultsByGameId[lastPlayedGameId]
    : undefined
  // Keep the concise result visible only while its round is still the
  // canonical current round. If this game completed the entire round, normal
  // Season derivation advances and the next matchup takes its place.
  const completedHubGame =
    lastPlayedGame &&
    lastPlayedResult &&
    lastPlayedGame.round === currentRound
      ? { game: lastPlayedGame, result: lastPlayedResult }
      : undefined
  const controlledRoundGame =
    currentRound === undefined
      ? undefined
      : season.schedule.games.find(
          (game) =>
            game.round === currentRound &&
            (game.homeProgramId === controlledProgramId ||
              game.awayProgramId === controlledProgramId),
        )
  const controlledRoundGameComplete = Boolean(
    controlledRoundGame && season.resultsByGameId[controlledRoundGame.id],
  )

  return (
    <div className="season-hub">
      <DynastySectionNav
        competitionLabel="Season"
        activeSection="competition"
        onSelectCompetition={goToHub}
        onSelectCoaching={goToCoaching}
        onSelectRecruiting={goToRecruiting}
        onSelectLeague={goToLeague}
      />
      <SeasonHeader
        programName={controlledProgram.name}
        accentColor={controlledProgram.branding.primaryColor}
        conferenceName={controlledConference.name}
        seasonNumber={season.seasonNumber}
        overallRecord={overallRecord}
        conferenceRecord={conferenceRecord}
        currentRound={currentRound}
        roundCount={season.schedule.roundCount}
        isComplete={seasonComplete}
      />

      {shouldPromoteSeasonPreview(season) ? <SeasonPreviewPromotion seasonNumber={season.seasonNumber} onOpen={openSeasonPreview} /> : null}

      <div className="hub-primary-grid">
      <section className="section hub-primary-grid__game" aria-labelledby="next-game-heading">
        <h2 id="next-game-heading" className="visually-hidden">
          Next game
        </h2>
        {seasonComplete ? (
          <div className="season-complete-panel">
            <p className="eyebrow-tag">Regular Season Complete</p>
            <p className="season-complete-panel__body">
              Final record {formatRecord(overallRecord.wins, overallRecord.losses)}{' '}
              ({formatRecord(conferenceRecord.wins, conferenceRecord.losses)}{' '}
              conference).
            </p>
            <div className="season-complete-panel__tournament">
              <p className="season-complete-panel__tournament-label">
                National Tournament
              </p>
              <p className="season-complete-panel__tournament-status">
                {formatTournamentQualification(controlledTournamentEntry)}
              </p>
            </div>
            <button
              type="button"
              className="button button--primary season-complete-panel__action"
              onClick={enterPostseason}
            >
              {controlledTournamentEntry
                ? 'Enter National Tournament'
                : 'View National Tournament'}
            </button>
          </div>
        ) : completedHubGame ? (
          <CompletedMatchupCard
            roundLabel={`Round ${completedHubGame.game.round}`}
            siteLabel={
              completedHubGame.game.homeProgramId === controlledProgramId
                ? 'Home'
                : 'Away'
            }
            overtimeTag={formatOvertimeTag(
              completedHubGame.result.overtimePeriods,
            )}
            home={{
              name: season.programStates[completedHubGame.game.homeProgramId]!
                .team.name,
              accentColor: PROGRAMS_BY_ID.get(
                completedHubGame.game.homeProgramId,
              )!.branding.primaryColor,
              score: completedHubGame.result.homeScore,
              isWinner:
                completedHubGame.result.winnerId ===
                completedHubGame.game.homeProgramId,
            }}
            away={{
              name: season.programStates[completedHubGame.game.awayProgramId]!
                .team.name,
              accentColor: PROGRAMS_BY_ID.get(
                completedHubGame.game.awayProgramId,
              )!.branding.primaryColor,
              score: completedHubGame.result.awayScore,
              isWinner:
                completedHubGame.result.winnerId ===
                completedHubGame.game.awayProgramId,
            }}
            resultLabel={
              completedHubGame.result.winnerId === controlledProgramId
                ? 'Win'
                : 'Loss'
            }
            resultTone={
              completedHubGame.result.winnerId === controlledProgramId
                ? 'positive'
                : 'negative'
            }
            leaders={deriveGameLeaders(
              completedHubGame.result,
              season.programStates[completedHubGame.result.homeTeamId]!.team,
              season.programStates[completedHubGame.result.awayTeamId]!.team,
            )}
            onViewBoxScore={() => viewCompletedGame(completedHubGame.game.id)}
          />
        ) : (
          nextGame &&
          opponentProgram &&
          opponentConference && (
            <NextGameCard
              round={nextGame.round}
              isControlledHome={nextGame.homeProgramId === controlledProgramId}
              controlled={buildTeamInfo(
                season,
                controlledProgramId,
                controlledProgram.branding.primaryColor,
              )}
              opponent={buildTeamInfo(
                season,
                opponentProgram.id,
                opponentProgram.branding.primaryColor,
              )}
              opponentConferenceName={opponentConference.name}
              opponentRecord={deriveProgramRecord(season, opponentProgram.id)}
              opponentConferenceRecord={deriveConferenceRecord(
                season,
                opponentProgram.id,
              )}
              onSimulate={simulateNextGame}
              onGamePrep={goToGamePrep}
            />
          )
        )}
        {currentRound !== undefined && (
          <div className="round-progress">
            <div>
              <p className="round-progress__text">
                Round {currentRound} —{' '}
                {describeRoundProgress(
                  roundGameCount - pendingRoundGames.length,
                  roundGameCount,
                )}
              </p>
              {controlledRoundGameComplete && pendingRoundGames.length > 0 && (
                <p className="round-progress__detail">
                  Advance will simulate the remaining {pendingRoundGames.length}{' '}
                  {pendingRoundGames.length === 1 ? 'game' : 'games'}.
                </p>
              )}
            </div>
            <div className="round-progress__actions">
              {hasSimulatableRoundGames && (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={simulateRestOfRound}
                >
                  {controlledRoundGameComplete
                    ? 'Advance to Next Round'
                    : 'Simulate Other Games'}
                </button>
              )}
              <SuperSimMenu
                showMidseason={showMidseason}
                midseasonRound={MIDSEASON_ROUND}
                endOfSeasonRound={season.schedule.roundCount}
                onSelect={requestSuperSim}
                isDialogOpen={isSuperSimDialogOpen}
              />
            </div>
          </div>
        )}
        {currentRound === undefined && !postseason && (
          <div className="round-progress">
            <p className="round-progress__text">Postseason is ready.</p>
            <div className="round-progress__actions">
              <SuperSimMenu
                showMidseason={false}
                showEndOfRegularSeason={false}
                midseasonRound={MIDSEASON_ROUND}
                endOfSeasonRound={season.schedule.roundCount}
                onSelect={requestSuperSim}
                isDialogOpen={isSuperSimDialogOpen}
              />
            </div>
          </div>
        )}
      </section>

      {recruiting && recruitingBoard && (
        <section
          className="section hub-primary-grid__recruiting"
          aria-labelledby="recruiting-summary-heading"
        >
          <h2 id="recruiting-summary-heading" className="visually-hidden">
            Recruiting
          </h2>
          <RecruitingHubSummary
            targetSeasonNumber={recruiting.targetSeasonNumber}
            phase={recruiting.phase}
            lastResolvedPeriod={recruiting.lastResolvedPeriod}
            board={recruitingBoard}
            focusTargets={focusTargets}
            commits={recruitingCommits}
            activity={recruitingActivity}
            onGenerateDraftBoard={generateControlledDraftBoard}
            onBuildManually={goToRecruiting}
          />
        </section>
      )}
      </div>

      <div className="hub-secondary-grid">
        <section className="section" aria-labelledby="standings-heading">
          <h2 id="standings-heading" className="section-title">
            {controlledConference.name} Standings
          </h2>
          <ConferenceStandingsSection
            universe={UNIVERSE_V0}
            season={season}
            controlledProgramId={controlledProgramId}
            conferenceId={controlledProgram.conferenceId}
            onSelectProgram={openTeamDetails}
          />
        </section>

        {recentGames.length > 0 && (
          <section className="section" aria-labelledby="recent-results-heading">
            <h2 id="recent-results-heading" className="section-title">
              Recent Results
            </h2>
            <RecentResultsSection
              games={recentGames}
              programId={controlledProgramId}
              programsById={PROGRAMS_BY_ID}
              onSelectGame={viewCompletedGame}
            />
          </section>
        )}
      </div>

      <section className="section" aria-labelledby="schedule-heading">
        <h2 id="schedule-heading" className="section-title">
          Schedule &amp; Results
        </h2>
        <ScheduleTable
          games={getScheduleForProgram(season, controlledProgramId)}
          controlledProgramId={controlledProgramId}
          programsById={PROGRAMS_BY_ID}
          resultsByGameId={season.resultsByGameId}
          nextGameId={nextGame?.id}
          onSelectGame={viewCompletedGame}
        />
      </section>

      {pendingSuperSim && !pendingRecruitingSetupIntent && (
        <SuperSimConfirmDialog
          kind={pendingSuperSim.kind}
          throughRound={pendingSuperSim.throughRound}
          controlledProgramName={controlledProgram.name}
          onCancel={cancelSuperSim}
          onConfirm={confirmSuperSim}
        />
      )}

      {superSimSummary && (
        <SuperSimSummaryDialog
          kind={superSimSummary.kind}
          controlledProgramName={controlledProgram.name}
          segmentRecord={{
            wins: superSimSummary.segmentWins,
            losses: superSimSummary.segmentLosses,
          }}
          overallRecord={overallRecord}
          conferenceRecord={conferenceRecord}
          conferenceStanding={controlledConferenceStanding}
          tournamentEntry={controlledTournamentEntry}
          onContinue={dismissSuperSimSummary}
        />
      )}
    </div>
  )
}
