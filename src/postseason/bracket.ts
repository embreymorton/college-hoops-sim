import {
  POSTSEASON_V0_VERSION,
  type NationalTournamentBracket,
  type TournamentGame,
  type TournamentParticipantSource,
  type TournamentRound,
} from './domain'

const seed = (value: number): TournamentParticipantSource => ({
  type: 'seed',
  seed: value,
})
const winner = (gameId: string): TournamentParticipantSource => ({
  type: 'winner',
  gameId,
})

function game(
  id: string,
  index: number,
  round: TournamentRound,
  first: TournamentParticipantSource,
  second: TournamentParticipantSource,
): TournamentGame {
  return { id, index, round, participantSources: [first, second] }
}

/** Accepted fixed 16-team national bracket; winners advance without reseeding. */
export function createNationalTournamentBracket(): NationalTournamentBracket {
  const games = [
    game('national-r16-g1', 0, 'round-of-16', seed(1), seed(16)),
    game('national-r16-g2', 1, 'round-of-16', seed(8), seed(9)),
    game('national-r16-g3', 2, 'round-of-16', seed(5), seed(12)),
    game('national-r16-g4', 3, 'round-of-16', seed(4), seed(13)),
    game('national-r16-g5', 4, 'round-of-16', seed(3), seed(14)),
    game('national-r16-g6', 5, 'round-of-16', seed(6), seed(11)),
    game('national-r16-g7', 6, 'round-of-16', seed(7), seed(10)),
    game('national-r16-g8', 7, 'round-of-16', seed(2), seed(15)),
    game(
      'national-qf-g1',
      8,
      'quarterfinals',
      winner('national-r16-g1'),
      winner('national-r16-g2'),
    ),
    game(
      'national-qf-g2',
      9,
      'quarterfinals',
      winner('national-r16-g3'),
      winner('national-r16-g4'),
    ),
    game(
      'national-qf-g3',
      10,
      'quarterfinals',
      winner('national-r16-g5'),
      winner('national-r16-g6'),
    ),
    game(
      'national-qf-g4',
      11,
      'quarterfinals',
      winner('national-r16-g7'),
      winner('national-r16-g8'),
    ),
    game(
      'national-sf-g1',
      12,
      'semifinals',
      winner('national-qf-g1'),
      winner('national-qf-g2'),
    ),
    game(
      'national-sf-g2',
      13,
      'semifinals',
      winner('national-qf-g3'),
      winner('national-qf-g4'),
    ),
    game(
      'national-final',
      14,
      'championship',
      winner('national-sf-g1'),
      winner('national-sf-g2'),
    ),
  ] as const

  return { version: POSTSEASON_V0_VERSION, games }
}
