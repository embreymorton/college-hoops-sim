import { TOURNAMENT_ROUNDS, type TournamentRound } from '../postseason'
import { formatTournamentRoundName } from '../app/postseasonFormatters'

export interface BracketSlotParticipant {
  readonly seed: number
  readonly name: string
  readonly accentColor: string
  /** Null while the game is not yet complete. */
  readonly score: number | null
  readonly isWinner: boolean
  readonly isControlled: boolean
}

export interface BracketSlot {
  readonly gameId: string
  readonly round: TournamentRound
  readonly index: number
  /** Canonical first source slot; null while unresolved, never home orientation. */
  readonly top: BracketSlotParticipant | null
  /** Canonical second source slot; null while unresolved, never away orientation. */
  readonly bottom: BracketSlotParticipant | null
  readonly isComplete: boolean
  readonly isUpset: boolean
}

interface TournamentBracketProps {
  /** All 15 games across all four rounds, in any order. */
  readonly slots: readonly BracketSlot[]
  /** When omitted, renders the completed bracket as a read-only historical artifact. */
  readonly onSelectGame?: (gameId: string) => void
}

const TOTAL_ROW_UNITS = 16

/** Row-of-16-equivalent units each round's slot spans, so later rounds center over their two feeders. */
const ROUND_UNIT_HEIGHT: Record<TournamentRound, number> = {
  'round-of-16': 2,
  quarterfinals: 4,
  semifinals: 8,
  championship: 16,
}

/** Renders the canonical fixed 16-team bracket via a shared CSS Grid, deriving no advancement itself. */
export function TournamentBracket({ slots, onSelectGame }: TournamentBracketProps) {
  return (
    <div className="tournament-bracket-scroll">
      <div
        className="tournament-bracket"
        style={{ gridTemplateRows: `auto repeat(${TOTAL_ROW_UNITS}, minmax(0, 1fr))` }}
      >
        {TOURNAMENT_ROUNDS.map((round, roundIndex) => (
          <div
            key={round}
            className="tournament-bracket__round-header"
            style={{ gridColumn: roundIndex + 1, gridRow: 1 }}
          >
            {formatTournamentRoundName(round)}
          </div>
        ))}
        {TOURNAMENT_ROUNDS.map((round, roundIndex) => {
          const unitHeight = ROUND_UNIT_HEIGHT[round]
          const roundSlots = slots
            .filter((slot) => slot.round === round)
            .sort((first, second) => first.index - second.index)

          return roundSlots.map((slot, positionInRound) => (
            <div
              key={slot.gameId}
              style={{
                gridColumn: roundIndex + 1,
                gridRow: `${positionInRound * unitHeight + 2} / span ${unitHeight}`,
              }}
              className="tournament-bracket__cell"
            >
              <BracketSlotCard slot={slot} onSelectGame={onSelectGame} />
            </div>
          ))
        })}
      </div>
    </div>
  )
}

function slotAriaLabel(slot: BracketSlot): string | undefined {
  if (!slot.isComplete || !slot.top || !slot.bottom) {
    return undefined
  }

  const winner = slot.top.isWinner ? slot.top : slot.bottom
  const loser = slot.top.isWinner ? slot.bottom : slot.top

  return `${formatTournamentRoundName(slot.round)}: ${winner.name} defeated ${loser.name}, ${winner.score}-${loser.score}`
}

function BracketSlotCard({
  slot,
  onSelectGame,
}: {
  slot: BracketSlot
  onSelectGame?: (gameId: string) => void
}) {
  const rows = (
    <>
      <BracketParticipantRow participant={slot.top} />
      <BracketParticipantRow participant={slot.bottom} />
    </>
  )

  if (slot.isComplete && onSelectGame) {
    return (
      <button
        type="button"
        className="bracket-slot bracket-slot--complete"
        data-game-id={slot.gameId}
        onClick={() => onSelectGame(slot.gameId)}
        aria-label={slotAriaLabel(slot)}
      >
        {rows}
        {slot.isUpset && <span className="bracket-slot__upset">Upset</span>}
      </button>
    )
  }

  return (
    <div
      className={`bracket-slot${slot.isComplete ? ' bracket-slot--complete bracket-slot--read-only' : ''}`}
      data-game-id={slot.gameId}
      aria-label={slotAriaLabel(slot)}
    >
      {rows}
      {slot.isUpset && <span className="bracket-slot__upset">Upset</span>}
    </div>
  )
}

function BracketParticipantRow({
  participant,
}: {
  participant: BracketSlotParticipant | null
}) {
  if (!participant) {
    return (
      <div className="bracket-slot__row bracket-slot__row--tbd">
        <span className="bracket-slot__seed">—</span>
        <span className="bracket-slot__name">TBD</span>
      </div>
    )
  }

  return (
    <div
      className="bracket-slot__row"
      data-winner={participant.isWinner}
      data-controlled={participant.isControlled}
    >
      <span className="bracket-slot__seed">{participant.seed}</span>
      <span
        className="team-color-dot"
        style={{ background: participant.accentColor }}
        aria-hidden="true"
      />
      <span className="bracket-slot__name">
        {participant.name}
        {participant.isControlled && (
          <span className="standings-you-tag"> · You</span>
        )}
      </span>
      {participant.score !== null && (
        <span className="bracket-slot__score">{participant.score}</span>
      )}
    </div>
  )
}
