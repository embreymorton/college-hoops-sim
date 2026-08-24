import { useState } from 'react'
import type { ResolvedSeasonHonor, TournamentMopSummary } from '../dynasty'
import type { ConferenceDefinition } from '../universe'
import { formatRating } from '../app/formatters'
import { AWARD_LABELS } from '../app/awardFormatters'

interface AwardsHonorsProps {
  readonly honors: readonly ResolvedSeasonHonor[]
  readonly conferences: readonly ConferenceDefinition[]
  readonly controlledProgramId: string
  readonly controlledConferenceId: string
  readonly showMopPending: boolean
  readonly mopSummary?: TournamentMopSummary | null
  readonly archival?: boolean
  readonly summary?: boolean
  readonly onSelectPlayer: (programId: string, playerId: string) => void
}

function PlayerLink({ honor, onSelectPlayer }: {
  readonly honor: ResolvedSeasonHonor
  readonly onSelectPlayer: AwardsHonorsProps['onSelectPlayer']
}) {
  return <button type="button" className="text-link-button" onClick={() => onSelectPlayer(honor.program.id, honor.player.id)}>{honor.player.firstName} {honor.player.lastName}</button>
}

function YouMarker({ honor, controlledProgramId }: { readonly honor: ResolvedSeasonHonor; readonly controlledProgramId: string }) {
  return honor.program.id === controlledProgramId ? <span className="standings-you-tag"> · You</span> : null
}

function StatTrio({ honor, tournament }: { readonly honor: ResolvedSeasonHonor; readonly tournament?: TournamentMopSummary | null }) {
  const stats = tournament ?? honor.seasonStats
  return <div className="stat-trio award-stat-trio">
    <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(stats.pointsPerGame)}</span><span className="stat-trio__label">PPG</span></div>
    <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(stats.reboundsPerGame)}</span><span className="stat-trio__label">RPG</span></div>
    <div className="stat-trio__item"><span className="stat-trio__value">{formatRating(stats.assistsPerGame)}</span><span className="stat-trio__label">APG</span></div>
  </div>
}

function StatLine({ honor }: { readonly honor: ResolvedSeasonHonor }) {
  const stats = honor.seasonStats
  return <span className="award-stat-line">{formatRating(stats.pointsPerGame)} PPG · {formatRating(stats.reboundsPerGame)} RPG · {formatRating(stats.assistsPerGame)} APG</span>
}

function AwardCard({ honor, controlledProgramId, onSelectPlayer, tournament, label, variant }: {
  readonly honor: ResolvedSeasonHonor
  readonly controlledProgramId: string
  readonly onSelectPlayer: AwardsHonorsProps['onSelectPlayer']
  readonly tournament?: TournamentMopSummary | null
  readonly label: string
  readonly variant: 'poy' | 'foy' | 'mop'
}) {
  return <article className={`award-card award-card--${variant}`}>
    <p className="eyebrow-tag award-card__eyebrow">{label}</p>
    <div className="award-card__row">
      <div className="award-card__identity">
        <strong className="award-card__name"><PlayerLink honor={honor} onSelectPlayer={onSelectPlayer} /><YouMarker honor={honor} controlledProgramId={controlledProgramId} /></strong>
        <span className="award-card__context">{honor.program.name} · {honor.player.position} · {honor.player.classYear}</span>
      </div>
      <StatTrio honor={honor} tournament={tournament} />
    </div>
  </article>
}

function HonorTeam({ honors, controlledProgramId, onSelectPlayer, label }: {
  readonly honors: readonly ResolvedSeasonHonor[]
  readonly controlledProgramId: string
  readonly onSelectPlayer: AwardsHonorsProps['onSelectPlayer']
  readonly label: string
}) {
  return <div className="table-scroll">
    <table className="data-table award-team-table">
      <caption className="visually-hidden">{label}</caption>
      <thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Program</th><th scope="col">Stats</th></tr></thead>
      <tbody>
        {[...honors].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map((honor) => (
          <tr key={`${honor.type}:${honor.conference?.id ?? 'national'}:${honor.player.id}`} data-controlled={honor.program.id === controlledProgramId}>
            <td className="award-team-table__rank">{honor.rank}</td>
            <td className="player-name-cell">
              <PlayerLink honor={honor} onSelectPlayer={onSelectPlayer} />
              <span className="award-team-table__meta">{honor.player.position} · {honor.player.classYear}<YouMarker honor={honor} controlledProgramId={controlledProgramId} /></span>
            </td>
            <td>{honor.program.name}</td>
            <td><StatLine honor={honor} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
}

function conferenceTabLabel(name: string): string { return name.replace(/ Conference$/, '') }

export function AwardsHonors({ honors, conferences, controlledProgramId, controlledConferenceId, showMopPending, mopSummary, archival = false, summary = false, onSelectPlayer }: AwardsHonorsProps) {
  const [conferenceId, setConferenceId] = useState(controlledConferenceId)
  const byType = (type: ResolvedSeasonHonor['type']) => honors.filter((honor) => honor.type === type)
  const nationalPoy = byType('national-player-of-the-year')[0]
  const nationalFoy = byType('national-freshman-of-the-year')[0]
  const mop = byType('tournament-most-outstanding-player')[0]
  const allAmericans = byType('all-america-first-team')
  const conferenceHonors = honors.filter(({ conference }) => conference?.id === conferenceId)
  const conferencePoy = conferenceHonors.find(({ type }) => type === 'conference-player-of-the-year')
  const conferenceFoy = conferenceHonors.find(({ type }) => type === 'conference-freshman-of-the-year')
  const allConference = conferenceHonors.filter(({ type }) => type === 'all-conference-first-team')
  return <div className="awards-content" data-archival={archival || undefined} data-summary={summary || undefined}>
    <section className="awards-marquee" aria-label="National award winners">
      {nationalPoy && <AwardCard honor={nationalPoy} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} label={AWARD_LABELS[nationalPoy.type]} variant="poy" />}
      <div className="awards-marquee__secondary">
        {nationalFoy && <AwardCard honor={nationalFoy} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} label={AWARD_LABELS[nationalFoy.type]} variant="foy" />}
        <article className="award-card award-card--mop">
          <p className="eyebrow-tag award-card__eyebrow">Tournament Most Outstanding Player</p>
          {mop
            ? <div className="award-card__identity"><strong className="award-card__name"><PlayerLink honor={mop} onSelectPlayer={onSelectPlayer} /><YouMarker honor={mop} controlledProgramId={controlledProgramId} /></strong><span className="award-card__context">{mop.program.name} · {mop.player.position} · {mop.player.classYear}</span></div>
            : showMopPending ? <p className="award-card__pending">Awarded after the National Championship</p> : null}
          {mop && <StatTrio honor={mop} tournament={mopSummary} />}
        </article>
      </div>
    </section>
    <section className="section awards-section" aria-labelledby={summary ? 'yearbook-all-america-heading' : 'all-america-heading'}>
      <h2 id={summary ? 'yearbook-all-america-heading' : 'all-america-heading'} className="section-title">First Team All-America</h2>
      <HonorTeam honors={allAmericans} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} label="First Team All-America" />
    </section>
    {!summary && <section className="section awards-section awards-section--conference" aria-labelledby="conference-honors-heading">
      <h2 id="conference-honors-heading" className="section-title">Conference Honors</h2>
      <div className="awards-conference-panel">
        <div role="group" aria-label="Conference" className="tab-list awards-conference-tabs">{conferences.map((conference) => <button key={conference.id} type="button" className="tab" aria-pressed={conference.id === conferenceId} onClick={() => setConferenceId(conference.id)}>{conferenceTabLabel(conference.name)}</button>)}</div>
        <div className="awards-conference-winners">
          {conferencePoy && <div className="award-row"><p className="eyebrow-tag award-row__eyebrow">Conference Player of the Year</p><div className="award-row__identity"><strong><PlayerLink honor={conferencePoy} onSelectPlayer={onSelectPlayer} /><YouMarker honor={conferencePoy} controlledProgramId={controlledProgramId} /></strong><span className="award-card__context">{conferencePoy.program.name} · {conferencePoy.player.position} · {conferencePoy.player.classYear}</span></div><StatLine honor={conferencePoy} /></div>}
          {conferenceFoy && <div className="award-row"><p className="eyebrow-tag award-row__eyebrow">Conference Freshman of the Year</p><div className="award-row__identity"><strong><PlayerLink honor={conferenceFoy} onSelectPlayer={onSelectPlayer} /><YouMarker honor={conferenceFoy} controlledProgramId={controlledProgramId} /></strong><span className="award-card__context">{conferenceFoy.program.name} · {conferenceFoy.player.position} · {conferenceFoy.player.classYear}</span></div><StatLine honor={conferenceFoy} /></div>}
        </div>
        <h3 className="section-subtitle awards-conference-panel__subtitle">First Team All-Conference</h3>
        <HonorTeam honors={allConference} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} label="First Team All-Conference" />
      </div>
    </section>}
  </div>
}
