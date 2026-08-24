import { useState } from 'react'
import type { ResolvedSeasonHonor } from '../dynasty'
import type { ConferenceDefinition } from '../universe'
import { AWARD_LABELS } from '../app/awardFormatters'

interface AwardsHonorsProps {
  readonly honors: readonly ResolvedSeasonHonor[]
  readonly conferences: readonly ConferenceDefinition[]
  readonly controlledProgramId: string
  readonly controlledProgramName: string
  readonly controlledConferenceId: string
  readonly showMopPending: boolean
  readonly archival?: boolean
  readonly onSelectPlayer: (programId: string, playerId: string) => void
}

function Recipient({ honor, onSelectPlayer }: {
  readonly honor: ResolvedSeasonHonor
  readonly onSelectPlayer: AwardsHonorsProps['onSelectPlayer']
}) {
  return (
    <div className="award-recipient">
      <button
        type="button"
        className="text-link-button award-recipient__player"
        onClick={() => onSelectPlayer(honor.program.id, honor.player.id)}
      >
        {honor.player.firstName} {honor.player.lastName}
      </button>
      <span className="award-recipient__context">
        {honor.program.name} · {honor.player.position} · {honor.player.classYear}
      </span>
    </div>
  )
}

function HonorTeam({ honors, onSelectPlayer }: {
  readonly honors: readonly ResolvedSeasonHonor[]
  readonly onSelectPlayer: AwardsHonorsProps['onSelectPlayer']
}) {
  return (
    <ol className="award-team-list">
      {[...honors].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).map((honor) => (
        <li key={`${honor.type}:${honor.conference?.id ?? 'national'}:${honor.player.id}`}>
          <Recipient honor={honor} onSelectPlayer={onSelectPlayer} />
        </li>
      ))}
    </ol>
  )
}

export function AwardsHonors({
  honors,
  conferences,
  controlledProgramId,
  controlledProgramName,
  controlledConferenceId,
  showMopPending,
  archival = false,
  onSelectPlayer,
}: AwardsHonorsProps) {
  const [conferenceId, setConferenceId] = useState(controlledConferenceId)
  const byType = (type: ResolvedSeasonHonor['type']) =>
    honors.filter((honor) => honor.type === type)
  const nationalPoy = byType('national-player-of-the-year')[0]
  const nationalFoy = byType('national-freshman-of-the-year')[0]
  const mop = byType('tournament-most-outstanding-player')[0]
  const allAmericans = byType('all-america-first-team')
  const controlled = honors.filter(({ program }) => program.id === controlledProgramId)
  const controlledPlayers = new Map<string, ResolvedSeasonHonor[]>()
  for (const honor of controlled) {
    const playerHonors = controlledPlayers.get(honor.player.id) ?? []
    playerHonors.push(honor)
    controlledPlayers.set(honor.player.id, playerHonors)
  }
  const conferenceHonors = honors.filter(({ conference }) => conference?.id === conferenceId)
  const conferencePoy = conferenceHonors.find(({ type }) => type === 'conference-player-of-the-year')
  const conferenceFoy = conferenceHonors.find(({ type }) => type === 'conference-freshman-of-the-year')
  const allConference = conferenceHonors.filter(({ type }) => type === 'all-conference-first-team')
  return (
    <div className="awards-content" data-archival={archival || undefined}>
      <section className="awards-headliners" aria-label="National award winners">
        {nationalPoy && <article className="award-headliner award-headliner--primary"><p className="eyebrow-tag">{AWARD_LABELS[nationalPoy.type]}</p><Recipient honor={nationalPoy} onSelectPlayer={onSelectPlayer} /></article>}
        {nationalFoy && <article className="award-headliner"><p className="eyebrow-tag">{AWARD_LABELS[nationalFoy.type]}</p><Recipient honor={nationalFoy} onSelectPlayer={onSelectPlayer} /></article>}
        <article className="award-headliner">
          <p className="eyebrow-tag">Tournament Most Outstanding Player</p>
          {mop ? <Recipient honor={mop} onSelectPlayer={onSelectPlayer} /> : showMopPending ? <p className="award-headliner__pending">Awarded after the National Championship</p> : null}
        </article>
      </section>

      <section className="section awards-section" aria-labelledby="all-america-heading">
        <h2 id="all-america-heading" className="section-title">First Team All-America</h2>
        <HonorTeam honors={allAmericans} onSelectPlayer={onSelectPlayer} />
      </section>

      <section className="section awards-section" aria-labelledby="your-program-honors-heading">
        <div className="section-heading">
          <div><p className="eyebrow-tag">Your Program</p><h2 id="your-program-honors-heading" className="section-title">{controlledProgramName} Honors</h2></div>
          {controlled.length > 0 && <p className="section-hint">{controlled.length} {controlled.length === 1 ? 'honor' : 'honors'} · {controlledPlayers.size} {controlledPlayers.size === 1 ? 'player' : 'players'}</p>}
        </div>
        {controlledPlayers.size === 0 ? (
          <p className="league-empty-state">No {controlledProgramName} players earned season honors.</p>
        ) : (
          <div className="your-program-honors">
            {[...controlledPlayers.values()].map((playerHonors) => (
              <div className="your-program-honors__player" key={playerHonors[0]!.player.id}>
                <Recipient honor={playerHonors[0]!} onSelectPlayer={onSelectPlayer} />
                <ul>{playerHonors.map((honor) => <li key={`${honor.type}:${honor.conference?.id ?? ''}`}>{AWARD_LABELS[honor.type]}{honor.conference ? ` · ${honor.conference.name}` : ''}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section awards-section" aria-labelledby="conference-honors-heading">
        <div className="awards-conference-heading">
          <h2 id="conference-honors-heading" className="section-title">Conference Honors</h2>
          <label className="awards-conference-select">Conference<select value={conferenceId} onChange={(event) => setConferenceId(event.target.value)}>{conferences.map((conference) => <option value={conference.id} key={conference.id}>{conference.name}</option>)}</select></label>
        </div>
        <div className="awards-conference-winners">
          {conferencePoy && <article><p className="eyebrow-tag">Conference Player of the Year</p><Recipient honor={conferencePoy} onSelectPlayer={onSelectPlayer} /></article>}
          {conferenceFoy && <article><p className="eyebrow-tag">Conference Freshman of the Year</p><Recipient honor={conferenceFoy} onSelectPlayer={onSelectPlayer} /></article>}
        </div>
        <h3 className="section-subtitle">First Team All-Conference</h3>
        <HonorTeam honors={allConference} onSelectPlayer={onSelectPlayer} />
      </section>
    </div>
  )
}
