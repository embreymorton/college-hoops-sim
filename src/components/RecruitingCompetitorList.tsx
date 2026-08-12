import { formatBattlePositionLabel } from '../app/recruitingBattleFormatters'
import type { RecruitingCompetitorSummary } from '../app/recruitingBattleFormatters'

interface RecruitingCompetitorListProps {
  readonly competitors: readonly RecruitingCompetitorSummary[]
  /** Competing Programs beyond the ones already shown, if the Board is crowded. */
  readonly overflowCount?: number
}

/**
 * Compact, deterministically ordered list of meaningful competing Programs.
 * Deliberately does not attempt to show every pursuer when the list is long
 * — an "+N more" summary keeps the card from becoming noisy.
 */
export function RecruitingCompetitorList({
  competitors,
  overflowCount = 0,
}: RecruitingCompetitorListProps) {
  if (competitors.length === 0) {
    return null
  }

  return (
    <ul className="recruiting-competitor-list">
      {competitors.map((competitor) => (
        <li
          key={competitor.programId}
          className="recruiting-competitor-list__item"
          data-position={competitor.position}
        >
          <span
            className="recruiting-competitor-list__dot"
            style={{ background: competitor.accentColor }}
            aria-hidden="true"
          />
          <span className="recruiting-competitor-list__name">
            {competitor.programName}
          </span>
          <span className="recruiting-competitor-list__position">
            {formatBattlePositionLabel(competitor.position)}
          </span>
          {competitor.hasActiveOffer && (
            <span className="recruiting-competitor-list__offer">Offer</span>
          )}
        </li>
      ))}
      {overflowCount > 0 && (
        <li className="recruiting-competitor-list__overflow">
          +{overflowCount} more
        </li>
      )}
    </ul>
  )
}
