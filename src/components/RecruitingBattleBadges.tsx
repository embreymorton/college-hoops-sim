import type { RecruitingReadiness } from '../dynasty'
import { formatReadinessLabel } from '../app/recruitingBattleFormatters'

interface RecruitingReadinessBadgeProps {
  readonly readiness: RecruitingReadiness
}

/** A restrained categorical readiness tag — never a percentage or progress bar. */
export function RecruitingReadinessBadge({ readiness }: RecruitingReadinessBadgeProps) {
  return (
    <span className="recruiting-readiness-badge" data-readiness={readiness}>
      {formatReadinessLabel(readiness)}
    </span>
  )
}
