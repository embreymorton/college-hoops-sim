import type { SeasonSessionView } from '../store'
import { formatBackDestinationLabel } from '../app/seasonFormatters'

interface ExplorationBackButtonProps {
  /** The view one `goBackFromExploration()` step returns to. */
  readonly destination: SeasonSessionView
  readonly onClick: () => void
}

/** Returns from League/Team/Player Details to wherever exploration was entered from. */
export function ExplorationBackButton({
  destination,
  onClick,
}: ExplorationBackButtonProps) {
  return (
    <button
      type="button"
      className="button button--ghost exploration-back-button"
      onClick={onClick}
    >
      ← Back to {formatBackDestinationLabel(destination)}
    </button>
  )
}
