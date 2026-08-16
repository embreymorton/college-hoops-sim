import {
  formatControlledPositionLabel,
  formatReadinessLabel,
} from '../app/recruitingBattleFormatters'
import type { FollowingRecruitsView } from '../dynasty'
import type { ProgramDefinition } from '../universe'
import { FollowRecruitButton } from './FollowRecruitButton'
import { RecruitStars } from './RecruitStars'

interface FollowingRecruitsSectionProps {
  readonly projection: FollowingRecruitsView
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly controlledProgramId: string
  readonly onSelectRecruit: (playerId: string) => void
}

/** Recruiting → Following: the current-class sibling of League → Following. */
export function FollowingRecruitsSection({
  projection,
  programsById,
  controlledProgramId,
  onSelectRecruit,
}: FollowingRecruitsSectionProps) {
  const { totalFollowed, recruits, unresolvedRecruitIds } = projection

  if (totalFollowed === 0) {
    return (
      <p className="league-empty-state">
        You haven&rsquo;t followed any Recruits yet. Follow a Recruit from his
        Recruit Details page to track him here.
      </p>
    )
  }

  if (recruits.length === 0) {
    return (
      <p className="league-empty-state">
        {unresolvedRecruitIds.length === 1
          ? 'That followed Recruit is unavailable in the current recruiting class.'
          : 'Those followed Recruits are unavailable in the current recruiting class.'}
      </p>
    )
  }

  return (
    <div className="following-groups">
      <section aria-labelledby="following-recruits-heading">
        <h2 id="following-recruits-heading" className="section-title">
          Followed Recruits
        </h2>
        <div className="table-scroll">
          <table className="data-table data-table--recruit-following">
            <caption className="visually-hidden">Followed current-class Recruits</caption>
            <thead>
              <tr>
                <th scope="col">Recruit</th>
                <th scope="col">Rank</th>
                <th scope="col">Pos</th>
                <th scope="col">Ovr</th>
                <th scope="col">Pot</th>
                <th scope="col">Readiness</th>
                <th scope="col">Status</th>
                <th scope="col">Follow</th>
              </tr>
            </thead>
            <tbody>
              {recruits.map((recruit) => {
                const fullName = `${recruit.firstName} ${recruit.lastName}`
                const commitment = recruit.battle.commitment
                const status = commitment
                  ? commitment.programId === controlledProgramId
                    ? 'Committed to Us'
                    : `Committed — ${programsById.get(commitment.programId)?.name ?? commitment.programId}`
                  : formatControlledPositionLabel(recruit.battle.controlled.position)

                return (
                  <tr key={recruit.playerId}>
                    <td className="player-name-cell recruit-following-identity">
                      <button
                        type="button"
                        className="text-link-button"
                        onClick={() => onSelectRecruit(recruit.playerId)}
                      >
                        {fullName}
                      </button>
                      <RecruitStars stars={recruit.stars} />
                    </td>
                    <td>#{recruit.nationalRank}</td>
                    <td className="player-pos-cell">{recruit.position}</td>
                    <td>{recruit.overall}</td>
                    <td>{recruit.potential}</td>
                    <td>{commitment ? '—' : formatReadinessLabel(recruit.battle.readiness)}</td>
                    <td className="recruit-following-status">{status}</td>
                    <td>
                      <FollowRecruitButton
                        playerId={recruit.playerId}
                        ariaLabel={`Unfollow ${fullName}`}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      {unresolvedRecruitIds.length > 0 ? (
        <p className="following-unresolved-note">
          {unresolvedRecruitIds.length} followed Recruit
          {unresolvedRecruitIds.length === 1 ? ' is' : 's are'} unavailable in
          the current recruiting class.
        </p>
      ) : null}
    </div>
  )
}
