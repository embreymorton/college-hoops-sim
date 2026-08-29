import { useId, useMemo, useRef } from 'react'
import { deriveObserverMultiSeasonSummary, type DynastyState } from '../dynasty'
import { formatHistoricalTournamentOutcome } from '../app/programLegacyFormatters'
import type { ObserverMultiSeasonHorizon, ObserverMultiSeasonSimState } from '../store'
import { ModalOverlay } from './ModalOverlay'

interface Props {
  readonly dynasty: DynastyState
  readonly operation: ObserverMultiSeasonSimState
  readonly onSelectHorizon: (horizon: ObserverMultiSeasonHorizon) => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
  readonly onDismiss: () => void
}

function formatReputation(value: number | null): string {
  return value === null ? 'Unestablished' : value.toFixed(1)
}

const PRESET_DETAILS: Record<ObserverMultiSeasonHorizon, string> = {
  1: 'Quick look ahead',
  5: 'Program arc',
  10: 'Long-run simulation',
}

export function ObserverMultiSeasonSimDialog({
  dynasty,
  operation,
  onSelectHorizon,
  onCancel,
  onConfirm,
  onDismiss,
}: Props) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const summaryResult = useMemo(
    () => {
      if (operation.status !== 'complete' || !operation.summary) return { summary: null, error: null }
      try {
        return { summary: deriveObserverMultiSeasonSummary(dynasty, operation.summary), error: null }
      } catch (error) {
        return { summary: null, error: error instanceof Error ? error.message : 'Summary could not be displayed.' }
      }
    },
    [dynasty, operation],
  )
  const summary = summaryResult.summary
  const programs = new Map(dynasty.universe.programs.map((program) => [program.id, program]))
  const locked = operation.status === 'running'
  const isWide = summary !== null

  return (
    <ModalOverlay
      titleId={titleId}
      descriptionId={descriptionId}
      role={operation.status === 'confirming' ? 'alertdialog' : 'dialog'}
      onDismiss={locked ? () => undefined : operation.status === 'confirming' ? onCancel : onDismiss}
      initialFocusRef={operation.status === 'confirming' ? cancelRef : undefined}
      className={isWide ? 'modal--wide' : undefined}
    >
      <p className="modal__eyebrow">Super Duper Sim</p>
      {operation.status === 'confirming' && (
        <>
          <h2 id={titleId} className="modal__title">Sim Multiple Seasons</h2>
          <p id={descriptionId} className="modal__body">
            Choose how many canonical Season rollovers to complete. Normal games,
            Recruiting, Tournament, Awards, Development, history, and roster changes
            will still occur.
          </p>
          <div className="multi-season-presets" role="group" aria-label="Seasons to simulate">
            {([1, 5, 10] as const).map((horizon) => (
              <button
                key={horizon}
                type="button"
                className={`button ${operation.requestedSeasons === horizon ? 'button--primary' : 'button--ghost'}`}
                aria-pressed={operation.requestedSeasons === horizon}
                onClick={() => onSelectHorizon(horizon)}
              >
                <span>{horizon} Season{horizon === 1 ? '' : 's'}</span>
                <span className="multi-season-presets__detail">{PRESET_DETAILS[horizon]}</span>
              </button>
            ))}
          </div>
          <p className="modal__body modal__body--muted">
            Intermediate review screens will be skipped. All Programs remain AI-controlled,
            and the simulation runs to completion once confirmed.
          </p>
          <div className="modal__actions">
            <button ref={cancelRef} type="button" className="button button--ghost" onClick={onCancel}>Cancel</button>
            <button type="button" className="button button--primary" onClick={onConfirm}>
              Sim {operation.requestedSeasons} Season{operation.requestedSeasons === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}

      {operation.status === 'running' && (
        <>
          <h2 id={titleId} className="modal__title">Simulating Season {operation.completedSeasons + 1}</h2>
          <p id={descriptionId} className="modal__body" role="status" aria-live="polite">
            Simulating Season {operation.completedSeasons + 1} of {operation.requestedSeasons}
          </p>
          <div className="multi-season-progress">
            <div
              className="multi-season-progress__track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={operation.requestedSeasons}
              aria-valuenow={operation.completedSeasons}
              aria-label="Seasons complete"
            >
              <div
                className="multi-season-progress__fill"
                style={{ width: `${(operation.completedSeasons / operation.requestedSeasons) * 100}%` }}
              />
            </div>
          </div>
          <p className="modal__body modal__body--muted">
            {operation.completedSeasons} of {operation.requestedSeasons} complete. This operation cannot be cancelled.
          </p>
        </>
      )}

      {operation.status === 'error' && (
        <>
          <h2 id={titleId} className="modal__title">Simulation Stopped</h2>
          <p id={descriptionId} className="modal__body" role="alert">
            Season {operation.errorSeasonNumber} stopped during {operation.errorPhase}.
            The last {operation.completedSeasons} completed Season{operation.completedSeasons === 1 ? '' : 's'} remain saved in this session.
          </p>
          <p className="modal__body modal__body--muted">{operation.errorMessage}</p>
          <div className="modal__actions"><button type="button" className="button button--primary" onClick={onDismiss}>Return to Season Hub</button></div>
        </>
      )}

      {summary && (
        <>
          <h2 id={titleId} className="modal__title">{summary.descriptor.rolloverCount} Season{summary.descriptor.rolloverCount === 1 ? '' : 's'} Simulated</h2>
          <p id={descriptionId} className="modal__body">
            Seasons {summary.descriptor.startSeasonNumber}–{summary.descriptor.endSeasonNumber} · Viewing {summary.viewedProgramName}
          </p>

          <div className="multi-season-snapshot">
            <p className="multi-season-snapshot__name">{summary.viewedProgramName}</p>
            <dl className="modal-stat-list">
              <div className="modal-stat-list__row">
                <dt>Best Season</dt>
                <dd>Season {summary.bestSeason.seasonNumber} · {summary.bestSeason.record.wins}–{summary.bestSeason.record.losses} · {formatHistoricalTournamentOutcome(summary.bestSeason.tournamentOutcome)}</dd>
              </div>
              <div className="modal-stat-list__row"><dt>Championships</dt><dd>{summary.championships}</dd></div>
              <div className="modal-stat-list__row">
                <dt>Reputation</dt>
                <dd>
                  {formatReputation(summary.startingReputation)} → {formatReputation(summary.endingReputation)}
                  {summary.reputationMovement !== null && (
                    <> ({summary.reputationMovement >= 0 ? '+' : ''}{summary.reputationMovement.toFixed(1)})</>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="multi-season-summary-section">
            <h3>Season by Season</h3>
            <div className="multi-season-summary-table-wrap">
              <table className="multi-season-summary-table">
                <thead><tr><th>Season</th><th>{summary.viewedProgramName}</th><th>Conf.</th><th>Tournament</th><th>Champion</th></tr></thead>
                <tbody>{summary.rows.map((row) => (
                  <tr key={row.seasonNumber}>
                    <td>{row.seasonNumber}</td>
                    <td>{row.record.wins}–{row.record.losses}</td>
                    <td>#{row.conferenceFinish}</td>
                    <td>{formatHistoricalTournamentOutcome(row.tournamentOutcome)}</td>
                    <td>{programs.get(row.championProgramId)?.name ?? row.championProgramId}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div className="multi-season-summary-section">
            <h3>Major Awards</h3>
            <div className="multi-season-summary-table-wrap">
              <table className="multi-season-summary-table">
                <thead><tr><th>Season</th><th>Player of the Year</th><th>Tournament MOP</th></tr></thead>
                <tbody>{summary.rows.map((row) => (
                  <tr key={row.seasonNumber}>
                    <td>{row.seasonNumber}</td>
                    <td>{row.nationalPlayerOfYear?.playerName ?? '—'}</td>
                    <td>{row.tournamentMop?.playerName ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div className="modal__actions"><button type="button" className="button button--primary" onClick={onDismiss}>Continue to Season Hub</button></div>
        </>
      )}
      {operation.status === 'complete' && summaryResult.error && (
        <>
          <h2 id={titleId} className="modal__title">Seasons Simulated</h2>
          <p id={descriptionId} className="modal__body">The simulation completed, but its summary could not be displayed. All canonical history remains available.</p>
          <p className="modal__body modal__body--muted">{summaryResult.error}</p>
          <div className="modal__actions"><button type="button" className="button button--primary" onClick={onDismiss}>Continue to Season Hub</button></div>
        </>
      )}
    </ModalOverlay>
  )
}
