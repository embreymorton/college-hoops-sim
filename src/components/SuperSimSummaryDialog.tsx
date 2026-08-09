import { useId } from 'react'
import type { TournamentEntry } from '../postseason'
import type { ProgramRecord } from '../season'
import type { SuperSimKind } from '../store'
import { formatCompactTournamentQualification } from '../app/postseasonFormatters'
import { formatOrdinal, formatRecord } from '../app/seasonFormatters'
import { ModalOverlay } from './ModalOverlay'

interface SuperSimSummaryDialogProps {
  readonly kind: SuperSimKind
  readonly controlledProgramName: string
  readonly segmentRecord: ProgramRecord
  readonly overallRecord: ProgramRecord
  readonly conferenceRecord: ProgramRecord
  /** 1-based position within the controlled Program's Conference, if derivable. */
  readonly conferenceStanding: number | undefined
  /** Canonical end-of-season field entry; undefined means the Program was not selected. */
  readonly tournamentEntry: TournamentEntry | undefined
  readonly onContinue: () => void
}

/** One-time acknowledgement after a Super Sim checkpoint completes. */
export function SuperSimSummaryDialog({
  kind,
  controlledProgramName,
  segmentRecord,
  overallRecord,
  conferenceRecord,
  conferenceStanding,
  tournamentEntry,
  onContinue,
}: SuperSimSummaryDialogProps) {
  const titleId = useId()
  const isEndOfSeason = kind === 'endOfRegularSeason'
  const gamesSimulated = segmentRecord.wins + segmentRecord.losses

  return (
    <ModalOverlay titleId={titleId} onDismiss={onContinue}>
      <p className="modal__eyebrow">Super Sim</p>
      <h2 id={titleId} className="modal__title">
        {isEndOfSeason ? 'Regular Season Complete' : 'Midseason Reached'}
      </h2>
      <p className="modal__body">
        {gamesSimulated} game{gamesSimulated === 1 ? '' : 's'} simulated
      </p>
      <p className="modal__body">
        {controlledProgramName} went{' '}
        {formatRecord(segmentRecord.wins, segmentRecord.losses)}
      </p>
      <dl className="modal-stat-list">
        <div className="modal-stat-list__row">
          <dt>{isEndOfSeason ? 'Final' : 'Overall'}</dt>
          <dd>{formatRecord(overallRecord.wins, overallRecord.losses)}</dd>
        </div>
        <div className="modal-stat-list__row">
          <dt>Conference</dt>
          <dd>
            {formatRecord(conferenceRecord.wins, conferenceRecord.losses)}
          </dd>
        </div>
        {conferenceStanding !== undefined && (
          <div className="modal-stat-list__row">
            <dt>Standing</dt>
            <dd>{formatOrdinal(conferenceStanding)}</dd>
          </div>
        )}
        {isEndOfSeason && (
          <div className="modal-stat-list__row">
            <dt>Tournament</dt>
            <dd>{formatCompactTournamentQualification(tournamentEntry)}</dd>
          </div>
        )}
      </dl>
      <div className="modal__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </ModalOverlay>
  )
}
