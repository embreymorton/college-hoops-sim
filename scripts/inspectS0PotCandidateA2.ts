import { calculateOverall, MIN_PLAYER_RATING, type ClassYear } from '../src/engine'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile } from './dynastyLongRunMetrics'
import { collectEndogenousPotReference } from './inspectEndogenousPotReference'
import { generateS0PotCandidateA, S0_POT_CANDIDATE_A } from './s0PotCandidateA'
import { generateS0PotCandidateA2, realizedFraction, S0_POT_CANDIDATE_A2 } from './s0PotCandidateA2'

const YEARS = ['FR', 'SO', 'JR', 'SR'] as const
type Arm = 'a1' | 'a2'
type Row = { id: string; name: string; position: string; programId: string; year: ClassYear; ovr: number; legacy: number; a1: number; a2: number; seed: string }
type ReferenceRow = { overall: number; potential: number }
const fixed = (value: number, digits = 2) => value.toFixed(digits)
const pct = (count: number, total: number) => total === 0 ? 'n/a' : `${fixed(count / total * 100)}%`
const table = (headers: string[], rows: (string | number)[][]) => { console.log(`| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`); rows.forEach((row) => console.log(`| ${row.join(' | ')} |`)) }
const pot = (row: Row, arm: Arm) => row[arm]
const gap = (row: Row, arm: Arm) => pot(row, arm) - row.ovr
const rf = (row: Row, arm: Arm) => realizedFraction(row.ovr, pot(row, arm))
const rate = (rows: Row[], test: (row: Row) => boolean) => `${rows.filter(test).length} (${pct(rows.filter(test).length, rows.length)})`
const refRate = (rows: ReferenceRow[], test: (row: ReferenceRow) => boolean) => pct(rows.filter(test).length, rows.length)
const summary = (values: number[]) => ({ mean: average(values), med: percentile(values, .5), p25: percentile(values, .25), p75: percentile(values, .75), p90: percentile(values, .9), p95: percentile(values, .95), p99: percentile(values, .99), max: Math.max(...values) })
const hrBand = (value: number) => value <= 3 ? '0–3' : value <= 7 ? '4–7' : value <= 12 ? '8–12' : value <= 19 ? '13–19' : '20+'

function collect(universes: number, root: string) {
  const rows: Row[] = []
  for (let index = 0; index < universes; index += 1) {
    const seed = `${root}:${index}`
    const universe = initializeUniverse(UNIVERSE_V0, seed)
    for (const { program, team } of universe.programs) for (const player of team.roster) {
      const ovr = calculateOverall(player)
      const input = { overall: ovr, classYear: player.classYear, universeSeed: seed, programId: program.id, playerId: player.id }
      rows.push({ id: player.id, name: `${player.firstName} ${player.lastName}`, position: player.position, programId: program.id, year: player.classYear, ovr, legacy: player.potential, a1: generateS0PotCandidateA(input), a2: generateS0PotCandidateA2(input), seed })
    }
  }
  return rows
}

function marginalRow(label: string, rows: Row[], arm: Arm) {
  const values = rows.map((row) => pot(row, arm)); const s = summary(values)
  return [label, `${fixed(s.mean)}/${s.med}/${s.p75}/${s.p90}/${s.p95}/${s.p99}/${s.max}`, ...[80, 85, 90, 95, 97].map((threshold) => pct(values.filter((value) => value >= threshold).length, values.length)), pct(values.filter((value) => value === 99).length, values.length)]
}

function referenceMarginalRow(label: string, rows: ReferenceRow[]) {
  const values = rows.map((row) => row.potential); const s = summary(values)
  return [label, `${fixed(s.mean)}/${s.med}/${s.p75}/${s.p90}/${s.p95}/${s.p99}/${s.max}`, ...[80, 85, 90, 95, 97].map((threshold) => pct(values.filter((value) => value >= threshold).length, values.length)), pct(values.filter((value) => value === 99).length, values.length)]
}

function realizationRow(label: string, rows: Row[], arm: Arm) {
  const values = rows.map((row) => rf(row, arm)); const s = summary(values)
  return [label, rows.length, `${fixed(s.mean, 3)}/${fixed(s.med, 3)}/${fixed(s.p25, 3)}/${fixed(s.p75, 3)}/${fixed(s.p90, 3)}`]
}

function eliteRow(label: string, rows: Row[], arm: Arm, threshold: number) {
  const selected = rows.filter((row) => threshold === 99 ? pot(row, arm) === 99 : pot(row, arm) >= threshold)
  const o = summary(selected.map((row) => row.ovr)); const h = summary(selected.map((row) => gap(row, arm)))
  return [label, selected.length, `${fixed(o.mean)}/${o.med}`, `${fixed(h.mean)}/${h.med}`, ...[3, 7].map((value) => pct(selected.filter((row) => gap(row, arm) <= value).length, selected.length)), ...[13, 20].map((value) => pct(selected.filter((row) => gap(row, arm) >= value).length, selected.length))]
}

function referenceEliteRow(label: string, rows: ReferenceRow[], threshold: number) {
  const selected = rows.filter((row) => threshold === 99 ? row.potential === 99 : row.potential >= threshold)
  const o = summary(selected.map((row) => row.overall)); const h = summary(selected.map((row) => row.potential - row.overall))
  return [label, selected.length, `${fixed(o.mean)}/${o.med}`, `${fixed(h.mean)}/${h.med}`, ...[3, 7].map((value) => pct(selected.filter((row) => row.potential - row.overall <= value).length, selected.length)), ...[13, 20].map((value) => pct(selected.filter((row) => row.potential - row.overall >= value).length, selected.length))]
}

function formatExample(row: Row | undefined) { return row ? `${row.name} | ${row.programId} | ${row.position} | ${row.year} | ${row.ovr}/${row.a2} | HR${gap(row, 'a2')} | r=${fixed(rf(row, 'a2'), 3)}` : 'none' }
function example(rows: Row[], test: (row: Row) => boolean) { const matches = rows.filter(test).sort((a, b) => a.ovr - b.ovr || a.id.localeCompare(b.id)); return matches[Math.floor(matches.length / 2)] }

export function runReport() {
  const universes = Number(process.env.UNIVERSES ?? 500); const root = process.env.SEED ?? 's0-pot-candidate-a2:v1'
  const all = collect(universes, root); const references = collectEndogenousPotReference(500, 'endogenous-pot-reference:v1').stages as ReferenceRow[][]
  console.log(`# S0 POT Candidate A2\nA1 ${JSON.stringify(S0_POT_CANDIDATE_A)}\nA2 ${JSON.stringify(S0_POT_CANDIDATE_A2)}\nFormula A1Weight × exp(lambda[class] × (OVR-${MIN_PLAYER_RATING})/(POT-${MIN_PLAYER_RATING}))\nUniverses ${universes}; paired S0 players ${all.length}; reference careers ${references[0]!.length}; seed ${root}`)

  console.log('\n## POT marginals A1 / A2 / endogenous')
  table(['Arm/stage', 'Mean/med/P75/P90/P95/P99/max', '80+', '85+', '90+', '95+', '97+', '99'], YEARS.flatMap((year, stage) => { const rows = all.filter((row) => row.year === year); return [marginalRow(`A1 ${year}`, rows, 'a1'), marginalRow(`A2 ${year}`, rows, 'a2'), referenceMarginalRow(`REF +${stage}`, references[stage]!)] }))

  console.log('\n## Headroom and correlations')
  table(['Arm/stage', 'Mean/med', '0–3', '4–7', '8–12', '13–19', '20+', '8+', '13+', '20+', 'OVR↔POT', 'OVR↔HR'], YEARS.flatMap((year, stage) => {
    const rows = all.filter((row) => row.year === year)
    const candidate = (arm: Arm) => { const gaps = rows.map((row) => gap(row, arm)); return [`${arm.toUpperCase()} ${year}`, `${fixed(average(gaps))}/${percentile(gaps, .5)}`, ...['0–3', '4–7', '8–12', '13–19', '20+'].map((band) => pct(gaps.filter((value) => hrBand(value) === band).length, gaps.length)), ...[8, 13, 20].map((threshold) => pct(gaps.filter((value) => value >= threshold).length, gaps.length)), fixed(correlation(rows.map((row) => ({ first: row.ovr, second: pot(row, arm) }))), 3), fixed(correlation(rows.map((row) => ({ first: row.ovr, second: gap(row, arm) }))), 3)] }
    const ref = references[stage]!; const gaps = ref.map((row) => row.potential - row.overall)
    return [candidate('a1'), candidate('a2'), [`REF +${stage}`, `${fixed(average(gaps))}/${percentile(gaps, .5)}`, ...['0–3', '4–7', '8–12', '13–19', '20+'].map((band) => pct(gaps.filter((value) => hrBand(value) === band).length, gaps.length)), ...[8, 13, 20].map((threshold) => pct(gaps.filter((value) => value >= threshold).length, gaps.length)), fixed(correlation(ref.map((row) => ({ first: row.overall, second: row.potential }))), 3), fixed(correlation(ref.map((row) => ({ first: row.overall, second: row.potential - row.overall }))), 3)]]
  }))

  console.log('\n## Primary elite upperclassman gate')
  for (const threshold of [95, 97]) table([`POT${threshold}+`, 'N', 'OVR mean/med', 'HR mean/med', '≤3', '≤7', '13+', '20+'], (['JR', 'SR'] as const).flatMap((year) => { const stage = YEARS.indexOf(year); const rows = all.filter((row) => row.year === year); return [eliteRow(`A1 ${year}`, rows, 'a1', threshold), eliteRow(`A2 ${year}`, rows, 'a2', threshold), referenceEliteRow(`REF +${stage}`, references[stage]!, threshold)] }))

  console.log('\n## Elite ceiling supply')
  table(['Arm/stage', '90+', '95+', '97+', '99'], YEARS.flatMap((year, stage) => { const rows = all.filter((row) => row.year === year); return [(['a1', 'a2'] as const).map((arm) => [`${arm.toUpperCase()} ${year}`, ...[90, 95, 97].map((threshold) => pct(rows.filter((row) => pot(row, arm) >= threshold).length, rows.length)), pct(rows.filter((row) => pot(row, arm) === 99).length, rows.length)]), [[`REF +${stage}`, ...[90, 95, 97].map((threshold) => refRate(references[stage]!, (row) => row.potential >= threshold)), refRate(references[stage]!, (row) => row.potential === 99)]]].flat() }))

  console.log('\n## Project preservation')
  const projectTests = [['OVR<75/POT90+', (row: Row) => row.ovr < 75 && row.a2 >= 90], ['OVR<75/POT95+', (row: Row) => row.ovr < 75 && row.a2 >= 95], ['OVR<75/POT97+', (row: Row) => row.ovr < 75 && row.a2 >= 97], ['OVR<75/POT99', (row: Row) => row.ovr < 75 && row.a2 === 99], ['OVR<75/HR13+', (row: Row) => row.ovr < 75 && gap(row, 'a2') >= 13], ['OVR<75/HR20+', (row: Row) => row.ovr < 75 && gap(row, 'a2') >= 20]] as const
  table(['Profile', ...YEARS], projectTests.map(([label, test]) => [label, ...YEARS.map((year) => rate(all.filter((row) => row.year === year), test))]))

  console.log('\n## Polished profiles')
  table(['Profile', ...YEARS], [75, 85, 90].map((threshold) => [`OVR${threshold}+/HR≤3`, ...YEARS.map((year) => rate(all.filter((row) => row.year === year), (row) => row.ovr >= threshold && gap(row, 'a2') <= 3))]))

  console.log('\n## High-current A2 behavior')
  for (const year of YEARS) table([`${year} OVR`, 'N', 'POT mean/med', '95+', '97+', '99', 'HR mean', '≤3', '≤7'], ([['85–89', 85, 89], ['90+', 90, Infinity]] as const).map(([label, low, high]) => { const rows = all.filter((row) => row.year === year && row.ovr >= low && row.ovr <= high); return [label, rows.length, `${fixed(average(rows.map((row) => row.a2)))}/${percentile(rows.map((row) => row.a2), .5)}`, ...[95, 97].map((threshold) => pct(rows.filter((row) => row.a2 >= threshold).length, rows.length)), pct(rows.filter((row) => row.a2 === 99).length, rows.length), fixed(average(rows.map((row) => gap(row, 'a2')))), ...[3, 7].map((threshold) => pct(rows.filter((row) => gap(row, 'a2') <= threshold).length, rows.length))] }))

  console.log('\n## Low-current elite ceilings A2')
  for (const year of YEARS) table([`${year} OVR`, 'N', '90+', '95+', '97+', '99', 'HR13+', 'HR20+'], ([['<65', -Infinity, 64], ['65–74', 65, 74]] as const).map(([label, low, high]) => { const rows = all.filter((row) => row.year === year && row.ovr >= low && row.ovr <= high); return [label, rows.length, ...[90, 95, 97].map((threshold) => pct(rows.filter((row) => row.a2 >= threshold).length, rows.length)), pct(rows.filter((row) => row.a2 === 99).length, rows.length), ...[13, 20].map((threshold) => pct(rows.filter((row) => gap(row, 'a2') >= threshold).length, rows.length))] }))

  const p99 = all.filter((row) => row.a2 === 99); const universeCounts = [...new Set(all.map((row) => row.seed))].map((seed) => p99.filter((row) => row.seed === seed).length)
  console.log(`\n## 99 POT semantics\n${p99.length}/${all.length} ${pct(p99.length, all.length)}; ${fixed(p99.length / universes)} per universe; zero/one/two/3+ ${[0, 1, 2].map((count) => pct(universeCounts.filter((value) => value === count).length, universeCounts.length)).join('/')} / ${pct(universeCounts.filter((value) => value >= 3).length, universeCounts.length)}; class ${YEARS.map((year) => `${year} ${p99.filter((row) => row.year === year).length}`).join(' | ')}; OVR ${fixed(average(p99.map((row) => row.ovr)))}/${percentile(p99.map((row) => row.ovr), .5)} range ${Math.min(...p99.map((row) => row.ovr))}-${Math.max(...p99.map((row) => row.ovr))}; HR ${fixed(average(p99.map((row) => gap(row, 'a2'))))}/${percentile(p99.map((row) => gap(row, 'a2')), .5)}`)
  table(['Class', 'N', 'OVR mean/med', 'HR mean/med', '<65', '65–74', '75–84', '85–89', '90+'], YEARS.map((year) => { const rows = p99.filter((row) => row.year === year); return [year, rows.length, `${fixed(average(rows.map((row) => row.ovr)))}/${percentile(rows.map((row) => row.ovr), .5)}`, `${fixed(average(rows.map((row) => gap(row, 'a2'))))}/${percentile(rows.map((row) => gap(row, 'a2')), .5)}`, ...([[-Infinity, 64], [65, 74], [75, 84], [85, 89], [90, Infinity]] as const).map(([low, high]) => pct(rows.filter((row) => row.ovr >= low && row.ovr <= high).length, rows.length))] }))

  console.log('\n## Realized fraction')
  table(['Cohort', 'N', 'Mean/med/P25/P75/P90'], YEARS.flatMap((year) => { const rows = all.filter((row) => row.year === year); return [realizationRow(`${year} all`, rows, 'a2'), ...[95, 97, 99].map((threshold) => realizationRow(`${year} POT${threshold}${threshold === 99 ? '' : '+'}`, rows.filter((row) => threshold === 99 ? row.a2 === 99 : row.a2 >= threshold), 'a2'))] }))

  console.log('\n## Example A2 players')
  for (const year of YEARS) { const rows = all.filter((row) => row.year === year); console.log(`${year}\n  polished: ${formatExample(example(rows, (row) => row.ovr >= 85 && gap(row, 'a2') <= 3))}\n  runway: ${formatExample(example(rows, (row) => row.ovr >= 80 && gap(row, 'a2') >= 4 && gap(row, 'a2') <= 12))}\n  elite project: ${formatExample(example(rows, (row) => row.ovr < 75 && row.a2 >= 95))}\n  exceptional project: ${formatExample(example(rows, (row) => row.ovr < 75 && row.a2 >= 97))}`) }

  const groups = [...new Set(all.map((row) => row.seed))].map((seed) => ({ seed, rows: all.filter((row) => row.seed === seed && row.year === 'FR').sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id)) })).sort((a, b) => average(a.rows.slice(0, 3).map((row) => row.ovr)) - average(b.rows.slice(0, 3).map((row) => row.ovr)))
  console.log('\n## Freshmen to Know'); for (const [label, group] of [['Ordinary', groups[0]!], ['Typical', groups[Math.floor(groups.length / 2)]!], ['Strong', groups.at(-1)!]] as const) console.log(`${label} ${group.seed}: ${group.rows.slice(0, 3).map((row) => `${row.name} ${row.programId} ${row.position} ${row.ovr}/${row.a2}`).join(' | ')}`)

  const preservation = all.every((row) => row.a2 >= row.ovr && row.a2 <= 99) && all.every((row) => row.a1 >= row.ovr && row.a1 <= 99)
  console.log(`\n## Preservation\nPaired rows ${all.length}; unique IDs ${new Set(all.map((row) => row.id)).size}; diagnostic arms share IDs/programs/classes/positions/attributes/OVR by construction; production POT retained separately; legal ${preservation}; no production mutation or production A2 import.`)
}

if (import.meta.url === `file://${process.argv[1]}`) runReport()
