import type { Player, PlayerAttributes } from '../engine'

interface RatingField {
  readonly key: keyof PlayerAttributes
  readonly label: string
}

const RATING_FIELDS: readonly RatingField[] = [
  { key: 'finishing', label: 'Finishing' },
  { key: 'shooting', label: 'Shooting' },
  { key: 'playmaking', label: 'Playmaking' },
  { key: 'ballHandling', label: 'Ball Handling' },
  { key: 'perimeterDefense', label: 'Perimeter Def' },
  { key: 'interiorDefense', label: 'Interior Def' },
  { key: 'rebounding', label: 'Rebounding' },
  { key: 'athleticism', label: 'Athleticism' },
  { key: 'stamina', label: 'Stamina' },
]

interface PlayerRatingsGridProps {
  readonly player: Player
}

/** The nine canonical current-ability ratings, compact and readable — never one card each. */
export function PlayerRatingsGrid({ player }: PlayerRatingsGridProps) {
  return (
    <dl className="player-ratings-grid">
      {RATING_FIELDS.map(({ key, label }) => (
        <div className="player-ratings-grid__item" key={key}>
          <dt className="player-ratings-grid__label">{label}</dt>
          <dd className="player-ratings-grid__value">{player.attributes[key]}</dd>
        </div>
      ))}
    </dl>
  )
}
