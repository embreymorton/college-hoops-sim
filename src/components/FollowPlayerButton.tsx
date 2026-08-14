import { useDynastyStore } from '../store'

interface FollowPlayerButtonProps {
  readonly playerId: string
}

/** Compact Follow/Following toggle for Player Details, backed by canonical 7A.1 follow state. */
export function FollowPlayerButton({ playerId }: FollowPlayerButtonProps) {
  const isFollowed = useDynastyStore((state) =>
    state.isPlayerFollowed(playerId),
  )
  const followPlayer = useDynastyStore((state) => state.followPlayer)
  const unfollowPlayer = useDynastyStore((state) => state.unfollowPlayer)

  return (
    <button
      type="button"
      className="button button--ghost follow-player-button"
      aria-pressed={isFollowed}
      onClick={() =>
        isFollowed ? unfollowPlayer(playerId) : followPlayer(playerId)
      }
    >
      {isFollowed ? 'Following' : 'Follow'}
    </button>
  )
}
