import { useDynastyStore } from '../store'

/**
 * Intentional temporary boundary screen for Phase 6C. It exposes lifecycle
 * commands without pre-empting the dedicated Late Recruiting/Offseason UX.
 */
export function LifecycleTransitionScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const actionError = useDynastyStore((state) => state.recruitingActionError)
  const beginDynastyOffseason = useDynastyStore(
    (state) => state.beginDynastyOffseason,
  )
  const beginNextSeason = useDynastyStore((state) => state.beginNextSeason)

  if (!dynasty) return null

  const isOffseason = dynasty.offseason !== null
  const targetSeasonNumber = isOffseason
    ? dynasty.offseason!.targetSeasonNumber
    : dynasty.recruiting?.targetSeasonNumber

  return (
    <section className="section season-complete-panel" aria-labelledby="lifecycle-heading">
      <p className="eyebrow-tag">Dynasty Transition</p>
      <h2 id="lifecycle-heading" className="section-title">
        {isOffseason ? 'Offseason Prepared' : 'Recruiting Finalized'}
      </h2>
      <p className="season-complete-panel__body">
        {isOffseason
          ? `Season ${targetSeasonNumber} is ready to begin when you are.`
          : `The incoming class for Season ${targetSeasonNumber} is complete.`}
      </p>
      {actionError && <p className="recruiting-action-error" role="alert">{actionError}</p>}
      <button
        type="button"
        className="button button--primary"
        onClick={isOffseason ? beginNextSeason : beginDynastyOffseason}
      >
        {isOffseason ? 'Begin Next Season' : 'Begin Offseason'}
      </button>
    </section>
  )
}
