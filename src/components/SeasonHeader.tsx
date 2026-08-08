import type { CSSProperties } from 'react'
import { formatRecord } from '../app/seasonFormatters'

interface SeasonHeaderProps {
  readonly programName: string
  readonly accentColor: string
  readonly conferenceName: string
  readonly seasonNumber: number
  readonly overallRecord: { readonly wins: number; readonly losses: number }
  readonly conferenceRecord: { readonly wins: number; readonly losses: number }
  readonly currentRound: number | undefined
  readonly roundCount: number
  readonly isComplete: boolean
}

/** The coach's program identity, record, and round context atop the Season Hub. */
export function SeasonHeader({
  programName,
  accentColor,
  conferenceName,
  seasonNumber,
  overallRecord,
  conferenceRecord,
  currentRound,
  roundCount,
  isComplete,
}: SeasonHeaderProps) {
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
          <p className="season-header__meta">
            {conferenceName} · Season {seasonNumber}
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
          <span className="stat-trio__value">
            {isComplete ? 'Final' : currentRound}
          </span>
          <span className="stat-trio__label">
            {isComplete ? 'Season' : `of ${roundCount} Rounds`}
          </span>
        </div>
      </div>
    </div>
  )
}
