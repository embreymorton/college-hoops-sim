import { RECRUITING_BOARD_LIMIT, type ProgramRecruitingBoard, type RecruitingPhase } from '../dynasty'
import {
  deriveRecruitingHubTotals,
  formatRankLabel,
  formatRecruitingPeriodLabel,
  type RecentControlledCommitment,
} from '../app/recruitingFormatters'
import { RecruitStars } from './RecruitStars'

interface RecruitingHubSummaryProps {
  readonly targetSeasonNumber: number
  readonly phase: RecruitingPhase
  readonly lastResolvedPeriod: number
  readonly board: ProgramRecruitingBoard
  readonly recentCommitment: RecentControlledCommitment | undefined
  readonly onManageRecruiting: () => void
  readonly onGenerateDraftBoard: () => void
  readonly onBuildManually: () => void
  /** True once the Tournament has concluded — reframes this module as the Late Recruiting lead-in rather than mid-Season status. */
  readonly isSeasonComplete?: boolean
}

/** A compact Season/Postseason Hub module — high-value Recruiting facts only, not the full page. */
export function RecruitingHubSummary({
  targetSeasonNumber,
  phase,
  lastResolvedPeriod,
  board,
  recentCommitment,
  onManageRecruiting,
  onGenerateDraftBoard,
  onBuildManually,
  isSeasonComplete = false,
}: RecruitingHubSummaryProps) {
  const totals = deriveRecruitingHubTotals(board)
  const periodLabel = formatRecruitingPeriodLabel(phase, lastResolvedPeriod)
  // Onboarding is a one-time, preseason-only condition — an empty board later
  // in the season is a normal in-progress state, not a setup prompt.
  const needsOnboarding = board.targets.length === 0 && lastResolvedPeriod === 0

  return (
    <div className="recruiting-hub-summary">
      <p className="eyebrow-tag">Recruiting</p>
      <p className="recruiting-hub-summary__class">Class of Season {targetSeasonNumber}</p>
      <p className="recruiting-hub-summary__period">{periodLabel.toUpperCase()}</p>
      {isSeasonComplete && (
        <p className="recruiting-hub-summary__handoff-note">
          Late Recruiting is next — this board carries forward.
        </p>
      )}

      {needsOnboarding ? (
        <div className="recruiting-hub-summary__onboarding">
          <p className="recruiting-hub-summary__onboarding-title">Your Board Is Empty</p>
          <p className="recruiting-hub-summary__onboarding-body">
            Build your own recruiting board or generate a suggested starting plan based on
            your roster needs.
          </p>
          <div className="recruiting-hub-summary__onboarding-actions">
            <button
              type="button"
              className="button button--primary recruiting-hub-summary__action"
              onClick={onGenerateDraftBoard}
            >
              Generate Draft Board
            </button>
            <button
              type="button"
              className="button button--ghost recruiting-hub-summary__action"
              onClick={onBuildManually}
            >
              Build Manually
            </button>
          </div>
        </div>
      ) : (
        <>
          {totals.needsByPosition.length > 0 && (
            <div className="recruiting-hub-summary__needs">
              <p className="recruiting-hub-summary__needs-label">Roster Needs</p>
              <p className="recruiting-hub-summary__needs-list">
                {totals.needsByPosition
                  .map(({ position, remaining }) => `${position} ${remaining}`)
                  .join(' · ')}
              </p>
            </div>
          )}

          <dl className="recruiting-hub-summary__facts">
            <div className="recruiting-hub-summary__fact">
              <dt>Signed</dt>
              <dd>
                {totals.signedTotal} / {totals.projectedTotal}
              </dd>
            </div>
            <div className="recruiting-hub-summary__fact">
              <dt>Board</dt>
              <dd>
                {board.targets.length} / {RECRUITING_BOARD_LIMIT}
              </dd>
            </div>
            <div className="recruiting-hub-summary__fact">
              <dt>Offers</dt>
              <dd>
                {totals.offersTotal} / {totals.remainingTotal}
              </dd>
            </div>
          </dl>

          {recentCommitment && (
            <p className="recruiting-hub-summary__commitment">
              <span className="recruiting-hub-summary__commitment-tag">New Commitment</span>
              {formatRankLabel(recentCommitment.nationalRank)}{' '}
              {recentCommitment.playerName} · {recentCommitment.position} ·{' '}
              <RecruitStars stars={recentCommitment.stars} />
            </p>
          )}

          <button
            type="button"
            className="button button--primary recruiting-hub-summary__action"
            onClick={onManageRecruiting}
          >
            Manage Recruiting
          </button>
        </>
      )}
    </div>
  )
}
