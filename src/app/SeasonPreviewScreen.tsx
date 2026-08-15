import { calculateOverall } from '../engine'
import {
  deriveSeasonPreview,
  type FollowedSeasonPreview,
  type FreshFacePreview,
  type ReturningStarPreview,
  type SeasonPreviewPlayerBase,
} from '../dynasty'
import { ExplorationBackButton } from '../components'
import { useDynastyStore } from '../store'
import { UNIVERSE_V0 } from '../universe'

const PROGRAM_NAMES: ReadonlyMap<string, string> = new Map(UNIVERSE_V0.programs.map((program) => [program.id, program.name]))

function PlayerLink({ row }: { readonly row: SeasonPreviewPlayerBase }) {
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)
  return <button type="button" className="text-link-button" onClick={() => openPlayerDetails(row.programId, row.playerId)}>{row.player.firstName} {row.player.lastName}</button>
}

function ProgramLink({ row }: { readonly row: SeasonPreviewPlayerBase }) {
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)
  return <button type="button" className="text-link-button" onClick={() => openTeamDetails(row.programId)}>{PROGRAM_NAMES.get(row.programId) ?? row.programId}</button>
}

function StandardTable({ title, rows, extra }: {
  readonly title: string
  readonly rows: readonly SeasonPreviewPlayerBase[]
  readonly extra?: (row: SeasonPreviewPlayerBase) => React.ReactNode
}) {
  return (
    <section className="section season-preview-group">
      <h2 className="section-title">{title}</h2>
      <div className="table-scroll">
        <table className="season-preview-table">
          <thead><tr><th>Player</th><th>Program</th><th>Class</th><th>OVR</th>{extra ? <th>Preview note</th> : null}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.playerId}><td><PlayerLink row={row} /></td><td><ProgramLink row={row} /></td><td>{row.player.classYear}</td><td>{row.currentOverall}</td>{extra ? <td>{extra(row)}</td> : null}</tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

function signed(value: number): string { return value > 0 ? `+${value}` : String(value) }

export function SeasonPreviewScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const followedPlayerIds = useDynastyStore((state) => state.followedPlayerIds)
  const explorationViewHistory = useDynastyStore((state) => state.explorationViewHistory)
  const goBackFromExploration = useDynastyStore((state) => state.goBackFromExploration)
  if (!dynasty?.activeSeason) return null

  const preview = deriveSeasonPreview(dynasty, followedPlayerIds)
  return (
    <main className="season-preview-screen">
      <ExplorationBackButton destination={explorationViewHistory.at(-1) ?? 'hub'} onClick={goBackFromExploration} />
      <header className="section season-preview-hero">
        <p className="eyebrow-tag">Season {preview.seasonNumber}</p>
        <h1 className="section-title">Season Preview</h1>
        <p className="section-hint">The players shaping the national picture before the season settles in.</p>
      </header>
      {preview.kind === 'initial' ? <>
        <StandardTable title="Established Players" rows={preview.establishedPlayers} />
        <StandardTable title="Freshmen to Know" rows={preview.freshmenToKnow} />
      </> : <>
        <StandardTable title="Returning Stars" rows={preview.returningStars} extra={(base) => { const row = base as ReturningStarPreview; return `${row.previousPointsPerGame.toFixed(1)} PPG last season · ${signed(row.overallChange)} OVR` }} />
        <StandardTable title="Biggest Leaps" rows={preview.biggestLeaps} extra={(base) => `${signed((base as ReturningStarPreview).overallChange)} OVR`} />
        <StandardTable title="Fresh Faces" rows={preview.freshFaces} extra={(base) => { const row = base as FreshFacePreview; return `${row.stars}-star · No. ${row.nationalRank} recruit` }} />
      </>}
      {preview.followedPlayers.length > 0 ? <StandardTable title={preview.kind === 'initial' ? 'Your Following' : 'Following'} rows={preview.followedPlayers} extra={(base) => { const row = base as FollowedSeasonPreview; return row.kind === 'initial' ? `OVR ${calculateOverall(row.player)}` : row.kind === 'freshman' ? 'Incoming freshman' : `${signed(row.overallChange!)} OVR` }} /> : null}
    </main>
  )
}
