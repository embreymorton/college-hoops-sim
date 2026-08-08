import type { CSSProperties } from 'react'
import {
  calculateOverall,
  calculatePlayerDefense,
  calculatePlayerOffense,
  calculatePositionMinutes,
  calculateTotalMinutes,
  getPlayersByMinutes,
  MAX_PLAYER_MINUTES,
  MINUTES_PER_POSITION,
  POSITIONS,
  TOTAL_ROTATION_MINUTES,
  type Rotation,
  type RotationValidationResult,
  type Team,
  type TeamStrength,
} from '../engine'
import type { DemoProgram } from '../demo/demoPrograms'
import { areRotationsEqual, describePositionMinutes, formatRating } from '../app/formatters'
import { MinuteStepper } from './MinuteStepper'
import { RotationStrengthSummary } from './RotationStrengthSummary'
import { TeamPanelHeader } from './TeamPanelHeader'

interface RotationEditorPanelProps {
  readonly team: Team
  readonly defaultRotation: Rotation
  readonly currentRotation: Rotation
  readonly program: DemoProgram
  readonly validation: RotationValidationResult
  readonly defaultStrength: TeamStrength
  readonly currentStrength: TeamStrength | null
  readonly pendingStrengthReason: string | null
  readonly onSetPlayerMinutes: (playerId: string, minutes: number) => void
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
  onSetPlayerMinutes,
  onReset,
  headingId,
}: RotationEditorPanelProps) {
  const accentStyle = {
    '--team-accent': program.primaryColor,
  } as CSSProperties
  const totalMinutes = calculateTotalMinutes(currentRotation)
  const isChanged = !areRotationsEqual(team, defaultRotation, currentRotation)
  const rankedRoster = getPlayersByMinutes(team, currentRotation)

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
              <th scope="col">Minutes</th>
            </tr>
          </thead>
          {POSITIONS.map((position) => {
            const positionActual = calculatePositionMinutes(
              team,
              currentRotation,
              position,
            )
            const isPositionInvalid = validation.issues.some(
              (issue) =>
                issue.code === 'INVALID_POSITION_TOTAL' &&
                issue.position === position,
            )
            const positionPlayers = rankedRoster.filter(
              ({ player }) => player.position === position,
            )

            return (
              <tbody key={position}>
                <tr
                  className="rotation-group-row"
                  data-status={isPositionInvalid ? 'invalid' : 'valid'}
                >
                  <th scope="colgroup" colSpan={6}>
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
                {positionPlayers.map(({ player, minutes }) => {
                  const playerIssue = validation.issues.find(
                    (issue) =>
                      issue.code === 'INVALID_PLAYER_MINUTES' &&
                      issue.playerId === player.id,
                  )
                  const playerLabel = `${player.firstName} ${player.lastName}`

                  return (
                    <tr
                      key={player.id}
                      data-player-id={player.id}
                      data-zero-minutes={minutes === 0}
                    >
                      <td className="player-name-cell">{playerLabel}</td>
                      <td>{player.classYear}</td>
                      <td>{calculateOverall(player)}</td>
                      <td>{formatRating(calculatePlayerOffense(player))}</td>
                      <td>{formatRating(calculatePlayerDefense(player))}</td>
                      <td className="rotation-minutes-cell">
                        <MinuteStepper
                          id={`minutes-${player.id}`}
                          value={minutes}
                          label={`Minutes for ${playerLabel}`}
                          onChange={(nextMinutes) =>
                            onSetPlayerMinutes(player.id, nextMinutes)
                          }
                        />
                        {playerIssue && (
                          <span className="rotation-player-note">
                            Outside 0–{MAX_PLAYER_MINUTES} minutes
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
