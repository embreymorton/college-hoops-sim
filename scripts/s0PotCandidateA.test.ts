import { describe,expect,it } from 'vitest'
import { candidatePotWeight,generateS0PotCandidateA } from './s0PotCandidateA'

describe('S0 POT Candidate A',()=>{
  it('is deterministic, legal, and gives every intended legal POT positive support',()=>{
    for(const classYear of ['FR','SO','JR','SR'] as const)for(const overall of [40,60,72,90,99]){
      const input={overall,classYear,universeSeed:'candidate-test',programId:'p',playerId:`${classYear}-${overall}`}
      const first=generateS0PotCandidateA(input);expect(generateS0PotCandidateA(input)).toBe(first);expect(first).toBeGreaterThanOrEqual(overall);expect(first).toBeLessThanOrEqual(99)
      for(let pot=Math.max(60,overall);pot<=99;pot++)expect(candidatePotWeight(overall,classYear,pot)).toBeGreaterThan(0)
    }
  })
})
