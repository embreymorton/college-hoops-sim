import { useId, useRef } from 'react'
import { ModalOverlay } from './ModalOverlay'

interface RecruitingSetupDialogProps {
  readonly onGenerateAndContinue: () => void
  readonly onReviewRecruiting: () => void
  readonly onCancel: () => void
}

/** First-period safety prompt: the controlled board must exist before Recruiting can advance. */
export function RecruitingSetupDialog({
  onGenerateAndContinue,
  onReviewRecruiting,
  onCancel,
}: RecruitingSetupDialogProps) {
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
      <p className="modal__eyebrow">Recruiting</p>
      <h2 id={titleId} className="modal__title">
        Recruiting Board Not Set
      </h2>
      <p id={descriptionId} className="modal__body">
        Your first recruiting period is about to advance. Generate a suggested board,
        priorities, and initial offers before continuing?
      </p>
      <p className="modal__body modal__body--muted">You can edit the plan at any time.</p>
      <div className="modal__actions">
        <button
          type="button"
          className="button button--tertiary"
          ref={cancelRef}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={onReviewRecruiting}
        >
          Review Recruiting
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={onGenerateAndContinue}
        >
          Generate &amp; Continue
        </button>
      </div>
    </ModalOverlay>
  )
}
