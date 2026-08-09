import { useId, useRef } from 'react'
import type { SuperSimKind } from '../store'
import { ModalOverlay } from './ModalOverlay'

interface SuperSimConfirmDialogProps {
  readonly kind: SuperSimKind
  readonly throughRound: number
  readonly controlledProgramName: string
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

/** Lightweight confirmation for an irreversible bulk-progression checkpoint. */
export function SuperSimConfirmDialog({
  kind,
  throughRound,
  controlledProgramName,
  onCancel,
  onConfirm,
}: SuperSimConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isMidseason = kind === 'midseason'

  return (
    <ModalOverlay
      titleId={titleId}
      descriptionId={descriptionId}
      role="alertdialog"
      onDismiss={onCancel}
      initialFocusRef={cancelRef}
    >
      <p className="modal__eyebrow">Super Sim</p>
      <h2 id={titleId} className="modal__title">
        {isMidseason ? 'Sim to Midseason?' : 'Sim to End of Regular Season?'}
      </h2>
      <p id={descriptionId} className="modal__body">
        {isMidseason
          ? `${controlledProgramName} will play all remaining scheduled games through Round ${throughRound} using its current rotation.`
          : 'All remaining regular-season games will be simulated using the current Season rotations.'}{' '}
        All game results are final.
      </p>
      <div className="modal__actions">
        <button
          type="button"
          className="button button--ghost"
          ref={cancelRef}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={onConfirm}
        >
          {isMidseason ? `Sim to Round ${throughRound}` : 'Sim Regular Season'}
        </button>
      </div>
    </ModalOverlay>
  )
}
