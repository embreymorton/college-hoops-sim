import {
  ExplorationBackButton,
  TournamentBracket,
  type BracketSlot,
} from '../components'
import {
  deriveCompletedSeasonYearbook,
  type CompletedSeasonYearbook,
  type HistoricalLeaderRow,
  type HistoricalTournamentOutcome,
} from '../dynasty'
import { TOURNAMENT_ROUNDS } from '../postseason'
import { useDynastyStore } from '../store'
import { formatOrdinal } from './seasonFormatters'
import {
  formatBidType,
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
  return `#${outcome.seed} Seed · ${formatBidType(outcome.bidType)} Bid`
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
}: {
  readonly title: string
  readonly unit: string
  readonly rows: readonly HistoricalLeaderRow[]
}) {
  return (
    <div className="leader-board yearbook-leader-board">
      <div className="leader-board__header">
        <span className="leader-board__title">{title}</span>
        <span className="leader-board__unit">{unit}</span>
      </div>
      <div className="table-scroll">
        <table className="data-table leader-board__table">
          <thead>
            <tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Program</th><th scope="col">{unit}</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.player.playerId} data-player-id={row.player.playerId}>
                <td className="leader-board__rank">{row.rank}</td>
                <td className="player-name-cell">{row.player.firstName} {row.player.lastName}</td>
                <td>{row.player.program.name}</td>
                <td>{formatRating(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Complete, read-only player-facing summary of one canonical archived Season. */
export function SeasonYearbookScreen() {
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

  if (!dynasty) return null

  let yearbook: CompletedSeasonYearbook
  try {
    if (selectedSeasonNumber === null) {
      throw new RangeError('No completed Season is selected.')
    }
    yearbook = deriveCompletedSeasonYearbook(dynasty, selectedSeasonNumber)
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
  const runnerUp = yearbook.championship.runnerUp
  const titleGame = yearbook.championship.game
  const controlled = yearbook.controlledProgramSeason
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

  return (
    <main className="season-yearbook-screen">
      <ExplorationBackButton
        destination={explorationViewHistory.at(-1) ?? 'history'}
        onClick={goBackFromExploration}
      />

      <header className="section yearbook-hero">
        <p className="eyebrow-tag">Completed Season</p>
        <h1 className="section-title">Season {yearbook.seasonNumber} Yearbook</h1>
        <div className="yearbook-champion">
          <span className="yearbook-champion__label">National Champion</span>
          <strong className="yearbook-champion__name">{champion.name}</strong>
          <span className="yearbook-champion__result">
            Championship · {champion.name} {championScore} — {runnerUp.name} {runnerUpScore}
          </span>
        </div>
      </header>

      <section className="section" aria-labelledby="your-season-heading">
        <h2 id="your-season-heading" className="section-title">Your Season</h2>
        <div className="yearbook-your-season">
          <div>
            <p className="eyebrow-tag">{controlled.program.name}</p>
            <div className="yearbook-record-grid">
              <div><strong>{controlled.overallRecord.wins}-{controlled.overallRecord.losses}</strong><span>Overall</span></div>
              <div><strong>{controlled.conferenceRecord.wins}-{controlled.conferenceRecord.losses}</strong><span>Conference</span></div>
              <div><strong>{formatOrdinal(controlled.conferencePlace)}</strong><span>Conference Finish</span></div>
            </div>
          </div>
          <div className="yearbook-tournament-result">
            <span className="eyebrow-tag">Tournament</span>
            <strong>{tournamentOutcomeLabel(controlled.tournamentOutcome)}</strong>
            {tournamentEntry && <span>{tournamentEntry}</span>}
          </div>
        </div>

        {tournamentGames.length > 0 && (
          <div className="yearbook-run" role="region" aria-label="Your Tournament Run">
            <h3 className="section-subtitle">Tournament Run</h3>
            <div className="yearbook-run__games">
              {tournamentGames.map((game) => {
                const controlledIsHome = game.homeProgram.programId === controlled.program.programId
                const controlledScore = controlledIsHome ? game.result.homeScore : game.result.awayScore
                const opponentScore = controlledIsHome ? game.result.awayScore : game.result.homeScore
                const controlledSeed = controlledIsHome ? game.homeSeed : game.awaySeed
                const opponentSeed = controlledIsHome ? game.awaySeed : game.homeSeed
                return (
                  <article key={game.gameId} className="yearbook-run__game" data-result={game.resultForControlledProgram}>
                    <span className="eyebrow-tag">{formatTournamentRoundName(game.round)}</span>
                    <strong>{game.resultForControlledProgram === 'win' ? 'W' : 'L'} · #{controlledSeed} {controlled.program.name} {controlledScore}</strong>
                    <span>#{opponentSeed} {game.opponent.name} {opponentScore}</span>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="national-tournament-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow-tag">Read-Only Archive</p>
            <h2 id="national-tournament-heading" className="section-title">National Tournament</h2>
          </div>
        </div>
        <div role="region" aria-label="Archived Tournament Bracket">
          <TournamentBracket slots={bracketSlots} />
        </div>
      </section>

      <section className="section" aria-labelledby="final-standings-heading">
        <h2 id="final-standings-heading" className="section-title">Final Conference Standings</h2>
        <p className="section-hint">Final regular-season conference and overall records.</p>
        <div className="yearbook-standings-grid">
          {yearbook.conferenceStandings.map(({ conference, rows }) => (
            <article key={conference.id} className="yearbook-standings-card">
              <h3 className="section-subtitle">{conference.name}</h3>
              <div className="table-scroll">
                <table className="data-table yearbook-standings-table">
                  <thead><tr><th scope="col">#</th><th scope="col">Program</th><th scope="col">Conf</th><th scope="col">Overall</th></tr></thead>
                  <tbody>
                    {rows.map((row) => {
                      const isControlled = row.program.programId === controlled.program.programId
                      return (
                        <tr key={row.program.programId} data-controlled={isControlled}>
                          <td>{row.place}</td>
                          <td>{row.program.name}{isControlled && <span className="standings-you-tag"> · You</span>}</td>
                          <td>{row.conferenceWins}-{row.conferenceLosses}</td>
                          <td>{row.wins}-{row.losses}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="yearbook-leaders-heading">
        <h2 id="yearbook-leaders-heading" className="section-title">Regular-Season Statistical Leaders</h2>
        <p className="section-hint">Tournament statistics are not included.</p>
        <div className="leaders-grid yearbook-leaders-grid">
          {LEADER_CATEGORIES.map(({ key, title, unit }) => (
            <LeaderTable key={key} title={title} unit={unit} rows={yearbook.statisticalLeaders.national[key]} />
          ))}
        </div>

        <div className="yearbook-team-leaders" role="region" aria-label="Your Team Leaders">
          <h3 className="section-subtitle">Your Team Leaders</h3>
          <div className="yearbook-team-leaders__grid">
            {LEADER_CATEGORIES.map(({ key, title, unit }) => {
              const leader = yearbook.statisticalLeaders.controlledProgram[key][0]
              return (
                <div key={key} className="yearbook-team-leader" data-player-id={leader?.player.playerId}>
                  <span className="eyebrow-tag">{title}</span>
                  {leader ? <>
                    <strong>{formatRating(leader.value)} {unit}</strong>
                    <span>{leader.player.firstName} {leader.player.lastName}</span>
                  </> : <span>No qualifier</span>}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
