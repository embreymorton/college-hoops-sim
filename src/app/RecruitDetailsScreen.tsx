import { useEffect } from 'react'
import { PlayerRatingsGrid, RecruitStars } from '../components'
import { deriveRecruitDetailsView, type RecruitDetailsView } from '../dynasty'
import type { Player } from '../engine'
import { useDynastyStore } from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import {
  deriveBattleGroups,
  formatBattlePositionLabel,
  formatControlledPositionLabel,
  formatReadinessLabel,
} from './recruitingBattleFormatters'
import { formatHeight } from './formatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Functional inspection destination for one Recruit in the active class. */
export function RecruitDetailsScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const playerId = useDynastyStore((state) => state.selectedRecruitPlayerId)
  const returnToRecruiting = useDynastyStore((state) => state.returnToRecruiting)

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

  return (
    <div className="recruit-details-screen">
      <button
        type="button"
        className="button button--ghost exploration-back-button"
        onClick={returnToRecruiting}
      >
        ← Back to Recruiting
      </button>

      <header className="recruit-details-header section">
        <div>
          <p className="eyebrow-tag">Recruit Profile</p>
          <h1>{details.firstName} {details.lastName}</h1>
          <RecruitStars stars={details.stars} />
          <p className="recruit-details-header__rank">
            #{details.nationalRank} National · #{details.positionRank} {details.position}
          </p>
          <p className="section-hint">
            {details.position} · {formatHeight(details.height)} · Recruiting Class — Season {details.targetSeasonNumber}
          </p>
        </div>
        <dl className="recruit-details-header__ratings" aria-label="Recruit ability">
          <div><dt>OVR</dt><dd>{details.overall}</dd></div>
          <div><dt>POT</dt><dd>{details.potential}</dd></div>
        </dl>
      </header>

      <section className="section" aria-labelledby="recruit-ratings-heading">
        <div className="section-heading"><h2 id="recruit-ratings-heading">Player Ratings</h2></div>
        <PlayerRatingsGrid player={player} />
      </section>

      <section className="section recruit-details-recruitment" aria-labelledby="recruitment-heading">
        <div className="section-heading"><h2 id="recruitment-heading">Current Recruitment</h2></div>
        {battle.commitment ? (
          <div className="recruit-details-commitment" data-position={battle.controlled.position}>
            <p className="eyebrow-tag">Committed</p>
            <p className="recruit-details-commitment__program">
              Committed to {commitmentProgram?.name ?? battle.commitment.programId}
            </p>
          </div>
        ) : (
          <>
            <div className="recruit-details-snapshot">
              <div>
                <span className="recruit-details-snapshot__label">Readiness</span>
                <strong>{formatReadinessLabel(battle.readiness)}</strong>
              </div>
              <div>
                <span className="recruit-details-snapshot__label">Your Program</span>
                <strong>{battle.controlled.isOnBoard
                  ? formatControlledPositionLabel(battle.controlled.position)
                  : 'Not on your Board'}</strong>
                <span className="section-hint">
                  {[
                    battle.controlled.isOnBoard && 'On your Board',
                    battle.controlled.isFocused && 'Focused',
                    battle.controlled.hasActiveOffer ? 'Offered' : 'No Offer',
                    battle.controlled.targetStatus === 'position-filled' && 'Position Filled',
                  ].filter(Boolean).join(' · ')}
                </span>
              </div>
            </div>

            <div className="recruit-details-battle">
              <h3>Pursuing Programs</h3>
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
