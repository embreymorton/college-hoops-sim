import type { PlayerRecruitingOrigin as PlayerRecruitingOriginFacts } from '../dynasty'
import type { ProgramDefinition } from '../universe'
import { RecruitStars } from './RecruitStars'

interface PlayerRecruitingOriginProps {
  readonly origin: PlayerRecruitingOriginFacts
  readonly committedProgram: ProgramDefinition | null
}

/** Compact, canonical Recruiting-origin facts — omitted entirely when none exist. */
export function PlayerRecruitingOrigin({
  origin,
  committedProgram,
}: PlayerRecruitingOriginProps) {
  return (
    <div className="player-recruiting-origin">
      <RecruitStars stars={origin.stars} />
      <span className="player-recruiting-origin__item">
        #{origin.nationalRank} national
      </span>
      <span className="player-recruiting-origin__item">
        #{origin.positionRank} position
      </span>
      <span className="player-recruiting-origin__item">
        {origin.entryOverall} OVR / {origin.entryPotential} POT entering
      </span>
      {committedProgram ? (
        <span className="player-recruiting-origin__item">
          Signed with {committedProgram.name}
        </span>
      ) : null}
    </div>
  )
}
