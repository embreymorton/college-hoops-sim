import { formatReadinessLabel } from '../app/recruitingBattleFormatters'
import type { RecruitingReadiness } from '../dynasty'

const READINESS_ORDER: readonly RecruitingReadiness[] = [
  'not-deciding',
  'decision-soon',
  'developing',
  'serious',
  'decision-imminent',
  'committed',
]

/** Categorical only — no thresholds, relationship values, or probabilities. */
const READINESS_DESCRIPTIONS: Record<RecruitingReadiness, string> = {
  'not-deciding':
    "Not yet in his decision window — this isn't a sign of weak Program interest.",
  'decision-soon':
    'One period from his decision window, and the current battle is already strong enough that a commitment next period is realistic.',
  developing: "In his decision window, but no Program has pulled ahead enough to resolve it.",
  serious: 'A leader has emerged, but the race is still too close to call.',
  'decision-imminent':
    'The current battle meets the real conditions to resolve — a commitment could land any period now.',
  committed: 'He has signed with a Program.',
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
        <p className="info-affordance__intro">
          How close a Recruit is to resolving his recruitment — not a probability.
        </p>
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
