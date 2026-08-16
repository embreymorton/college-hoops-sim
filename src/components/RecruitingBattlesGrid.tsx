import {
  deriveBattleGroups,
  formatBattlePositionLabel,
  formatControlledPositionLabel,
  formatReadinessLabel,
  type BattleCardSummary,
} from '../app/recruitingBattleFormatters'
import { formatRankLabel } from '../app/recruitingFormatters'
import type { ProgramDefinition } from '../universe'
import { RecruitStars } from './RecruitStars'

const COMPETITOR_DISPLAY_LIMIT = 3

interface RecruitingBattlesGridProps {
  readonly cards: readonly BattleCardSummary[]
  readonly controlledProgram: ProgramDefinition
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly onOpenRecruitDetails: (playerId: string) => void
}

/**
 * Recruiting intelligence: one spacious card per Board Recruit, our Program
 * and its meaningful competitors, and the commitment outcome once resolved.
 * Consumes only the existing `deriveRecruitingBattleView` projection —
 * derives no new Recruiting facts.
 */
export function RecruitingBattlesGrid({
  cards,
  controlledProgram,
  programsById,
  onOpenRecruitDetails,
}: RecruitingBattlesGridProps) {
  if (cards.length === 0) {
    return (
      <p className="section-hint">
        No Board Recruits yet — add targets from the National Class to see their battles.
      </p>
    )
  }

  return (
    <ul className="recruiting-battles-grid">
      {cards.map((card) => (
        <RecruitingBattleCard
          key={card.playerId}
          card={card}
          controlledProgram={controlledProgram}
          programsById={programsById}
          onOpenRecruitDetails={onOpenRecruitDetails}
        />
      ))}
    </ul>
  )
}

interface RecruitingBattleCardProps {
  readonly card: BattleCardSummary
  readonly controlledProgram: ProgramDefinition
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly onOpenRecruitDetails: (playerId: string) => void
}

function RecruitingBattleCard({
  card,
  controlledProgram,
  programsById,
  onOpenRecruitDetails,
}: RecruitingBattleCardProps) {
  const { battle } = card
  const isCommitted = battle.commitment !== null
  const committedProgramName = isCommitted
    ? battle.commitment!.programId === controlledProgram.id
      ? controlledProgram.name
      : (programsById.get(battle.commitment!.programId)?.name ?? 'another Program')
    : undefined

  // The controlled Program only appears in `pursuingPrograms` while it is
  // actively pursuing (on board, active status). A Board target can still
  // be `position-filled` while remaining on the board, in which case the
  // grouped battle has nothing to say about our own standing.
  const controlledIsPursuing = battle.pursuingPrograms.some(
    (entry) => entry.programId === controlledProgram.id,
  )
  const { groups, overflowCount } = deriveBattleGroups(
    battle,
    controlledProgram,
    programsById,
    COMPETITOR_DISPLAY_LIMIT,
  )
  const youLabel = ['YOU', card.isFocused && 'Focused', card.hasActiveOffer && 'Offered']
    .filter((tag): tag is string => Boolean(tag))
    .join(' · ')

  return (
    <li className="recruiting-battle-card" data-readiness={battle.readiness}>
      <div className="recruiting-battle-card__identity">
        <span className="recruiting-battle-card__rank">
          {formatRankLabel(card.nationalRank)}
        </span>
        <button
          type="button"
          className="text-link-button recruiting-battle-card__name recruit-details-link"
          onClick={() => onOpenRecruitDetails(card.playerId)}
        >
          {card.playerName}
        </button>
        <span className="recruiting-battle-card__pos">{card.position}</span>
        <RecruitStars stars={card.stars} />
      </div>
      <p className="recruiting-battle-card__ratings">
        OVR {card.ovr} · POT {card.pot}
      </p>

      {isCommitted ? (
        <p
          className="recruiting-battle-card__outcome"
          data-position={battle.controlled.position}
        >
          Committed To {committedProgramName}
        </p>
      ) : (
        <>
          <p className="recruiting-battle-card__readiness">
            {formatReadinessLabel(battle.readiness)}
          </p>

          {!controlledIsPursuing && (
            <p className="recruiting-battle-card__not-pursuing">
              {formatControlledPositionLabel(battle.controlled.position)}
            </p>
          )}

          {groups.map((group) => (
            <div key={group.position} className="recruiting-battle-card__group">
              <p className="recruiting-battle-card__group-heading">
                {formatBattlePositionLabel(group.position)}
              </p>
              <ul className="recruiting-battle-card__group-list">
                {group.rows.map((row) => (
                  <li
                    key={row.programId}
                    className="recruiting-battle-card__row"
                    data-controlled={row.isControlled}
                  >
                    <span
                      className="team-color-dot"
                      style={{ background: row.accentColor }}
                      aria-hidden="true"
                    />
                    <span className="recruiting-battle-card__row-name">
                      {row.programName}
                    </span>
                    {row.isControlled ? (
                      <span className="recruiting-battle-card__row-you">{youLabel}</span>
                    ) : (
                      row.hasActiveOffer && (
                        <span className="recruiting-battle-card__row-offer">Offered</span>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {overflowCount > 0 && (
            <p className="recruiting-battle-card__overflow">
              +{overflowCount} other programs
            </p>
          )}
        </>
      )}
    </li>
  )
}
