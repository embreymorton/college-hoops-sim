import { useState, type CSSProperties } from 'react'
import {
  DeparturesTable,
  DevelopmentTable,
  IncomingClassTable,
  NextSeasonRosterTable,
  OffseasonTimeline,
  RecruitingClassSummary,
  RecruitingFinalizationDialog,
  ViewedProgramSelector,
  type NextSeasonRosterRow,
} from '../components'
import { assembleNextSeasonRosters, deriveProgramRecruitingBoard } from '../dynasty'
import { selectPresentationProgramId, useDynastyStore } from '../store'
import {
  deriveDepartures,
  deriveBiggestLeap,
  deriveClassAverages,
  deriveDevelopmentRows,
  deriveIncomingClass,
  derivePositionCounts,
  deriveRosterAverageOverall,
  formatAverage,
} from './offseasonFormatters'
import {
  deriveOffseasonExperience,
  type OffseasonStageId,
} from './offseasonExperience'
import { RecruitingScreen } from './RecruitingScreen'
import { deriveRecruitingHubTotals } from './recruitingFormatters'

/** Dedicated guided-but-explorable presentation over existing offseason facts. */
export function OffseasonScreen() {
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false)
  const dynasty = useDynastyStore((state) => state.dynasty)
  const cursor = useDynastyStore((state) => state.offseasonPresentationCursor)
  const actionError = useDynastyStore((state) => state.recruitingActionError)
  const finalizeRecruitingClass = useDynastyStore((state) => state.finalizeRecruitingClass)
  const beginDynastyOffseason = useDynastyStore((state) => state.beginDynastyOffseason)
  const advancePresentation = useDynastyStore((state) => state.advanceOffseasonPresentation)
  const viewStage = useDynastyStore((state) => state.viewOffseasonStage)
  const beginNextSeason = useDynastyStore((state) => state.beginNextSeason)
  const goToLeague = useDynastyStore((state) => state.goToLeague)
  const openHistory = useDynastyStore((state) => state.openHistory)
  const openArchivedSeason = useDynastyStore((state) => state.openArchivedSeason)
  const setViewedProgram = useDynastyStore((state) => state.setViewedProgram)

  if (!dynasty) return null
  const isObserver = dynasty.controlledProgramId === null
  const controlledProgramId = selectPresentationProgramId(useDynastyStore.getState())
  if (controlledProgramId === null) return null
  const experience = deriveOffseasonExperience(dynasty, cursor, controlledProgramId)
  if (!experience) return null

  const controlledProgram = dynasty.universe.programs.find(
    ({ id }) => id === controlledProgramId,
  )
  if (!controlledProgram) return null

  const accentStyle = {
    '--team-accent': controlledProgram.branding.primaryColor,
  } as CSSProperties

  const handleTimelineSelect = (stage: OffseasonStageId) => {
    if (stage === 'recruiting-class' || stage === 'departures' || stage === 'development' ||
      stage === 'roster-review' || stage === 'ready-for-season') {
      viewStage(stage)
    }
  }

  const handleProgression = () => {
    const action = experience.progressionAction
    switch (action.kind) {
      case 'finalize-recruiting-class':
        setIsFinalizeDialogOpen(true)
        break
      case 'begin-dynasty-offseason':
        beginDynastyOffseason()
        break
      case 'advance-presentation':
        advancePresentation(action.target)
        break
      case 'begin-next-season':
        beginNextSeason()
        break
    }
  }

  const renderStage = () => {
    if (experience.viewedStage === 'late-recruiting') {
      return <RecruitingScreen embeddedOffseason />
    }

    const completedClass = dynasty.completedRecruitingHistory.find(
      ({ targetSeasonNumber }) => targetSeasonNumber === experience.targetSeasonNumber,
    )
    const recruiting = completedClass?.recruitingState ?? dynasty.recruiting
    const incoming = recruiting
      ? deriveIncomingClass(recruiting, controlledProgramId)
      : []

    if (experience.viewedStage === 'recruiting-class') {
      const averages = deriveClassAverages(incoming.map(({ recruit }) => recruit))
      const positionCounts = derivePositionCounts(incoming.map(({ recruit }) => recruit.player))
      return (
        <section className="section" aria-labelledby="offseason-class-heading">
          <p className="eyebrow-tag">Finalized Class</p>
          <h2 id="offseason-class-heading" className="section-title">Recruiting Class</h2>
          <RecruitingClassSummary
            embedded
            programName={controlledProgram.name}
            targetSeasonNumber={experience.targetSeasonNumber}
            signees={incoming}
            averages={averages}
            positionCounts={positionCounts}
            onBeginOffseason={beginDynastyOffseason}
          />
        </section>
      )
    }

    const offseason = dynasty.offseason
    const archive = dynasty.history.find(
      ({ seasonNumber }) => seasonNumber === experience.completedSeasonNumber,
    )
    const offseasonProgram = offseason?.programs[controlledProgramId]
    if (!offseason || !archive || !completedClass || !offseasonProgram) return null

    if (experience.viewedStage === 'departures') {
      const departures = deriveDepartures(dynasty, archive, controlledProgramId)
      return (
        <section className="section" aria-labelledby="departures-heading">
          <p className="eyebrow-tag">Who Is Moving On</p>
          <h2 id="departures-heading" className="section-title">Departures</h2>
          <p className="section-hint">Recognize the Seniors closing their careers with {controlledProgram.name}.</p>
          <DeparturesTable programName={controlledProgram.name} departures={departures} />
        </section>
      )
    }

    const developmentRows = deriveDevelopmentRows(
      archive,
      controlledProgramId,
      offseasonProgram,
      dynasty.dynastySeed,
      offseason.developmentExplosions,
    )
    if (experience.viewedStage === 'development') {
      return (
        <section className="section" aria-labelledby="development-heading">
          <p className="eyebrow-tag">Returning Players</p>
          <h2 id="development-heading" className="section-title">Development</h2>
          <p className="section-hint">These results were applied once when the Offseason began.</p>
          <DevelopmentTable rows={developmentRows} biggestLeap={deriveBiggestLeap(developmentRows)} />
        </section>
      )
    }

    const assembly = assembleNextSeasonRosters({
      universe: dynasty.universe,
      offseason,
      completedRecruitingClass: completedClass,
      completedSeasonArchive: archive,
    })
    const roster = assembly.programs[controlledProgramId]!.players
    const returningIds = new Set(offseasonProgram.returningPlayers.map(({ id }) => id))
    const rosterRows: NextSeasonRosterRow[] = roster.map((player) => ({
      player,
      status: returningIds.has(player.id) ? 'returning' : 'incoming',
    }))
    const positionCounts = derivePositionCounts(roster)

    if (experience.viewedStage === 'roster-review') {
      return (
        <>
          <section className="roster-review-summary" aria-labelledby="roster-review-heading">
            <div className="roster-review-summary__identity">
              <p className="eyebrow-tag">Season {experience.targetSeasonNumber}</p>
              <h2 id="roster-review-heading" className="section-title">Roster Review</h2>
            </div>
            <div className="stat-trio roster-review-summary__stats">
              <div className="stat-trio__item"><span className="stat-trio__value">{roster.length}</span><span className="stat-trio__label">Players</span></div>
              <div className="stat-trio__item"><span className="stat-trio__value">{formatAverage(deriveRosterAverageOverall(roster))}</span><span className="stat-trio__label">Avg Ovr</span></div>
              <div className="stat-trio__item"><span className="stat-trio__value">{incoming.length}</span><span className="stat-trio__label">Incoming</span></div>
            </div>
            <div className="roster-review-summary__balance">
              <span className="roster-review-summary__balance-label">Position Balance</span>
              <span className="roster-review-summary__balance-value">
                {positionCounts.map(({ position, count }) => `${position} ${count}`).join(' · ')}
              </span>
            </div>
          </section>
          <section className="section" aria-labelledby="incoming-heading">
            <h3 id="incoming-heading" className="section-title">Incoming Class</h3>
            <IncomingClassTable programName={controlledProgram.name} rows={incoming} />
          </section>
          <section className="section" aria-labelledby="next-roster-heading">
            <h3 id="next-roster-heading" className="section-title">Season {experience.targetSeasonNumber} Roster</h3>
            <NextSeasonRosterTable rows={rosterRows} />
          </section>
        </>
      )
    }

    return (
      <section className="ready-for-season" aria-labelledby="ready-heading">
        <span className="ready-for-season__badge" aria-hidden="true">✓</span>
        <p className="eyebrow-tag">Offseason Complete</p>
        <h2 id="ready-heading" className="ready-for-season__title">Ready for Season {experience.targetSeasonNumber}</h2>
        <div className="stat-trio ready-for-season__facts">
          <div className="stat-trio__item"><span className="stat-trio__value">{roster.length}</span><span className="stat-trio__label">Players</span></div>
          <div className="stat-trio__item"><span className="stat-trio__value">{offseasonProgram.returningPlayers.length}</span><span className="stat-trio__label">Returning</span></div>
          <div className="stat-trio__item"><span className="stat-trio__value">{incoming.length}</span><span className="stat-trio__label">Incoming</span></div>
        </div>
      </section>
    )
  }

  const isReviewing = experience.viewedStage !== experience.furthestUnlockedStage
  const furthestLabel = experience.stages.find(
    ({ id }) => id === experience.furthestUnlockedStage,
  )?.label
  const remainingOpenings = dynasty.recruiting?.phase === 'late'
    ? deriveRecruitingHubTotals(
        deriveProgramRecruitingBoard(dynasty, controlledProgramId),
      ).remainingTotal
    : 0

  return (
    <div className="offseason-experience" style={accentStyle}>
      <header className="season-header offseason-header">
        <div className="season-header__identity">
          <span className="season-header__dot" style={{ background: controlledProgram.branding.primaryColor }} aria-hidden="true" />
          <div>
            <p className="eyebrow-tag">Offseason</p>
            <h1 className="season-header__name">{controlledProgram.name}</h1>
            <p className="season-header__meta">Season {experience.completedSeasonNumber} → Season {experience.targetSeasonNumber}</p>
          </div>
        </div>
        <div className="offseason-header__actions">
          <div className="offseason-exploration" aria-label="Offseason exploration">
            {dynasty.activeSeason && <button type="button" className="button button--tertiary" onClick={goToLeague}>View League</button>}
            <button type="button" className="button button--tertiary" onClick={openHistory}>History</button>
            {dynasty.offseason && <button type="button" className="button button--tertiary" onClick={() => openArchivedSeason(experience.completedSeasonNumber)}>Completed Tournament</button>}
          </div>
          <div className="offseason-header__cta">
            {isReviewing && (
              <p className="offseason-header__reviewing-note">
                Reviewing {experience.stages.find(({ id }) => id === experience.viewedStage)?.label} · Progress at {furthestLabel}
              </p>
            )}
            {experience.progressionAction.kind !== 'none' && (
              <button
                type="button"
                className="button button--primary offseason-header__cta-button"
                onClick={handleProgression}
              >
                {experience.progressionAction.label}
              </button>
            )}
          </div>
        </div>
      </header>

      {isObserver && <ViewedProgramSelector
        programId={controlledProgramId}
        programs={dynasty.universe.programs}
        onChange={setViewedProgram}
      />}

      <OffseasonTimeline stages={experience.stages} onSelectStage={handleTimelineSelect} />

      {actionError && <p className="recruiting-action-error" role="alert">{actionError}</p>}
      {renderStage()}

      {isFinalizeDialogOpen && (
        <RecruitingFinalizationDialog
          remainingOpenings={remainingOpenings}
          onCancel={() => setIsFinalizeDialogOpen(false)}
          onConfirm={() => {
            setIsFinalizeDialogOpen(false)
            finalizeRecruitingClass()
          }}
        />
      )}
    </div>
  )
}
