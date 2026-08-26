import type { CSSProperties } from 'react'
import type { TeamStrength } from '../engine'
import { formatRating } from '../app/formatters'
import { formatRecord } from '../app/seasonFormatters'
import type { ProgramReputationSnapshot } from '../dynasty'
import { ProgramReputationLabel } from './ProgramReputationSummary'

interface TeamDetailsHeaderProps {
  readonly programName: string
  readonly accentColor: string
  readonly conferenceName: string
  readonly locationLabel?: string
  readonly prestige?: number
  readonly reputation?: ProgramReputationSnapshot
  readonly isControlled: boolean
  readonly overallRecord: { readonly wins: number; readonly losses: number }
  readonly conferenceRecord: { readonly wins: number; readonly losses: number }
  readonly strength: TeamStrength
}

/** Any Program's identity, record, and Team Strength — the Team Details centerpiece header. */
export function TeamDetailsHeader({
  programName,
  accentColor,
  conferenceName,
  locationLabel,
  prestige,
  reputation,
  isControlled,
  overallRecord,
  conferenceRecord,
  strength,
}: TeamDetailsHeaderProps) {
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
          <h1 className="season-header__name">
            {programName}
            {isControlled && <span className="standings-you-tag"> · You</span>}
          </h1>
          <p className="season-header__meta">
            <span className="season-header__meta-place">
              {conferenceName}
              {locationLabel && <> · {locationLabel}</>}
            </span>
            {(prestige !== undefined || reputation) && (
              <span className="season-header__standing">
                {prestige !== undefined && (
                  <span className="season-header__standing-item">
                    <span className="season-header__standing-label">Prestige</span>{' '}
                    <span className="season-header__standing-value">{prestige}</span>
                  </span>
                )}
                {reputation && (
                  <span className="season-header__standing-item">
                    <span className="season-header__standing-label">Reputation</span>{' '}
                    <span className="season-header__standing-value">
                      <ProgramReputationLabel reputation={reputation} />
                    </span>
                  </span>
                )}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="stat-trio season-header__stats">
        <div className="stat-trio__item">
          <span className="stat-trio__value">
            {formatRecord(overallRecord.wins, overallRecord.losses)}
          </span>
          <span className="stat-trio__label">Overall</span>
        </div>
        <div className="stat-trio__item">
          <span className="stat-trio__value">
            {formatRecord(conferenceRecord.wins, conferenceRecord.losses)}
          </span>
          <span className="stat-trio__label">Conference</span>
        </div>
        <div className="stat-trio__item">
          <span className="stat-trio__value">{formatRating(strength.offense)}</span>
          <span className="stat-trio__label">Off</span>
        </div>
        <div className="stat-trio__item">
          <span className="stat-trio__value">{formatRating(strength.defense)}</span>
          <span className="stat-trio__label">Def</span>
        </div>
        <div className="stat-trio__item">
          <span className="stat-trio__value">{formatRating(strength.overall)}</span>
          <span className="stat-trio__label">Ovr</span>
        </div>
      </div>
    </div>
  )
}
