import { describe, expect, it } from 'vitest'
import {
  describeRemainingTournamentGames,
  formatTournamentProgressRoundName,
  formatTournamentQuickResult,
} from './postseasonFormatters'

describe('Postseason Hub polish formatters', () => {
  it('uses milestone-specific controlled Program outcome language', () => {
    expect(
      formatTournamentQuickResult('Northbridge', 'semifinals', 'advanced'),
    ).toBe('Northbridge Advances to the National Championship')
    expect(
      formatTournamentQuickResult('Northbridge', 'championship', 'champion'),
    ).toBe('National Champions')
    expect(
      formatTournamentQuickResult('Northbridge', 'quarterfinals', 'eliminated'),
    ).toBe('Tournament Run Ends')
  })

  it('uses informative round and natural remaining-game language', () => {
    expect(formatTournamentProgressRoundName('championship')).toBe(
      'National Championship',
    )
    expect(describeRemainingTournamentGames('semifinals', 1)).toBe(
      'Advance will simulate the remaining semifinal.',
    )
    expect(describeRemainingTournamentGames('quarterfinals', 3)).toBe(
      'Advance will simulate the remaining 3 quarterfinals.',
    )
  })
})
