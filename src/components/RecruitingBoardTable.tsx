import { calculateOverall } from '../engine'
import {
  getRecruit,
  MAX_RECRUITING_PRIORITY,
  MIN_RECRUITING_PRIORITY,
  type ProgramRecruitingBoard,
  type RecruitingState,
} from '../dynasty'
import {
  formatOfferCapacityMessage,
  formatRecruitStatusLabel,
  formatRankLabel,
} from '../app/recruitingFormatters'
import type { ProgramDefinition } from '../universe'
import { RecruitStars } from './RecruitStars'

interface RecruitingBoardTableProps {
  readonly board: ProgramRecruitingBoard
  readonly recruiting: RecruitingState
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly onSetPriority: (playerId: string, priority: number) => void
  readonly onOffer: (playerId: string) => void
  readonly onWithdraw: (playerId: string) => void
  readonly onRemove: (playerId: string) => void
}

interface PriorityStepperProps {
  readonly value: number
  readonly disabled: boolean
  readonly label: string
  readonly onChange: (nextValue: number) => void
}

function PriorityStepper({ value, disabled, label, onChange }: PriorityStepperProps) {
  return (
    <div className="minute-stepper recruiting-priority-stepper">
      <button
        type="button"
        className="minute-stepper__button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= MIN_RECRUITING_PRIORITY}
        aria-label={`Decrease ${label} priority`}
      >
        <span aria-hidden="true">−</span>
      </button>
      <span className="minute-stepper__input recruiting-priority-stepper__value" aria-label={`${label} priority`}>
        {value}
      </span>
      <button
        type="button"
        className="minute-stepper__button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= MAX_RECRUITING_PRIORITY}
        aria-label={`Increase ${label} priority`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}

/** The controlled Program's board: priority, active-offer, and commitment status per target. */
export function RecruitingBoardTable({
  board,
  recruiting,
  programsById,
  onSetPriority,
  onOffer,
  onWithdraw,
  onRemove,
}: RecruitingBoardTableProps) {
  if (board.targets.length === 0) {
    return (
      <p className="league-empty-state">
        Your board is empty. Add targets from the National Class to start recruiting.
      </p>
    )
  }

  const rows = board.targets
    .map((target) => ({ target, recruit: getRecruit(recruiting, target.playerId)! }))
    .sort(
      (first, second) =>
        second.target.priority - first.target.priority ||
        first.recruit.nationalRank - second.recruit.nationalRank,
    )

  return (
    <div className="table-scroll">
      <table className="data-table recruiting-board-table">
        <caption className="visually-hidden">Recruiting board</caption>
        <thead>
          <tr>
            <th scope="col">Rk</th>
            <th scope="col">Player</th>
            <th scope="col">Stars</th>
            <th scope="col">Ovr</th>
            <th scope="col">Pot</th>
            <th scope="col">Standing</th>
            <th scope="col">Priority</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ target, recruit }) => {
            const position = recruit.player.position
            const isActive = target.status === 'active'
            const canRemove = target.status !== 'committed'
            const committedProgramName =
              target.status === 'committed-elsewhere'
                ? programsById.get(recruiting.commitmentsByPlayerId[target.playerId]!.programId)
                    ?.name
                : undefined
            const availableOfferSlots = board.availableOfferSlotsByPosition[position]
            const canOffer = isActive && !target.hasActiveOffer && availableOfferSlots > 0

            return (
              <tr key={target.playerId} data-status={target.status}>
                <td>{recruit.nationalRank}</td>
                <td className="player-name-cell">
                  {recruit.player.firstName} {recruit.player.lastName}
                  <span className="leader-board__pos">{position}</span>
                </td>
                <td>
                  <RecruitStars stars={recruit.stars} />
                </td>
                <td>{calculateOverall(recruit.player)}</td>
                <td>{recruit.player.potential}</td>
                <td>{formatRankLabel(target.standingRank)}</td>
                <td>
                  <PriorityStepper
                    value={target.priority}
                    disabled={!isActive}
                    label={`${recruit.player.firstName} ${recruit.player.lastName}`}
                    onChange={(next) => onSetPriority(target.playerId, next)}
                  />
                </td>
                <td className="recruiting-status-cell">
                  {formatRecruitStatusLabel({
                    status: target.status,
                    // Every row here is already a board member — the
                    // "On Board" nuance only matters from the National Class.
                    isOnBoard: false,
                    hasActiveOffer: target.hasActiveOffer,
                    committedProgramName,
                  })}
                </td>
                <td>
                  <div className="recruiting-board-table__actions">
                    {isActive && target.hasActiveOffer && (
                      <button
                        type="button"
                        className="button button--ghost recruiting-action-button"
                        onClick={() => onWithdraw(target.playerId)}
                      >
                        Withdraw
                      </button>
                    )}
                    {isActive && !target.hasActiveOffer && (
                      <>
                        <button
                          type="button"
                          className="button button--primary recruiting-action-button"
                          disabled={!canOffer}
                          onClick={() => onOffer(target.playerId)}
                        >
                          Offer
                        </button>
                        {!canOffer && (
                          <p className="recruiting-capacity-note">
                            {formatOfferCapacityMessage(
                              position,
                              board.activeOfferCountsByPosition[position],
                              board.remainingOpeningsByPosition[position],
                            )}
                          </p>
                        )}
                      </>
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        className="text-link-button recruiting-remove-button"
                        onClick={() => onRemove(target.playerId)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
