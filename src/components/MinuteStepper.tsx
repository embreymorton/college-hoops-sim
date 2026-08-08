import { useState, type ChangeEvent } from 'react'

interface MinuteStepperProps {
  readonly id: string
  readonly value: number
  readonly label: string
  readonly onChange: (nextValue: number) => void
}

/**
 * Precise one-minute-at-a-time editor: [-] [numeric input] [+]. Non-negative
 * integers only. Does not cap the upper bound — the engine's Rotation
 * validator is the source of truth for what counts as too many minutes.
 */
export function MinuteStepper({ id, value, label, onChange }: MinuteStepperProps) {
  const [draft, setDraft] = useState(String(value))
  const [lastSyncedValue, setLastSyncedValue] = useState(value)

  if (value !== lastSyncedValue) {
    setLastSyncedValue(value)
    setDraft(String(value))
  }

  function commit(nextValue: number): void {
    onChange(Math.max(0, Math.round(nextValue)))
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const raw = event.target.value
    setDraft(raw)

    if (raw.trim() === '') {
      return
    }

    const parsed = Number.parseInt(raw, 10)

    if (Number.isFinite(parsed)) {
      commit(parsed)
    }
  }

  function handleBlur(): void {
    setDraft(String(value))
  }

  return (
    <div className="minute-stepper">
      <button
        type="button"
        className="minute-stepper__button"
        onClick={() => commit(value - 1)}
        disabled={value <= 0}
        aria-label={`Decrease ${label}`}
      >
        <span aria-hidden="true">−</span>
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        id={id}
        className="minute-stepper__input"
        value={draft}
        onChange={handleInputChange}
        onBlur={handleBlur}
        aria-label={label}
      />
      <button
        type="button"
        className="minute-stepper__button"
        onClick={() => commit(value + 1)}
        aria-label={`Increase ${label}`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}
