import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DevelopmentRow } from '../app/offseasonFormatters'
import { DevelopmentTable } from './DevelopmentTable'

function row(id: string, options: { explosion?: boolean; completedClass?: 'FR'|'SO'|'JR'; reveal?: 'Inconsistent'|'Steady'|'Strong' } = {}): DevelopmentRow {
  const completedClass=options.completedClass??'FR'
  const nextClass=completedClass==='FR'?'SO':completedClass==='SO'?'JR':'SR'
  const previousOverall=completedClass==='JR'?61:63
  const change=options.explosion?(completedClass==='JR'?12:15):4
  return {
    player:{id,firstName:id,lastName:'Player',position:'PG',classYear:nextClass,height:74,potential:95,attributes:{finishing:70,shooting:70,playmaking:70,ballHandling:70,perimeterDefense:70,interiorDefense:50,rebounding:50,athleticism:70,stamina:70}},
    summary:{programId:'program',playerId:id,completedClass,nextClass,previousOverall,currentOverall:previousOverall+change,overallChange:change,potentialHeadroom:32},
    gains:[],
    workEthicReveal:options.reveal??null,
    explosion:options.explosion?{completedSeasonNumber:1,programId:'program',playerId:id,completedClass,nextClass,previousOverall,ordinaryOverall:previousOverall+3,currentOverall:previousOverall+change,ordinaryGain:3,explosionContribution:change-3,totalGain:change,potential:95,targetTotalGain:change,potentialTruncation:0}:null,
  }
}

describe('DevelopmentTable explosion and reveal presentation',()=>{
  it('leaves ordinary rows free of explosion labels',()=>{
    render(<DevelopmentTable rows={[row('Ordinary')]} biggestLeap={null}/>)
    expect(screen.queryByText('Explosive Offseason')).not.toBeInTheDocument()
  })

  it('renders multiple official facts, senior transitions, and a freshman Work Ethic reveal',()=>{
    const rows=[row('Marcus',{explosion:true,reveal:'Inconsistent'}),row('Senior',{explosion:true,completedClass:'JR'})]
    const {rerender}=render(<DevelopmentTable rows={rows} biggestLeap={rows[0]!}/>)
    expect(screen.getAllByText('Explosive Offseason')).toHaveLength(2)
    expect(screen.getByText('Work Ethic Revealed: Inconsistent')).toBeInTheDocument()
    const seniorRow=screen.getByText('Senior Player').closest('tr')!
    expect(within(seniorRow).getByText('SR')).toBeInTheDocument()
    expect(within(seniorRow).getByText('+12')).toBeInTheDocument()
    rerender(<DevelopmentTable rows={rows} biggestLeap={rows[0]!}/>)
    expect(screen.getAllByText('Explosive Offseason')).toHaveLength(2)
  })
})
