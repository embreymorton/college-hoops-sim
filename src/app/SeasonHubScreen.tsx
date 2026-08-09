import { calculateTeamStrength, type Team, type TeamStrength } from '../engine'
import {
  ConferenceStandingsSection,
  HubSectionTabs,
  NextGameCard,
  RecentResultsSection,
  ScheduleTable,
  SeasonHeader,
  SuperSimConfirmDialog,
  SuperSimMenu,
  SuperSimSummaryDialog,
} from '../components'
import { MIDSEASON_ROUND, useSeasonStore } from '../store'
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
import { describeRoundProgress, formatRecord } from './seasonFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Compact recent-form strip; 3–5 games keeps the Hub from feeling like a full log. */
const RECENT_RESULTS_COUNT = 4

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
  const season = useSeasonStore((state) => state.season)
  const controlledProgramId = useSeasonStore(
    (state) => state.controlledProgramId,
  )
  const goToGamePrep = useSeasonStore((state) => state.goToGamePrep)
  const simulateNextGame = useSeasonStore((state) => state.simulateNextGame)
  const simulateRestOfRound = useSeasonStore(
    (state) => state.simulateRestOfRound,
  )
  const viewCompletedGame = useSeasonStore((state) => state.viewCompletedGame)
  const pendingSuperSim = useSeasonStore((state) => state.pendingSuperSim)
  const superSimSummary = useSeasonStore((state) => state.superSimSummary)
  const requestSuperSim = useSeasonStore((state) => state.requestSuperSim)
  const cancelSuperSim = useSeasonStore((state) => state.cancelSuperSim)
  const confirmSuperSim = useSeasonStore((state) => state.confirmSuperSim)
  const dismissSuperSimSummary = useSeasonStore(
    (state) => state.dismissSuperSimSummary,
  )
  const postseason = useSeasonStore((state) => state.postseason)
  const enterPostseason = useSeasonStore((state) => state.enterPostseason)
  const goToLeague = useSeasonStore((state) => state.goToLeague)
  const openTeamDetails = useSeasonStore((state) => state.openTeamDetails)

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

  return (
    <>
      <HubSectionTabs activeLabel="Season" onSelectLeague={goToLeague} />
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

      <section className="section" aria-labelledby="next-game-heading">
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
            <button
              type="button"
              className="button button--primary season-complete-panel__action"
              onClick={enterPostseason}
            >
              {postseason ? 'Return to National Tournament' : 'Enter National Tournament'}
            </button>
          </div>
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
              onManageRotation={goToGamePrep}
            />
          )
        )}
        {currentRound !== undefined && (
          <div className="round-progress">
            <p className="round-progress__text">
              Round {currentRound} —{' '}
              {describeRoundProgress(
                roundGameCount - pendingRoundGames.length,
                roundGameCount,
              )}
            </p>
            <div className="round-progress__actions">
              {hasSimulatableRoundGames && (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={simulateRestOfRound}
                >
                  Simulate Rest of Round
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
      </section>

      <section className="section" aria-labelledby="standings-heading">
        <h2 id="standings-heading" className="section-title">
          Conference Standings
        </h2>
        <ConferenceStandingsSection
          universe={UNIVERSE_V0}
          season={season}
          controlledProgramId={controlledProgramId}
          defaultConferenceId={controlledProgram.conferenceId}
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

      {pendingSuperSim && (
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
          onContinue={dismissSuperSimSummary}
        />
      )}
    </>
  )
}
