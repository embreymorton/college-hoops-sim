import { useMemo } from 'react'
import { RecruitStars } from '../components'
import {
  deriveRecruitingClassIndex,
  deriveRecruitingClassRetrospective,
  type RecruitingRetrospectiveRow,
} from '../dynasty'
import { useDynastyStore } from '../store'
import type { ProgramDefinition } from '../universe'

function formatOutcome(row: RecruitingRetrospectiveRow): string {
  switch (row.outcome.kind) {
    case 'incoming':
      return 'Incoming'
    case 'active':
      return `${row.outcome.classYear} · ${row.outcome.currentOverall} OVR`
    case 'former':
      return `Former · Peak ${row.outcome.peakOverall} OVR`
    case 'unavailable':
      return 'Unavailable'
  }
}

/** League History view over immutable finalized national signing classes. */
export function RecruitingHistoryScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const selectedSeasonNumber = useDynastyStore(
    (state) => state.selectedRecruitingClassSeasonNumber,
  )
  const selectClass = useDynastyStore((state) => state.selectRecruitingHistoryClass)
  const filter = useDynastyStore((state) => state.recruitingHistoryFilter)
  const setFilter = useDynastyStore((state) => state.setRecruitingHistoryFilter)
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)

  const programsById = useMemo(
    () => new Map(
      dynasty?.universe.programs.map((program) => [program.id, program] as const) ?? [],
    ),
    [dynasty],
  ) as ReadonlyMap<string, ProgramDefinition>

  const classIndex = useMemo(
    () => dynasty ? deriveRecruitingClassIndex(dynasty) : [],
    [dynasty],
  )
  const selectedClass = useMemo(
    () => dynasty && selectedSeasonNumber !== null
      ? deriveRecruitingClassRetrospective(dynasty, selectedSeasonNumber)
      : null,
    [dynasty, selectedSeasonNumber],
  )

  if (!dynasty) return null

  if (!selectedClass) {
    return (
      <section className="recruiting-history" aria-labelledby="recruiting-history-heading">
        <header className="history-subsection-header">
          <div>
            <p className="eyebrow-tag">National Signing Classes</p>
            <h2 id="recruiting-history-heading" className="section-title">Recruiting History</h2>
          </div>
        </header>
        {classIndex.length === 0 ? (
          <p className="league-empty-state">
            Finalized recruiting classes will appear here after Late Recruiting.
          </p>
        ) : (
          <div className="history-season-list">
            {classIndex.map((entry) => (
              <button
                key={entry.targetSeasonNumber}
                type="button"
                className="history-season-card recruiting-history-card"
                onClick={() => {
                  setFilter('all')
                  selectClass(entry.targetSeasonNumber)
                }}
              >
                <span className="history-season-card__season">
                  Season {entry.targetSeasonNumber} Recruiting Class
                </span>
                <span className="history-season-card__detail">
                  {entry.signeeCount} signees
                </span>
                <span className="history-season-card__detail">
                  Your Program: {entry.controlledProgramSigneeCount}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    )
  }

  const rows = filter === 'all'
    ? selectedClass.rows
    : selectedClass.rows.filter(
      ({ signedProgramId }) => signedProgramId === dynasty.controlledProgramId,
    )

  return (
    <section className="recruiting-history" aria-labelledby="recruiting-class-heading">
      <button
        type="button"
        className="text-link-button recruiting-history__back"
        onClick={() => selectClass(null)}
      >
        ← Back to Recruiting History
      </button>
      <header className="history-subsection-header recruiting-history__detail-header">
        <div>
          <p className="eyebrow-tag">National Signing Class</p>
          <h2 id="recruiting-class-heading" className="section-title">
            Season {selectedClass.targetSeasonNumber} Recruiting Class
          </h2>
          <p className="section-hint">
            {selectedClass.signeeCount} signees · Your Program: {selectedClass.controlledProgramSigneeCount}
          </p>
        </div>
        <div role="group" aria-label="Recruiting class scope" className="tab-list">
          <button
            type="button"
            className="tab"
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All Programs
          </button>
          <button
            type="button"
            className="tab"
            aria-pressed={filter === 'controlled'}
            onClick={() => setFilter('controlled')}
          >
            Your Program
          </button>
        </div>
      </header>

      <div className="table-scroll recruiting-history__table-scroll">
        <table className="data-table recruiting-history-table">
          <caption className="visually-hidden">
            Season {selectedClass.targetSeasonNumber} national recruiting class
          </caption>
          <thead>
            <tr>
              <th scope="col">Recruit</th>
              <th scope="col">Signed</th>
              <th scope="col">Entered</th>
              <th scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const program = programsById.get(row.signedProgramId)
              const canOpenPlayer = row.outcome.kind === 'active' || row.outcome.kind === 'former'
              const playerProgramId = row.outcome.kind === 'active'
                ? row.outcome.currentProgramId
                : row.outcome.kind === 'former'
                  ? row.outcome.finalProgramId
                  : null
              return (
                <tr key={row.playerId} data-outcome={row.outcome.kind}>
                  <td className="recruiting-history-table__recruit">
                    <span className="recruiting-history-table__name">
                      <span className="recruiting-history-table__rank">#{row.nationalRank}</span>{' '}
                      {canOpenPlayer && playerProgramId ? (
                        <button
                          type="button"
                          className="text-link-button"
                          onClick={() => openPlayerDetails(playerProgramId, row.playerId)}
                        >
                          {row.firstName} {row.lastName}
                        </button>
                      ) : (
                        <span>{row.firstName} {row.lastName}</span>
                      )}
                    </span>
                    <span className="recruiting-history-table__secondary">
                      {row.position} · <RecruitStars stars={row.stars} />
                    </span>
                  </td>
                  <td>
                    <span className="program-inline-identity">
                      {program ? (
                        <span
                          className="team-color-dot"
                          style={{ backgroundColor: program.branding.primaryColor }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {program?.name ?? row.signedProgramId}
                    </span>
                  </td>
                  <td>
                    <span className="recruiting-history-table__entered">
                      <span>{row.entryOverall} / {row.entryPotential}</span>
                      <span>OVR / POT</span>
                    </span>
                  </td>
                  <td className="recruiting-history-table__outcome">{formatOutcome(row)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
