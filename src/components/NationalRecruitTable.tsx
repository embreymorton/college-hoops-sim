import { useMemo, useState } from 'react'
import { calculateOverall, POSITIONS, type Position } from '../engine'
import {
  deriveRecruitActiveOfferCount,
  deriveRecruitMarketView,
  deriveRecruitProgramStandings,
  deriveTargetStatus,
  RECRUITING_BOARD_LIMIT,
  type DynastyState,
  type ProgramRecruitingBoard,
} from '../dynasty'
import {
  formatRecruitStatusLabel,
  formatRankLabel,
} from '../app/recruitingFormatters'
import type { ProgramDefinition } from '../universe'
import { RecruitStars } from './RecruitStars'

type ClassFilter = 'all' | Position | 'needs'

const FILTER_OPTIONS: readonly { readonly value: ClassFilter; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  ...POSITIONS.map((position) => ({ value: position, label: position })),
  { value: 'needs', label: 'Needs' },
]

interface NationalRecruitTableProps {
  readonly dynasty: DynastyState
  readonly board: ProgramRecruitingBoard
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly onAddToBoard: (playerId: string) => void
  readonly onOpenRecruitDetails: (playerId: string) => void
  readonly availableMarketOnly?: boolean
}

/** The full national Recruit pool, filterable by position/need, in National Rank order. */
export function NationalRecruitTable({
  dynasty,
  board,
  programsById,
  onAddToBoard,
  onOpenRecruitDetails,
  availableMarketOnly = false,
}: NationalRecruitTableProps) {
  const [filter, setFilter] = useState<ClassFilter>('all')
  const recruiting = dynasty.recruiting!
  const controlledProgramId = dynasty.controlledProgramId
  const boardIsFull = board.targets.length >= RECRUITING_BOARD_LIMIT
  const marketIsForming = recruiting.lastResolvedPeriod === 0

  const sorted = [...recruiting.recruits].sort(
    (first, second) => first.nationalRank - second.nationalRank,
  )
  const filtered = sorted.filter((recruit) => {
    if (
      availableMarketOnly &&
      (deriveTargetStatus(recruiting, controlledProgramId, recruit.player.id) !== 'active' ||
        board.targets.some(({ playerId }) => playerId === recruit.player.id))
    ) return false
    if (filter === 'all') return true
    if (filter === 'needs') {
      return board.remainingOpeningsByPosition[recruit.player.position] > 0
    }
    return recruit.player.position === filter
  })

  // Standing is expensive (compares against every Program); only compute it
  // for the currently visible, filtered rows, and only when the filter or
  // underlying Dynasty actually changes.
  const standingByPlayerId = useMemo(() => {
    const map = new Map<string, number>()
    for (const recruit of filtered) {
      const standings = deriveRecruitProgramStandings(dynasty, recruit.player.id)
      map.set(
        recruit.player.id,
        standings.find((entry) => entry.programId === controlledProgramId)!.rank,
      )
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynasty, filter])

  return (
    <div className="national-recruit-table">
      <div role="group" aria-label="Position filter" className="tab-list recruiting-class-filters">
        {FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="tab"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="league-empty-state">
          {availableMarketOnly
            ? 'No additional available Recruits match this filter.'
            : 'No Recruits match this filter.'}
        </p>
      ) : (
        <>
        {marketIsForming && (
          <p className="section-hint national-recruit-table__market-note">
            Preseason Evaluation — national market information becomes available after the first Recruiting period.
          </p>
        )}
        <div className="table-scroll">
          <table className="data-table national-recruit-table__table">
            <caption className="visually-hidden">National recruiting class</caption>
            <thead>
              <tr>
                <th scope="col">Rk</th>
                <th scope="col">Player</th>
                <th scope="col">Stars</th>
                <th scope="col">Ovr</th>
                <th scope="col">Pot</th>
                <th scope="col">Standing</th>
                <th scope="col">Market</th>
                <th scope="col">Offers</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((recruit) => {
                const status = deriveTargetStatus(
                  recruiting,
                  controlledProgramId,
                  recruit.player.id,
                )
                const boardTarget = board.targets.find(
                  (target) => target.playerId === recruit.player.id,
                )
                const isOnBoard = Boolean(boardTarget)
                const market = deriveRecruitMarketView(dynasty, recruit.player.id)
                const committedProgramName =
                  status === 'committed-elsewhere'
                    ? programsById.get(
                        recruiting.commitmentsByPlayerId[recruit.player.id]!.programId,
                      )?.name
                    : undefined

                return (
                  <tr key={recruit.player.id} data-status={status}>
                    <td>{recruit.nationalRank}</td>
                    <td className="player-name-cell">
                      <button
                        type="button"
                        className="text-link-button recruit-details-link"
                        onClick={() => onOpenRecruitDetails(recruit.player.id)}
                      >
                        {recruit.player.firstName} {recruit.player.lastName}
                      </button>
                      <span className="leader-board__pos">{recruit.player.position}</span>
                    </td>
                    <td>
                      <RecruitStars stars={recruit.stars} />
                    </td>
                    <td>{calculateOverall(recruit.player)}</td>
                    <td>{recruit.player.potential}</td>
                    <td>
                      {formatRankLabel(
                        standingByPlayerId.get(recruit.player.id) ?? 0,
                      )}
                    </td>
                    <td>
                      <span aria-label={market.isForming
                        ? 'Market forming'
                        : `${market.tier} market, ${market.activeProgramCount} recruiting programs`}>
                        {market.tier === 'forming'
                          ? 'Forming'
                          : market.tier[0]!.toUpperCase() + market.tier.slice(1)}
                      </span>
                    </td>
                    <td>
                      {status === 'committed' || status === 'committed-elsewhere'
                        ? '-'
                        : market.isForming ? '—' : deriveRecruitActiveOfferCount(recruiting, recruit.player.id)}
                    </td>
                    <td className="recruiting-status-cell">
                      {formatRecruitStatusLabel({
                        status,
                        isOnBoard,
                        hasActiveOffer: boardTarget?.hasActiveOffer ?? false,
                        committedProgramName,
                      })}
                    </td>
                    <td>
                      {status !== 'active' || isOnBoard ? null : boardIsFull ? (
                        <button
                          type="button"
                          className="button button--ghost recruiting-action-button"
                          disabled
                        >
                          Board Full
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button button--primary recruiting-action-button"
                          onClick={() => onAddToBoard(recruit.player.id)}
                        >
                          Add to Board
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
