import type { NationalLeaderboards, SeasonState } from '../season'
import type { ProgramDefinition } from '../universe'
import { LeaderBoard } from './LeaderBoard'

interface NationalLeadersSectionProps {
  readonly leaderboards: NationalLeaderboards
  readonly season: SeasonState
  readonly programsById: ReadonlyMap<string, ProgramDefinition>
  readonly onSelectPlayer: (programId: string, playerId: string) => void
}

const CATEGORY_PANELS = [
  { category: 'points', title: 'Scoring', unitLabel: 'PPG' },
  { category: 'rebounds', title: 'Rebounding', unitLabel: 'RPG' },
  { category: 'assists', title: 'Assists', unitLabel: 'APG' },
  { category: 'steals', title: 'Steals', unitLabel: 'SPG' },
  { category: 'blocks', title: 'Blocks', unitLabel: 'BPG' },
] as const

/** National statistical leaders across all five V0 counting-stat categories. */
export function NationalLeadersSection({
  leaderboards,
  season,
  programsById,
  onSelectPlayer,
}: NationalLeadersSectionProps) {
  const hasAnyLeaders = CATEGORY_PANELS.some(
    ({ category }) => leaderboards[category].length > 0,
  )

  if (!hasAnyLeaders) {
    return (
      <p className="league-empty-state">
        No completed games yet. Check back after the first round of Season
        play to see who&rsquo;s leading the country.
      </p>
    )
  }

  return (
    <div className="leaders-grid">
      {CATEGORY_PANELS.map(({ category, title, unitLabel }) => (
        <LeaderBoard
          key={category}
          title={title}
          unitLabel={unitLabel}
          entries={leaderboards[category]}
          season={season}
          programsById={programsById}
          onSelectPlayer={onSelectPlayer}
        />
      ))}
    </div>
  )
}
