import type { CSSProperties } from 'react'
import type { RecruitingPhase } from '../dynasty'
import { formatRecruitingPeriodLine } from '../app/recruitingFormatters'

interface RecruitingHeaderProps {
  readonly programName: string
  readonly accentColor: string
  readonly targetSeasonNumber: number
  readonly phase: RecruitingPhase
  readonly lastResolvedPeriod: number
  readonly focusCount: number
  readonly focusLimit: number
}

/** Program/class identity plus the actual derived Recruiting period and phase. */
export function RecruitingHeader({
  programName,
  accentColor,
  targetSeasonNumber,
  phase,
  lastResolvedPeriod,
  focusCount,
  focusLimit,
}: RecruitingHeaderProps) {
  const accentStyle = { '--team-accent': accentColor } as CSSProperties

  return (
    <div className="season-header recruiting-header" style={accentStyle}>
      <div className="season-header__identity">
        <span
          className="season-header__dot"
          style={{ background: accentColor }}
          aria-hidden="true"
        />
        <div>
          <h1 className="season-header__name">{programName} Recruiting</h1>
          <p className="season-header__meta">Class of Season {targetSeasonNumber}</p>
        </div>
      </div>
      <div>
        <p className="eyebrow-tag recruiting-header__period">
          {formatRecruitingPeriodLine(phase, lastResolvedPeriod)}
        </p>
        <p className="season-header__meta">FOCUS {focusCount} / {focusLimit}</p>
      </div>
    </div>
  )
}
