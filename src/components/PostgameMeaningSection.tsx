import type {
  PostgameMeaning,
  PostgameMeaningFact,
  PostgameRecordScope,
  PostgameRecordValue,
} from '../dynasty'
import type { TournamentRound } from '../postseason'

interface PostgameMeaningSectionProps {
  readonly meaning: PostgameMeaning
  readonly onSelectPlayer?: (programId: string, playerId: string) => void
}

const CATEGORY_LABELS: Readonly<Record<PostgameRecordValue['category'], string>> = {
  points: 'points',
  rebounds: 'rebounds',
  assists: 'assists',
  steals: 'steals',
  blocks: 'blocks',
}

const RECORD_SCOPE_LABELS: Readonly<Record<PostgameRecordScope, string>> = {
  'dynasty-single-game': 'Dynasty Record',
  'program-single-game': 'Program Record',
  'tournament-single-game': 'Tournament Record',
  'tournament-run': 'Tournament Run Record',
  'tournament-career': 'Tournament Career Record',
}

const ROUND_LABELS: Readonly<Record<TournamentRound, string>> = {
  'round-of-16': 'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals: 'Semifinals',
  championship: 'National Championship',
}

function playerName(fact: Extract<PostgameMeaningFact, { player: unknown }>) {
  return `${fact.player.firstName} ${fact.player.lastName}`
}

function PlayerName({
  fact,
  onSelectPlayer,
}: {
  readonly fact: Extract<PostgameMeaningFact, { player: unknown }>
  readonly onSelectPlayer?: PostgameMeaningSectionProps['onSelectPlayer']
}) {
  if (!onSelectPlayer) return playerName(fact)
  return (
    <button
      type="button"
      className="text-link-button postgame-meaning__player-link"
      onClick={() => onSelectPlayer(fact.player.program.programId, fact.player.playerId)}
    >
      {playerName(fact)}
    </button>
  )
}

function recordValues(records: readonly PostgameRecordValue[]): string {
  return records
    .map(({ category, value }) => `${value} ${CATEGORY_LABELS[category]}`)
    .join(' and ')
}

type FactTier = 'headline' | 'notable' | 'quiet'

/** Presentation-only grouping over the already-ranked facts: the routine
 * "record improves to X-Y" fact stays quiet, a National Championship carries
 * the most visual weight, everything else (records, career highs, streaks,
 * advancement/elimination, upsets) reads as a notable but even-weighted
 * consequence. */
function factTier(fact: PostgameMeaningFact): FactTier {
  if (fact.kind === 'program-records') return 'quiet'
  if (fact.kind === 'competitive-outcome' && fact.outcome === 'championship') return 'headline'
  return 'notable'
}

function factLabel(fact: PostgameMeaningFact): string {
  switch (fact.kind) {
    case 'competitive-outcome':
      return fact.outcome === 'championship' ? 'Championship' : 'Tournament'
    case 'statistical-record':
      return RECORD_SCOPE_LABELS[fact.scope]
    case 'career-high':
      return fact.competition === 'tournament' ? 'Tournament Career High' : 'Career High'
    case 'tournament-upset':
      return 'Tournament Upset'
    case 'streak':
      return 'Streak'
    case 'program-records':
      return 'Updated Records'
  }
}

function FactText({
  fact,
  historical,
  onSelectPlayer,
}: {
  readonly fact: PostgameMeaningFact
  readonly historical: boolean
  readonly onSelectPlayer?: PostgameMeaningSectionProps['onSelectPlayer']
}) {
  switch (fact.kind) {
    case 'competitive-outcome':
      if (fact.outcome === 'championship') {
        return <>{fact.winner.name} {historical ? 'became' : 'is'} National Champion; {fact.loser.name} {historical ? 'finished' : 'finishes'} as National Runner-Up.</>
      }
      return <>{fact.winner.name} {historical ? 'advanced' : 'advances'} to the {ROUND_LABELS[fact.nextRound!]}; {fact.loser.name} {historical ? 'was eliminated' : 'is eliminated'}.</>
    case 'statistical-record':
      return <><PlayerName fact={fact} onSelectPlayer={onSelectPlayer} /> {historical ? 'set' : 'sets'} a {RECORD_SCOPE_LABELS[fact.scope].toLowerCase()} with {recordValues(fact.records)}.</>
    case 'career-high':
      return <><PlayerName fact={fact} onSelectPlayer={onSelectPlayer} /> {historical ? 'set' : 'sets'} {fact.competition === 'tournament' ? 'a Tournament' : 'a'} career high with {recordValues(fact.records)}.</>
    case 'tournament-upset':
      return <>No. {fact.winnerSeed} {fact.winner.name} {historical ? 'eliminated' : 'eliminates'} No. {fact.loserSeed} {fact.loser.name}.</>
    case 'streak':
      return fact.streak === 'ten-wins'
        ? <>{fact.program.name} {historical ? 'reached' : 'reaches'} 10 consecutive wins.</>
        : <>{fact.opponent.name} {historical ? 'ended' : 'ends'} {fact.program.name}&apos;s {fact.wins}-game undefeated run.</>
    case 'program-records': {
      const describe = (program: typeof fact.first) =>
        `${program.name} ${program.overall.wins}-${program.overall.losses}${program.conference ? ` (${program.conference.wins}-${program.conference.losses} conference)` : ''}`
      return <>{historical ? 'After the game: ' : ''}{describe(fact.first)}; {describe(fact.second)}.</>
    }
  }
}

/** Minimal shared presentation for the already-ranked pure consequence projection. */
export function PostgameMeaningSection({ meaning, onSelectPlayer }: PostgameMeaningSectionProps) {
  if (meaning.facts.length === 0) return null
  const historical = meaning.presentation === 'historical'
  const tiers = meaning.facts.map(factTier)
  const isCompact = tiers.length === 1 && tiers[0] === 'quiet'
  return (
    <section
      className={`section postgame-meaning${isCompact ? ' postgame-meaning--compact' : ''}`}
      aria-labelledby="postgame-meaning-heading"
    >
      <div className="section-heading">
        <h2 id="postgame-meaning-heading" className="section-title">What Changed</h2>
      </div>
      <ul className="postgame-meaning__list">
        {meaning.facts.map((fact, index) => (
          <li
            className={`postgame-meaning__fact postgame-meaning__fact--${tiers[index]}`}
            key={`${fact.kind}:${index}`}
          >
            <span className="postgame-meaning__label">{factLabel(fact)}</span>
            <p><FactText fact={fact} historical={historical} onSelectPlayer={onSelectPlayer} /></p>
          </li>
        ))}
      </ul>
    </section>
  )
}
