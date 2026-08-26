import type { ProgramReputationSnapshot } from '../dynasty'
import {
  formatProgramReputationFact,
  formatProgramReputationTier,
  formatProgramReputationTrend,
  programReputationTrendArrow,
} from '../app/programReputationFormatters'

interface ProgramReputationSummaryProps {
  readonly reputation: ProgramReputationSnapshot
}

export function ProgramReputationLabel({
  reputation,
}: ProgramReputationSummaryProps) {
  const trend = formatProgramReputationTrend(reputation.trend)
  const arrow = programReputationTrendArrow(reputation.trend)
  return (
    <>
      <span>{formatProgramReputationTier(reputation.tier)}</span>
      {arrow && <span aria-hidden="true"> {arrow}</span>}
      {trend && <span className="visually-hidden">, {trend}</span>}
    </>
  )
}

export function ProgramReputationSummary({
  reputation,
}: ProgramReputationSummaryProps) {
  if (reputation.tier === 'unestablished') {
    return (
      <div className="program-reputation-summary program-reputation-summary--empty">
        <p className="program-reputation-summary__status">
          Reputation <strong><ProgramReputationLabel reputation={reputation} /></strong>
        </p>
        <p className="program-reputation-summary__hint">
          Reputation establishes after completed Dynasty results exist.
        </p>
      </div>
    )
  }

  return (
    <div className="program-reputation-summary">
      <p className="program-reputation-summary__status">
        Reputation <strong><ProgramReputationLabel reputation={reputation} /></strong>
      </p>
      {reputation.facts.length > 0 && (
        <ul className="program-reputation-summary__facts">
          {reputation.facts.map((fact) => (
            <li key={fact.kind}>{formatProgramReputationFact(fact)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
