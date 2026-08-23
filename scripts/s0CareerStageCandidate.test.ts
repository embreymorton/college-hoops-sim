import { describe, expect, it } from 'vitest'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { assignCandidateClasses } from './s0CareerStageCandidate'

describe('S0 career-stage priority candidate', () => {
  const program = initializeUniverse(UNIVERSE_V0, 'candidate-test').programs[0]!

  it('is deterministic and preserves every roster opportunity and class count', () => {
    const first = assignCandidateClasses(program.team.roster, 'candidate-test', program.program.id)
    expect(assignCandidateClasses(program.team.roster, 'candidate-test', program.program.id)).toEqual(first)
    expect(first.map(({ player }) => player)).toEqual(program.team.roster)
    expect(first.map(({ overall }) => overall)).toEqual(program.team.roster.map((player) => first.find(({ player: row }) => row.id === player.id)!.overall))
    expect(first.map(({ classYear }) => classYear).sort()).toEqual(program.team.roster.map(({ classYear }) => classYear).sort())
  })

  it('leaves every class eligible for every roster rank across deterministic seeds', () => {
    const observed = Array.from({ length: 12 }, () => new Set<string>())
    for (let index = 0; index < 2_000; index += 1) {
      assignCandidateClasses(program.team.roster, `eligibility:${index}`, program.program.id)
        .forEach(({ classYear }, rank) => observed[rank]!.add(classYear))
    }
    expect(observed.every((classes) => classes.size === 4)).toBe(true)
  })
})
