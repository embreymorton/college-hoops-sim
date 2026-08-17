import type { CSSProperties } from 'react'
import {
  calculateOverall,
  getEligibleRotationPositions,
  MAX_PLAYER_MINUTES,
  TOTAL_ROTATION_MINUTES,
  type Player,
  type ProjectedStartingFive,
  type SimpleRotationIntentIssue,
  type Team,
} from '../engine'
import {
  deriveSimpleRotationSections,
  describeMinutesBudgetHint,
  describeSimpleRotationIssues,
  type SimpleRotationStarter,
} from '../app/formatters'
import { MinuteStepper } from './MinuteStepper'
import { TeamPanelHeader } from './TeamPanelHeader'
import type { BrandingSource } from './branding'

interface SimpleRotationPanelProps {
  readonly team: Team
  readonly program: BrandingSource
  /** UI-only aggregate MPG draft, including explicit zeroes for Reserves. */
  readonly minutesByPlayerId: Readonly<Record<string, number>>
  /** Player MPG values currently held exact by Fill Remaining. */
  readonly preservedPlayerIds?: readonly string[]
  /** Aggregate MPG from the currently committed canonical Rotation, for the Discard/unsaved state. */
  readonly committedMinutesByPlayerId: Readonly<Record<string, number>>
  /**
   * Projected PG/SG/SF/PF/C lineup from the last committed canonical
   * Rotation, or null when no projection is available (invalid/incomplete
   * committed Rotation). Deliberately independent of the current draft —
   * see `deriveSimpleRotationSections`.
   */
  readonly projectedStartingFive: ProjectedStartingFive | null
  readonly issues: readonly SimpleRotationIntentIssue[]
  readonly onSetPlayerMinutes: (playerId: string, minutes: number) => void
  readonly onFill?: () => void
  readonly onApply: () => void
  readonly onDiscard: () => void
  readonly onSelectPlayer: (playerId: string) => void
  readonly headingId: string
}

/**
 * The default Coaching Rotation experience: one row per roster Player, one
 * total-MPG control each, grouped into Rotation Players and Reserves purely
 * by whether the current draft assigns positive minutes. Compiles through
 * the existing `compileSimpleRotationIntent()` / Coaching Simple state
 * contract on Apply — this component makes no legality decision itself.
 */
export function SimpleRotationPanel({
  team,
  program,
  minutesByPlayerId,
  preservedPlayerIds = [],
  committedMinutesByPlayerId,
  projectedStartingFive,
  issues,
  onSetPlayerMinutes,
  onFill = () => {},
  onApply,
  onDiscard,
  onSelectPlayer,
  headingId,
}: SimpleRotationPanelProps) {
  const accentStyle = {
    '--team-accent': program.primaryColor,
  } as CSSProperties

  const totalMinutes = team.roster.reduce(
    (total, player) => total + (minutesByPlayerId[player.id] ?? 0),
    0,
  )
  const isReady = totalMinutes === TOTAL_ROTATION_MINUTES
  const budgetHint = describeMinutesBudgetHint(totalMinutes, TOTAL_ROTATION_MINUTES)
  const isChanged = team.roster.some(
    (player) =>
      (minutesByPlayerId[player.id] ?? 0) !==
      (committedMinutesByPlayerId[player.id] ?? 0),
  )
  const issueMessages = describeSimpleRotationIssues(issues)
  const preservedPlayerIdSet = new Set(preservedPlayerIds)

  const { starters, bench, reserves, hasProjectedStartingFive } =
    deriveSimpleRotationSections(team, minutesByPlayerId, projectedStartingFive)

  return (
    <div className="team-panel simple-rotation-panel" style={accentStyle}>
      <TeamPanelHeader team={team} headingId={headingId} />
      <div className="rotation-toolbar">
        <div className="simple-rotation-budget-group">
          <div
            className="rotation-budget"
            data-status={isReady ? 'valid' : 'invalid'}
          >
            <span className="rotation-budget__value">{totalMinutes}</span>
            <span className="rotation-budget__slash">/</span>
            <span className="rotation-budget__value rotation-budget__value--target">
              {TOTAL_ROTATION_MINUTES}
            </span>
            <span className="rotation-budget__label">Minutes</span>
          </div>
          <p className="section-hint" role="status">
            {budgetHint ?? (isChanged ? 'Ready to apply.' : 'Up to date.')}
          </p>
        </div>
        <div className="simple-rotation-actions">
          <button
            type="button"
            className="button button--assistant"
            onClick={onFill}
            title="Keep every MPG value you edited and complete the rest of the Rotation"
          >
            <span className="button__icon" aria-hidden="true">✦</span>
            Fill Remaining
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={onDiscard}
            disabled={!isChanged}
          >
            Discard Changes
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onApply}
            disabled={!isReady}
          >
            Apply Rotation
          </button>
        </div>
      </div>
      <p className="section-hint simple-rotation-fill-hint">
        Edited MPG stays locked during Fill Remaining. Your Rotation changes
        only when you Apply.
      </p>

      {issueMessages.length > 0 && (
        <div className="simple-rotation-issues" role="status">
          {issueMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      <div className="table-scroll">
        <table className="data-table simple-rotation-table">
          <caption className="visually-hidden">
            {`${team.name} Simple Rotation editor — assign each Player's total minutes per game`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Pos</th>
              <th scope="col">Yr</th>
              <th scope="col">Ovr</th>
              <th scope="col">Minutes</th>
            </tr>
          </thead>
          {hasProjectedStartingFive && (
            <StartingFiveGroup
              starters={starters}
              minutesByPlayerId={minutesByPlayerId}
              preservedPlayerIdSet={preservedPlayerIdSet}
              onSetPlayerMinutes={onSetPlayerMinutes}
              onSelectPlayer={onSelectPlayer}
            />
          )}
          <SimpleRotationGroup
            label={hasProjectedStartingFive ? 'Bench' : 'Rotation Players'}
            players={bench}
            minutesByPlayerId={minutesByPlayerId}
            preservedPlayerIdSet={preservedPlayerIdSet}
            onSetPlayerMinutes={onSetPlayerMinutes}
            onSelectPlayer={onSelectPlayer}
            emptyMessage={
              hasProjectedStartingFive
                ? 'No Players are on the bench right now.'
                : 'No Players currently have minutes assigned.'
            }
          />
          <SimpleRotationGroup
            label="Reserves"
            players={reserves}
            minutesByPlayerId={minutesByPlayerId}
            preservedPlayerIdSet={preservedPlayerIdSet}
            onSetPlayerMinutes={onSetPlayerMinutes}
            onSelectPlayer={onSelectPlayer}
            emptyMessage="Every roster Player is currently in the rotation."
          />
        </table>
      </div>
    </div>
  )
}

interface SimpleRotationGroupProps {
  readonly label: string
  readonly players: readonly Player[]
  readonly minutesByPlayerId: Readonly<Record<string, number>>
  readonly preservedPlayerIdSet: ReadonlySet<string>
  readonly onSetPlayerMinutes: (playerId: string, minutes: number) => void
  readonly onSelectPlayer: (playerId: string) => void
  readonly emptyMessage: string
}

function SimpleRotationGroup({
  label,
  players,
  minutesByPlayerId,
  preservedPlayerIdSet,
  onSetPlayerMinutes,
  onSelectPlayer,
  emptyMessage,
}: SimpleRotationGroupProps) {
  return (
    <tbody>
      <tr className="rotation-group-row">
        <th scope="colgroup" colSpan={5}>
          <div className="rotation-group-row__inner">
            <span className="rotation-group-row__position">{label}</span>
            <span className="rotation-group-row__total">{players.length}</span>
          </div>
        </th>
      </tr>
      {players.length === 0 && (
        <tr>
          <td colSpan={5} className="simple-rotation-empty">
            {emptyMessage}
          </td>
        </tr>
      )}
      {players.map((player) => {
        const minutes = minutesByPlayerId[player.id] ?? 0
        const playerLabel = `${player.firstName} ${player.lastName}`
        const eligibility = getEligibleRotationPositions(player).join('/')

        return (
          <tr
            key={player.id}
            data-player-id={player.id}
            data-zero-minutes={minutes === 0}
            data-preserved={preservedPlayerIdSet.has(player.id)}
          >
            <td className="player-name-cell">
              <button
                type="button"
                className="text-link-button"
                onClick={() => onSelectPlayer(player.id)}
              >
                {playerLabel}
              </button>
            </td>
            <td className="player-pos-cell">{eligibility}</td>
            <td>{player.classYear}</td>
            <td>{calculateOverall(player)}</td>
            <td className="rotation-minutes-cell">
              <SimpleMinutesControl
                player={player}
                minutes={minutes}
                preserved={preservedPlayerIdSet.has(player.id)}
                onSetPlayerMinutes={onSetPlayerMinutes}
              />
            </td>
          </tr>
        )
      })}
    </tbody>
  )
}

interface StartingFiveGroupProps {
  readonly starters: readonly SimpleRotationStarter[]
  readonly minutesByPlayerId: Readonly<Record<string, number>>
  readonly preservedPlayerIdSet: ReadonlySet<string>
  readonly onSetPlayerMinutes: (playerId: string, minutes: number) => void
  readonly onSelectPlayer: (playerId: string) => void
}

/**
 * PG → C, one row per projected starter. Minutes always reflect the current
 * (possibly uncommitted) Simple draft; which five Players appear here does
 * not change until a successful Apply — see `deriveSimpleRotationSections`.
 */
function StartingFiveGroup({
  starters,
  minutesByPlayerId,
  preservedPlayerIdSet,
  onSetPlayerMinutes,
  onSelectPlayer,
}: StartingFiveGroupProps) {
  return (
    <tbody className="simple-rotation-starters">
      <tr className="rotation-group-row rotation-group-row--starters">
        <th scope="colgroup" colSpan={5}>
          <div className="rotation-group-row__inner">
            <span className="rotation-group-row__position">Starting Five</span>
            <span className="rotation-group-row__total">{starters.length}</span>
            <span className="rotation-group-row__note">
              Updates when Rotation is applied
            </span>
          </div>
        </th>
      </tr>
      {starters.map(({ position, player }) => {
        const minutes = minutesByPlayerId[player.id] ?? 0
        const playerLabel = `${player.firstName} ${player.lastName}`

        return (
          <tr
            key={player.id}
            data-player-id={player.id}
            data-zero-minutes={minutes === 0}
            data-preserved={preservedPlayerIdSet.has(player.id)}
            className="simple-rotation-starter-row"
          >
            <td className="player-name-cell">
              <button
                type="button"
                className="text-link-button"
                onClick={() => onSelectPlayer(player.id)}
              >
                {playerLabel}
              </button>
            </td>
            <td className="player-pos-cell player-pos-cell--starter">
              {position}
            </td>
            <td>{player.classYear}</td>
            <td>{calculateOverall(player)}</td>
            <td className="rotation-minutes-cell">
              <SimpleMinutesControl
                player={player}
                minutes={minutes}
                preserved={preservedPlayerIdSet.has(player.id)}
                onSetPlayerMinutes={onSetPlayerMinutes}
              />
            </td>
          </tr>
        )
      })}
    </tbody>
  )
}

interface SimpleMinutesControlProps {
  readonly player: Player
  readonly minutes: number
  readonly preserved: boolean
  readonly onSetPlayerMinutes: (playerId: string, minutes: number) => void
}

function SimpleMinutesControl({
  player,
  minutes,
  preserved,
  onSetPlayerMinutes,
}: SimpleMinutesControlProps) {
  const playerLabel = `${player.firstName} ${player.lastName}`

  return (
    <div className="simple-minutes-control" data-preserved={preserved}>
      {preserved && (
        <span className="simple-minutes-control__preserved" title="Fill Remaining will keep this MPG value exact">
          <svg
            className="simple-minutes-control__lock"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2h.5a1 1 0 0 1 1 1v6H3V8a1 1 0 0 1 1-1h.5Zm1.5 0h4V5a2 2 0 1 0-4 0v2Z" />
          </svg>
          Locked
        </span>
      )}
      <MinuteStepper
        id={`simple-minutes-${player.id}`}
        value={minutes}
        label={`${playerLabel} minutes`}
        onChange={(nextMinutes) =>
          onSetPlayerMinutes(
            player.id,
            Math.min(MAX_PLAYER_MINUTES, nextMinutes),
          )
        }
      />
    </div>
  )
}
