import type { NextSeasonRosterOutlook as RosterOutlook } from '../dynasty'

interface NextSeasonRosterOutlookProps {
  readonly outlook: RosterOutlook
  readonly onSelectPlayer: (playerId: string) => void
  readonly onSelectRecruit: (playerId: string) => void
}

export function NextSeasonRosterOutlook({
  outlook,
  onSelectPlayer,
  onSelectRecruit,
}: NextSeasonRosterOutlookProps) {
  const returningCount = outlook.positionGroups.reduce(
    (sum, group) => sum + group.players.filter((player) => player.status === 'returning').length,
    0,
  )
  const incomingCount = outlook.projectedPlayerCount - returningCount

  return (
    <div className="next-season-outlook">
      <div className="next-season-outlook__summary recruiting-overview">
        <p className="section-hint next-season-outlook__hint">
          Season {outlook.targetSeasonNumber} · Current ratings, before offseason Development
        </p>
        <dl className="recruiting-overview__stats next-season-outlook__stats">
          <div className="recruiting-overview__stat">
            <dt>Returning</dt>
            <dd>{returningCount}</dd>
          </div>
          <div className="recruiting-overview__stat">
            <dt>Incoming</dt>
            <dd>{incomingCount}</dd>
          </div>
          <div className="recruiting-overview__stat">
            <dt>Scholarships</dt>
            <dd>{outlook.remainingOpeningCount}</dd>
          </div>
          <div className="recruiting-overview__stat">
            <dt>Mandatory Needs</dt>
            <dd>{outlook.mandatoryNeedCount}</dd>
          </div>
          <div className="recruiting-overview__stat">
            <dt>Flexible Openings</dt>
            <dd>{outlook.flexibleOpeningCount}</dd>
          </div>
        </dl>
      </div>

      <div className="next-season-outlook__groups">
        {outlook.positionGroups.map((group) => {
          return (
            <section key={group.position} className="next-season-outlook__group" aria-labelledby={`outlook-${group.position}`}>
              <header className="next-season-outlook__group-header">
                <h3 id={`outlook-${group.position}`} className="next-season-outlook__position">{group.position}</h3>
                <div className="next-season-outlook__group-capacity">
                  <span className="next-season-outlook__group-count">{group.projectedCount} projected</span>
                  <span className="next-season-outlook__capacity-status">
                    {group.mandatoryNeed > 0 && <span data-capacity="required">Required {group.mandatoryNeed}</span>}
                    {group.flexibleEligible && <span data-capacity="flexible">Flex +1</span>}
                    {!group.flexibleEligible && <span data-capacity="full">Full</span>}
                  </span>
                </div>
              </header>
              <ul className="next-season-outlook__rows">
                {group.players.map((player) => (
                  <li key={player.playerId} className="next-season-outlook__row" data-status={player.status}>
                    <span className="next-season-outlook__identity-block">
                      <button
                        type="button"
                        className="text-link-button next-season-outlook__identity"
                        onClick={() => player.status === 'returning'
                          ? onSelectPlayer(player.playerId)
                          : onSelectRecruit(player.playerId)}
                      >
                        {player.firstName} {player.lastName}
                      </button>
                      <span className="next-season-outlook__meta">
                        {player.status === 'returning'
                          ? `Next season ${player.projectedClassYear}`
                          : 'Incoming FR'}
                      </span>
                    </span>
                    <span className="next-season-outlook__ratings">
                      <span className="next-season-outlook__rating"><strong>{player.currentOverall}</strong><em>OVR</em></span>
                      <span className="next-season-outlook__rating"><strong>{player.potential}</strong><em>POT</em></span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      {outlook.departures.length > 0 && (
        <section className="next-season-outlook__departures" aria-labelledby="departing-seniors-heading">
          <h3 id="departing-seniors-heading" className="next-season-outlook__departures-title">Departing Seniors</h3>
          <ul className="next-season-outlook__departures-list">
            {outlook.departures.map((player) => (
              <li key={player.playerId} className="next-season-outlook__departure-chip">
                <button type="button" className="text-link-button" onClick={() => onSelectPlayer(player.playerId)}>
                  {player.firstName} {player.lastName}
                </button>
                <span>{player.position} · {player.currentOverall} OVR</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
