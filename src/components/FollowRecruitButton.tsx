import { useDynastyStore } from '../store'

interface FollowRecruitButtonProps {
  readonly playerId: string
  readonly ariaLabel?: string
}

/** Compact Recruit Follow toggle, matching the accepted Player Details control. */
export function FollowRecruitButton({
  playerId,
  ariaLabel,
}: FollowRecruitButtonProps) {
  const isFollowed = useDynastyStore((state) =>
    state.isRecruitFollowed(playerId),
  )
  const followRecruit = useDynastyStore((state) => state.followRecruit)
  const unfollowRecruit = useDynastyStore((state) => state.unfollowRecruit)

  return (
    <button
      type="button"
      className="button button--ghost follow-player-button"
      aria-label={ariaLabel}
      aria-pressed={isFollowed}
      onClick={() =>
        isFollowed ? unfollowRecruit(playerId) : followRecruit(playerId)
      }
    >
      {isFollowed ? 'Following' : 'Follow'}
    </button>
  )
}
