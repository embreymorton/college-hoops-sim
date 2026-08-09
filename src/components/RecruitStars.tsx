import type { RecruitStarRating } from '../dynasty'

interface RecruitStarsProps {
  readonly stars: RecruitStarRating
}

/** Compact star tier — glyph count carries the tier, never color alone. */
export function RecruitStars({ stars }: RecruitStarsProps) {
  return (
    <span className="recruit-stars" aria-label={`${stars}-star recruit`}>
      <span aria-hidden="true">{'★'.repeat(stars)}</span>
      <span aria-hidden="true" className="recruit-stars__empty">
        {'★'.repeat(5 - stars)}
      </span>
    </span>
  )
}
