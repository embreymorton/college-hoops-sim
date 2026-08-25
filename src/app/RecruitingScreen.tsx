import { useState, type ReactNode } from 'react'
import {
  DynastySectionNav,
  FollowingRecruitsSection,
  NationalRecruitTable,
  RecruitingBattlesGrid,
  RecruitingBoardEmptyState,
  RecruitingBoardTable,
  RecruitingClassSummary,
  RecruitingFinalizationDialog,
  RecruitingGuide,
  RecruitingHeader,
  RecruitingModeTabs,
  NextSeasonRosterOutlook,
  RecruitingOverview,
} from '../components'
import {
  deriveFollowingRecruitsView,
  deriveNextSeasonRosterOutlook,
  deriveProgramRecruitingBoard,
  RECRUITING_BOARD_LIMIT,
  RECRUITING_FOCUS_LIMIT,
} from '../dynasty'
import {
  selectActivePostseason,
  useDynastyStore,
} from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import {
  deriveClassAverages,
  deriveIncomingClass,
  derivePositionCounts,
} from './offseasonFormatters'
import { deriveBattleCardSummaries } from './recruitingBattleFormatters'
import { deriveRecruitingHubTotals } from './recruitingFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Recruiting: board management and the National Class, reachable through both lifecycle stages. */
export function RecruitingScreen({
  progressionBar,
  embeddedOffseason = false,
}: {
  readonly progressionBar?: ReactNode
  readonly embeddedOffseason?: boolean
}) {
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false)
  const [boardActionMessage, setBoardActionMessage] = useState<string | null>(null)
  const dynasty = useDynastyStore((state) => state.dynasty)
  const postseason = useDynastyStore(selectActivePostseason)
  const actionError = useDynastyStore((state) => state.recruitingActionError)
  const mode = useDynastyStore((state) => state.recruitingMode)
  const followedRecruitIds = useDynastyStore((state) => state.followedRecruitIds)
  const setMode = useDynastyStore((state) => state.setRecruitingMode)
  const dismissRecruitingActionError = useDynastyStore(
    (state) => state.dismissRecruitingActionError,
  )
  const goToHub = useDynastyStore((state) => state.goToHub)
  const goToPostseasonHub = useDynastyStore((state) => state.goToPostseasonHub)
  const goToCoaching = useDynastyStore((state) => state.goToCoaching)
  const goToRecruiting = useDynastyStore((state) => state.goToRecruiting)
  const goToLeague = useDynastyStore((state) => state.goToLeague)
  const addRecruitingTarget = useDynastyStore((state) => state.addRecruitingTarget)
  const openRecruitDetails = useDynastyStore((state) => state.openRecruitDetails)
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)
  const removeRecruitingTarget = useDynastyStore((state) => state.removeRecruitingTarget)
  const clearUnavailableRecruitingTargets = useDynastyStore(
    (state) => state.clearUnavailableRecruitingTargets,
  )
  const setRecruitingFocus = useDynastyStore((state) => state.setRecruitingFocus)
  const offerRecruitingTarget = useDynastyStore((state) => state.offerRecruitingTarget)
  const withdrawRecruitingOffer = useDynastyStore((state) => state.withdrawRecruitingOffer)
  const generateControlledDraftBoard = useDynastyStore(
    (state) => state.generateControlledDraftBoard,
  )
  const fillRemainingRecruitingBoard = useDynastyStore(
    (state) => state.fillRemainingRecruitingBoard,
  )
  const finalizeRecruitingClass = useDynastyStore(
    (state) => state.finalizeRecruitingClass,
  )
  const beginDynastyOffseason = useDynastyStore(
    (state) => state.beginDynastyOffseason,
  )

  if (!dynasty || !dynasty.recruiting) {
    return (
      <p className="league-empty-state">
        Recruiting is not currently available.
      </p>
    )
  }

  const controlledProgram = PROGRAMS_BY_ID.get(dynasty.controlledProgramId)

  if (!controlledProgram) {
    return null
  }

  if (dynasty.recruiting.phase === 'finalized') {
    const signees = deriveIncomingClass(dynasty.recruiting, dynasty.controlledProgramId)
    const averages = deriveClassAverages(signees.map(({ recruit }) => recruit))
    const positionCounts = derivePositionCounts(
      signees.map(({ recruit }) => recruit.player),
    )

    return (
      <div className="recruiting-screen">
        {!embeddedOffseason && <DynastySectionNav
          competitionLabel={postseason ? 'Tournament' : 'Season'}
          activeSection="recruiting"
          onSelectCompetition={postseason ? goToPostseasonHub : goToHub}
          onSelectCoaching={goToCoaching}
          onSelectRecruiting={goToRecruiting}
          onSelectLeague={goToLeague}
        />}
        {progressionBar}
        <RecruitingClassSummary
          programName={controlledProgram.name}
          targetSeasonNumber={dynasty.recruiting.targetSeasonNumber}
          signees={signees}
          averages={averages}
          positionCounts={positionCounts}
          onBeginOffseason={beginDynastyOffseason}
        />
      </div>
    )
  }

  const board = deriveProgramRecruitingBoard(dynasty, dynasty.controlledProgramId)
  const focusCount = board.targets.filter(({ isFocused, status }) => isFocused && status === 'active').length
  const totals = deriveRecruitingHubTotals(board)
  const showZeroOfferWarning =
    board.targets.length > 0 && totals.remainingTotal > 0 && totals.offersTotal === 0
  const isLate = dynasty.recruiting.phase === 'late'
  const fillBoard = () => {
    const added = fillRemainingRecruitingBoard()
    setBoardActionMessage(
      added > 0
        ? `Added ${added} ${added === 1 ? 'recruit' : 'recruits'} to your Board.`
        : 'No additional eligible recruits were available.',
    )
  }
  const unavailableCount = board.targets.filter(
    ({ status }) => status === 'committed-elsewhere' || status === 'position-filled',
  ).length
  const clearUnavailable = () => {
    const removed = clearUnavailableRecruitingTargets()
    if (removed > 0) {
      setBoardActionMessage(
        `Removed ${removed} unavailable ${removed === 1 ? 'recruit' : 'recruits'} from your Board.`,
      )
    }
  }

  const hasRemainingOpenings = totals.remainingTotal > 0

  return (
    <div className="recruiting-screen">
      {!embeddedOffseason && <DynastySectionNav
        competitionLabel={postseason ? 'Tournament' : 'Season'}
        activeSection="recruiting"
        onSelectCompetition={postseason ? goToPostseasonHub : goToHub}
        onSelectCoaching={goToCoaching}
        onSelectRecruiting={goToRecruiting}
        onSelectLeague={goToLeague}
      />}
      {progressionBar}

      {!embeddedOffseason && (
        <RecruitingHeader
          programName={controlledProgram.name}
          accentColor={controlledProgram.branding.primaryColor}
          targetSeasonNumber={dynasty.recruiting.targetSeasonNumber}
          phase={dynasty.recruiting.phase}
          lastResolvedPeriod={dynasty.recruiting.lastResolvedPeriod}
          focusCount={focusCount}
          focusLimit={RECRUITING_FOCUS_LIMIT}
        />
      )}

      {isLate && !embeddedOffseason && (
        <section
          className="section late-recruiting-banner"
          aria-labelledby="late-recruiting-heading"
        >
          <p id="late-recruiting-heading" className="eyebrow-tag">
            Late Recruiting — Final Signing Window
          </p>
          {hasRemainingOpenings ? (
            <p className="section-hint">
              Finish filling the incoming class from the remaining offseason market.
              Remaining openings will be resolved automatically once you finalize the class.
            </p>
          ) : (
            <>
              <p className="late-recruiting-banner__complete-title">
                Recruiting Class Complete
              </p>
              <p className="section-hint">All projected roster openings are filled.</p>
            </>
          )}
          <button
            type="button"
            className="button button--primary late-recruiting-banner__action"
            onClick={() => setIsFinalizeDialogOpen(true)}
          >
            Finalize Recruiting Class
          </button>
        </section>
      )}

      {isLate && embeddedOffseason && !hasRemainingOpenings && (
        <p className="section-hint late-recruiting-embedded__complete" role="status">
          Recruiting Class Complete — all projected roster openings are filled.
        </p>
      )}

      <RecruitingOverview board={board} compact={embeddedOffseason} />

      {showZeroOfferWarning && (
        <p
          className={
            embeddedOffseason ? 'recruiting-warning recruiting-warning--compact' : 'recruiting-warning'
          }
          role="status"
        >
          <span className="recruiting-warning__tag">No Active Offers</span>
          Recruits can only commit to programs that have offered them.
        </p>
      )}

      <section className="section" aria-labelledby="recruiting-mode-heading">
        <div className="section-heading">
          <h2 id="recruiting-mode-heading" className="section-title">
            {isLate && mode === 'board'
              ? 'My Board'
              : isLate && mode === 'national'
                ? 'Available Market'
                : 'Recruiting'}
          </h2>
          <RecruitingModeTabs mode={mode} onSelectMode={setMode} />
        </div>

        {actionError && (
          <p className="recruiting-action-error" role="alert">
            {actionError}
            <button
              type="button"
              className="text-link-button recruiting-action-error__dismiss"
              onClick={dismissRecruitingActionError}
            >
              Dismiss
            </button>
          </p>
        )}

        {mode === 'board' ? (
          board.targets.length === 0 ? (
            <RecruitingBoardEmptyState
              lastResolvedPeriod={dynasty.recruiting.lastResolvedPeriod}
              needsByPosition={totals.needsByPosition}
              remainingTotal={totals.remainingTotal}
              mandatoryTotal={totals.mandatoryTotal}
              flexibleTotal={totals.flexibleTotal}
              onGenerateDraftBoard={generateControlledDraftBoard}
              onFillRemainingBoard={fillBoard}
              onBrowseNationalClass={() => setMode('national')}
            />
          ) : (
            <>
              {(unavailableCount > 0 || board.targets.length < RECRUITING_BOARD_LIMIT) && (
                <div className="recruiting-board-management">
                  {unavailableCount > 0 && (
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={clearUnavailable}
                    >
                      Clear Unavailable ({unavailableCount})
                    </button>
                  )}
                  {board.targets.length < RECRUITING_BOARD_LIMIT && (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={fillBoard}
                  >
                    Fill Remaining Board
                  </button>
                  )}
                </div>
              )}
              {boardActionMessage && <p className="section-hint" role="status">{boardActionMessage}</p>}
              <RecruitingBoardTable
                dynasty={dynasty}
                board={board}
                programsById={PROGRAMS_BY_ID}
                onSetFocus={setRecruitingFocus}
                onOffer={offerRecruitingTarget}
                onWithdraw={withdrawRecruitingOffer}
                onRemove={removeRecruitingTarget}
                onOpenRecruitDetails={openRecruitDetails}
              />
            </>
          )
        ) : mode === 'roster-outlook' ? (
          <NextSeasonRosterOutlook
            outlook={deriveNextSeasonRosterOutlook(dynasty)}
            onSelectPlayer={(playerId) => openPlayerDetails(dynasty.controlledProgramId, playerId)}
            onSelectRecruit={openRecruitDetails}
          />
        ) : mode === 'battles' ? (
          <RecruitingBattlesGrid
            cards={deriveBattleCardSummaries(dynasty, board)}
            controlledProgram={controlledProgram}
            programsById={PROGRAMS_BY_ID}
            onOpenRecruitDetails={openRecruitDetails}
          />
        ) : mode === 'national' ? (
          <NationalRecruitTable
            dynasty={dynasty}
            board={board}
            programsById={PROGRAMS_BY_ID}
            onAddToBoard={addRecruitingTarget}
            onOpenRecruitDetails={openRecruitDetails}
            availableMarketOnly={isLate}
          />
        ) : mode === 'following' ? (
          <FollowingRecruitsSection
            projection={deriveFollowingRecruitsView(dynasty, followedRecruitIds)}
            programsById={PROGRAMS_BY_ID}
            controlledProgramId={dynasty.controlledProgramId}
            onSelectRecruit={openRecruitDetails}
          />
        ) : (
          <RecruitingGuide />
        )}
      </section>

      {isFinalizeDialogOpen && (
        <RecruitingFinalizationDialog
          remainingOpenings={totals.remainingTotal}
          onCancel={() => setIsFinalizeDialogOpen(false)}
          onConfirm={() => {
            setIsFinalizeDialogOpen(false)
            finalizeRecruitingClass()
          }}
        />
      )}
    </div>
  )
}
