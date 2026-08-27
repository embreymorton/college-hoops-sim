import { useState, type CSSProperties } from 'react'
import {
  AwardsHonors,
  ExplorationBackButton,
  TournamentBracket,
  type BracketSlot,
} from '../components'
import {
  deriveCompletedSeasonYearbook,
  deriveCompletedSeasonHonors,
  deriveTournamentMopSummaryFromSources,
  type CompletedSeasonYearbook,
  type HistoricalConferenceStandings,
  type HistoricalLeaderRow,
  type HistoricalLeaderboards,
  type HistoricalTournamentOutcome,
} from '../dynasty'
import { TOURNAMENT_ROUNDS } from '../postseason'
import { selectPresentationProgramId, useDynastyStore } from '../store'
import { formatOrdinal, formatRecord } from './seasonFormatters'
import {
  formatBidType,
  formatSeedLabel,
  formatTournamentRoundName,
  isUpset,
} from './postseasonFormatters'
import { formatRating } from './formatters'

const LEADER_CATEGORIES = [
  { key: 'points', title: 'Scoring', unit: 'PPG' },
  { key: 'rebounds', title: 'Rebounding', unit: 'RPG' },
  { key: 'assists', title: 'Assists', unit: 'APG' },
  { key: 'steals', title: 'Steals', unit: 'SPG' },
  { key: 'blocks', title: 'Blocks', unit: 'BPG' },
] as const

type LeaderCategoryKey = (typeof LEADER_CATEGORIES)[number]['key']

function tournamentOutcomeLabel(outcome: HistoricalTournamentOutcome): string {
  switch (outcome.status) {
    case 'did-not-qualify':
      return 'Did Not Qualify'
    case 'national-champion':
      return 'National Champion'
    case 'runner-up':
      return 'Runner-Up'
    case 'eliminated':
      return formatTournamentRoundName(outcome.round)
  }
}

function tournamentEntryLabel(outcome: HistoricalTournamentOutcome): string | null {
  if (outcome.status === 'did-not-qualify') return null
  return `${formatSeedLabel(outcome.seed)} Seed · ${formatBidType(outcome.bidType)} Bid`
}

/** "Atlantic Foundry Conference" → "Atlantic Foundry" for a compact tab label. */
function formatConferenceTabLabel(conferenceName: string): string {
  return conferenceName.replace(/ Conference$/, '')
}

function buildHistoricalBracket(
  yearbook: CompletedSeasonYearbook,
  accentByProgramId: ReadonlyMap<string, string>,
): BracketSlot[] {
  return yearbook.tournament.games.map((game) => {
    const homeWinner = game.result.winnerId === game.homeProgram.programId
    const winningSeed = homeWinner ? game.homeSeed : game.awaySeed
    const losingSeed = homeWinner ? game.awaySeed : game.homeSeed
    const participant = (
      programId: string,
      name: string,
      seed: number,
      score: number,
      isWinner: boolean,
    ) => ({
      seed,
      name,
      score,
      isWinner,
      isControlled:
        programId === yearbook.controlledProgramSeason.program.programId,
      accentColor: accentByProgramId.get(programId) ?? 'var(--ink-2)',
    })

    return {
      gameId: game.gameId,
      round: game.round,
      index: game.index,
      top: participant(
        game.homeProgram.programId,
        game.homeProgram.name,
        game.homeSeed,
        game.result.homeScore,
        homeWinner,
      ),
      bottom: participant(
        game.awayProgram.programId,
        game.awayProgram.name,
        game.awaySeed,
        game.result.awayScore,
        !homeWinner,
      ),
      isComplete: true,
      isUpset: isUpset(winningSeed, losingSeed),
    }
  })
}

function LeaderTable({
  title,
  unit,
  rows,
  onSelectPlayer,
}: {
  readonly title: string
  readonly unit: string
  readonly rows: readonly HistoricalLeaderRow[]
  readonly onSelectPlayer: (programId: string, playerId: string) => void
}) {
  return (
    <div className="table-scroll">
      <table className="data-table leader-board__table">
        <caption className="visually-hidden">{`National ${title} leaders`}</caption>
        <thead>
          <tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Program</th><th scope="col">{unit}</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.player.playerId} data-player-id={row.player.playerId}>
              <td className="leader-board__rank">{row.rank}</td>
              <td className="player-name-cell">
                <button
                  type="button"
                  className="text-link-button"
                  onClick={() => onSelectPlayer(row.player.program.programId, row.player.playerId)}
                >
                  {row.player.firstName} {row.player.lastName}
                </button>
              </td>
              <td>{row.player.program.name}</td>
              <td>{formatRating(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** One conference table at a time, defaulting to the controlled Program's own conference. */
function ConferenceStandingsCard({
  standings,
  controlledProgramId,
  defaultConferenceId,
}: {
  readonly standings: readonly HistoricalConferenceStandings[]
  readonly controlledProgramId: string
  readonly defaultConferenceId: string
}) {
  const [selectedConferenceId, setSelectedConferenceId] = useState(defaultConferenceId)
  const active =
    standings.find(({ conference }) => conference.id === selectedConferenceId) ?? standings[0]!

  return (
    <article className="yearbook-league-card" aria-labelledby="final-standings-heading">
      <h3 id="final-standings-heading" className="section-subtitle">Final Standings</h3>
      <div role="group" aria-label="Conference" className="tab-list yearbook-league-tabs">
        {standings.map(({ conference }) => (
          <button
            key={conference.id}
            type="button"
            className="tab"
            aria-pressed={conference.id === active.conference.id}
            onClick={() => setSelectedConferenceId(conference.id)}
          >
            {formatConferenceTabLabel(conference.name)}
          </button>
        ))}
      </div>
      <div className="table-scroll">
        <table className="data-table standings-table">
          <caption className="visually-hidden">{active.conference.name} standings</caption>
          <thead><tr><th scope="col">Pos</th><th scope="col">Program</th><th scope="col">W-L</th><th scope="col">Conf</th></tr></thead>
          <tbody>
            {active.rows.map((row) => {
              const isControlled = row.program.programId === controlledProgramId
              return (
                <tr key={row.program.programId} data-controlled={isControlled}>
                  <td>{row.place}</td>
                  <td>{row.program.name}{isControlled && <span className="standings-you-tag"> · You</span>}</td>
                  <td>{formatRecord(row.wins, row.losses)}</td>
                  <td>{formatRecord(row.conferenceWins, row.conferenceLosses)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </article>
  )
}

/** One national leaderboard at a time, defaulting to Scoring. */
function StatisticalLeadersCard({
  national,
  onSelectPlayer,
}: {
  readonly national: HistoricalLeaderboards
  readonly onSelectPlayer: (programId: string, playerId: string) => void
}) {
  const [selectedCategory, setSelectedCategory] = useState<LeaderCategoryKey>('points')
  const active = LEADER_CATEGORIES.find(({ key }) => key === selectedCategory)!

  return (
    <article className="yearbook-league-card" aria-labelledby="yearbook-leaders-heading">
      <h3 id="yearbook-leaders-heading" className="section-subtitle">Statistical Leaders</h3>
      <p className="section-hint">Regular season only.</p>
      <div role="group" aria-label="Statistical category" className="tab-list yearbook-league-tabs">
        {LEADER_CATEGORIES.map(({ key, unit }) => (
          <button
            key={key}
            type="button"
            className="tab"
            aria-pressed={key === selectedCategory}
            onClick={() => setSelectedCategory(key)}
          >
            {unit}
          </button>
        ))}
      </div>
      <LeaderTable
        title={active.title}
        unit={active.unit}
        rows={national[active.key]}
        onSelectPlayer={onSelectPlayer}
      />
    </article>
  )
}

/** Complete, read-only player-facing summary of one canonical archived Season. */
export function SeasonYearbookScreen() {
  const perspectiveProgramId = useDynastyStore(selectPresentationProgramId)
  const dynasty = useDynastyStore((state) => state.dynasty)
  const selectedSeasonNumber = useDynastyStore(
    (state) => state.selectedArchivedSeasonNumber,
  )
  const explorationViewHistory = useDynastyStore(
    (state) => state.explorationViewHistory,
  )
  const goBackFromExploration = useDynastyStore(
    (state) => state.goBackFromExploration,
  )
  const recoverHistoryIndex = useDynastyStore(
    (state) => state.recoverHistoryIndex,
  )
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)

  if (!dynasty) return null

  let yearbook: CompletedSeasonYearbook
  try {
    if (selectedSeasonNumber === null) {
      throw new RangeError('No completed Season is selected.')
    }
    yearbook = deriveCompletedSeasonYearbook(
      dynasty.controlledProgramId === null && perspectiveProgramId
        ? { ...dynasty, controlledProgramId: perspectiveProgramId }
        : dynasty,
      selectedSeasonNumber,
    )
  } catch (error) {
    return (
      <main className="season-yearbook-screen">
        <section className="section">
          <h1 className="section-title">Yearbook unavailable</h1>
          <p className="section-hint">
            {error instanceof Error ? error.message : 'That completed Season could not be loaded.'}
          </p>
          <button type="button" className="button button--ghost" onClick={recoverHistoryIndex}>
            Return to History
          </button>
        </section>
      </main>
    )
  }

  const champion = yearbook.championship.nationalChampion
  const archive = dynasty.history.find(({ seasonNumber }) => seasonNumber === yearbook.seasonNumber)!
  const awards = deriveCompletedSeasonHonors(archive, dynasty.universe)
  const awardsMop = deriveTournamentMopSummaryFromSources(
    archive.season,
    archive.postseason,
    dynasty.universe,
  )
  const runnerUp = yearbook.championship.runnerUp
  const titleGame = yearbook.championship.game
  const controlled = yearbook.controlledProgramSeason
  const isObserver = dynasty.controlledProgramId === null
  const tournamentEntry = tournamentEntryLabel(controlled.tournamentOutcome)
  const accentByProgramId = new Map(
    dynasty.universe.programs.map((program) => [program.id, program.branding.primaryColor]),
  )
  const bracketSlots = buildHistoricalBracket(yearbook, accentByProgramId)
  const championIsHome = titleGame.homeProgram.programId === champion.programId
  const championScore = championIsHome
    ? titleGame.result.homeScore
    : titleGame.result.awayScore
  const runnerUpScore = championIsHome
    ? titleGame.result.awayScore
    : titleGame.result.homeScore
  const tournamentGames = [...controlled.tournamentGames].sort(
    (first, second) =>
      TOURNAMENT_ROUNDS.indexOf(first.round) - TOURNAMENT_ROUNDS.indexOf(second.round),
  )
  const championAccent = accentByProgramId.get(champion.programId) ?? 'var(--ink-2)'
  const championAccentStyle = { '--team-accent': championAccent } as CSSProperties

  return (
    <main className="season-yearbook-screen">
      <ExplorationBackButton
        destination={explorationViewHistory.at(-1) ?? 'history'}
        onClick={goBackFromExploration}
      />

      <header className="season-header" style={championAccentStyle}>
        <div className="season-header__identity">
          <span
            className="season-header__dot"
            style={{ background: championAccent }}
            aria-hidden="true"
          />
          <div>
            <p className="eyebrow-tag">Season {yearbook.seasonNumber} · Completed</p>
            <h1 className="season-header__name">{champion.name}</h1>
            <p className="season-header__meta">
              National Champion · def. {runnerUp.name} {championScore}–{runnerUpScore}
            </p>
          </div>
        </div>
      </header>

      <section className="section" aria-labelledby="your-season-heading">
        <h2 id="your-season-heading" className="section-title">
          {isObserver ? 'Viewed Program Season' : 'Your Season'}
        </h2>
        <div className="yearbook-recap-card">
          <div className="yearbook-recap-card__summary">
            <p className="eyebrow-tag">{controlled.program.name}</p>
            <div className="stat-trio player-stat-block__row">
              <div className="stat-trio__item">
                <span className="stat-trio__value">{formatRecord(controlled.overallRecord.wins, controlled.overallRecord.losses)}</span>
                <span className="stat-trio__label">Overall</span>
              </div>
              <div className="stat-trio__item">
                <span className="stat-trio__value">{formatRecord(controlled.conferenceRecord.wins, controlled.conferenceRecord.losses)}</span>
                <span className="stat-trio__label">Conference</span>
              </div>
              <div className="stat-trio__item">
                <span className="stat-trio__value">{formatOrdinal(controlled.conferencePlace)}</span>
                <span className="stat-trio__label">Conf Finish</span>
              </div>
              <div className="stat-trio__item">
                <span className="stat-trio__value stat-trio__value--text">{tournamentOutcomeLabel(controlled.tournamentOutcome)}</span>
                <span className="stat-trio__label">Tournament</span>
              </div>
            </div>
            {tournamentEntry && <p className="section-hint">{tournamentEntry}</p>}
          </div>

          <div className="yearbook-recap-card__section" role="region" aria-label={isObserver ? 'Program Team Leaders' : 'Your Team Leaders'}>
            <h3 className="section-subtitle">Team Leaders</h3>
            <div className="team-leaders">
              {LEADER_CATEGORIES.map(({ key, unit }) => {
                const leader = yearbook.statisticalLeaders.controlledProgram[key][0]
                if (!leader) {
                  return (
                    <div key={key} className="team-leaders__item" data-empty="true">
                      <span className="team-leaders__unit">{unit}</span>
                      <span className="team-leaders__empty">No qualifier</span>
                    </div>
                  )
                }
                return (
                  <button
                    key={key}
                    type="button"
                    className="team-leaders__item"
                    data-player-id={leader.player.playerId}
                    onClick={() => openPlayerDetails(leader.player.program.programId, leader.player.playerId)}
                  >
                    <span className="team-leaders__value">{formatRating(leader.value)}</span>
                    <span className="team-leaders__unit">{unit}</span>
                    <span className="team-leaders__player">{leader.player.firstName} {leader.player.lastName}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {tournamentGames.length > 0 && (
            <div className="yearbook-recap-card__section" role="region" aria-label={isObserver ? 'Program Tournament Run' : 'Your Tournament Run'}>
              <h3 className="section-subtitle">Tournament Run</h3>
              <ul className="recent-results__list">
                {tournamentGames.map((game) => {
                  const controlledIsHome = game.homeProgram.programId === controlled.program.programId
                  const controlledScore = controlledIsHome ? game.result.homeScore : game.result.awayScore
                  const opponentScore = controlledIsHome ? game.result.awayScore : game.result.homeScore
                  const opponentSeed = controlledIsHome ? game.awaySeed : game.homeSeed
                  const outcome = game.resultForControlledProgram
                  return (
                    <li key={game.gameId}>
                      <div className="recent-results__row" data-outcome={outcome} data-interactive="false">
                        <span className="recent-results__outcome">{outcome === 'win' ? 'W' : 'L'}</span>
                        <span className="recent-results__score">{controlledScore}-{opponentScore}</span>
                        <span className="recent-results__opponent">
                          {formatTournamentRoundName(game.round)} · {formatSeedLabel(opponentSeed)} {game.opponent.name}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="yearbook-awards" aria-labelledby="yearbook-awards-heading">
        <h2 id="yearbook-awards-heading" className="section-title">Awards &amp; Honors</h2>
        <AwardsHonors
          honors={awards}
          conferences={dynasty.universe.conferences}
          controlledProgramId={controlled.program.programId}
          controlledConferenceId={controlled.program.conferenceId}
          showMopPending={false}
          mopSummary={awardsMop}
          archival
          summary
          onSelectPlayer={openPlayerDetails}
        />
      </section>

      <section className="section" aria-labelledby="season-around-league-heading">
        <h2 id="season-around-league-heading" className="section-title">Season Around the League</h2>
        <div className="yearbook-league-grid">
          <ConferenceStandingsCard
            standings={yearbook.conferenceStandings}
            controlledProgramId={controlled.program.programId}
            defaultConferenceId={controlled.program.conferenceId}
          />
          <StatisticalLeadersCard
            national={yearbook.statisticalLeaders.national}
            onSelectPlayer={openPlayerDetails}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="national-tournament-heading">
        <h2 id="national-tournament-heading" className="section-title">National Tournament</h2>
        <div role="region" aria-label="Archived Tournament Bracket">
          <TournamentBracket slots={bracketSlots} />
        </div>
      </section>
    </main>
  )
}
