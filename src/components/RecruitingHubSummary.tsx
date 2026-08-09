import { RECRUITING_BOARD_LIMIT, type RecruitingPhase } from '../dynasty'
import {
  formatRankLabel,
  getRecruitingPeriodDenominator,
  type RecentControlledCommitment,
} from '../app/recruitingFormatters'
import { RecruitStars } from './RecruitStars'

interface RecruitingHubSummaryProps {
  readonly targetSeasonNumber: number
  readonly phase: RecruitingPhase
  readonly lastResolvedPeriod: number
  readonly boardSize: number
  readonly signedTotal: number
  readonly projectedTotal: number
  readonly recentCommitment: RecentControlledCommitment | undefined
  readonly onManageRecruiting: () => void
}

/** A compact Season/Postseason Hub module — high-value Recruiting facts only, not the full page. */
export function RecruitingHubSummary({
  targetSeasonNumber,
  phase,
  lastResolvedPeriod,
  boardSize,
  signedTotal,
  projectedTotal,
  recentCommitment,
  onManageRecruiting,
}: RecruitingHubSummaryProps) {
  const denominator = getRecruitingPeriodDenominator(phase)

  return (
    <div className="recruiting-hub-summary">
      <p className="eyebrow-tag">Recruiting</p>
      <p className="recruiting-hub-summary__class">Class of Season {targetSeasonNumber}</p>

      <dl className="recruiting-hub-summary__stats">
        <div className="recruiting-hub-summary__stat">
          <dt>Period</dt>
          <dd>
            {lastResolvedPeriod} / {denominator}
          </dd>
        </div>
        <div className="recruiting-hub-summary__stat">
          <dt>Signed</dt>
          <dd>
            {signedTotal} / {projectedTotal}
          </dd>
        </div>
        <div className="recruiting-hub-summary__stat">
          <dt>Board</dt>
          <dd>
            {boardSize} / {RECRUITING_BOARD_LIMIT}
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
    </div>
  )
}
