import { useEffect, useRef, useState } from 'react'
import type { SuperSimKind } from '../store'

interface SuperSimMenuProps {
  /** Hidden once Round `midseasonRound` has fully completed. */
  readonly showMidseason: boolean
  readonly showEndOfRegularSeason?: boolean
  readonly showSeasonComplete?: boolean
  readonly midseasonRound: number
  readonly endOfSeasonRound: number
  readonly onSelect: (kind: SuperSimKind) => void
  /** True while a Super Sim confirm/summary dialog is open, so focus can return to the trigger once it closes. */
  readonly isDialogOpen: boolean
}

/**
 * Compact secondary disclosure for bulk-progression checkpoints. Deliberately
 * plain — a toggle button plus a small panel of real buttons — rather than a
 * full ARIA menu, since V0 only ever offers one or two options.
 */
export function SuperSimMenu({
  showMidseason,
  showEndOfRegularSeason = true,
  showSeasonComplete = true,
  midseasonRound,
  endOfSeasonRound,
  onSelect,
  isDialogOpen,
}: SuperSimMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasDialogOpen = useRef(isDialogOpen)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.querySelector('button')?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (wasDialogOpen.current && !isDialogOpen) {
      triggerRef.current?.focus()
    }

    wasDialogOpen.current = isDialogOpen
  }, [isDialogOpen])

  function select(kind: SuperSimKind) {
    setIsOpen(false)
    onSelect(kind)
  }

  return (
    <div className="super-sim-menu" ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className="super-sim-menu__trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        Super Sim <span aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div
          className="super-sim-menu__panel"
          role="group"
          aria-label="Super Sim"
          ref={panelRef}
        >
          {showMidseason && (
            <button
              type="button"
              className="super-sim-menu__option"
              onClick={() => select('midseason')}
            >
              <span className="super-sim-menu__option-label">
                Sim to Midseason
              </span>
              <span className="super-sim-menu__option-detail">
                Through Round {midseasonRound}
              </span>
            </button>
          )}
          {showEndOfRegularSeason && (
            <button
              type="button"
              className="super-sim-menu__option"
              onClick={() => select('endOfRegularSeason')}
            >
              <span className="super-sim-menu__option-label">
                Sim to End of Regular Season
              </span>
              <span className="super-sim-menu__option-detail">
                Through Round {endOfSeasonRound}
              </span>
            </button>
          )}
          {showSeasonComplete && (
            <button
              type="button"
              className="super-sim-menu__option"
              onClick={() => select('seasonComplete')}
            >
              <span className="super-sim-menu__option-label">
                Sim to Season Complete
              </span>
              <span className="super-sim-menu__option-detail">
                Through the National Championship
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
