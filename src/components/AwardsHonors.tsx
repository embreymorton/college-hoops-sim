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

function StatLine({ honor, tournament }: { readonly honor: ResolvedSeasonHonor; readonly tournament?: TournamentMopSummary | null }) {
  const stats = tournament ?? honor.seasonStats
  return <span className="award-stat-line">{formatRating(stats.pointsPerGame)} PPG · {formatRating(stats.reboundsPerGame)} RPG · {formatRating(stats.assistsPerGame)} APG</span>
}

function MajorRecipient({ honor, controlledProgramId, onSelectPlayer, tournament }: {
  readonly honor: ResolvedSeasonHonor
  readonly controlledProgramId: string
  readonly onSelectPlayer: AwardsHonorsProps['onSelectPlayer']
  readonly tournament?: TournamentMopSummary | null
}) {
  return <div className="award-recipient"><strong><PlayerLink honor={honor} onSelectPlayer={onSelectPlayer} /><YouMarker honor={honor} controlledProgramId={controlledProgramId} /></strong><span className="award-recipient__context">{honor.program.name} · {honor.player.position} · {honor.player.classYear}</span><StatLine honor={honor} tournament={tournament} /></div>
}

function HonorTeam({ honors, controlledProgramId, onSelectPlayer, label }: {
  readonly honors: readonly ResolvedSeasonHonor[]
  readonly controlledProgramId: string
  readonly onSelectPlayer: AwardsHonorsProps['onSelectPlayer']
  readonly label: string
}) {
  return <div className="table-scroll"><table className="data-table leader-board__table award-team-table"><caption className="visually-hidden">{label}</caption><thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">Program</th><th scope="col">Season</th></tr></thead><tbody>{[...honors].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map((honor) => <tr key={`${honor.type}:${honor.conference?.id ?? 'national'}:${honor.player.id}`} data-controlled={honor.program.id === controlledProgramId}><td className="leader-board__rank">{honor.rank}</td><td className="player-name-cell"><PlayerLink honor={honor} onSelectPlayer={onSelectPlayer} /><span className="leader-board__pos">{honor.player.position} · {honor.player.classYear}<YouMarker honor={honor} controlledProgramId={controlledProgramId} /></span></td><td>{honor.program.name}</td><td><StatLine honor={honor} /></td></tr>)}</tbody></table></div>
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
    <section className="awards-headliners" aria-label="National award winners">
      {nationalPoy && <article className="award-headliner award-headliner--primary"><p className="eyebrow-tag">{AWARD_LABELS[nationalPoy.type]}</p><MajorRecipient honor={nationalPoy} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} /></article>}
      {nationalFoy && <article className="award-headliner"><p className="eyebrow-tag">{AWARD_LABELS[nationalFoy.type]}</p><MajorRecipient honor={nationalFoy} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} /></article>}
      <article className="award-headliner"><p className="eyebrow-tag">Tournament Most Outstanding Player</p>{mop ? <MajorRecipient honor={mop} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} tournament={mopSummary} /> : showMopPending ? <p className="award-headliner__pending">Awarded after the National Championship</p> : null}</article>
    </section>
    <section className="section awards-section" aria-labelledby={summary ? 'yearbook-all-america-heading' : 'all-america-heading'}><h2 id={summary ? 'yearbook-all-america-heading' : 'all-america-heading'} className="section-title">First Team All-America</h2><HonorTeam honors={allAmericans} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} label="First Team All-America" /></section>
    {!summary && <section className="section awards-section" aria-labelledby="conference-honors-heading"><h2 id="conference-honors-heading" className="section-title">Conference Honors</h2><div role="group" aria-label="Conference" className="tab-list awards-conference-tabs">{conferences.map((conference) => <button key={conference.id} type="button" className="tab" aria-pressed={conference.id === conferenceId} onClick={() => setConferenceId(conference.id)}>{conferenceTabLabel(conference.name)}</button>)}</div><div className="awards-conference-winners">{conferencePoy && <article><p className="eyebrow-tag">Conference Player of the Year</p><MajorRecipient honor={conferencePoy} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} /></article>}{conferenceFoy && <article><p className="eyebrow-tag">Conference Freshman of the Year</p><MajorRecipient honor={conferenceFoy} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} /></article>}</div><h3 className="section-subtitle">First Team All-Conference</h3><HonorTeam honors={allConference} controlledProgramId={controlledProgramId} onSelectPlayer={onSelectPlayer} label="First Team All-Conference" /></section>}
  </div>
}
