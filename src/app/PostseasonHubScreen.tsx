import type { ReactNode } from 'react'
import { calculateTeamStrength } from '../engine'
import {
  CompletedMatchupCard,
  DynastySectionNav,
  RecruitingCommitmentAlerts,
  RecruitingHubSummary,
  SeasonCompleteHandoff,
  SeasonHubFocusTargets,
  SuperSimConfirmDialog,
  SuperSimMenu,
  TournamentBracket,
  TournamentFieldTable,
  TournamentMatchupCard,
  TournamentStatusBanner,
  TournamentStatusHeader,
  type BracketSlot,
  type BracketSlotParticipant,
  type TournamentFieldRow,
} from '../components'
import { deriveProgramRecruitingBoard, FINAL_RECRUITING_PERIOD } from '../dynasty'
import {
  deriveNationalChampion,
  getCurrentTournamentRound,
  getGamesForTournamentRound,
  getPendingGamesForTournamentRound,
  getTournamentGameForProgram,
  isTournamentComplete,
  resolveTournamentGameParticipantSlots,
  resolveTournamentGameParticipants,
  TOURNAMENT_ROUNDS,
  type PostseasonState,
  type TournamentGame,
} from '../postseason'
import { deriveProgramRecord } from '../season'
import {
  selectActivePostseason,
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import {
  describeRemainingTournamentGames,
  formatTournamentQuickResult,
  formatTournamentProgressRoundName,
  formatTournamentRoundName,
} from './postseasonFormatters'
import { formatOvertimeTag } from './formatters'
import { deriveGameLeaders } from './gameLeaders'
import {
  deriveFocusTargetSummaries,
  deriveRecruitingActivityDescriptions,
} from './recruitingBattleFormatters'
import { deriveRecentControlledCommitment } from './recruitingFormatters'
import { describeRoundProgress } from './seasonFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Walks forward from Round of 16 to find the first round a Program lost, if any. */
function findEliminationGame(
  postseason: PostseasonState,
  programId: string,
): TournamentGame | undefined {
  for (const round of TOURNAMENT_ROUNDS) {
    const game = getTournamentGameForProgram(postseason, programId, round)
    if (!game) return undefined
    const result = postseason.resultsByGameId[game.id]
    if (!result) return undefined
    if (result.winnerId !== programId) return game
  }
  return undefined
}

function buildBracketSlots(
  postseason: PostseasonState,
  controlledProgramId: string,
): BracketSlot[] {
  function buildParticipant(
    programId: string | undefined,
    score: number | null,
    isWinner: boolean,
  ): BracketSlotParticipant | null {
    if (!programId) {
      return null
    }

    const entry = postseason.field.find(
      (candidate) => candidate.programId === programId,
    )!
    const program = PROGRAMS_BY_ID.get(programId)!

    return {
      seed: entry.seed,
      name: program.name,
      accentColor: program.branding.primaryColor,
      score,
      isWinner,
      isControlled: programId === controlledProgramId,
    }
  }

  return postseason.bracket.games.map((game) => {
    const [topProgramId, bottomProgramId] =
      resolveTournamentGameParticipantSlots(postseason, game.id)
    const result = postseason.resultsByGameId[game.id]
    const scoreFor = (programId: string | undefined): number | null => {
      if (!result || !programId) return null
      return result.homeTeamId === programId
        ? result.homeScore
        : result.awayScore
    }
    const top = buildParticipant(
      topProgramId,
      scoreFor(topProgramId),
      Boolean(result && topProgramId && result.winnerId === topProgramId),
    )
    const bottom = buildParticipant(
      bottomProgramId,
      scoreFor(bottomProgramId),
      Boolean(result && bottomProgramId && result.winnerId === bottomProgramId),
    )

    const isUpset = Boolean(
      result &&
        top &&
        bottom &&
        (top.isWinner ? top.seed > bottom.seed : bottom.seed > top.seed),
    )

    return {
      gameId: game.id,
      round: game.round,
      index: game.index,
      top,
      bottom,
      isComplete: Boolean(result),
      isUpset,
    }
  })
}

/**
 * Escalates the Season Hub into Tournament play. Supports all three
 * controlled-Program states — qualified/alive, eliminated, and did-not-
 * qualify — by branching purely on existing Postseason query output.
 */
export function PostseasonHubScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const season = useDynastyStore(selectActiveSeason)
  const postseason = useDynastyStore(selectActivePostseason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const simulateNextPostseasonGame = useDynastyStore(
    (state) => state.simulateNextPostseasonGame,
  )
  const goToPostseasonGamePrep = useDynastyStore(
    (state) => state.goToPostseasonGamePrep,
  )
  const simulateRestOfCurrentTournamentRound = useDynastyStore(
    (state) => state.simulateRestOfCurrentTournamentRound,
  )
  const viewCompletedTournamentGame = useDynastyStore(
    (state) => state.viewCompletedTournamentGame,
  )
  const lastPlayedTournamentGameId = useDynastyStore(
    (state) => state.lastPlayedTournamentGameId,
  )
  const goToHub = useDynastyStore((state) => state.goToHub)
  const goToPostseasonHub = useDynastyStore((state) => state.goToPostseasonHub)
  const goToLeague = useDynastyStore((state) => state.goToLeague)
  const goToRecruiting = useDynastyStore((state) => state.goToRecruiting)
  const generateControlledDraftBoard = useDynastyStore(
    (state) => state.generateControlledDraftBoard,
  )
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)
  const enterLateRecruiting = useDynastyStore(
    (state) => state.enterLateRecruiting,
  )
  const pendingSuperSim = useDynastyStore((state) => state.pendingSuperSim)
  const pendingRecruitingSetupIntent = useDynastyStore(
    (state) => state.pendingRecruitingSetupIntent,
  )
  const requestSuperSim = useDynastyStore((state) => state.requestSuperSim)
  const cancelSuperSim = useDynastyStore((state) => state.cancelSuperSim)
  const confirmSuperSim = useDynastyStore((state) => state.confirmSuperSim)
  const recruitingActivityBaselinePeriod = useDynastyStore(
    (state) => state.recruitingActivityBaselinePeriod,
  )
  const dismissRecruitingActivity = useDynastyStore(
    (state) => state.dismissRecruitingActivity,
  )

  if (!season || !postseason || !controlledProgramId) {
    return null
  }

  const controlledProgram = PROGRAMS_BY_ID.get(controlledProgramId)

  if (!controlledProgram) {
    return null
  }

  const recruiting = dynasty?.recruiting
  const recruitingBoard =
    dynasty && recruiting ? deriveProgramRecruitingBoard(dynasty, controlledProgramId) : undefined
  const focusTargets =
    dynasty && recruitingBoard ? deriveFocusTargetSummaries(dynasty, recruitingBoard) : []
  const recruitingActivity =
    dynasty && recruiting && recruitingActivityBaselinePeriod !== null
      ? deriveRecruitingActivityDescriptions(
          dynasty,
          recruitingActivityBaselinePeriod,
          PROGRAMS_BY_ID,
        )
      : []

  const controlledEntry = postseason.field.find(
    (entry) => entry.programId === controlledProgramId,
  )
  const currentRound = getCurrentTournamentRound(postseason)
  const tournamentComplete = isTournamentComplete(postseason)
  const championProgramId = tournamentComplete
    ? deriveNationalChampion(postseason)
    : undefined
  const championProgram = championProgramId
    ? PROGRAMS_BY_ID.get(championProgramId)
    : undefined
  const isLateRecruitingHandoffAvailable = Boolean(
    tournamentComplete &&
      recruiting &&
      recruiting.phase !== 'late' &&
      recruiting.phase !== 'finalized' &&
      recruiting.lastResolvedPeriod === FINAL_RECRUITING_PERIOD,
  )

  const controlledGame =
    currentRound !== undefined && controlledEntry
      ? getTournamentGameForProgram(postseason, controlledProgramId, currentRound)
      : undefined
  const controlledGameResult = controlledGame
    ? postseason.resultsByGameId[controlledGame.id]
    : undefined
  const isAliveWithPendingGame = Boolean(controlledGame && !controlledGameResult)
  // Elimination can surface two ways: `controlledGame` is undefined because
  // the loss happened in an earlier round, or `controlledGame` IS this
  // round's own game and it has already been resolved as a loss. Both are
  // "eliminated" — only a resolved *win* means "waiting on the rest of the
  // round," so this must be checked before treating any resolved game as
  // advancement.
  const eliminationGame = controlledEntry
    ? findEliminationGame(postseason, controlledProgramId)
    : undefined
  const isEliminated = eliminationGame !== undefined

  const pendingRoundGames =
    currentRound !== undefined
      ? getPendingGamesForTournamentRound(postseason, currentRound)
      : []
  const roundGameCount =
    currentRound !== undefined
      ? getGamesForTournamentRound(postseason, currentRound).length
      : 0
  const hasOtherSimulatableGames = pendingRoundGames.some((game) => {
    const participants = resolveTournamentGameParticipants(postseason, game.id)
    return (
      participants !== undefined &&
      participants.homeProgramId !== controlledProgramId &&
      participants.awayProgramId !== controlledProgramId
    )
  })

  const fieldRows: TournamentFieldRow[] = [...postseason.field]
    .sort((first, second) => first.seed - second.seed)
    .map((entry) => {
      const program = PROGRAMS_BY_ID.get(entry.programId)!
      const conference = UNIVERSE_V0.conferences.find(
        (candidate) => candidate.id === program.conferenceId,
      )!

      return {
        programId: entry.programId,
        programName: program.name,
        conferenceName: conference.name,
        seed: entry.seed,
        bidType: entry.bidType,
        record: deriveProgramRecord(season, entry.programId),
      }
    })

  const bracketSlots = buildBracketSlots(postseason, controlledProgramId)
  const lastPlayedTournamentGame = lastPlayedTournamentGameId
    ? postseason.bracket.games.find(
        (game) => game.id === lastPlayedTournamentGameId,
      )
    : undefined
  const lastPlayedTournamentResult = lastPlayedTournamentGameId
    ? postseason.resultsByGameId[lastPlayedTournamentGameId]
    : undefined
  const completedHubTournamentGame =
    lastPlayedTournamentGame &&
    lastPlayedTournamentResult &&
    (lastPlayedTournamentGame.round === currentRound ||
      (tournamentComplete && lastPlayedTournamentGame.round === 'championship'))
      ? {
          game: lastPlayedTournamentGame,
          result: lastPlayedTournamentResult,
        }
      : undefined

  let matchup: ReactNode

  if (completedHubTournamentGame) {
    const homeProgram = PROGRAMS_BY_ID.get(
      completedHubTournamentGame.result.homeTeamId,
    )!
    const awayProgram = PROGRAMS_BY_ID.get(
      completedHubTournamentGame.result.awayTeamId,
    )!
    const homeEntry = postseason.field.find(
      (entry) => entry.programId === completedHubTournamentGame.result.homeTeamId,
    )!
    const awayEntry = postseason.field.find(
      (entry) => entry.programId === completedHubTournamentGame.result.awayTeamId,
    )!
    const controlledWon =
      completedHubTournamentGame.result.winnerId === controlledProgramId

    const tournamentOutcome =
      championProgramId === controlledProgramId
        ? 'champion'
        : isEliminated || !controlledWon
          ? 'eliminated'
          : 'advanced'

    matchup = (
      <CompletedMatchupCard
        roundLabel={formatTournamentRoundName(completedHubTournamentGame.game.round)}
        siteLabel="Neutral"
        overtimeTag={formatOvertimeTag(
          completedHubTournamentGame.result.overtimePeriods,
        )}
        home={{
          name: homeProgram.name,
          accentColor: homeProgram.branding.primaryColor,
          score: completedHubTournamentGame.result.homeScore,
          label: `#${homeEntry.seed}`,
          isWinner:
            completedHubTournamentGame.result.winnerId === homeProgram.id,
        }}
        away={{
          name: awayProgram.name,
          accentColor: awayProgram.branding.primaryColor,
          score: completedHubTournamentGame.result.awayScore,
          label: `#${awayEntry.seed}`,
          isWinner:
            completedHubTournamentGame.result.winnerId === awayProgram.id,
        }}
        resultLabel={formatTournamentQuickResult(
          controlledProgram.name,
          completedHubTournamentGame.game.round,
          tournamentOutcome,
        )}
        resultTone={tournamentOutcome === 'eliminated' ? 'negative' : 'positive'}
        leaders={deriveGameLeaders(
          completedHubTournamentGame.result,
          postseason.programStates[completedHubTournamentGame.result.homeTeamId]!
            .team,
          postseason.programStates[completedHubTournamentGame.result.awayTeamId]!
            .team,
        )}
        onViewBoxScore={() =>
          viewCompletedTournamentGame(completedHubTournamentGame.game.id)
        }
      />
    )
  } else if (tournamentComplete) {
    const isControlledChampion = championProgramId === controlledProgramId
    matchup = (
      <TournamentStatusBanner
        variant="champion"
        eyebrow={isControlledChampion ? 'National Champions' : 'Tournament Complete'}
        headline={
          isControlledChampion
            ? `${controlledProgram.name} are your National Champions!`
            : `${championProgram?.name ?? 'A Program'} is your National Champion.`
        }
        body={
          isControlledChampion
            ? 'The bracket is complete. Every result and box score below remains available.'
            : controlledEntry
              ? `${controlledProgram.name}'s tournament run has ended. The completed bracket and every box score remain available below.`
              : `${controlledProgram.name} did not qualify this season. The completed bracket and every box score remain available below.`
        }
      />
    )
  } else if (!controlledEntry) {
    matchup = (
      <TournamentStatusBanner
        variant="did-not-qualify"
        eyebrow="No Bid"
        headline={`${controlledProgram.name} did not qualify for the National Tournament.`}
        body="Follow the field and bracket below as the tournament plays out."
        action={{
          label: `Simulate ${formatTournamentRoundName(currentRound!)}`,
          onClick: simulateRestOfCurrentTournamentRound,
        }}
      />
    )
  } else if (isAliveWithPendingGame) {
    const participants = resolveTournamentGameParticipants(
      postseason,
      controlledGame!.id,
    )!
    const opponentProgramId =
      participants.homeProgramId === controlledProgramId
        ? participants.awayProgramId
        : participants.homeProgramId
    const opponentEntry = postseason.field.find(
      (entry) => entry.programId === opponentProgramId,
    )!
    const opponentProgram = PROGRAMS_BY_ID.get(opponentProgramId)!
    const controlledState = postseason.programStates[controlledProgramId]!
    const opponentState = postseason.programStates[opponentProgramId]!

    matchup = (
      <TournamentMatchupCard
        roundLabel={formatTournamentRoundName(currentRound!)}
        controlled={{
          name: controlledState.team.name,
          accentColor: controlledProgram.branding.primaryColor,
          seed: controlledEntry.seed,
          strength: calculateTeamStrength(
            controlledState.team,
            controlledState.rotation,
          ),
        }}
        opponent={{
          name: opponentState.team.name,
          accentColor: opponentProgram.branding.primaryColor,
          seed: opponentEntry.seed,
          strength: calculateTeamStrength(opponentState.team, opponentState.rotation),
        }}
        onSimulate={simulateNextPostseasonGame}
        onGamePrep={goToPostseasonGamePrep}
      />
    )
  } else if (isEliminated) {
    const eliminationResult = eliminationGame
      ? postseason.resultsByGameId[eliminationGame.id]
      : undefined
    const eliminationParticipants = eliminationGame
      ? resolveTournamentGameParticipants(postseason, eliminationGame.id)
      : undefined
    const opponentId = eliminationParticipants
      ? eliminationParticipants.homeProgramId === controlledProgramId
        ? eliminationParticipants.awayProgramId
        : eliminationParticipants.homeProgramId
      : undefined
    const opponentName = opponentId
      ? PROGRAMS_BY_ID.get(opponentId)?.name
      : undefined
    const controlledScore =
      eliminationResult && eliminationParticipants
        ? eliminationParticipants.homeProgramId === controlledProgramId
          ? eliminationResult.homeScore
          : eliminationResult.awayScore
        : undefined
    const opponentScore =
      eliminationResult && eliminationParticipants
        ? eliminationParticipants.homeProgramId === controlledProgramId
          ? eliminationResult.awayScore
          : eliminationResult.homeScore
        : undefined

    matchup = (
      <TournamentStatusBanner
        variant="eliminated"
        eyebrow="Eliminated"
        headline={
          eliminationGame
            ? `${controlledProgram.name}'s tournament run ended in the ${formatTournamentRoundName(eliminationGame.round)}.`
            : `${controlledProgram.name}'s tournament run has ended.`
        }
        body={
          opponentName && controlledScore !== undefined && opponentScore !== undefined
            ? `Final: ${opponentName} ${Math.max(controlledScore, opponentScore)}-${Math.min(controlledScore, opponentScore)}.`
            : 'The bracket continues below.'
        }
        action={
          !tournamentComplete
            ? {
                label: `Simulate ${formatTournamentRoundName(currentRound!)}`,
                onClick: simulateRestOfCurrentTournamentRound,
              }
            : undefined
        }
      />
    )
  } else {
    matchup = (
      <TournamentStatusBanner
        variant="advancing"
        eyebrow="Advancing"
        headline={`${controlledProgram.name} is through to the next round.`}
        body={`Waiting on the rest of the ${formatTournamentRoundName(currentRound!)} bracket to finish.`}
        action={{
          label: `Simulate Rest of ${formatTournamentRoundName(currentRound!)}`,
          onClick: simulateRestOfCurrentTournamentRound,
        }}
      />
    )
  }

  return (
    <>
      <DynastySectionNav
        competitionLabel="Tournament"
        activeSection="competition"
        onSelectCompetition={goToPostseasonHub}
        onSelectRecruiting={goToRecruiting}
        onSelectLeague={goToLeague}
      />
      <TournamentStatusHeader
        programName={controlledProgram.name}
        accentColor={controlledProgram.branding.primaryColor}
        seed={controlledEntry?.seed ?? null}
        bidType={controlledEntry?.bidType ?? null}
        roundLabel={
          tournamentComplete || currentRound === undefined
            ? 'Final'
            : formatTournamentRoundName(currentRound)
        }
      />

      <RecruitingCommitmentAlerts
        activity={recruitingActivity}
        onDismiss={dismissRecruitingActivity}
      />

      <div className="hub-primary-grid">
        <section
          className="section hub-primary-grid__game"
          aria-labelledby="tournament-status-heading"
        >
          <h2 id="tournament-status-heading" className="visually-hidden">
            Tournament status
          </h2>
          {matchup}
          {(isAliveWithPendingGame || completedHubTournamentGame) &&
            hasOtherSimulatableGames &&
            currentRound && (
            <div className="round-progress">
              <div>
                <p className="round-progress__text">
                  {formatTournamentProgressRoundName(currentRound)} —{' '}
                  {describeRoundProgress(
                    roundGameCount - pendingRoundGames.length,
                    roundGameCount,
                  )}
                </p>
                {completedHubTournamentGame && pendingRoundGames.length > 0 && (
                  <p className="round-progress__detail">
                    {describeRemainingTournamentGames(
                      currentRound,
                      pendingRoundGames.length,
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="button button--ghost"
                onClick={simulateRestOfCurrentTournamentRound}
              >
                {completedHubTournamentGame
                  ? 'Advance to Next Round'
                  : 'Simulate Other Games'}
              </button>
            </div>
            )}

          {!tournamentComplete && (
            <div className="round-progress">
              <p className="round-progress__text">
                Fast-forward the remaining Tournament.
              </p>
              <div className="round-progress__actions">
                <SuperSimMenu
                  showMidseason={false}
                  showEndOfRegularSeason={false}
                  midseasonRound={season.schedule.roundCount}
                  endOfSeasonRound={season.schedule.roundCount}
                  onSelect={requestSuperSim}
                  isDialogOpen={pendingSuperSim !== null}
                />
              </div>
            </div>
          )}

          {isLateRecruitingHandoffAvailable && (
            <SeasonCompleteHandoff onContinue={enterLateRecruiting} />
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
            <SeasonHubFocusTargets
              focusTargets={focusTargets}
              controlledProgramId={controlledProgramId}
              programsById={PROGRAMS_BY_ID}
              onManageRecruiting={goToRecruiting}
            />
            <RecruitingHubSummary
              targetSeasonNumber={recruiting.targetSeasonNumber}
              phase={recruiting.phase}
              lastResolvedPeriod={recruiting.lastResolvedPeriod}
              board={recruitingBoard}
              recentCommitment={deriveRecentControlledCommitment(recruiting, controlledProgramId)}
              onManageRecruiting={goToRecruiting}
              onGenerateDraftBoard={generateControlledDraftBoard}
              onBuildManually={goToRecruiting}
              isSeasonComplete={tournamentComplete}
            />
          </section>
        )}
      </div>

      <section className="section" aria-labelledby="bracket-heading">
        <h2 id="bracket-heading" className="section-title">
          Bracket
        </h2>
        <TournamentBracket
          slots={bracketSlots}
          onSelectGame={viewCompletedTournamentGame}
        />
      </section>

      <section className="section" aria-labelledby="field-heading">
        <h2 id="field-heading" className="section-title">
          National Tournament Field
        </h2>
        <TournamentFieldTable
          rows={fieldRows}
          controlledProgramId={controlledProgramId}
          onSelectProgram={openTeamDetails}
        />
      </section>

      <div className="postseason-hub-footer">
        <button type="button" className="button button--ghost" onClick={goToHub}>
          View Final Regular Season
        </button>
      </div>

      {pendingSuperSim && !pendingRecruitingSetupIntent && (
        <SuperSimConfirmDialog
          kind={pendingSuperSim.kind}
          throughRound={pendingSuperSim.throughRound}
          controlledProgramName={controlledProgram.name}
          onCancel={cancelSuperSim}
          onConfirm={confirmSuperSim}
        />
      )}
    </>
  )
}
