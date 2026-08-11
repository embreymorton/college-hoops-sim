import {
  calculateOverall,
  createRng,
  generatePlayer,
  type Player,
  type Position,
} from '../src/engine'
import {
  deriveAttributeDevelopmentGains,
  deriveDevelopmentTendency,
  developReturningPlayer,
} from '../src/dynasty'
import { average, summarizeDistribution } from './dynastyLongRunMetrics'

export interface DevelopmentProfile {
  readonly overall: number
  readonly potential: number
}

export const DEVELOPMENT_PROFILES: readonly DevelopmentProfile[] = [
  { overall: 55, potential: 60 }, { overall: 55, potential: 75 }, { overall: 55, potential: 90 },
  { overall: 65, potential: 75 }, { overall: 65, potential: 90 }, { overall: 65, potential: 99 },
  { overall: 75, potential: 80 }, { overall: 75, potential: 90 }, { overall: 75, potential: 99 },
  { overall: 85, potential: 90 }, { overall: 85, potential: 99 },
]

export interface CareerOutcome {
  readonly requested: DevelopmentProfile
  readonly startingOverall: number
  readonly potential: number
  readonly tendency: ReturnType<typeof deriveDevelopmentTendency>
  readonly seniorOverall: number
  readonly annualGains: readonly number[]
  readonly annualHeadrooms: readonly number[]
  readonly attributesImproved: readonly number[]
  readonly largestAttributeGain: readonly number[]
}

const POSITIONS: readonly Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

function profileKey(profile: DevelopmentProfile): string {
  return `${profile.overall}/${profile.potential}`
}

function generateProfilePlayer(profile: DevelopmentProfile, career: number): Player {
  const generated = generatePlayer({
    position: POSITIONS[career % POSITIONS.length]!,
    talentLevel: profile.overall,
    classYear: 'FR',
    rng: createRng(`development-diagnostic:v1:${profileKey(profile)}:${career}`),
  })
  return {
    ...generated,
    id: `development-diagnostic-${profileKey(profile)}-${career}-${generated.id}`,
    potential: Math.max(profile.potential, calculateOverall(generated)),
  }
}

export function runDevelopmentCareers(options: {
  readonly profiles?: readonly DevelopmentProfile[]
  readonly careersPerProfile?: number
} = {}): readonly CareerOutcome[] {
  const profiles = options.profiles ?? DEVELOPMENT_PROFILES
  const careersPerProfile = options.careersPerProfile ?? 500
  const outcomes: CareerOutcome[] = []
  for (const profile of profiles) {
    for (let career = 0; career < careersPerProfile; career += 1) {
      let player = generateProfilePlayer(profile, career)
      const startingOverall = calculateOverall(player)
      const tendency = deriveDevelopmentTendency(
        player,
        `development-diagnostic:v1:${profileKey(profile)}:${career}`,
      )
      const annualGains: number[] = []
      const annualHeadrooms: number[] = []
      const attributesImproved: number[] = []
      const largestAttributeGain: number[] = []
      for (let completedSeasonNumber = 1; completedSeasonNumber <= 3; completedSeasonNumber += 1) {
        const before = player
        annualHeadrooms.push(before.potential - calculateOverall(before))
        player = developReturningPlayer({
          player: before,
          dynastySeed: `development-diagnostic:v1:${profileKey(profile)}:${career}`,
          completedSeasonNumber,
          programId: 'development-diagnostic',
        })
        annualGains.push(calculateOverall(player) - calculateOverall(before))
        const attributeGains = deriveAttributeDevelopmentGains(before, player)
        attributesImproved.push(attributeGains.length)
        largestAttributeGain.push(Math.max(0, ...attributeGains.map(({ change }) => change)))
      }
      outcomes.push({
        requested: profile,
        startingOverall,
        potential: player.potential,
        tendency,
        seniorOverall: calculateOverall(player),
        annualGains,
        annualHeadrooms,
        attributesImproved,
        largestAttributeGain,
      })
    }
  }
  return outcomes
}

function percent(value: number): string { return `${(value * 100).toFixed(1)}%` }
function fixed(value: number): string { return value.toFixed(1) }
function distributionLine(values: readonly number[]): string {
  const summary = summarizeDistribution(values)
  return `min ${fixed(summary.minimum)} P10 ${fixed(summary.p10)} P25 ${fixed(summary.p25)} med ${fixed(summary.median)} P75 ${fixed(summary.p75)} P90 ${fixed(summary.p90)} P95 ${fixed(values.length ? [...values].sort((a, b) => a - b)[Math.round((values.length - 1) * .95)]! : 0)} max ${fixed(summary.maximum)}`
}
function headroomBand(value: number): string {
  if (value <= 4) return '0–4'
  if (value <= 9) return '5–9'
  if (value <= 19) return '10–19'
  if (value <= 29) return '20–29'
  return '30+'
}

export function printDevelopmentCareerReport(outcomes: readonly CareerOutcome[]): void {
  const annual = outcomes.flatMap(({ annualGains }) => annualGains)
  console.log('COLLEGE HOOPS SIM — PLAYER DEVELOPMENT CAREER DIAGNOSTIC\n')
  console.log(`Direct production careers: ${outcomes.length} (${outcomes.length / DEVELOPMENT_PROFILES.length} per requested profile)\n`)
  console.log('ANNUAL OVR GAIN DISTRIBUTION')
  console.log(distributionLine(annual))
  console.log(`0 ${percent(annual.filter((gain) => gain === 0).length / annual.length)} | 1+ ${percent(annual.filter((gain) => gain >= 1).length / annual.length)} | 3+ ${percent(annual.filter((gain) => gain >= 3).length / annual.length)} | 5+ ${percent(annual.filter((gain) => gain >= 5).length / annual.length)} | 6+ ${percent(annual.filter((gain) => gain >= 6).length / annual.length)} | 8+ ${percent(annual.filter((gain) => gain >= 8).length / annual.length)} | 10+ ${percent(annual.filter((gain) => gain >= 10).length / annual.length)}\n`)
  for (const [index, transition] of ['FR→SO', 'SO→JR', 'JR→SR'].entries()) {
    const gains = outcomes.map(({ annualGains }) => annualGains[index]!)
    console.log(`${transition}: ${distributionLine(gains)} | 5+ ${percent(gains.filter((gain) => gain >= 5).length / gains.length)} | 6+ ${percent(gains.filter((gain) => gain >= 6).length / gains.length)} | 8+ ${percent(gains.filter((gain) => gain >= 8).length / gains.length)} | 10+ ${percent(gains.filter((gain) => gain >= 10).length / gains.length)}`)
  }
  console.log('PROFILE OUTCOMES')
  console.log('REQUESTED  ACTUAL START  SENIOR P50/P90/P95/MAX  TOTAL GAIN P50/P90/P95  ≤5 POT  ≤10 POT  20+ BELOW')
  for (const profile of DEVELOPMENT_PROFILES) {
    const rows = outcomes.filter(({ requested }) => profileKey(requested) === profileKey(profile))
    if (rows.length === 0) continue
    const start = summarizeDistribution(rows.map(({ startingOverall }) => startingOverall))
    const senior = summarizeDistribution(rows.map(({ seniorOverall }) => seniorOverall))
    const gains = summarizeDistribution(rows.map(({ seniorOverall, startingOverall }) => seniorOverall - startingOverall))
    const gaps = rows.map(({ potential, seniorOverall }) => potential - seniorOverall)
    const p95 = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.round((values.length - 1) * .95)]!
    console.log(`${profileKey(profile).padEnd(9)}  ${fixed(start.median).padStart(5)}/${fixed(start.p10)}–${fixed(start.p90)}    ${fixed(senior.median).padStart(5)}/${fixed(senior.p90)}/${fixed(p95(rows.map(({ seniorOverall }) => seniorOverall)))}/${fixed(senior.maximum)}      ${fixed(gains.median).padStart(5)}/${fixed(gains.p90)}/${fixed(p95(rows.map(({ seniorOverall, startingOverall }) => seniorOverall - startingOverall)))}        ${percent(gaps.filter((gap) => gap <= 5).length / gaps.length).padStart(6)}  ${percent(gaps.filter((gap) => gap <= 10).length / gaps.length).padStart(7)}  ${percent(gaps.filter((gap) => gap >= 20).length / gaps.length).padStart(8)}`)
  }
  console.log('\nHEADROOM BEFORE OFFSEASON')
  for (const band of ['0–4', '5–9', '10–19', '20–29', '30+']) {
    const rows = outcomes.flatMap((outcome) => outcome.annualHeadrooms.map((headroom, index) => ({
      headroom, gain: outcome.annualGains[index]!, senior: outcome.seniorOverall, total: outcome.seniorOverall - outcome.startingOverall,
    }))).filter(({ headroom }) => headroomBand(headroom) === band)
    console.log(`${band.padEnd(6)} annual avg/med ${fixed(average(rows.map(({ gain }) => gain)))}/${fixed(summarizeDistribution(rows.map(({ gain }) => gain)).median)} | career gain ${fixed(average(rows.map(({ total }) => total)))} | senior ${fixed(average(rows.map(({ senior }) => senior)))} | n ${rows.length}`)
  }
  console.log('\nHIGH-POT RAW OUTCOME ARCHETYPES')
  for (const profile of DEVELOPMENT_PROFILES.filter(({ overall, potential }) => overall <= 65 && potential >= 90)) {
    const rows = outcomes.filter(({ requested }) => profileKey(requested) === profileKey(profile))
    const counts = { bust: 0, low: 0, solid: 0, hit: 0, breakout: 0 }
    for (const row of rows) {
      const gain = row.seniorOverall - row.startingOverall
      if (gain <= 7) counts.bust += 1
      else if (gain <= 11) counts.low += 1
      else if (gain <= 15) counts.solid += 1
      else if (gain <= 20) counts.hit += 1
      else counts.breakout += 1
    }
    console.log(`${profileKey(profile)}: BUST ${percent(counts.bust / rows.length)} | LOW ${percent(counts.low / rows.length)} | SOLID ${percent(counts.solid / rows.length)} | HIT ${percent(counts.hit / rows.length)} | BREAKOUT ${percent(counts.breakout / rows.length)}`)
  }
  console.log('\nTENDENCY OUTCOMES')
  for (const tendency of ['weak', 'steady', 'strong'] as const) {
    const rows = outcomes.filter((outcome) => outcome.tendency === tendency)
    console.log(`${tendency}: careers ${rows.length} | senior avg ${fixed(average(rows.map(({ seniorOverall }) => seniorOverall)))} | total gain avg ${fixed(average(rows.map(({ seniorOverall, startingOverall }) => seniorOverall - startingOverall)))} | annual 5+ ${percent(rows.flatMap(({ annualGains }) => annualGains).filter((gain) => gain >= 5).length / rows.flatMap(({ annualGains }) => annualGains).length)}`)
  }
  console.log(`\nATTRIBUTE ALLOCATION: attributes improved/offseason avg ${fixed(average(outcomes.flatMap(({ attributesImproved }) => attributesImproved)))}; largest individual gain avg/max ${fixed(average(outcomes.flatMap(({ largestAttributeGain }) => largestAttributeGain)))}/${Math.max(...outcomes.flatMap(({ largestAttributeGain }) => largestAttributeGain))}.`)
}

if (process.argv[1]?.endsWith('playerDevelopmentDiagnostic.ts')) {
  const outcomes = runDevelopmentCareers()
  printDevelopmentCareerReport(outcomes)
}
