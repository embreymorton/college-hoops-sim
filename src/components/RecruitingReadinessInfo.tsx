import { formatReadinessLabel } from '../app/recruitingBattleFormatters'
import type { RecruitingReadiness } from '../dynasty'

const READINESS_ORDER: readonly RecruitingReadiness[] = [
  'early',
  'developing',
  'serious',
  'decision-imminent',
  'committed',
]

/** Categorical only — no thresholds, relationship values, or probabilities. */
const READINESS_DESCRIPTIONS: Record<RecruitingReadiness, string> = {
  early: "Not yet inside the Recruit's decision window.",
  developing: 'Being actively recruited, with no clear leader yet.',
  serious: 'A leading Program has emerged, but the outcome is still contested.',
  'decision-imminent': 'A commitment is close.',
  committed: 'The Recruit has signed.',
}

/**
 * Accessible hover/focus explanation of the Readiness categories, beside the
 * Board's Readiness column heading. Categorical only — never exposes exact
 * thresholds, relationship values, probabilities, or decision-period internals.
 */
export function RecruitingReadinessInfo() {
  return (
    <span className="info-affordance">
      <button
        type="button"
        className="info-affordance__trigger"
        aria-describedby="recruiting-readiness-info"
      >
        <span aria-hidden="true">ⓘ</span>
        <span className="visually-hidden">About Readiness</span>
      </button>
      <span
        role="tooltip"
        id="recruiting-readiness-info"
        className="info-affordance__tooltip"
      >
        <span className="info-affordance__title">Readiness</span>
        <ul className="info-affordance__list">
          {READINESS_ORDER.map((readiness) => (
            <li key={readiness}>
              <strong>{formatReadinessLabel(readiness)}</strong>
              {' — '}
              {READINESS_DESCRIPTIONS[readiness]}
            </li>
          ))}
        </ul>
      </span>
    </span>
  )
}
