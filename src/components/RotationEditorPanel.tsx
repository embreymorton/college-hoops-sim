import type { CSSProperties } from 'react'
import {
  calculateOverall,
  calculatePlayerDefense,
  calculatePlayerOffense,
  derivePlayerMinutesV1,
  getEligibleRotationPositions,
  MAX_PLAYER_MINUTES,
  MINUTES_PER_POSITION,
  POSITIONS,
  TOTAL_ROTATION_MINUTES,
  type Position,
  type RotationV1,
  type RotationV1ValidationResult,
  type Team,
  type TeamStrength,
} from '../engine'
import { areRotationsEqual, describePositionMinutes, formatRating } from '../app/formatters'
import { MinuteStepper } from './MinuteStepper'
import { RotationStrengthSummary } from './RotationStrengthSummary'
import { TeamPanelHeader } from './TeamPanelHeader'
import type { BrandingSource } from './branding'

interface RotationEditorPanelProps {
  readonly team: Team
  readonly defaultRotation: RotationV1
  readonly currentRotation: RotationV1
  readonly program: BrandingSource
  readonly validation: RotationV1ValidationResult
  readonly defaultStrength: TeamStrength
  readonly currentStrength: TeamStrength | null
  readonly pendingStrengthReason: string | null
  readonly onSetPlayerPositionMinutes: (
    playerId: string,
    floorPosition: Position,
    minutes: number,
  ) => void
  readonly onReset: () => void
  readonly headingId: string
}

export function RotationEditorPanel({
  team,
  defaultRotation,
  currentRotation,
  program,
  validation,
  defaultStrength,
  currentStrength,
  pendingStrengthReason,
  onSetPlayerPositionMinutes,
  onReset,
  headingId,
}: RotationEditorPanelProps) {
  const accentStyle = {
    '--team-accent': program.primaryColor,
  } as CSSProperties
  const aggregateMinutes = derivePlayerMinutesV1(currentRotation)
  const totalMinutes = Object.values(aggregateMinutes).reduce(
    (total, minutes) => total + minutes,
    0,
  )
  const isChanged = !areRotationsEqual(team, defaultRotation, currentRotation)

  return (
    <div className="team-panel" style={accentStyle}>
      <TeamPanelHeader team={team} headingId={headingId} />
      <div className="rotation-toolbar">
        <div
          className="rotation-budget"
          data-status={totalMinutes === TOTAL_ROTATION_MINUTES ? 'valid' : 'invalid'}
        >
          <span className="rotation-budget__value">{totalMinutes}</span>
          <span className="rotation-budget__slash">/</span>
          <span className="rotation-budget__value rotation-budget__value--target">
            {TOTAL_ROTATION_MINUTES}
          </span>
          <span className="rotation-budget__label">Minutes</span>
        </div>
        <button
          type="button"
          className="button button--ghost rotation-reset"
          onClick={onReset}
          disabled={!isChanged}
        >
          Reset to Default
        </button>
      </div>
      <RotationStrengthSummary
        defaultStrength={defaultStrength}
        currentStrength={currentStrength}
        pendingReason={pendingStrengthReason}
      />
      <div className="table-scroll">
        <table className="data-table rotation-table">
          <caption className="visually-hidden">
            {`${team.name} rotation editor — assign Player minutes by position`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Yr</th>
              <th scope="col">Ovr</th>
              <th scope="col">Off</th>
              <th scope="col">Def</th>
              <th scope="col">Floor Min</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          {POSITIONS.map((position) => {
            const assignments = currentRotation.minutesByPosition[position]
            const positionActual = Object.values(assignments).reduce(
              (total, minutes) => total + minutes,
              0,
            )
            const isPositionInvalid = validation.issues.some(
              (issue) =>
                issue.code === 'INVALID_POSITION_TOTAL' &&
                issue.position === position,
            )
            const positionPlayers = team.roster
              .filter((player) =>
                getEligibleRotationPositions(player).includes(position),
              )
              .sort(
                (first, second) =>
                  (assignments[second.id] ?? 0) -
                    (assignments[first.id] ?? 0) ||
                  calculateOverall(second) - calculateOverall(first) ||
                  first.id.localeCompare(second.id),
              )

            return (
              <tbody key={position}>
                <tr
                  className="rotation-group-row"
                  data-status={isPositionInvalid ? 'invalid' : 'valid'}
                >
                  <th scope="colgroup" colSpan={7}>
                    <div className="rotation-group-row__inner">
                      <span className="rotation-group-row__position">
                        {position}
                      </span>
                      <span className="rotation-group-row__total">
                        {positionActual} / {MINUTES_PER_POSITION}
                      </span>
                      <span className="rotation-group-row__status">
                        {describePositionMinutes(
                          positionActual,
                          MINUTES_PER_POSITION,
                        )}
                      </span>
                    </div>
                  </th>
                </tr>
                {positionPlayers.map((player) => {
                  const minutes = assignments[player.id] ?? 0
                  const playerTotal = aggregateMinutes[player.id] ?? 0
                  const playerIssue = validation.issues.find(
                    (issue) =>
                      (issue.code === 'INVALID_PLAYER_MINUTES' ||
                        issue.code === 'INVALID_PLAYER_TOTAL') &&
                      issue.playerId === player.id,
                  )
                  const playerLabel = `${player.firstName} ${player.lastName}`
                  const eligibility = getEligibleRotationPositions(player).join('/')

                  return (
                    <tr
                      key={`${position}:${player.id}`}
                      data-player-id={player.id}
                      data-floor-position={position}
                      data-zero-minutes={minutes === 0}
                    >
                      <td className="player-name-cell">
                        {playerLabel} — {eligibility}
                      </td>
                      <td>{player.classYear}</td>
                      <td>{calculateOverall(player)}</td>
                      <td>{formatRating(calculatePlayerOffense(player))}</td>
                      <td>{formatRating(calculatePlayerDefense(player))}</td>
                      <td className="rotation-minutes-cell">
                        <MinuteStepper
                          id={`minutes-${position}-${player.id}`}
                          value={minutes}
                          label={`${position} floor minutes for ${playerLabel}`}
                          onChange={(nextMinutes) =>
                            onSetPlayerPositionMinutes(
                              player.id,
                              position,
                              nextMinutes,
                            )
                          }
                        />
                      </td>
                      <td
                        className="rotation-total-cell"
                        data-invalid={Boolean(playerIssue)}
                        title={
                          playerIssue
                            ? `Player total must remain within 0–${MAX_PLAYER_MINUTES}`
                            : undefined
                        }
                      >
                        {playerTotal} / {MAX_PLAYER_MINUTES}
                        {playerIssue && (
                          <span className="visually-hidden">
                            {' '}
                            Player total must remain within 0–{MAX_PLAYER_MINUTES}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            )
          })}
        </table>
      </div>
    </div>
  )
}
