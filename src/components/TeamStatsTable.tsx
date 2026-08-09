import { useState } from 'react'
import { calculateOverall, type Team } from '../engine'
import type { PlayerSeasonStats } from '../season'
import { formatPercentage, formatRating } from '../app/formatters'

interface TeamStatsTableProps {
  readonly team: Team
  readonly statsByPlayerId: ReadonlyMap<string, PlayerSeasonStats>
  readonly onSelectPlayer: (playerId: string) => void
}

type StatsTab = 'overview' | 'shooting'

/** Roster ratings alongside derived Player Season Stats, in two restrained density modes. */
export function TeamStatsTable({
  team,
  statsByPlayerId,
  onSelectPlayer,
}: TeamStatsTableProps) {
  const [tab, setTab] = useState<StatsTab>('overview')
  const rows = team.roster
    .map((player) => ({
      player,
      stats: statsByPlayerId.get(player.id)!,
    }))
    .sort(
      (first, second) =>
        second.stats.minutesPerGame - first.stats.minutesPerGame ||
        second.stats.pointsPerGame - first.stats.pointsPerGame ||
        first.player.id.localeCompare(second.player.id),
    )

  return (
    <div>
      <div
        role="group"
        aria-label="Stat view"
        className="tab-list team-stats-tabs"
      >
        <button
          type="button"
          className="tab"
          aria-pressed={tab === 'overview'}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className="tab"
          aria-pressed={tab === 'shooting'}
          onClick={() => setTab('shooting')}
        >
          Shooting + Defense
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="visually-hidden">
            {`${team.name} roster and season stats — ${tab === 'overview' ? 'overview' : 'shooting and defense'}`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Pos</th>
              <th scope="col">Player</th>
              <th scope="col">Cl</th>
              {tab === 'overview' ? (
                <>
                  <th scope="col">Ovr</th>
                  <th scope="col">Pot</th>
                  <th scope="col">GP</th>
                  <th scope="col">MPG</th>
                  <th scope="col">PPG</th>
                  <th scope="col">RPG</th>
                  <th scope="col">APG</th>
                </>
              ) : (
                <>
                  <th scope="col">FG%</th>
                  <th scope="col">3P%</th>
                  <th scope="col">FT%</th>
                  <th scope="col">SPG</th>
                  <th scope="col">BPG</th>
                  <th scope="col">TOPG</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, stats }) => (
              <tr key={player.id} data-zero-minutes={stats.gamesPlayed === 0}>
                <td className="player-pos-cell">{player.position}</td>
                <td className="player-name-cell">
                  <button
                    type="button"
                    className="text-link-button"
                    onClick={() => onSelectPlayer(player.id)}
                  >
                    {player.firstName} {player.lastName}
                  </button>
                </td>
                <td>{player.classYear}</td>
                {tab === 'overview' ? (
                  <>
                    <td>{calculateOverall(player)}</td>
                    <td>{player.potential}</td>
                    <td>{stats.gamesPlayed}</td>
                    <td>{formatRating(stats.minutesPerGame)}</td>
                    <td>{formatRating(stats.pointsPerGame)}</td>
                    <td>{formatRating(stats.reboundsPerGame)}</td>
                    <td>{formatRating(stats.assistsPerGame)}</td>
                  </>
                ) : (
                  <>
                    <td>{formatPercentage(stats.fieldGoalPercentage)}</td>
                    <td>{formatPercentage(stats.threePointPercentage)}</td>
                    <td>{formatPercentage(stats.freeThrowPercentage)}</td>
                    <td>{formatRating(stats.stealsPerGame)}</td>
                    <td>{formatRating(stats.blocksPerGame)}</td>
                    <td>{formatRating(stats.turnoversPerGame)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
