import type { CSSProperties } from 'react'
import { useState } from 'react'
import { formatRating } from '../app/formatters'
import { formatRecord } from '../app/seasonFormatters'
import type { RngSeed } from '../engine'

interface LeagueHeaderProps {
  readonly seasonNumber: number
  readonly phaseLabel: string
  readonly programName: string
  readonly accentColor: string
  readonly overallRecord: { readonly wins: number; readonly losses: number }
  readonly overallRating: number
  readonly dynastySeed?: RngSeed
}

/** National League identity and Dynasty context, with a compact snapshot of the controlled Program. */
export function LeagueHeader({
  seasonNumber,
  phaseLabel,
  programName,
  accentColor,
  overallRecord,
  overallRating,
  dynastySeed,
}: LeagueHeaderProps) {
  const accentStyle = { '--team-accent': accentColor } as CSSProperties
  const [copied, setCopied] = useState(false)

  async function handleCopySeed(): Promise<void> {
    if (dynastySeed === undefined) return
    try {
      await navigator.clipboard.writeText(String(dynastySeed))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied by the browser; the seed remains visible to copy manually.
    }
  }

  return (
    <div className="season-header league-header" style={accentStyle}>
      <div className="season-header__identity">
        <div>
          <h1 className="season-header__name">The League</h1>
          <p className="season-header__meta">
            Season {seasonNumber} · {phaseLabel}
          </p>
          {dynastySeed !== undefined ? (
            <p className="league-header__seed">
              Dynasty Seed <span className="league-header__seed-value">{dynastySeed}</span>
              {typeof navigator !== 'undefined' && navigator.clipboard ? (
                <button
                  type="button"
                  className="league-header__seed-copy"
                  onClick={handleCopySeed}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              ) : null}
            </p>
          ) : null}
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
