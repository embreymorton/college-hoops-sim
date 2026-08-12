import type { ControlledRecruitingPosition, RecruitingReadiness } from '../dynasty'
import {
  formatControlledPositionLabel,
  formatReadinessLabel,
} from '../app/recruitingBattleFormatters'

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

interface RecruitingStandingBadgeProps {
  readonly position: ControlledRecruitingPosition
}

/** The controlled Program's categorical standing — leading/competitive/trailing plus commitment outcomes. */
export function RecruitingStandingBadge({ position }: RecruitingStandingBadgeProps) {
  return (
    <span className="recruiting-standing-badge" data-position={position}>
      {formatControlledPositionLabel(position)}
    </span>
  )
}
