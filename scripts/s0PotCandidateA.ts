import { createRng, type ClassYear } from '../src/engine'

export const S0_POT_CANDIDATE_A = {
  namespace: 'college-hoops-sim:s0-pot-shared-prior-compatibility:candidate-a1:v1',
  tierMass: { limited: .20, normal: .538, high: .221, elite: .032, exceptional: .009 },
  highWeights: [.18,.17,.15,.13,.11,.09,.07,.05,.03,.02],
  eliteWeights: [.65,.35],
  exceptionalWeights: [.55,.15,.30],
  ordinaryLocation: { FR: 10, SO: 6, JR: 4, SR: 2 },
  ordinaryScale: 4,
  nearScale: 1.8,
  tailScale: 18,
  tailMix: { FR: .30, SO: .20, JR: .14, SR: .10 },
  nearMix: { FR: .28, SO: .40, JR: .50, SR: .58 },
  compatibilityPower: .82,
} as const

function prior(pot: number): number {
  const c=S0_POT_CANDIDATE_A
  if(pot<60||pot>99)return 0
  if(pot<=74)return c.tierMass.limited/15
  if(pot<=84)return c.tierMass.normal/10
  if(pot<=94)return c.tierMass.high*c.highWeights[pot-85]!
  if(pot<=96)return c.tierMass.elite*c.eliteWeights[pot-95]!
  return c.tierMass.exceptional*c.exceptionalWeights[pot-97]!
}

export function candidatePotWeight(overall:number,classYear:ClassYear,pot:number):number{
  if(pot<Math.max(60,overall)||pot>99)return 0
  const c=S0_POT_CANDIDATE_A; const h=pot-overall; const tail=c.tailMix[classYear]; const near=c.nearMix[classYear]; const ordinary=1-tail-near
  const compatibility=near*Math.exp(-h/c.nearScale)+ordinary*Math.exp(-Math.abs(h-c.ordinaryLocation[classYear])/c.ordinaryScale)+tail*Math.exp(-h/c.tailScale)
  return prior(pot)*Math.pow(compatibility,c.compatibilityPower)
}

export function generateS0PotCandidateA(input:{overall:number;classYear:ClassYear;universeSeed:string;programId:string;playerId:string}):number{
  const options=Array.from({length:100-Math.max(60,input.overall)},(_,i)=>Math.max(60,input.overall)+i)
  const weights=options.map((pot)=>candidatePotWeight(input.overall,input.classYear,pot)); const total=weights.reduce((a,b)=>a+b,0)
  if(!(total>0))throw new RangeError('S0 POT candidate has no legal positive-weight ceiling.')
  let draw=createRng(JSON.stringify({namespace:S0_POT_CANDIDATE_A.namespace,...input})).next()*total
  for(let i=0;i<options.length;i++){draw-=weights[i]!;if(draw<0)return options[i]!}
  return options.at(-1)!
}
