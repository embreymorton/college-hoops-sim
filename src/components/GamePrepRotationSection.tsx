import { useState } from 'react'
import {
  deriveProjectedStartingFive,
  type RotationV1,
  type RotationV1ValidationResult,
  type SimpleRotationIntentIssue,
  type Team,
  type TeamStrength,
} from '../engine'
import { deriveSimplePlayerMinutes } from '../app/formatters'
import type { BrandingSource } from './branding'
import { OpponentRotationPanel } from './OpponentRotationPanel'
import { RotationEditorPanel } from './RotationEditorPanel'
import { RotationModeTabs, type RotationMode } from './RotationModeTabs'
import { SimpleRotationPanel } from './SimpleRotationPanel'

interface GamePrepRotationSectionProps {
  readonly headingId: string
  readonly controlledTeam: Team
  readonly controlledProgram: BrandingSource
  readonly canonicalRotation: RotationV1
  readonly defaultRotation: RotationV1
  readonly draftRotation: RotationV1
  readonly validation: RotationV1ValidationResult
  readonly defaultStrength: TeamStrength
  readonly currentStrength: TeamStrength | null
  readonly pendingStrengthReason: string | null
  readonly simpleMinutesByPlayerId: Readonly<Record<string, number>>
  readonly simplePreservedPlayerIds: readonly string[]
  readonly simpleIssues: readonly SimpleRotationIntentIssue[]
  readonly opponentTeam: Team
  readonly opponentRotation: RotationV1
  readonly opponentProgram: BrandingSource
  readonly onSetSimplePlayerMinutes: (playerId: string, minutes: number) => void
  readonly onFillSimple: () => void
  readonly onApplySimple: () => void
  readonly onDiscardSimple: () => void
  readonly onSetAdvancedPlayerPositionMinutes: (
    playerId: string,
    floorPosition: 'PG' | 'SG' | 'SF' | 'PF' | 'C',
    minutes: number,
  ) => void
  readonly onResetAdvanced: () => void
  readonly onSelectControlledPlayer: (playerId: string) => void
  readonly onSelectOpponentPlayer: (playerId: string) => void
  readonly onViewOpponentRoster: () => void
}

export function GamePrepRotationSection(props: GamePrepRotationSectionProps) {
  const [mode, setMode] = useState<RotationMode>('simple')
  const [modeFeedback, setModeFeedback] = useState<string | null>(null)
  const committedSimpleMinutes = deriveSimplePlayerMinutes(
    props.controlledTeam,
    props.canonicalRotation,
  )
  const simpleIsDirty = props.controlledTeam.roster.some(
    (player) =>
      (props.simpleMinutesByPlayerId[player.id] ?? 0) !==
      (committedSimpleMinutes[player.id] ?? 0),
  )
  const projection = deriveProjectedStartingFive(
    props.controlledTeam,
    props.canonicalRotation,
  )

  const selectMode = (nextMode: RotationMode) => {
    if (nextMode === mode) return
    if (mode === 'simple' && simpleIsDirty) {
      setModeFeedback('Apply or discard your Rotation changes before switching to Advanced.')
      return
    }
    if (mode === 'advanced' && !props.validation.valid) {
      setModeFeedback('Finish or reset the current Advanced Rotation before switching to Simple.')
      return
    }
    setModeFeedback(null)
    setMode(nextMode)
  }

  return (
    <section className="section game-prep-rotation-section" aria-labelledby={props.headingId}>
      <div className="section-heading">
        <div>
          <h2 id={props.headingId} className="section-title">Rotation Preparation</h2>
          <p className="section-hint">Who is playing, and do you want to change anything?</p>
        </div>
      </div>
      <div className="game-prep-rotation-grid">
        <div className="game-prep-rotation-side">
          <div className="game-prep-rotation-side__heading">
            <h3>Your Rotation</h3>
            <RotationModeTabs mode={mode} onSelectMode={selectMode} />
          </div>
          {modeFeedback && <p className="rotation-mode-feedback" role="status">{modeFeedback}</p>}
          {mode === 'simple' ? (
            <SimpleRotationPanel
              team={props.controlledTeam}
              program={props.controlledProgram}
              minutesByPlayerId={props.simpleMinutesByPlayerId}
              preservedPlayerIds={props.simplePreservedPlayerIds}
              committedMinutesByPlayerId={committedSimpleMinutes}
              projectedStartingFive={projection.valid ? projection.startingFive : null}
              issues={props.simpleIssues}
              onSetPlayerMinutes={props.onSetSimplePlayerMinutes}
              onFill={props.onFillSimple}
              onApply={props.onApplySimple}
              onDiscard={props.onDiscardSimple}
              onSelectPlayer={props.onSelectControlledPlayer}
              headingId={`${props.headingId}-controlled`}
            />
          ) : (
            <RotationEditorPanel
              team={props.controlledTeam}
              defaultRotation={props.defaultRotation}
              currentRotation={props.draftRotation}
              program={props.controlledProgram}
              validation={props.validation}
              defaultStrength={props.defaultStrength}
              currentStrength={props.currentStrength}
              pendingStrengthReason={props.pendingStrengthReason}
              onSetPlayerPositionMinutes={props.onSetAdvancedPlayerPositionMinutes}
              onReset={props.onResetAdvanced}
              headingId={`${props.headingId}-controlled`}
            />
          )}
        </div>
        <div className="game-prep-rotation-side">
          <h3>Opponent Rotation</h3>
          <OpponentRotationPanel
            team={props.opponentTeam}
            rotation={props.opponentRotation}
            program={props.opponentProgram}
            headingId={`${props.headingId}-opponent`}
            onSelectPlayer={props.onSelectOpponentPlayer}
            onViewFullRoster={props.onViewOpponentRoster}
          />
        </div>
      </div>
    </section>
  )
}
