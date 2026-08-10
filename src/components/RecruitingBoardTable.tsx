import { calculateOverall } from '../engine'
import {
  getRecruit,
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
  readonly onSetFocus: (playerId: string, isFocused: boolean) => void
  readonly onOffer: (playerId: string) => void
  readonly onWithdraw: (playerId: string) => void
  readonly onRemove: (playerId: string) => void
}

interface FocusToggleProps {
  readonly isFocused: boolean
  readonly disabled: boolean
  readonly label: string
  readonly onChange: (nextValue: boolean) => void
}

function FocusToggle({ isFocused, disabled, label, onChange }: FocusToggleProps) {
  return (
    <div className="recruiting-focus-toggle">
      <button
        type="button"
        className="button button--ghost recruiting-action-button"
        onClick={() => onChange(!isFocused)}
        disabled={disabled}
        aria-label={`${isFocused ? 'Unfocus' : 'Focus'} ${label}`}
      >
        {isFocused ? '★ Focused' : '☆ Focus'}
      </button>
    </div>
  )
}

/**
 * The controlled Program's board: focus, active-offer, and commitment
 * status per target. Callers must not render this with an empty board — use
 * `RecruitingBoardEmptyState` instead, since the two empty variants need
 * different copy the table itself doesn't have enough context to choose.
 */
export function RecruitingBoardTable({
  board,
  recruiting,
  programsById,
  onSetFocus,
  onOffer,
  onWithdraw,
  onRemove,
}: RecruitingBoardTableProps) {
  // Strictly by National Rank — a fixed identity order, so changing a
  // Recruit focus never moves their row.
  const rows = board.targets
    .map((target) => ({ target, recruit: getRecruit(recruiting, target.playerId)! }))
    .sort((first, second) => first.recruit.nationalRank - second.recruit.nationalRank)

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
            <th scope="col">Focus</th>
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
                  <FocusToggle
                    isFocused={target.isFocused}
                    disabled={!isActive}
                    label={`${recruit.player.firstName} ${recruit.player.lastName}`}
                    onChange={(next) => onSetFocus(target.playerId, next)}
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
