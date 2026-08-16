import type { DynastyState } from '../domain'
import {
  deriveRecruitDetailsView,
  type RecruitDetailsView,
} from './detailsView'
import { getRecruit } from './queries'

export interface FollowingRecruitsView {
  readonly totalFollowed: number
  readonly recruits: readonly RecruitDetailsView[]
  readonly unresolvedRecruitIds: readonly string[]
}

/**
 * Resolves stable Recruit-follow intent against only the active Recruiting
 * class. Duplicate IDs collapse at their first position; stale IDs remain
 * explicit without fabricating Recruit rows.
 */
export function deriveFollowingRecruitsView(
  dynasty: DynastyState,
  followedRecruitIds: readonly string[],
): FollowingRecruitsView {
  const uniqueIds = [...new Set(followedRecruitIds)]
  const recruiting = dynasty.recruiting
  if (!recruiting) {
    return {
      totalFollowed: uniqueIds.length,
      recruits: [],
      unresolvedRecruitIds: uniqueIds,
    }
  }

  const recruits: RecruitDetailsView[] = []
  const unresolvedRecruitIds: string[] = []

  for (const playerId of uniqueIds) {
    if (!getRecruit(recruiting, playerId)) {
      unresolvedRecruitIds.push(playerId)
      continue
    }
    recruits.push(deriveRecruitDetailsView(dynasty, playerId))
  }

  return {
    totalFollowed: uniqueIds.length,
    recruits,
    unresolvedRecruitIds,
  }
}
