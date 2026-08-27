import type { ProgramDefinition } from '../universe'

export function ViewedProgramSelector({
  programId,
  programs,
  onChange,
}: {
  readonly programId: string
  readonly programs: readonly ProgramDefinition[]
  readonly onChange: (programId: string) => void
}) {
  return (
    <label className="viewed-program-selector">
      <span>Viewing</span>
      <select
        aria-label="Viewed Program"
        value={programId}
        onChange={(event) => onChange(event.target.value)}
      >
        {programs.map((program) => (
          <option key={program.id} value={program.id}>{program.name}</option>
        ))}
      </select>
    </label>
  )
}
