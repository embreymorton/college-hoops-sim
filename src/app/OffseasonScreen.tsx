import type { CSSProperties } from 'react'
import {
  DeparturesTable,
  DevelopmentTable,
  IncomingClassTable,
  NextSeasonRosterTable,
  type NextSeasonRosterRow,
} from '../components'
import { assembleNextSeasonRosters } from '../dynasty'
import { useDynastyStore } from '../store'
import {
  deriveDepartures,
  deriveBiggestLeap,
  deriveDevelopmentRows,
  deriveIncomingClass,
  derivePositionCounts,
  deriveRosterAverageOverall,
  formatAverage,
  formatPrestigeReason,
  formatSignedPrestigeChange,
} from './offseasonFormatters'

/** The turnover report: who left, who improved, who arrived, what's next. */
export function OffseasonScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const actionError = useDynastyStore((state) => state.recruitingActionError)
  const beginNextSeason = useDynastyStore((state) => state.beginNextSeason)

  if (!dynasty || !dynasty.offseason) return null

  const offseason = dynasty.offseason
  const controlledProgramId = dynasty.controlledProgramId
  const controlledProgram = dynasty.universe.programs.find(
    ({ id }) => id === controlledProgramId,
  )
  const archive = dynasty.history.find(
    ({ seasonNumber }) => seasonNumber === offseason.completedSeasonNumber,
  )
  const completedRecruitingClass = dynasty.completedRecruitingHistory.find(
    ({ targetSeasonNumber }) => targetSeasonNumber === offseason.targetSeasonNumber,
  )
  const offseasonProgram = offseason.programs[controlledProgramId]

  if (!controlledProgram || !archive || !completedRecruitingClass || !offseasonProgram) {
    return null
  }

  const departures = deriveDepartures(dynasty, archive, controlledProgramId)
  const developmentRows = deriveDevelopmentRows(archive, controlledProgramId, offseasonProgram)
  const biggestLeap = deriveBiggestLeap(developmentRows)
  const incoming = deriveIncomingClass(
    completedRecruitingClass.recruitingState,
    controlledProgramId,
  )

  const assembly = assembleNextSeasonRosters({
    universe: dynasty.universe,
    offseason,
    completedRecruitingClass,
    completedSeasonArchive: archive,
  })
  const nextRosterPlayers = assembly.programs[controlledProgramId]!.players
  const returningIds = new Set(offseasonProgram.returningPlayers.map(({ id }) => id))
  const nextRosterRows: NextSeasonRosterRow[] = nextRosterPlayers.map((player) => ({
    player,
    status: returningIds.has(player.id) ? 'returning' : 'incoming',
  }))
  const positionCounts = derivePositionCounts(nextRosterPlayers)
  const outlookOverall = deriveRosterAverageOverall(nextRosterPlayers)

  const accentStyle = {
    '--team-accent': controlledProgram.branding.primaryColor,
  } as CSSProperties

  return (
    <>
      <div className="season-header offseason-header" style={accentStyle}>
        <div className="season-header__identity">
          <span
            className="season-header__dot"
            style={{ background: controlledProgram.branding.primaryColor }}
            aria-hidden="true"
          />
          <div>
            <p className="eyebrow-tag">Offseason</p>
            <h1 className="season-header__name">{controlledProgram.name}</h1>
            <p className="season-header__meta">
              Season {offseason.completedSeasonNumber} → Season {offseason.targetSeasonNumber}
            </p>
          </div>
        </div>
        <div className="stat-trio season-header__stats">
          <div className="stat-trio__item">
            <span className="stat-trio__value">{formatAverage(outlookOverall)}</span>
            <span className="stat-trio__label">ROSTER AVG OVR</span>
          </div>
        </div>
      </div>

      {actionError && (
        <p className="recruiting-action-error" role="alert">
          {actionError}
        </p>
      )}

      <section className="section" aria-labelledby="prestige-heading">
        <h2 id="prestige-heading" className="section-title">Program Prestige</h2>
        <div className="prestige-update" data-change={
          offseasonProgram.prestigeUpdate.change > 0
            ? 'positive'
            : offseasonProgram.prestigeUpdate.change < 0 ? 'negative' : 'unchanged'
        }>
          <p className="prestige-update__values">
            <span>{offseasonProgram.prestigeUpdate.previousPrestige}</span>
            <span aria-hidden="true">→</span>
            <span>{offseasonProgram.prestigeUpdate.newPrestige}</span>
            <strong>{formatSignedPrestigeChange(offseasonProgram.prestigeUpdate.change)}</strong>
          </p>
          <p className="prestige-update__reason">
            {formatPrestigeReason(offseasonProgram.prestigeUpdate.reason)}
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="departures-heading">
        <h2 id="departures-heading" className="section-title">
          Departures
        </h2>
        <DeparturesTable programName={controlledProgram.name} departures={departures} />
      </section>

      <section className="section" aria-labelledby="development-heading">
        <h2 id="development-heading" className="section-title">
          Player Development
        </h2>
        <DevelopmentTable rows={developmentRows} biggestLeap={biggestLeap} />
      </section>

      <section className="section" aria-labelledby="incoming-heading">
        <h2 id="incoming-heading" className="section-title">
          Incoming Class
        </h2>
        <IncomingClassTable programName={controlledProgram.name} rows={incoming} />
      </section>

      <section className="section" aria-labelledby="next-roster-heading">
        <div className="section-heading">
          <h2 id="next-roster-heading" className="section-title">
            Next Season Roster
          </h2>
          <p className="offseason-position-balance">
            {positionCounts
              .map(({ position, count }) => `${position} ${count}`)
              .join('   ')}
          </p>
        </div>
        <NextSeasonRosterTable rows={nextRosterRows} />
      </section>

      <div className="offseason-footer">
        <button
          type="button"
          className="button button--primary offseason-footer__action"
          onClick={beginNextSeason}
        >
          Begin Season {offseason.targetSeasonNumber}
        </button>
      </div>
    </>
  )
}
