import { useEffect, useRef } from 'react'
import type { OffseasonStageId, OffseasonStageView } from '../app/offseasonExperience'

interface OffseasonTimelineProps {
  readonly stages: readonly OffseasonStageView[]
  readonly onSelectStage: (stage: OffseasonStageId) => void
}

export function OffseasonTimeline({ stages, onSelectStage }: OffseasonTimelineProps) {
  const viewedRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    viewedRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [stages])

  return (
    <nav className="offseason-timeline" aria-label="Offseason timeline">
      <ol className="offseason-timeline__list">
        {stages.map((stage, index) => {
          const isReviewing = stage.isViewed && !stage.isFurthestUnlocked
          const statusLabel = isReviewing
            ? 'reviewing completed stage'
            : stage.status === 'completed'
              ? 'completed'
              : stage.status === 'active'
                ? 'current stage'
                : 'locked'
          const displayLabel = isReviewing
            ? 'Reviewing'
            : stage.status === 'completed'
              ? 'Complete'
              : stage.status === 'active'
                ? 'Current'
                : 'Locked'
          return (
            <li key={stage.id} className="offseason-timeline__item">
              <button
                ref={stage.isViewed ? viewedRef : undefined}
                type="button"
                className="offseason-timeline__button"
                data-status={stage.status}
                data-reviewing={isReviewing}
                disabled={!stage.isInteractive}
                aria-current={stage.isViewed ? 'step' : undefined}
                aria-label={`${stage.label}, ${statusLabel}`}
                onClick={() => onSelectStage(stage.id)}
              >
                <span className="offseason-timeline__marker" aria-hidden="true">
                  {stage.status === 'completed' ? '✓' : index + 1}
                </span>
                <span className="offseason-timeline__label">{stage.label}</span>
                <small>{displayLabel}</small>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
