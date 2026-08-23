import { describe, expect, it } from 'vitest'
import { collectEndogenousPotReference } from './inspectEndogenousPotReference'

describe('endogenous POT reference diagnostic',()=>{
  it('is deterministic and preserves identity, POT, stage count, and ceiling invariants',()=>{
    const first=collectEndogenousPotReference(2,'pot-reference-test')
    expect(collectEndogenousPotReference(2,'pot-reference-test')).toEqual(first)
    expect(first.stages.every((stage)=>stage.length===first.careers.length)).toBe(true)
    expect(first.careers.every((career)=>career.stages.length===4&&career.stages.every((row)=>row.id===career.id&&row.potential===career.stages[0]!.potential&&row.overall<=row.potential))).toBe(true)
  })
})
