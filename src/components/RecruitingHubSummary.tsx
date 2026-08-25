import { RECRUITING_BOARD_LIMIT, type ProgramRecruitingBoard, type RecruitingPhase } from '../dynasty'
import {
  formatControlledPositionLabel,
  formatReadinessLabel,
  type RecruitingPulseDescription,
  type FocusTargetSummary,
  type RecruitingHubCommitSummary,
} from '../app/recruitingBattleFormatters'
import {
  deriveRecruitingHubTotals,
  formatRankLabel,
  formatRecruitingPeriodLabel,
} from '../app/recruitingFormatters'
import { RecruitingCommitmentAlerts } from './RecruitingCommitmentAlerts'
import { RecruitStars } from './RecruitStars'

interface RecruitingHubSummaryProps {
  readonly targetSeasonNumber: number
  readonly phase: RecruitingPhase
  readonly lastResolvedPeriod: number
  readonly board: ProgramRecruitingBoard
  readonly focusTargets: readonly FocusTargetSummary[]
  /** Signed Board targets — the Hub's stable status home for commitments, distinct from still-unresolved Focus Targets. */
  readonly commits?: readonly RecruitingHubCommitSummary[]
  /** Ranked Recruiting Pulse since the last simulation/progression boundary. */
  readonly activity?: readonly RecruitingPulseDescription[]
  readonly onGenerateDraftBoard: () => void
  readonly onBuildManually: () => void
  /** True once the Tournament has concluded — reframes this module as the Late Recruiting lead-in rather than mid-Season status. */
  readonly isSeasonComplete?: boolean
}

/**
 * A compact, status-only Season/Postseason Hub module: a condensed Board
 * overview, the most recent Recruiting Update recap, every unresolved Focus
 * Target, and every signed Commit. No competitor detail and no navigation
 * CTA — primary Dynasty navigation already exposes Recruiting.
 */
export function RecruitingHubSummary({
  targetSeasonNumber,
  phase,
  lastResolvedPeriod,
  board,
  focusTargets,
  commits = [],
  activity = [],
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
      <p className="recruiting-hub-summary__title">
        Class of Season {targetSeasonNumber} · {periodLabel}
      </p>
      {isSeasonComplete && (
        <p className="recruiting-hub-summary__handoff-note">
          Late Recruiting is next — this board carries forward.
        </p>
      )}

      <RecruitingCommitmentAlerts activity={activity} />

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

          {totals.needsByPosition.length > 0 && (
            <p className="recruiting-hub-summary__needs">
              <span className="recruiting-hub-summary__needs-label">Needs</span>{' '}
              {totals.needsByPosition
                .map(({ position, remaining }) => `${position} ${remaining}`)
                .join(' · ')}
            </p>
          )}

          {focusTargets.length > 0 && (
            <div className="recruiting-hub-focus">
              <p className="recruiting-hub-focus__label">Focus Targets</p>
              <ul className="recruiting-hub-focus__list">
                {focusTargets.map((target) => (
                  <RecruitingHubFocusItem key={target.playerId} target={target} />
                ))}
              </ul>
            </div>
          )}

          {commits.length > 0 && (
            <div className="recruiting-hub-commits">
              <p className="recruiting-hub-commits__label">Commits</p>
              <ul className="recruiting-hub-commits__list">
                {commits.map((commit) => (
                  <li key={commit.playerId} className="recruiting-hub-commits__item">
                    <span className="recruiting-hub-commits__rank">
                      {formatRankLabel(commit.nationalRank)}
                    </span>
                    <span className="recruiting-hub-commits__name">{commit.playerName}</span>
                    <span className="recruiting-hub-commits__pos">{commit.position}</span>
                    <RecruitStars stars={commit.stars} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface RecruitingHubFocusItemProps {
  readonly target: FocusTargetSummary
}

/**
 * One Focused Recruit reduced to the decision the player actually needs:
 * identity, readiness, our standing, and an actionable state when relevant.
 * No competitor detail — that lives on the Battles tab.
 */
function RecruitingHubFocusItem({ target }: RecruitingHubFocusItemProps) {
  const isCommitted = target.battle.commitment !== null
  const needsOffer =
    !isCommitted &&
    target.battle.controlled.targetStatus === 'active' &&
    !target.battle.controlled.hasActiveOffer

  return (
    <li className="recruiting-hub-focus__item" data-readiness={target.battle.readiness}>
      <div className="recruiting-hub-focus__identity">
        <span className="recruiting-hub-focus__rank">{formatRankLabel(target.nationalRank)}</span>
        <span className="recruiting-hub-focus__name">{target.playerName}</span>
        <span className="recruiting-hub-focus__pos">{target.position}</span>
        <RecruitStars stars={target.stars} />
      </div>
      {isCommitted ? (
        <p
          className="recruiting-hub-focus__outcome"
          data-position={target.battle.controlled.position}
        >
          {formatControlledPositionLabel(target.battle.controlled.position)}
        </p>
      ) : (
        <div className="recruiting-hub-focus__status">
          <span className="recruiting-hub-focus__readiness">
            {formatReadinessLabel(target.battle.readiness)}
          </span>
          <span
            className="recruiting-hub-focus__standing"
            data-position={target.battle.controlled.position}
          >
            {formatControlledPositionLabel(target.battle.controlled.position)}
          </span>
        </div>
      )}
      {needsOffer && <p className="recruiting-hub-focus__action">Needs Offer</p>}
    </li>
  )
}
