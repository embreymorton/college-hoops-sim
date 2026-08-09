import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

interface ModalOverlayProps {
  readonly titleId: string
  readonly descriptionId?: string
  readonly role?: 'dialog' | 'alertdialog'
  readonly onDismiss: () => void
  readonly children: ReactNode
  /** Focused on mount; defaults to the dialog surface itself. */
  readonly initialFocusRef?: RefObject<HTMLElement | null>
}

/** Minimal accessible modal shell shared by the Super Sim confirm/summary dialogs. */
export function ModalOverlay({
  titleId,
  descriptionId,
  role = 'dialog',
  onDismiss,
  children,
  initialFocusRef,
}: ModalOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(initialFocusRef?.current ?? dialogRef.current)?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss()
        }
      }}
    >
      <div
        className="modal"
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialogRef}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  )
}
