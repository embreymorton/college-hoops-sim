import type { ChangeEvent } from 'react'
import type { DemoProgram } from '../app/demoPrograms'

interface TeamSelectProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly options: readonly DemoProgram[]
  readonly selectedProgram: DemoProgram
  readonly align: 'home' | 'away'
  readonly onChange: (programId: string) => void
}

export function TeamSelect({
  id,
  label,
  value,
  options,
  selectedProgram,
  align,
  onChange,
}: TeamSelectProps) {
  return (
    <div className={`team-select-field team-select-field--${align}`}>
      <div className="team-select-field__label-row">
        <span
          className="team-color-dot"
          style={{ background: selectedProgram.primaryColor }}
          aria-hidden="true"
        />
        <label htmlFor={id}>{label}</label>
      </div>
      <div className="select-shell">
        <select
          id={id}
          className="team-select"
          value={value}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange(event.target.value)
          }
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · Prestige {option.prestige}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
