import { BoxScorePanel, FinalScoreboard } from '../components'
import { useGamePresentationStore } from '../store'
import { formatOvertimeTag } from './formatters'
import { getDemoProgram } from '../demo/demoPrograms'

export function PostgameScreen() {
  const result = useGamePresentationStore((state) => state.result)
  const homeSetup = useGamePresentationStore((state) => state.homeSetup)
  const awaySetup = useGamePresentationStore((state) => state.awaySetup)
  const homeProgramId = useGamePresentationStore((state) => state.homeProgramId)
  const awayProgramId = useGamePresentationStore((state) => state.awayProgramId)
  const simulate = useGamePresentationStore((state) => state.simulate)
  const changeMatchup = useGamePresentationStore((state) => state.changeMatchup)

  if (!result) {
    return null
  }

  const homeProgram = getDemoProgram(homeProgramId)
  const awayProgram = getDemoProgram(awayProgramId)
  const homeIsWinner = result.winnerId === homeSetup.team.id
  const winnerName = homeIsWinner ? homeSetup.team.name : awaySetup.team.name

  return (
    <>
      <section className="section" aria-labelledby="final-heading">
        <h2 id="final-heading" className="visually-hidden">
          Final result
        </h2>
        <FinalScoreboard
          home={{
            name: homeSetup.team.name,
            accentColor: homeProgram.primaryColor,
            score: result.homeScore,
            isWinner: homeIsWinner,
          }}
          away={{
            name: awaySetup.team.name,
            accentColor: awayProgram.primaryColor,
            score: result.awayScore,
            isWinner: !homeIsWinner,
          }}
          winnerName={winnerName}
          overtimeTag={formatOvertimeTag(result.overtimePeriods)}
          primaryAction={{ label: 'Simulate Again', onClick: simulate }}
          secondaryAction={{ label: 'Change Matchup', onClick: changeMatchup }}
        />
      </section>
      <section className="section" aria-labelledby="box-score-heading">
        <div className="section-heading">
          <h2 id="box-score-heading" className="section-title">
            Player Box Score
          </h2>
        </div>
        <BoxScorePanel
          home={{
            team: homeSetup.team,
            stats: result.homePlayerStats,
            program: homeProgram,
          }}
          away={{
            team: awaySetup.team,
            stats: result.awayPlayerStats,
            program: awayProgram,
          }}
        />
      </section>
    </>
  )
}
