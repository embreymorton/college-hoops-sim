interface SeasonPreviewPromotionProps {
  readonly seasonNumber: number
  readonly onOpen: () => void
}

/** Early-season doorway to the national cast for the new Season. */
export function SeasonPreviewPromotion({ seasonNumber, onOpen }: SeasonPreviewPromotionProps) {
  return (
    <section className="section season-preview-promotion" aria-labelledby="season-preview-promotion-title">
      <div>
        <p className="eyebrow-tag">Season {seasonNumber}</p>
        <h2 id="season-preview-promotion-title" className="section-title">Meet this season’s national cast</h2>
        <p className="section-hint">Returning stars, breakout players, and freshmen arriving across the country.</p>
      </div>
      <button type="button" className="button" onClick={onOpen}>View Season Preview</button>
    </section>
  )
}
