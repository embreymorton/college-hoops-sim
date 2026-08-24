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
  return (
    <div className="next-season-outlook">
      <div className="next-season-outlook__summary">
        <p className="section-hint">Season {outlook.targetSeasonNumber} · Current ratings, before offseason Development</p>
        <strong>{outlook.remainingOpeningCount === 0
          ? 'All positions filled'
          : `${outlook.remainingOpeningCount} ${outlook.remainingOpeningCount === 1 ? 'opening' : 'openings'} remaining`}</strong>
      </div>

      <div className="next-season-outlook__groups">
        {outlook.positionGroups.map((group) => (
          <section key={group.position} className="next-season-outlook__group" aria-labelledby={`outlook-${group.position}`}>
            <h3 id={`outlook-${group.position}`} className="next-season-outlook__position">{group.position}</h3>
            <ul className="next-season-outlook__rows">
              {group.players.map((player) => (
                <li key={player.playerId} className="next-season-outlook__row" data-status={player.status}>
                  <button
                    type="button"
                    className="text-link-button next-season-outlook__identity"
                    onClick={() => player.status === 'returning'
                      ? onSelectPlayer(player.playerId)
                      : onSelectRecruit(player.playerId)}
                  >
                    {player.firstName} {player.lastName}
                  </button>
                  <span>{player.status === 'returning' ? player.projectedClassYear : 'FR'} · {player.status === 'returning' ? 'Returning' : 'Incoming'}</span>
                  <span><strong>{player.currentOverall}</strong> OVR · <strong>{player.potential}</strong> POT</span>
                </li>
              ))}
              {Array.from({ length: group.remainingOpenings }, (_, index) => (
                <li key={`${group.position}-open-${index + 1}`} className="next-season-outlook__row next-season-outlook__row--open">
                  <strong>Open {group.position} Spot</strong>
                  <span>Recruiting need</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {outlook.departures.length > 0 && (
        <section className="next-season-outlook__departures" aria-labelledby="departing-seniors-heading">
          <h3 id="departing-seniors-heading" className="section-title">Departing Seniors</h3>
          <ul className="next-season-outlook__rows">
            {outlook.departures.map((player) => (
              <li key={player.playerId} className="next-season-outlook__row">
                <button type="button" className="text-link-button next-season-outlook__identity" onClick={() => onSelectPlayer(player.playerId)}>
                  {player.firstName} {player.lastName}
                </button>
                <span>{player.position} · Departing SR</span>
                <span><strong>{player.currentOverall}</strong> OVR</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
