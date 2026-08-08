import type { TeamStrength } from '../engine'
import { formatRating, formatSignedRating } from '../app/formatters'

interface RotationStrengthSummaryProps {
  readonly defaultStrength: TeamStrength
  /** Null while the edited Rotation is invalid — never a misleading guess. */
  readonly currentStrength: TeamStrength | null
  readonly pendingReason: string | null
}

export function RotationStrengthSummary({
  defaultStrength,
  currentStrength,
  pendingReason,
}: RotationStrengthSummaryProps) {
  return (
    <div className="rotation-strength">
      <div className="rotation-strength__heading">
        <h4 className="rotation-strength__title">Team Strength</h4>
        {pendingReason && (
          <p className="rotation-strength__note">{pendingReason}</p>
        )}
      </div>
      <table className="data-table rotation-strength__table">
        <thead>
          <tr>
            <th scope="col">Rating</th>
            <th scope="col">Default</th>
            <th scope="col">Current</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          <RotationStrengthRow
            label="Off"
            defaultValue={defaultStrength.offense}
            currentValue={currentStrength?.offense ?? null}
          />
          <RotationStrengthRow
            label="Def"
            defaultValue={defaultStrength.defense}
            currentValue={currentStrength?.defense ?? null}
          />
          <RotationStrengthRow
            label="Ovr"
            defaultValue={defaultStrength.overall}
            currentValue={currentStrength?.overall ?? null}
          />
        </tbody>
      </table>
    </div>
  )
}

function RotationStrengthRow({
  label,
  defaultValue,
  currentValue,
}: {
  label: string
  defaultValue: number
  currentValue: number | null
}) {
  const change = currentValue === null ? null : currentValue - defaultValue

  return (
    <tr>
      <td className="player-pos-cell">{label}</td>
      <td>{formatRating(defaultValue)}</td>
      <td>{currentValue === null ? '—' : formatRating(currentValue)}</td>
      <td>{change === null ? '—' : formatSignedRating(change)}</td>
    </tr>
  )
}
