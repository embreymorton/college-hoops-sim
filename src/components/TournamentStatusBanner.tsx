export type TournamentStatusBannerVariant =
  | 'advancing'
  | 'eliminated'
  | 'did-not-qualify'
  | 'champion'

interface TournamentStatusBannerAction {
  readonly label: string
  readonly onClick: () => void
}

interface TournamentStatusBannerProps {
  readonly variant: TournamentStatusBannerVariant
  readonly eyebrow: string
  readonly headline: string
  readonly body: string
  readonly action?: TournamentStatusBannerAction
}

/**
 * Covers every non-"live matchup" controlled-Program state on the Tournament
 * Hub: advancing while the rest of the round resolves, eliminated, never
 * qualified, and National Champion. Elimination and non-qualification are
 * legitimate states here, not error states.
 */
export function TournamentStatusBanner({
  variant,
  eyebrow,
  headline,
  body,
  action,
}: TournamentStatusBannerProps) {
  return (
    <div
      className="season-complete-panel tournament-status-banner"
      data-variant={variant}
    >
      <p className="eyebrow-tag">{eyebrow}</p>
      <p className="tournament-status-banner__headline">{headline}</p>
      <p className="season-complete-panel__body">{body}</p>
      {action && (
        <button
          type="button"
          className="button button--primary tournament-status-banner__action"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
