import { useId, useState, type CSSProperties } from 'react'
import { useDynastyStore } from '../store'
import { UNIVERSE_V0 } from '../universe'
import type { ProgramDefinition } from '../universe'
import { parseDynastySeedInput } from './dynastySeedInput'

function programsForConference(conferenceId: string): ProgramDefinition[] {
  return UNIVERSE_V0.programs
    .filter((program) => program.conferenceId === conferenceId)
    .sort((first, second) => second.basePrestige - first.basePrestige)
}

/** Shown once, before a Season session exists: choose one of the 32 permanent programs. */
export function ProgramSelectScreen() {
  const selectProgram = useDynastyStore((state) => state.selectProgram)
  const startObserverDynasty = useDynastyStore((state) => state.startObserverDynasty)
  const [seedText, setSeedText] = useState('')
  const seedInputId = useId()
  const seedErrorId = useId()

  const parsedSeed = parseDynastySeedInput(seedText)
  const seedError = parsedSeed.kind === 'invalid' ? parsedSeed.reason : null

  function handleSelectProgram(programId: string): void {
    if (parsedSeed.kind === 'invalid') {
      return
    }
    selectProgram(programId, parsedSeed.kind === 'valid' ? parsedSeed.seed : undefined)
  }

  function handleObserve(): void {
    if (parsedSeed.kind === 'invalid') return
    startObserverDynasty(
      undefined,
      parsedSeed.kind === 'valid' ? parsedSeed.seed : undefined,
    )
  }

  return (
    <section className="section program-select" aria-labelledby="program-select-heading">
      <div className="section-heading">
        <h2 id="program-select-heading" className="section-title">
          Start a Dynasty
        </h2>
        <p className="section-hint">
          Starts Season 1 of a 24-round regular season across four conferences.
        </p>
      </div>
      <div className="program-select__seed">
        <label htmlFor={seedInputId} className="program-select__seed-label">
          Dynasty Seed
        </label>
        <input
          id={seedInputId}
          type="text"
          className="program-select__seed-input"
          value={seedText}
          onChange={(event) => setSeedText(event.target.value)}
          placeholder="Optional — leave blank for a random Dynasty"
          aria-describedby={seedErrorId}
          aria-invalid={seedError !== null}
        />
        <p
          id={seedErrorId}
          className={
            seedError
              ? 'program-select__seed-hint program-select__seed-hint--error'
              : 'program-select__seed-hint'
          }
        >
          {seedError ?? (
            "Use the same seed to recreate this Dynasty's starting world on compatible game versions."
          )}
        </p>
      </div>
      <div className="program-select__observer">
        <div>
          <p className="eyebrow-tag">Observer Mode</p>
          <h3>Observe the Simulation</h3>
          <p className="section-hint">
            Follow all 32 AI-controlled Programs and change the Program you are viewing at any time.
          </p>
        </div>
        <button
          type="button"
          className="button button--primary"
          disabled={parsedSeed.kind === 'invalid'}
          onClick={handleObserve}
        >
          Start Observer Dynasty
        </button>
      </div>
      <p className="eyebrow-tag">Control a Program</p>
      <div className="program-select__conferences">
        {UNIVERSE_V0.conferences.map((conference) => (
          <div key={conference.id} className="program-select__conference">
            <h3 className="program-select__conference-name">
              {conference.name}
            </h3>
            <ul className="program-select__list">
              {programsForConference(conference.id).map((program) => (
                <li key={program.id}>
                  <button
                    type="button"
                    className="program-select__row"
                    style={
                      {
                        '--team-accent': program.branding.primaryColor,
                      } as CSSProperties
                    }
                    disabled={parsedSeed.kind === 'invalid'}
                    onClick={() => handleSelectProgram(program.id)}
                  >
                    <span
                      className="team-color-dot"
                      style={{ background: program.branding.primaryColor }}
                      aria-hidden="true"
                    />
                    <span className="program-select__name">
                      {program.name}
                      <span className="program-select__abbr">
                        {program.abbreviation}
                      </span>
                    </span>
                    <span className="program-select__location">
                      {program.location.city}, {program.location.stateCode}
                    </span>
                    <span className="program-select__prestige">
                      <span
                        className="program-select__prestige-bar"
                        aria-hidden="true"
                      >
                        <span
                          className="program-select__prestige-fill"
                          style={{ width: `${program.basePrestige}%` }}
                        />
                      </span>
                      <span className="program-select__prestige-value">
                        {program.basePrestige}
                      </span>
                    </span>
                    <span className="program-select__identity">
                      {program.identity}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
