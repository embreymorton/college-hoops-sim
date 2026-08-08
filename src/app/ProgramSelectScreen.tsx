import type { CSSProperties } from 'react'
import { useSeasonStore } from '../store'
import { UNIVERSE_V0 } from '../universe'
import type { ProgramDefinition } from '../universe'

function programsForConference(conferenceId: string): ProgramDefinition[] {
  return UNIVERSE_V0.programs
    .filter((program) => program.conferenceId === conferenceId)
    .sort((first, second) => second.basePrestige - first.basePrestige)
}

/** Shown once, before a Season session exists: choose one of the 32 permanent programs. */
export function ProgramSelectScreen() {
  const selectProgram = useSeasonStore((state) => state.selectProgram)

  return (
    <section className="section program-select" aria-labelledby="program-select-heading">
      <div className="section-heading">
        <h2 id="program-select-heading" className="section-title">
          Choose Your Program
        </h2>
        <p className="section-hint">
          Starts Season 1 of a 24-round regular season across four conferences.
        </p>
      </div>
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
                    onClick={() => selectProgram(program.id)}
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
