import { useId, useRef } from 'react'
import { ModalOverlay } from './ModalOverlay'

interface RecruitingFinalizationDialogProps {
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

/** Confirms the irreversible Late Recruiting finalization boundary. */
export function RecruitingFinalizationDialog({
  onCancel,
  onConfirm,
}: RecruitingFinalizationDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <ModalOverlay
      titleId={titleId}
      descriptionId={descriptionId}
      role="alertdialog"
      onDismiss={onCancel}
      initialFocusRef={cancelRef}
    >
      <p className="modal__eyebrow">Late Recruiting</p>
      <h2 id={titleId} className="modal__title">
        Finalize Recruiting Class?
      </h2>
      <p id={descriptionId} className="modal__body">
        Any remaining roster openings will be resolved by the Late Recruiting
        finalization process.
      </p>
      <p className="modal__body modal__body--muted">
        Your completed class will then be archived.
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
        <button type="button" className="button button--primary" onClick={onConfirm}>
          Finalize Class
        </button>
      </div>
    </ModalOverlay>
  )
}
