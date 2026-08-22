import type { CSSProperties } from 'react'
import type { TournamentBidType } from '../postseason'
import { formatBidType, formatSeedLabel } from '../app/postseasonFormatters'

interface TournamentStatusHeaderProps {
  readonly programName: string
  readonly accentColor: string
  /** Null when the Program never qualified for the 16-team field. */
  readonly seed: number | null
  readonly bidType: TournamentBidType | null
  /** "Round of 16" … "Championship", or "Final" once the Tournament is complete. */
  readonly roundLabel: string
  /** Completed Tournaments describe the controlled Program's Finish instead. */
  readonly statusLabel?: 'Round' | 'Finish'
}

/** The coach's Tournament identity, seed/bid, and current-round context. */
export function TournamentStatusHeader({
  programName,
  accentColor,
  seed,
  bidType,
  roundLabel,
  statusLabel = 'Round',
}: TournamentStatusHeaderProps) {
  const accentStyle = { '--team-accent': accentColor } as CSSProperties

  return (
    <div className="season-header" style={accentStyle}>
      <div className="season-header__identity">
        <span
          className="season-header__dot"
          style={{ background: accentColor }}
          aria-hidden="true"
        />
        <div>
          <h1 className="season-header__name">{programName}</h1>
          <p className="season-header__meta">National Tournament</p>
        </div>
      </div>
      <div className="stat-trio season-header__stats">
        <div className="stat-trio__item">
          <span className="stat-trio__value">
            {seed !== null ? formatSeedLabel(seed) : '—'}
          </span>
          <span className="stat-trio__label">Seed</span>
        </div>
        <div className="stat-trio__item">
          <span className="stat-trio__value">
            {bidType !== null ? formatBidType(bidType) : '—'}
          </span>
          <span className="stat-trio__label">Bid</span>
        </div>
        <div className="stat-trio__item">
          <span className="stat-trio__value stat-trio__value--text">
            {roundLabel}
          </span>
          <span className="stat-trio__label">{statusLabel}</span>
        </div>
      </div>
    </div>
  )
}
