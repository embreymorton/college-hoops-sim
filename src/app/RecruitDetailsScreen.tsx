import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { PlayerRatingsGrid, RecruitingReadinessBadge, RecruitStars } from '../components'
import {
  deriveProgramRecruitingBoard,
  deriveRecruitDetailsView,
  deriveTargetStatus,
  RECRUITING_BOARD_LIMIT,
  type RecruitDetailsView,
} from '../dynasty'
import type { Player } from '../engine'
import { useDynastyStore } from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import {
  deriveBattleGroups,
  formatBattlePositionLabel,
  formatControlledPositionLabel,
} from './recruitingBattleFormatters'
import { formatOfferCapacityMessage } from './recruitingFormatters'
import { formatHeight } from './formatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Functional inspection destination for one Recruit in the active class. */
export function RecruitDetailsScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const playerId = useDynastyStore((state) => state.selectedRecruitPlayerId)
  const returnToRecruiting = useDynastyStore((state) => state.returnToRecruiting)
  const addRecruitingTarget = useDynastyStore((state) => state.addRecruitingTarget)
  const removeRecruitingTarget = useDynastyStore((state) => state.removeRecruitingTarget)
  const setRecruitingFocus = useDynastyStore((state) => state.setRecruitingFocus)
  const offerRecruitingTarget = useDynastyStore((state) => state.offerRecruitingTarget)
  const withdrawRecruitingOffer = useDynastyStore((state) => state.withdrawRecruitingOffer)

  let details: RecruitDetailsView | null = null
  let invalidSelection = false
  if (!dynasty || !playerId) {
    invalidSelection = true
  } else {
    try {
      details = deriveRecruitDetailsView(dynasty, playerId)
    } catch (error) {
      if (!(error instanceof RangeError)) throw error
      invalidSelection = true
    }
  }

  useEffect(() => {
    if (invalidSelection) returnToRecruiting()
  }, [invalidSelection, returnToRecruiting])

  if (!details || !dynasty) {
    return <p className="league-empty-state">Returning to Recruiting…</p>
  }

  const controlledProgram = PROGRAMS_BY_ID.get(dynasty.controlledProgramId)
  if (!controlledProgram) return null

  const { battle } = details
  const isCommitted = battle.commitment !== null
  const isCommittedToUs = isCommitted && battle.commitment!.programId === dynasty.controlledProgramId
  const commitmentProgram = battle.commitment
    ? PROGRAMS_BY_ID.get(battle.commitment.programId)
    : undefined
  const player: Player = {
    id: details.playerId,
    firstName: details.firstName,
    lastName: details.lastName,
    position: details.position,
    classYear: details.classYear,
    height: details.height,
    attributes: { ...details.ratings },
    potential: details.potential,
  }
  const { groups } = deriveBattleGroups(
    battle,
    controlledProgram,
    PROGRAMS_BY_ID,
    Number.POSITIVE_INFINITY,
  )

  // Only the controlled Program's own commitment earns the header's accent
  // border — a commitment elsewhere stays neutral so the page never
  // over-celebrates a rival Program.
  const accentStyle = isCommittedToUs
    ? ({ '--team-accent': controlledProgram.branding.primaryColor } as CSSProperties)
    : undefined

  let managementActions: ReactNode = null
  if (!isCommitted) {
    const board = deriveProgramRecruitingBoard(dynasty, dynasty.controlledProgramId)
    const { isOnBoard, isFocused, hasActiveOffer, targetStatus } = battle.controlled
    const isActive = targetStatus === 'active'
    const canRemove = isOnBoard && targetStatus !== 'committed'
    const availableOfferSlots = board.availableOfferSlotsByPosition[details.position]
    const canOffer = isOnBoard && isActive && !hasActiveOffer && availableOfferSlots > 0
    const boardIsFull = board.targets.length >= RECRUITING_BOARD_LIMIT
    const nationalStatus = isOnBoard
      ? targetStatus
      : deriveTargetStatus(dynasty.recruiting!, dynasty.controlledProgramId, details.playerId)
    const canAddToBoard = !isOnBoard && nationalStatus === 'active'
    const fullName = `${details.firstName} ${details.lastName}`

    managementActions = (
      <div className="recruit-details-actions">
        {isOnBoard ? (
          <>
            <button
              type="button"
              className="button button--ghost recruiting-action-button"
              disabled={!isActive}
              aria-label={`${isFocused ? 'Unfocus' : 'Focus'} ${fullName}`}
              onClick={() => setRecruitingFocus(details.playerId, !isFocused)}
            >
              {isFocused ? '★ Focused' : '☆ Focus'}
            </button>
            {isActive && hasActiveOffer && (
              <button
                type="button"
                className="button button--ghost recruiting-action-button"
                onClick={() => withdrawRecruitingOffer(details.playerId)}
              >
                Withdraw Offer
              </button>
            )}
            {isActive && !hasActiveOffer && (
              <>
                <button
                  type="button"
                  className="button button--primary recruiting-action-button"
                  disabled={!canOffer}
                  onClick={() => offerRecruitingTarget(details.playerId)}
                >
                  Offer
                </button>
                {!canOffer && (
                  <p className="recruiting-capacity-note">
                    {formatOfferCapacityMessage(
                      details.position,
                      board.activeOfferCountsByPosition[details.position],
                      board.remainingOpeningsByPosition[details.position],
                    )}
                  </p>
                )}
              </>
            )}
            {canRemove && (
              <button
                type="button"
                className="text-link-button recruiting-remove-button"
                onClick={() => removeRecruitingTarget(details.playerId)}
              >
                Remove from Board
              </button>
            )}
          </>
        ) : canAddToBoard ? (
          boardIsFull ? (
            <button type="button" className="button button--ghost recruiting-action-button" disabled>
              Board Full
            </button>
          ) : (
            <button
              type="button"
              className="button button--primary recruiting-action-button"
              onClick={() => addRecruitingTarget(details.playerId)}
            >
              Add to Board
            </button>
          )
        ) : null}
      </div>
    )
  }

  return (
    <div className="recruit-details-screen">
      <button
        type="button"
        className="button button--ghost exploration-back-button"
        onClick={returnToRecruiting}
      >
        ← Back to Recruiting
      </button>

      <header className="season-header recruit-details-header" style={accentStyle}>
        <div className="season-header__identity">
          <div>
            <p className="eyebrow-tag">Recruit Profile</p>
            <h1 className="season-header__name">
              {details.firstName} {details.lastName}
            </h1>
            <p className="season-header__meta recruit-details-header__meta">
              <RecruitStars stars={details.stars} />
              <span className="recruit-details-header__rank">
                #{details.nationalRank} National · #{details.positionRank} {details.position}
              </span>
            </p>
            <p className="section-hint">
              {details.position} · {formatHeight(details.height)} · Recruiting Class — Season {details.targetSeasonNumber}
            </p>
          </div>
        </div>
        <div className="stat-trio season-header__stats" aria-label="Recruit ability">
          <div className="stat-trio__item">
            <span className="stat-trio__value">{details.overall}</span>
            <span className="stat-trio__label">Ovr</span>
          </div>
          <div className="stat-trio__item">
            <span className="stat-trio__value">{details.potential}</span>
            <span className="stat-trio__label">Pot</span>
          </div>
        </div>
      </header>

      <section className="section" aria-labelledby="recruit-ratings-heading">
        <div className="section-heading"><h2 id="recruit-ratings-heading" className="section-title">Player Ratings</h2></div>
        <PlayerRatingsGrid player={player} />
      </section>

      <section className="section recruit-details-recruitment" aria-labelledby="recruitment-heading">
        <div className="section-heading"><h2 id="recruitment-heading" className="section-title">Current Recruitment</h2></div>
        {isCommitted ? (
          <div
            className="recruit-details-commitment"
            data-position={isCommittedToUs ? 'committed-to-us' : 'committed-elsewhere'}
          >
            <p className="eyebrow-tag">Recruitment Resolved</p>
            <p className="recruit-details-commitment__program">
              <span
                className="team-color-dot"
                style={{ background: commitmentProgram?.branding.primaryColor }}
                aria-hidden="true"
              />
              Committed to {commitmentProgram?.name ?? battle.commitment!.programId}
            </p>
          </div>
        ) : (
          <>
            <div className="recruit-details-readiness-row">
              <span className="recruit-details-readiness-row__label">Readiness</span>
              <RecruitingReadinessBadge readiness={battle.readiness} />
            </div>

            <div
              className="recruit-details-your-program"
              data-position={battle.controlled.position}
            >
              <p className="eyebrow-tag">Your Program</p>
              <p className="recruit-details-your-program__standing">
                {battle.controlled.isOnBoard
                  ? formatControlledPositionLabel(battle.controlled.position)
                  : 'Not on your Board'}
              </p>
              <p className="section-hint">
                {[
                  battle.controlled.isOnBoard && 'On your Board',
                  battle.controlled.isFocused && 'Focused',
                  battle.controlled.hasActiveOffer ? 'Offered' : 'No Offer',
                  battle.controlled.targetStatus === 'position-filled' && 'Position Filled',
                ].filter(Boolean).join(' · ')}
              </p>
              {managementActions}
            </div>

            <div className="recruit-details-battle">
              <h3 className="section-subtitle">Pursuing Programs</h3>
              {groups.length === 0 ? (
                <p className="section-hint">No Programs are currently pursuing this Recruit.</p>
              ) : groups.map((group) => (
                <div key={group.position} className="recruit-details-battle__group">
                  <p className="recruiting-battle-card__group-heading">
                    {formatBattlePositionLabel(group.position)}
                  </p>
                  <ul className="recruiting-battle-card__group-list">
                    {group.rows.map((row) => (
                      <li key={row.programId} className="recruiting-battle-card__row" data-controlled={row.isControlled}>
                        <span className="team-color-dot" style={{ background: row.accentColor }} aria-hidden="true" />
                        <span className="recruiting-battle-card__row-name">{row.programName}</span>
                        {row.isControlled ? (
                          <span className="recruiting-battle-card__row-you">
                            {[
                              'YOU',
                              battle.controlled.isFocused && 'Focused',
                              battle.controlled.hasActiveOffer && 'Offered',
                            ].filter(Boolean).join(' · ')}
                          </span>
                        ) : row.hasActiveOffer ? (
                          <span className="recruiting-battle-card__row-offer">Offered</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
