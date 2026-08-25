import { RECRUITING_BOARD_LIMIT, RECRUITING_FOCUS_LIMIT } from '../dynasty'
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
  developing: 'In his decision window, but no Program has pulled ahead enough to resolve it.',
  serious: 'A leader has emerged, but the race is still too close to call.',
  'decision-imminent':
    'The current battle meets the real conditions to resolve — a commitment could land any period now.',
  committed: 'He has signed with a Program.',
}

/**
 * The canonical in-app explanation destination for Board, Focus, Offers,
 * Readiness, and Battles standing — replaces the retired Readiness tooltip
 * and the scattered instructional copy that used to sit beside Positional
 * Needs. Player-facing and categorical only; never exposes hidden periods,
 * thresholds, relationship totals, or probabilities.
 */
export function RecruitingGuide() {
  return (
    <div className="recruiting-guide">
      <section className="recruiting-guide__section" aria-labelledby="guide-board-heading">
        <h3 id="guide-board-heading" className="recruiting-guide__heading">
          Board
        </h3>
        <p className="recruiting-guide__body">
          Board targets receive normal recruiting effort. Your Board can carry up to{' '}
          {RECRUITING_BOARD_LIMIT} recruits at once.
        </p>
      </section>

      <section className="recruiting-guide__section" aria-labelledby="guide-focus-heading">
        <h3 id="guide-focus-heading" className="recruiting-guide__heading">
          Focus
        </h3>
        <p className="recruiting-guide__body">
          Up to {RECRUITING_FOCUS_LIMIT} Board targets can be Focused for extra attention. Focus
          and Offers are separate choices — a generated plan may initially align them for
          coherence, but you can change either one manually at any time.
        </p>
      </section>

      <section className="recruiting-guide__section" aria-labelledby="guide-offers-heading">
        <h3 id="guide-offers-heading" className="recruiting-guide__heading">
          Offers
        </h3>
        <p className="recruiting-guide__body">
          Only recruits with an active Offer can commit to your Program. Active Offers reserve
          real scholarship capacity; withdrawing an Offer or losing a recruiting battle releases it.
        </p>
      </section>

      <section className="recruiting-guide__section" aria-labelledby="guide-scholarships-heading">
        <h3 id="guide-scholarships-heading" className="recruiting-guide__heading">
          Scholarships
        </h3>
        <p className="recruiting-guide__body">
          Next season's roster finishes with 12 Players and 2–3 at every natural position.
          Positions projected below 2 create Required needs. Remaining scholarships are Flexible
          and may be used at any position that has not reached the maximum of 3.
        </p>
      </section>

      <section className="recruiting-guide__section" aria-labelledby="guide-readiness-heading">
        <h3 id="guide-readiness-heading" className="recruiting-guide__heading">
          Readiness
        </h3>
        <p className="recruiting-guide__body">
          Readiness describes how close a recruit is to resolving his recruitment. It is not an
          exact commitment probability.
        </p>
        <dl className="recruiting-guide__readiness-list">
          {READINESS_ORDER.map((readiness) => (
            <div key={readiness} className="recruiting-guide__readiness-item">
              <dt>{formatReadinessLabel(readiness)}</dt>
              <dd>{READINESS_DESCRIPTIONS[readiness]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="recruiting-guide__section" aria-labelledby="guide-battles-heading">
        <h3 id="guide-battles-heading" className="recruiting-guide__heading">
          Battles
        </h3>
        <p className="recruiting-guide__body">
          A recruit's pursuing Programs are grouped as Leading, Competitive, or Trailing —
          categorical standings that do not expose exact hidden totals. When you are actively
          pursuing, your row also shows your rank among the recruit's current pursuers, such as
          "#2 of 9" — a count of active competitors, not a hidden score. Open the Battles tab for
          detailed Program-by-Program context on every recruit on your Board.
        </p>
      </section>
    </div>
  )
}
