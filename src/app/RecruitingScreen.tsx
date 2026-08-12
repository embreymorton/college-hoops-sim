import { useState } from 'react'
import {
  DynastySectionNav,
  NationalRecruitTable,
  RecruitingBattlesGrid,
  RecruitingBoardEmptyState,
  RecruitingBoardTable,
  RecruitingClassSummary,
  RecruitingFinalizationDialog,
  RecruitingHeader,
  RecruitingModeTabs,
  RecruitingNeedsLedger,
  type RecruitingMode,
} from '../components'
import { deriveProgramRecruitingBoard, RECRUITING_BOARD_LIMIT, RECRUITING_FOCUS_LIMIT } from '../dynasty'
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
export function RecruitingScreen() {
  const [mode, setMode] = useState<RecruitingMode>('board')
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false)
  const dynasty = useDynastyStore((state) => state.dynasty)
  const postseason = useDynastyStore(selectActivePostseason)
  const actionError = useDynastyStore((state) => state.recruitingActionError)
  const dismissRecruitingActionError = useDynastyStore(
    (state) => state.dismissRecruitingActionError,
  )
  const goToHub = useDynastyStore((state) => state.goToHub)
  const goToPostseasonHub = useDynastyStore((state) => state.goToPostseasonHub)
  const goToRecruiting = useDynastyStore((state) => state.goToRecruiting)
  const goToLeague = useDynastyStore((state) => state.goToLeague)
  const addRecruitingTarget = useDynastyStore((state) => state.addRecruitingTarget)
  const removeRecruitingTarget = useDynastyStore((state) => state.removeRecruitingTarget)
  const setRecruitingFocus = useDynastyStore((state) => state.setRecruitingFocus)
  const offerRecruitingTarget = useDynastyStore((state) => state.offerRecruitingTarget)
  const withdrawRecruitingOffer = useDynastyStore((state) => state.withdrawRecruitingOffer)
  const generateControlledDraftBoard = useDynastyStore(
    (state) => state.generateControlledDraftBoard,
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
      <>
        <DynastySectionNav
          competitionLabel={postseason ? 'Tournament' : 'Season'}
          activeSection="recruiting"
          onSelectCompetition={postseason ? goToPostseasonHub : goToHub}
          onSelectRecruiting={goToRecruiting}
          onSelectLeague={goToLeague}
        />
        <RecruitingClassSummary
          programName={controlledProgram.name}
          targetSeasonNumber={dynasty.recruiting.targetSeasonNumber}
          signees={signees}
          averages={averages}
          positionCounts={positionCounts}
          onBeginOffseason={beginDynastyOffseason}
        />
      </>
    )
  }

  const board = deriveProgramRecruitingBoard(dynasty, dynasty.controlledProgramId)
  const focusCount = board.targets.filter(({ isFocused, status }) => isFocused && status === 'active').length
  const totals = deriveRecruitingHubTotals(board)
  const showZeroOfferWarning =
    board.targets.length > 0 && totals.remainingTotal > 0 && totals.offersTotal === 0
  const isLate = dynasty.recruiting.phase === 'late'

  return (
    <>
      <DynastySectionNav
        competitionLabel={postseason ? 'Tournament' : 'Season'}
        activeSection="recruiting"
        onSelectCompetition={postseason ? goToPostseasonHub : goToHub}
        onSelectRecruiting={goToRecruiting}
        onSelectLeague={goToLeague}
      />

      <RecruitingHeader
        programName={controlledProgram.name}
        accentColor={controlledProgram.branding.primaryColor}
        targetSeasonNumber={dynasty.recruiting.targetSeasonNumber}
        phase={dynasty.recruiting.phase}
        lastResolvedPeriod={dynasty.recruiting.lastResolvedPeriod}
        focusCount={focusCount}
        focusLimit={RECRUITING_FOCUS_LIMIT}
      />

      {isLate && (
        <section className="section late-recruiting-banner" aria-labelledby="late-recruiting-heading">
          <p id="late-recruiting-heading" className="eyebrow-tag">
            Late Recruiting — Final Signing Window
          </p>
          <p className="section-hint">
            This is the last recruiting window before the offseason. Remaining
            openings will be resolved automatically once you finalize the class.
          </p>
          <div className="stat-trio late-recruiting-banner__stats">
            <div className="stat-trio__item">
              <span className="stat-trio__value">{totals.remainingTotal}</span>
              <span className="stat-trio__label">Openings</span>
            </div>
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {totals.signedTotal}/{totals.projectedTotal}
              </span>
              <span className="stat-trio__label">Signed</span>
            </div>
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {board.targets.length}/{RECRUITING_BOARD_LIMIT}
              </span>
              <span className="stat-trio__label">Board</span>
            </div>
            <div className="stat-trio__item">
              <span className="stat-trio__value">
                {totals.offersTotal}/{totals.remainingTotal}
              </span>
              <span className="stat-trio__label">Active Offers</span>
            </div>
          </div>
          <button
            type="button"
            className="button button--primary late-recruiting-banner__action"
            onClick={() => setIsFinalizeDialogOpen(true)}
          >
            Finalize Recruiting Class
          </button>
        </section>
      )}

      <section className="section" aria-labelledby="recruiting-needs-heading">
        <h2 id="recruiting-needs-heading" className="section-title">
          Positional Needs
        </h2>
        <RecruitingNeedsLedger board={board} />
        <p className="section-hint">
          Board targets receive normal recruiting effort. Focus up to {RECRUITING_FOCUS_LIMIT}{' '}
          recruits to give them extra attention. Only recruits with an active offer can commit.
        </p>
        {showZeroOfferWarning && (
          <p className="recruiting-warning" role="status">
            <span className="recruiting-warning__tag">No Active Offers</span>
            Recruits can only commit to programs that have offered them.
          </p>
        )}
      </section>

      <section className="section" aria-labelledby="recruiting-mode-heading">
        <div className="section-heading">
          <h2 id="recruiting-mode-heading" className="visually-hidden">
            Recruiting mode
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
              onGenerateDraftBoard={generateControlledDraftBoard}
              onBrowseNationalClass={() => setMode('national')}
            />
          ) : (
            <RecruitingBoardTable
              dynasty={dynasty}
              board={board}
              programsById={PROGRAMS_BY_ID}
              onSetFocus={setRecruitingFocus}
              onOffer={offerRecruitingTarget}
              onWithdraw={withdrawRecruitingOffer}
              onRemove={removeRecruitingTarget}
            />
          )
        ) : mode === 'battles' ? (
          <RecruitingBattlesGrid
            cards={deriveBattleCardSummaries(dynasty, board)}
            controlledProgram={controlledProgram}
            programsById={PROGRAMS_BY_ID}
          />
        ) : (
          <NationalRecruitTable
            dynasty={dynasty}
            board={board}
            programsById={PROGRAMS_BY_ID}
            onAddToBoard={addRecruitingTarget}
          />
        )}
      </section>

      {isFinalizeDialogOpen && (
        <RecruitingFinalizationDialog
          onCancel={() => setIsFinalizeDialogOpen(false)}
          onConfirm={() => {
            setIsFinalizeDialogOpen(false)
            finalizeRecruitingClass()
          }}
        />
      )}
    </>
  )
}
