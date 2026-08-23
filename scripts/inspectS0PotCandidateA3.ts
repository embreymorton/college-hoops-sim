import { calculateOverall, type ClassYear } from '../src/engine'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile } from './dynastyLongRunMetrics'
import { A3_NORMALIZER_BASELINE, deriveA3Normalizers, evaluateA3Normalizer } from './deriveS0PotCandidateA3Normalizers'
import { collectEndogenousPotReference } from './inspectEndogenousPotReference'
import { generateS0PotCandidateA } from './s0PotCandidateA'
import { generateS0PotCandidateA2, realizedFraction } from './s0PotCandidateA2'
import { candidateA3RealizationTilt, generateS0PotCandidateA3, S0_POT_CANDIDATE_A3 } from './s0PotCandidateA3'

const YEARS = ['FR', 'SO', 'JR', 'SR'] as const
const ARMS = ['legacy', 'a1', 'a2', 'a3'] as const
type Arm = typeof ARMS[number]
type Row = { id: string; name: string; program: string; position: string; year: ClassYear; ovr: number; legacy: number; a1: number; a2: number; a3: number; seed: string }
type Ref = { overall: number; potential: number }
const fixed = (value: number, digits = 2) => value.toFixed(digits)
const pct = (count: number, total: number) => total ? `${fixed(count / total * 100)}%` : 'n/a'
const table = (headers: string[], rows: (string | number)[][]) => { console.log(`| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`); rows.forEach((row) => console.log(`| ${row.join(' | ')} |`)) }
const pot = (row: Row, arm: Arm) => row[arm]
const gap = (row: Row, arm: Arm) => pot(row, arm) - row.ovr
const rf = (row: Row, arm: Arm) => realizedFraction(row.ovr, pot(row, arm))
const rate = (rows: Row[], test: (row: Row) => boolean) => `${rows.filter(test).length} (${pct(rows.filter(test).length, rows.length)})`
const summary = (values: number[]) => ({ mean: average(values), med: percentile(values, .5), p75: percentile(values, .75), p90: percentile(values, .9), p95: percentile(values, .95), p99: percentile(values, .99), max: Math.max(...values) })
const band = (overall: number) => overall < 65 ? '<65' : overall < 75 ? '65–74' : overall < 85 ? '75–84' : overall < 90 ? '85–89' : '90+'
const hrBand = (headroom: number) => headroom <= 3 ? '0–3' : headroom <= 7 ? '4–7' : headroom <= 12 ? '8–12' : headroom <= 19 ? '13–19' : '20+'

function collect(universes: number, root: string) {
  const rows: Row[] = []
  for (let index = 0; index < universes; index += 1) {
    const seed = `${root}:${index}`; const universe = initializeUniverse(UNIVERSE_V0, seed)
    for (const { program, team } of universe.programs) for (const player of team.roster) {
      const ovr = calculateOverall(player); const input = { overall: ovr, classYear: player.classYear, universeSeed: seed, programId: program.id, playerId: player.id }
      rows.push({ id: player.id, name: `${player.firstName} ${player.lastName}`, program: program.id, position: player.position, year: player.classYear, ovr, legacy: player.potential, a1: generateS0PotCandidateA(input), a2: generateS0PotCandidateA2(input), a3: generateS0PotCandidateA3(input), seed })
    }
  }
  return rows
}

function marginal(label: string, rows: Row[], arm: Arm) { const values = rows.map((row) => pot(row, arm)); const s = summary(values); return [label, `${fixed(s.mean)}/${s.med}/${s.p75}/${s.p90}/${s.p95}/${s.p99}/${s.max}`, ...[80, 85, 90, 95, 97].map((threshold) => pct(values.filter((value) => value >= threshold).length, values.length)), pct(values.filter((value) => value === 99).length, values.length)] }
function refMarginal(label: string, rows: Ref[]) { const values = rows.map((row) => row.potential); const s = summary(values); return [label, `${fixed(s.mean)}/${s.med}/${s.p75}/${s.p90}/${s.p95}/${s.p99}/${s.max}`, ...[80, 85, 90, 95, 97].map((threshold) => pct(values.filter((value) => value >= threshold).length, values.length)), pct(values.filter((value) => value === 99).length, values.length)] }
function elite(label: string, rows: Row[], arm: Arm, threshold: number) { const selected = rows.filter((row) => threshold === 99 ? pot(row, arm) === 99 : pot(row, arm) >= threshold); const os = summary(selected.map((row) => row.ovr)); const hs = summary(selected.map((row) => gap(row, arm))); const rs = summary(selected.map((row) => rf(row, arm))); return [label, selected.length, `${fixed(os.mean)}/${os.med}`, `${fixed(hs.mean)}/${hs.med}`, ...[3, 7].map((value) => pct(selected.filter((row) => gap(row, arm) <= value).length, selected.length)), ...[13, 20].map((value) => pct(selected.filter((row) => gap(row, arm) >= value).length, selected.length)), `${fixed(rs.mean, 3)}/${fixed(rs.med, 3)}`] }
function refElite(label: string, rows: Ref[], threshold: number) { const selected = rows.filter((row) => threshold === 99 ? row.potential === 99 : row.potential >= threshold); const os = summary(selected.map((row) => row.overall)); const hs = summary(selected.map((row) => row.potential - row.overall)); const rs = summary(selected.map((row) => realizedFraction(row.overall, row.potential))); return [label, selected.length, `${fixed(os.mean)}/${os.med}`, `${fixed(hs.mean)}/${hs.med}`, ...[3, 7].map((value) => pct(selected.filter((row) => row.potential - row.overall <= value).length, selected.length)), ...[13, 20].map((value) => pct(selected.filter((row) => row.potential - row.overall >= value).length, selected.length)), `${fixed(rs.mean, 3)}/${fixed(rs.med, 3)}`] }
function example(rows: Row[], test: (row: Row) => boolean) { const matches = rows.filter(test).sort((a, b) => a.ovr - b.ovr || a.id.localeCompare(b.id)); return matches[Math.floor(matches.length / 2)] }
function format(row?: Row) { return row ? `${row.name} | ${row.program} | ${row.position} | ${row.year} | ${row.ovr}/${row.a3} | HR${gap(row, 'a3')} | r=${fixed(rf(row, 'a3'), 3)}` : 'none' }

export function runReport() {
  const universes = Number(process.env.UNIVERSES ?? 500); const root = process.env.SEED ?? 's0-pot-candidate-a3:v1'; const all = collect(universes, root)
  const references = collectEndogenousPotReference(500, 'endogenous-pot-reference:v1').stages as Ref[][]; const normalizers = deriveA3Normalizers()
  console.log(`# S0 POT Candidate A3\n${JSON.stringify(S0_POT_CANDIDATE_A3)}\nUniverses ${universes}; paired players ${all.length}; reference careers ${references[0]!.length}; outcome seed ${root}; normalizer ${JSON.stringify(A3_NORMALIZER_BASELINE)}`)

  console.log('\n## Normalizer validation')
  table(['Stage', 'Exact range', 'Smooth range', 'MAE', 'Max error/POT', 'Max multiplier error'], YEARS.map((year) => { const exact = normalizers.exact[year]; const smooth = exact.map((_, index) => evaluateA3Normalizer(S0_POT_CANDIDATE_A3.normalizerCoefficients[year], index + 60)); const errors = exact.map((value, index) => Math.abs(value - smooth[index]!)); const worst = errors.indexOf(Math.max(...errors)); return [year, `${fixed(Math.min(...exact), 6)}..${fixed(Math.max(...exact), 6)}`, `${fixed(Math.min(...smooth), 6)}..${fixed(Math.max(...smooth), 6)}`, fixed(average(errors), 6), `${fixed(errors[worst]!, 6)}/${worst + 60}`, pct(Math.abs(Math.exp(exact[worst]! - smooth[worst]!) - 1), 1)] }))
  table(['Stage/POT', '75', '80', '85', '90', '95', '97', '99'], YEARS.map((year) => [year, ...[75, 80, 85, 90, 95, 97, 99].map((potential) => fixed(Math.exp(normalizers.exact[year][potential - 60]! - evaluateA3Normalizer(S0_POT_CANDIDATE_A3.normalizerCoefficients[year], potential)), 4))]))

  console.log('\n## POT marginals')
  table(['Arm/stage', 'Mean/med/P75/P90/P95/P99/max', '80+', '85+', '90+', '95+', '97+', '99'], YEARS.flatMap((year, stage) => { const rows = all.filter((row) => row.year === year); return [marginal(`A1 ${year}`, rows, 'a1'), marginal(`A2 ${year}`, rows, 'a2'), marginal(`A3 ${year}`, rows, 'a3'), refMarginal(`REF +${stage}`, references[stage]!)] }))
  console.log('\n## A3 class collapse deltas'); for (const threshold of [95, 97, 99]) { const freshman = all.filter((row) => row.year === 'FR'); const senior = all.filter((row) => row.year === 'SR'); const test = (row: Row) => threshold === 99 ? row.a3 === 99 : row.a3 >= threshold; const fr = freshman.filter(test).length / freshman.length; const sr = senior.filter(test).length / senior.length; console.log(`POT${threshold}${threshold === 99 ? '' : '+'}: FR ${pct(freshman.filter(test).length, freshman.length)} SR ${pct(senior.filter(test).length, senior.length)} difference ${fixed((fr - sr) * 100)}pp ratio ${fixed(sr / fr, 3)}`) }

  console.log('\n## Elite count preservation A1 → A3')
  table(['Class/ceiling', 'A1 count/rate', 'A3 count/rate', 'Raw Δ', '% Δ'], YEARS.flatMap((year) => [95, 97, 99].map((threshold) => { const rows = all.filter((row) => row.year === year); const test = (row: Row, arm: Arm) => threshold === 99 ? pot(row, arm) === 99 : pot(row, arm) >= threshold; const a1 = rows.filter((row) => test(row, 'a1')).length; const a3 = rows.filter((row) => test(row, 'a3')).length; return [`${year} ${threshold}${threshold === 99 ? '' : '+'}`, `${a1}/${pct(a1, rows.length)}`, `${a3}/${pct(a3, rows.length)}`, a3 - a1, pct(a3 - a1, a1)] })))

  console.log('\n## Elite carrier redistribution')
  for (const year of ['JR', 'SR'] as const) for (const threshold of [95, 97]) {
    const candidateRows = (['a1', 'a2', 'a3'] as const).map((arm) => {
      const rows = all.filter((row) => row.year === year && pot(row, arm) >= threshold)
      return [arm.toUpperCase(), rows.length, ...['<65', '65–74', '75–84', '85–89', '90+'].map((ovrBand) => `${rows.filter((row) => band(row.ovr) === ovrBand).length} (${pct(rows.filter((row) => band(row.ovr) === ovrBand).length, rows.length)})`)]
    })
    const rows = references[YEARS.indexOf(year)]!.filter((row) => row.potential >= threshold)
    const referenceRow = ['REF', rows.length, ...['<65', '65–74', '75–84', '85–89', '90+'].map((ovrBand) => `${rows.filter((row) => band(row.overall) === ovrBand).length} (${pct(rows.filter((row) => band(row.overall) === ovrBand).length, rows.length)})`)]
    table([`${year} POT${threshold}+`, 'N', '<65', '65–74', '75–84', '85–89', '90+'], [...candidateRows, referenceRow])
  }

  console.log('\n## Elite upperclassman realization')
  for (const threshold of [95, 97]) table([`POT${threshold}+`, 'N', 'OVR mean/med', 'HR mean/med', '≤3', '≤7', '13+', '20+', 'r mean/med'], (['JR', 'SR'] as const).flatMap((year) => { const rows = all.filter((row) => row.year === year); const stage = YEARS.indexOf(year); return [elite(`A1 ${year}`, rows, 'a1', threshold), elite(`A2 ${year}`, rows, 'a2', threshold), elite(`A3 ${year}`, rows, 'a3', threshold), refElite(`REF +${stage}`, references[stage]!, threshold)] }))

  console.log('\n## Headroom and correlation')
  table(['Arm/stage', 'Mean/med', '0–3', '4–7', '8–12', '13–19', '20+', '8+', '13+', '20+', 'OVR↔POT', 'OVR↔HR'], YEARS.flatMap((year, stage) => { const rows = all.filter((row) => row.year === year); const arms = (['a1', 'a2', 'a3'] as const).map((arm) => { const gaps = rows.map((row) => gap(row, arm)); return [`${arm.toUpperCase()} ${year}`, `${fixed(average(gaps))}/${percentile(gaps, .5)}`, ...['0–3', '4–7', '8–12', '13–19', '20+'].map((value) => pct(gaps.filter((headroom) => hrBand(headroom) === value).length, gaps.length)), ...[8, 13, 20].map((value) => pct(gaps.filter((headroom) => headroom >= value).length, gaps.length)), fixed(correlation(rows.map((row) => ({ first: row.ovr, second: pot(row, arm) }))), 3), fixed(correlation(rows.map((row) => ({ first: row.ovr, second: gap(row, arm) }))), 3)] }); const ref = references[stage]!; const gaps = ref.map((row) => row.potential - row.overall); return [...arms, [`REF +${stage}`, `${fixed(average(gaps))}/${percentile(gaps, .5)}`, ...['0–3', '4–7', '8–12', '13–19', '20+'].map((value) => pct(gaps.filter((headroom) => hrBand(headroom) === value).length, gaps.length)), ...[8, 13, 20].map((value) => pct(gaps.filter((headroom) => headroom >= value).length, gaps.length)), fixed(correlation(ref.map((row) => ({ first: row.overall, second: row.potential }))), 3), fixed(correlation(ref.map((row) => ({ first: row.overall, second: row.potential - row.overall }))), 3)]] }))

  console.log('\n## Project preservation A3')
  const projects = [['OVR<75/POT90+', (row: Row) => row.ovr < 75 && row.a3 >= 90], ['OVR<75/POT95+', (row: Row) => row.ovr < 75 && row.a3 >= 95], ['OVR<75/POT97+', (row: Row) => row.ovr < 75 && row.a3 >= 97], ['OVR<75/POT99', (row: Row) => row.ovr < 75 && row.a3 === 99], ['OVR<75/HR13+', (row: Row) => row.ovr < 75 && gap(row, 'a3') >= 13], ['OVR<75/HR20+', (row: Row) => row.ovr < 75 && gap(row, 'a3') >= 20]] as const
  table(['Profile', ...YEARS], projects.map(([label, test]) => [label, ...YEARS.map((year) => rate(all.filter((row) => row.year === year), test))]))

  console.log('\n## High-OVR diversity A3')
  for (const year of YEARS) table([`${year} OVR`, 'N', 'POT mean/med', '95+', '97+', '99', '≤3', '≤7'], ([['85–89', 85, 89], ['90+', 90, Infinity]] as const).map(([label, low, high]) => { const rows = all.filter((row) => row.year === year && row.ovr >= low && row.ovr <= high); return [label, rows.length, `${fixed(average(rows.map((row) => row.a3)))}/${percentile(rows.map((row) => row.a3), .5)}`, ...[95, 97].map((threshold) => pct(rows.filter((row) => row.a3 >= threshold).length, rows.length)), pct(rows.filter((row) => row.a3 === 99).length, rows.length), ...[3, 7].map((headroom) => pct(rows.filter((row) => gap(row, 'a3') <= headroom).length, rows.length))] }))

  const p99 = all.filter((row) => row.a3 === 99); const counts = [...new Set(all.map((row) => row.seed))].map((seed) => p99.filter((row) => row.seed === seed).length); const rs = summary(p99.map((row) => rf(row, 'a3')))
  console.log(`\n## POT99\n${p99.length}/${all.length} ${pct(p99.length, all.length)}; ${fixed(p99.length / universes)} per universe; zero/one/two/3+ ${[0, 1, 2].map((count) => pct(counts.filter((value) => value === count).length, counts.length)).join('/')} / ${pct(counts.filter((value) => value >= 3).length, counts.length)}; OVR ${fixed(average(p99.map((row) => row.ovr)))}/${percentile(p99.map((row) => row.ovr), .5)} range ${Math.min(...p99.map((row) => row.ovr))}-${Math.max(...p99.map((row) => row.ovr))}; HR ${fixed(average(p99.map((row) => gap(row, 'a3'))))}/${percentile(p99.map((row) => gap(row, 'a3')), .5)}; r ${fixed(rs.mean, 3)}/${fixed(rs.med, 3)}`)
  table(['Class', 'N/rate', 'OVR mean/med', 'HR mean/med', 'r mean/med'], YEARS.map((year) => { const base = all.filter((row) => row.year === year); const rows = p99.filter((row) => row.year === year); return [year, `${rows.length}/${pct(rows.length, base.length)}`, `${fixed(average(rows.map((row) => row.ovr)))}/${percentile(rows.map((row) => row.ovr), .5)}`, `${fixed(average(rows.map((row) => gap(row, 'a3'))))}/${percentile(rows.map((row) => gap(row, 'a3')), .5)}`, `${fixed(average(rows.map((row) => rf(row, 'a3')),), 3)}/${fixed(percentile(rows.map((row) => rf(row, 'a3')), .5), 3)}`] }))

  console.log('\n## Examples')
  for (const year of YEARS) { const rows = all.filter((row) => row.year === year); console.log(`${year}\n  polished: ${format(example(rows, (row) => row.ovr >= 85 && gap(row, 'a3') <= 3))}\n  runway: ${format(example(rows, (row) => row.ovr >= 80 && gap(row, 'a3') >= 4 && gap(row, 'a3') <= 12))}\n  elite project: ${format(example(rows, (row) => row.ovr < 75 && row.a3 >= 95))}\n  exceptional project: ${format(example(rows, (row) => row.ovr < 75 && row.a3 >= 97))}`) }
  const groups = [...new Set(all.map((row) => row.seed))].map((seed) => ({ seed, rows: all.filter((row) => row.seed === seed && row.year === 'FR').sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id)) })).sort((a, b) => average(a.rows.slice(0, 3).map((row) => row.ovr)) - average(b.rows.slice(0, 3).map((row) => row.ovr)))
  console.log('\n## Freshmen to Know'); for (const [label, group] of [['Ordinary', groups[0]!], ['Typical', groups[Math.floor(groups.length / 2)]!], ['Strong', groups.at(-1)!]] as const) console.log(`${label} ${group.seed}: ${group.rows.slice(0, 3).map((row) => `${row.name} ${row.program} ${row.position} ${row.ovr}/${row.a3}`).join(' | ')}`)

  const legal = all.every((row) => ARMS.every((arm) => pot(row, arm) >= row.ovr && pot(row, arm) <= 99)); const positive = YEARS.every((year) => [60, 75, 90, 95, 99].every((potential) => candidateA3RealizationTilt(Math.min(70, potential), year, potential) > 0))
  console.log(`\n## Preservation\nPaired ${all.length}; diagnostic arms share all non-POT inputs by construction; legal ${legal}; representative tilt positive ${positive}; A3 module has no production import; production POT retained as legacy arm.`)
}

if (import.meta.url === `file://${process.argv[1]}`) runReport()
