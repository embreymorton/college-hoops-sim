import { useState } from 'react'
import {
  DynastySectionNav,
  NationalRecruitTable,
  RecruitingBoardEmptyState,
  RecruitingBoardTable,
  RecruitingHeader,
  RecruitingModeTabs,
  RecruitingNeedsLedger,
  type RecruitingMode,
} from '../components'
import { deriveProgramRecruitingBoard } from '../dynasty'
import {
  selectActivePostseason,
  useDynastyStore,
} from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { deriveRecruitingHubTotals } from './recruitingFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Recruiting: board management and the National Class, reachable through both lifecycle stages. */
export function RecruitingScreen() {
  const [mode, setMode] = useState<RecruitingMode>('board')
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
  const setRecruitingPriority = useDynastyStore((state) => state.setRecruitingPriority)
  const offerRecruitingTarget = useDynastyStore((state) => state.offerRecruitingTarget)
  const withdrawRecruitingOffer = useDynastyStore((state) => state.withdrawRecruitingOffer)
  const generateControlledDraftBoard = useDynastyStore(
    (state) => state.generateControlledDraftBoard,
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

  const board = deriveProgramRecruitingBoard(dynasty, dynasty.controlledProgramId)
  const totals = deriveRecruitingHubTotals(board)
  const showZeroOfferWarning =
    board.targets.length > 0 && totals.remainingTotal > 0 && totals.offersTotal === 0

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
      />

      <section className="section" aria-labelledby="recruiting-needs-heading">
        <h2 id="recruiting-needs-heading" className="section-title">
          Positional Needs
        </h2>
        <RecruitingNeedsLedger board={board} />
        <p className="section-hint">
          Higher priority means a larger share of your recruiting attention each period.
          Board targets receive recruiting attention; an active offer reserves a positional
          signing slot if the Recruit commits.
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
              board={board}
              recruiting={dynasty.recruiting}
              programsById={PROGRAMS_BY_ID}
              onSetPriority={setRecruitingPriority}
              onOffer={offerRecruitingTarget}
              onWithdraw={withdrawRecruitingOffer}
              onRemove={removeRecruitingTarget}
            />
          )
        ) : (
          <NationalRecruitTable
            dynasty={dynasty}
            board={board}
            programsById={PROGRAMS_BY_ID}
            onAddToBoard={addRecruitingTarget}
          />
        )}
      </section>
    </>
  )
}
