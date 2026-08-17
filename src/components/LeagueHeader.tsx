import type { CSSProperties } from 'react'
import { formatRating } from '../app/formatters'
import { formatRecord } from '../app/seasonFormatters'

interface LeagueHeaderProps {
  readonly seasonNumber: number
  readonly phaseLabel: string
  readonly programName: string
  readonly accentColor: string
  readonly overallRecord: { readonly wins: number; readonly losses: number }
  readonly overallRating: number
}

/** National League identity and Dynasty context, with a compact snapshot of the controlled Program. */
export function LeagueHeader({
  seasonNumber,
  phaseLabel,
  programName,
  accentColor,
  overallRecord,
  overallRating,
}: LeagueHeaderProps) {
  const accentStyle = { '--team-accent': accentColor } as CSSProperties

  return (
    <div className="season-header league-header" style={accentStyle}>
      <div className="season-header__identity">
        <div>
          <h1 className="season-header__name">The League</h1>
          <p className="season-header__meta">
            Season {seasonNumber} · {phaseLabel}
          </p>
        </div>
      </div>
      <div className="league-header__program">
        <div className="season-header__identity">
          <span
            className="season-header__dot"
            style={{ background: accentColor }}
            aria-hidden="true"
          />
          <p className="season-header__name league-header__program-name">{programName}</p>
        </div>
        <p className="season-header__meta">
          {formatRecord(overallRecord.wins, overallRecord.losses)} · {formatRating(overallRating)} OVR
        </p>
      </div>
    </div>
  )
}
