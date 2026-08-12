import {
  countCompetitors,
  deriveCompetitorSummaries,
  type FocusTargetSummary,
} from '../app/recruitingBattleFormatters'
import { formatRankLabel } from '../app/recruitingFormatters'
import type { ProgramDefinition } from '../universe'
import { RecruitingReadinessBadge, RecruitingStandingBadge } from './RecruitingBattleBadges'
import { RecruitingCompetitorList } from './RecruitingCompetitorList'
import { RecruitStars } from './RecruitStars'

const COMPETITOR_DISPLAY_LIMIT = 3

interface SeasonHubFocusTargetsProps {
  readonly focusTargets: readonly FocusTargetSummary[]
  readonly controlledProgramId: string
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly onManageRecruiting: () => void
}

/**
 * The controlled Program's deliberately Focused Recruits, surfaced at a
 * glance on the Season Hub: readiness, standing, Offer status, and the
 * meaningful competitors — without opening the full Recruiting Hub. Never
 * more than `RECRUITING_FOCUS_LIMIT` targets exist, so this stays compact by
 * construction rather than needing its own cap.
 */
export function SeasonHubFocusTargets({
  focusTargets,
  controlledProgramId,
  programsById,
  onManageRecruiting,
}: SeasonHubFocusTargetsProps) {
  if (focusTargets.length === 0) {
    return null
  }

  return (
    <div className="season-hub-focus-targets">
      <div className="season-hub-focus-targets__header">
        <p className="eyebrow-tag">Focus Targets</p>
        <button
          type="button"
          className="text-link-button season-hub-focus-targets__manage"
          onClick={onManageRecruiting}
        >
          Manage Recruiting
        </button>
      </div>
      <ul className="season-hub-focus-targets__list">
        {focusTargets.map((target) => {
          const competitors = deriveCompetitorSummaries(
            target.battle,
            controlledProgramId,
            programsById,
            COMPETITOR_DISPLAY_LIMIT,
          )
          const overflowCount = Math.max(
            0,
            countCompetitors(target.battle, controlledProgramId) -
              competitors.length,
          )

          return (
            <li
              key={target.playerId}
              className="season-hub-focus-target"
              data-readiness={target.battle.readiness}
            >
              <div className="season-hub-focus-target__identity">
                <span className="season-hub-focus-target__rank">
                  {formatRankLabel(target.nationalRank)}
                </span>
                <span className="season-hub-focus-target__name">
                  {target.playerName}
                </span>
                <span className="season-hub-focus-target__pos">
                  {target.position}
                </span>
                <RecruitStars stars={target.stars} />
              </div>
              <div className="season-hub-focus-target__status">
                <RecruitingReadinessBadge readiness={target.battle.readiness} />
                <RecruitingStandingBadge position={target.battle.controlled.position} />
                {target.battle.controlled.hasActiveOffer && (
                  <span className="season-hub-focus-target__offer">Offered</span>
                )}
              </div>
              <RecruitingCompetitorList
                competitors={competitors}
                overflowCount={overflowCount}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
