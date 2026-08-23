import type { CSSProperties } from 'react'
import {
  calculateOverall,
  derivePlayerMinutesV1,
  deriveProjectedStartingFive,
  POSITIONS,
  type Player,
  type RotationV1,
  type Team,
} from '../engine'
import { TeamPanelHeader } from './TeamPanelHeader'
import type { BrandingSource } from './branding'

interface OpponentRotationPanelProps {
  readonly team: Team
  readonly rotation: RotationV1
  readonly program: BrandingSource
  readonly headingId: string
  readonly onSelectPlayer: (playerId: string) => void
  readonly onViewFullRoster: () => void
}

export function OpponentRotationPanel({
  team,
  rotation,
  program,
  headingId,
  onSelectPlayer,
  onViewFullRoster,
}: OpponentRotationPanelProps) {
  const minutesByPlayerId = derivePlayerMinutesV1(rotation)
  const playersById = new Map(team.roster.map((player) => [player.id, player]))
  const projection = deriveProjectedStartingFive(team, rotation)
  const starters = projection.valid
    ? POSITIONS.map((position) => ({
        role: position,
        player: playersById.get(projection.startingFive[position])!,
      }))
    : []
  const starterIds = new Set(starters.map(({ player }) => player.id))
  const bench = team.roster
    .filter(
      (player) =>
        !starterIds.has(player.id) && (minutesByPlayerId[player.id] ?? 0) > 0,
    )
    .sort(
      (first, second) =>
        (minutesByPlayerId[second.id] ?? 0) -
          (minutesByPlayerId[first.id] ?? 0) ||
        calculateOverall(second) - calculateOverall(first) ||
        first.id.localeCompare(second.id),
    )
  const reserveCount = team.roster.filter(
    (player) => (minutesByPlayerId[player.id] ?? 0) === 0,
  ).length
  const accentStyle = {
    '--team-accent': program.primaryColor,
  } as CSSProperties

  return (
    <div className="team-panel opponent-rotation-panel" style={accentStyle}>
      <TeamPanelHeader team={team} headingId={headingId} />
      <RotationGroup
        heading="Expected Starting Five"
        rows={starters}
        minutesByPlayerId={minutesByPlayerId}
        onSelectPlayer={onSelectPlayer}
      />
      <RotationGroup
        heading="Bench"
        rows={bench.map((player) => ({ role: player.position, player }))}
        minutesByPlayerId={minutesByPlayerId}
        onSelectPlayer={onSelectPlayer}
      />
      <div className="opponent-rotation-panel__footer">
        {reserveCount > 0 && (
          <p className="section-hint">
            {reserveCount} reserve{reserveCount === 1 ? '' : 's'} outside the current Rotation
          </p>
        )}
        <button type="button" className="button button--ghost" onClick={onViewFullRoster}>
          View Full Roster
        </button>
      </div>
    </div>
  )
}

function RotationGroup({
  heading,
  rows,
  minutesByPlayerId,
  onSelectPlayer,
}: {
  readonly heading: string
  readonly rows: readonly { readonly role: string; readonly player: Player }[]
  readonly minutesByPlayerId: Readonly<Record<string, number>>
  readonly onSelectPlayer: (playerId: string) => void
}) {
  return (
    <section className="opponent-rotation-group" aria-label={heading}>
      <h4 className="opponent-rotation-group__heading">{heading}</h4>
      <div className="opponent-rotation-list" role="list">
        {rows.map(({ role, player }) => (
          <div className="opponent-rotation-row" role="listitem" key={player.id}>
            <span className="opponent-rotation-row__role">{role}</span>
            <button
              type="button"
              className="text-link-button opponent-rotation-row__name"
              onClick={() => onSelectPlayer(player.id)}
            >
              {player.firstName} {player.lastName}
            </button>
            <span className="opponent-rotation-row__class">{player.classYear}</span>
            <span className="opponent-rotation-row__metric">
              <span className="opponent-rotation-row__metric-label">OVR</span>{' '}
              {calculateOverall(player)}
            </span>
            <span className="opponent-rotation-row__metric">
              <span className="opponent-rotation-row__metric-label">MIN</span>{' '}
              {minutesByPlayerId[player.id] ?? 0}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
