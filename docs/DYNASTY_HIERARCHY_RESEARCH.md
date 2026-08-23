# Dynasty Hierarchy / Competitive Compression Research

> **Conditional-read research archive.** Do not read this during ordinary fresh
> planning. Open it only when hierarchy/compression is deliberately reconsidered,
> a future feature materially changes Prestige, Recruiting, Development, roster
> lifecycle, or talent allocation, or this historical evidence is specifically
> needed.

This document owns the completed investigation into mature Dynasty hierarchy
and competitive compression. It preserves rejected experiments as evidence,
not recommendations. `ROADMAP.md` remains the only sequencing authority.

## Final status

**KNOWN LIMITATION / DEFERRED — DECISION-COMPLETE.**

Static Prestige produces a meaningful Program hierarchy. Mature roster quality
and Team Strength nevertheless compress, especially among the 16-Team
Tournament field. The project tested the most plausible boundaries and found no
supported targeted intervention whose product value exceeded its costs and
pathologies. Production should remain unchanged.

Reopen only if repeated normal play shows mature Tournaments becoming
predictably flat or interchangeable, a future feature materially changes the
talent economy, or a genuinely new causal hypothesis explains why earlier
Recruiting and roster-lifecycle candidates failed.

## Original product concern

The investigation began from two related observations: mature Dynasties rarely
produced temporary `88+`/`90+` powerhouse Teams, and nominal Tournament seed
gaps often represented modest actual Team Strength gaps. The desired product
shape was not permanent dominance. It was a recognizable hierarchy containing
durable strong and weak Programs, upward mobility, occasional elite peaks,
meaningful Tournament advantages, plausible upsets, and varied long-run stories.

The 32-Program abstraction matters. Its 16-Team Tournament selects half the
League, so its #16 Team is not comparable to a real NCAA #16 seed selected from
hundreds of Programs. A missing `90+` Team or higher upset rate was never, by
itself, a defect.

## Current production

**CURRENT PRODUCTION**

- Immutable `ProgramDefinition.basePrestige` initializes and remains each
  Team's Prestige across offseason and rollover.
- Every Team has exactly 12 active Players.
- Seniors are the only ordinary departures; every non-senior returns.
- Recruiting openings are the senior vacancies at each exact natural position.
- Every commitment enrolls once; returners plus commitments must equal exactly
  12 before Team and default Rotation construction.
- Recruit Talent Distribution V1 and Recruit POT Candidate B remain accepted.
- Player Development V1 includes the accepted high-POT/high-headroom Candidate
  A realization opportunity.
- Rotation V1, Team Strength, Game Simulation, and résumé/seeding retain their
  accepted production contracts.

## Static-Prestige baseline and causal trace

**OBSERVATIONAL / DIAGNOSTIC EVIDENCE**

Three production-fidelity 25-Season runs, using Seasons 5–25 as the mature
window, produced the representative waterfall below:

| Stage | Mean | SD | P90–P10 | Average range |
| --- | ---: | ---: | ---: | ---: |
| Prestige | 66.47 | 13.31 | 31.80 | 55.00 |
| Recruit-class OVR | 71.43 | 5.12 | 12.65 | 21.95 |
| Full-roster OVR | 74.41 | 3.50 | 8.24 | 15.47 |
| Top-five roster OVR | 79.81 | 3.71 | 8.86 | 15.89 |
| Rotation-weighted OVR | 77.44 | 3.70 | 8.88 | 16.09 |
| Team Strength | 77.20 | 3.71 | 8.93 | 16.12 |

Prestige therefore creates large initial differentiation that narrows through
Recruit allocation and the fixed roster economy. It does not disappear:
high-Prestige Programs sign better classes, accumulate more premium Players,
and field stronger rosters than weak Programs.

Rotation-weighted Player OVR correlated `0.995` with Team Strength. Top-three
and top-five roster OVR correlated approximately `0.934` and `0.965` with Team
Strength. A uniform 90 roster produces Strength 90, while five 90-level starters
with 80-level depth produces approximately `88.45`. Rotation and Team Strength
faithfully translate the roster quality they receive.

The mature Tournament field averaged roughly `2.33` Strength SD. In one 63-
Tournament audit, a 4-vs-13 matchup had an average/median Strength gap of
`2.90`/`2.57`; the lower seed was actually stronger `28.6%` of the time. This
confirmed compression but did not independently implicate Game Simulation or
résumé logic.

Across mature Seasons the League contained roughly 30 Players at `85+` and five
at `90+` per Season. Sequentially concentrating the actual Player pool into
legal diagnostic rosters yielded approximate Strengths of `89.5`, `85.9`,
`84.2`, `82.9`, `81.7`, and `80.8`. Supply can theoretically support greater
hierarchy; this was an observational ceiling, not a proposed allocation rule.

## Dynamic Prestige

**REJECTED EXPERIMENT**

Dynamic Prestige V1 changed Prestige from static identity into a performance-
responsive value. Same-seed long-run validation found that it compressed both
durable high and low Prestige tails. At Season 25, pooled Prestige SD/range
moved from approximately `13.3`/`55` static to `9.3`/`38` dynamic, while pooled
Team OVR SD fell from about `4.00` to `3.23`.

Expectation-relative and three-Season rolling-résumé variants were also tested.
They delayed or reframed the same convergence rather than preserving a durable
elite tail. All implementations were rejected and rolled back. Dynamic Prestige
may remain an independent future world-evolution idea, but none of these models
is a preferred successor or hierarchy solution.

## Development diagnosis

The original static trace found viable premium Recruiting concentration but
meaningful unrealized Potential. An average recruiting class contained about 24
`85+` POT and seven `90+` POT Recruits; Programs could stack seven or eight
premium signees across two classes. Only about `44–48%` of fully observed
`85+` POT signees reached 85 OVR, about `8–11%` reached 90, and they graduated
roughly `7.6` points below Potential.

**ACCEPTED PRODUCTION CORRECTION**

Development Candidate A added one deterministic high-POT/high-headroom
realization opportunity inside Development V1. It reduced average unused
ceiling among `85+` POT Players from `7.64` to `5.99` without meaningful broad
inflation, raised `85+` Team occurrences from 22 to 31, and created a two-Season
elite run. Accepted production parity later reproduced `31/3/0`
`85+`/`88+`/`90+` Team occurrences and a `89.52` maximum.

**REJECTED EXPERIMENT**

A late-career-only Candidate B was too weak. Candidate A+ added another
opportunity for `90+` POT Players but mostly improved senior Seasons immediately
before graduation: `32/3/0` elite-Team occurrences versus Candidate A's
`31/3/0`, and maximum Team OVR only `89.52 → 89.63`. It was rejected.
Development is not the demonstrated remaining bottleneck and is frozen.

## Recruiting micro-rule experiments

**REJECTED EXPERIMENT — early second premium Offer**

An AI-only second premium Offer opportunity approximately doubled meaningful
Recruiting collision. It barely changed premium accumulation, exceptional
classes, or mature Strength separation. More competition over the same fixed
capacity was low leverage.

**REJECTED EXPERIMENT — direct Rotation-compatible openings**

Allowing a Recruit to use any Rotation-compatible floor position was
architecturally invalid. Secondary Rotation eligibility assumes an already
coherent natural-position roster; the experiment could eliminate natural-
position groups and make default Rotation initialization impossible.

**REJECTED EXPERIMENT — coverage-preserving flexibility**

A stricter variant preserved at least one natural Player per position. It was
materially active but produced fragile/skewed position distributions, weak
Player-quality gains, and worse mature compression: Team Strength SD moved from
approximately `3.71` to `3.34`. Ordinary Offer and position micro-rule work was
closed.

## Roster-lifecycle architecture

**OBSERVATIONAL / DIAGNOSTIC EVIDENCE**

Repository inspection identified the structural lifecycle:

```text
fixed 12-player roster
+ senior-only departures
+ usually 2–4 exact-position openings
+ every non-senior returns
+ every commitment enrolls
+ synchronized four-year cohorts
```

Raw opening count did not predict future Strength; premium quality inside the
available slots did. Strong classes could overlap, but automatic retention and
cohort graduation made extreme multi-class co-location uncommon. This made the
lifecycle a plausible contributor, not proof that cuts, transfers, or broader
roster management were missing features.

## Bounded recruit-over

**REJECTED EXPERIMENT**

A final paired experiment gave each Program at most one optional same-natural-
position recruit-over. The incumbent was its weakest non-senior by an existing
diagnostic long-term score, `56% current OVR + 44% POT`. Only a Recruit scoring
strictly higher could use the slot; a commitment enrolled once and displaced
that incumbent. An unused opportunity disappeared before Late Recruiting.

Three paired deterministic seeds ran for 25 Seasons with a mature Seasons 5–25
window and full structural auditing:

| Metric | Control | Recruit-over |
| --- | ---: | ---: |
| Mature Players 88+ per Season | 13.05 | 12.19 |
| Mature Players 90+ per Season | 5.98 | 5.44 |
| Program-Seasons with 2+ 88+ | 6.9% | 7.0% |
| Program-Seasons with 3+ 88+ | 0.8% | 1.0% |
| Program-Seasons with 2+ 90+ | 2.0% | 1.7% |
| Top-three Player OVR | 81.97 | 81.60 |
| Top-five Player OVR | 79.89 | 79.55 |
| League Strength SD | 3.79 | 3.83 |
| Tournament-field SD | 2.35 | 2.61 |
| Team Strength P90 | 82.05 | 81.62 |
| Maximum Team Strength | 87.40 | 86.72 |
| `85+`/`88+`/`90+` Team-Seasons | 11/0/0 | 16/0/0 |

The opportunity was used in `1,016/2,112` mature Program-Seasons (`48.1%`).
Usage was `43.2%` for Prestige 80–100, `47.5%` for Prestige 40–79, and `92.4%`
for Prestige 1–39, with Prestige/use correlation `-0.164`. It displaced 631
freshmen, 243 sophomores, and 142 juniors. Mean displaced OVR/POT was
`64.32`/`73.43`.

The candidate slightly widened Tournament-field spread but did not increase
elite co-location or the elite ceiling. It lowered upper-tail Player and roster
quality and primarily helped weak Programs because their incumbents were easier
to replace. It was rejected rather than expanded into cuts, transfers, or
generalized roster management. All structural and deterministic audits passed,
so this was a causal rejection rather than a broken implementation.

## Causal-chain synthesis

```text
Prestige
  → supported durable Recruiting advantage
Recruiting access / allocation
  → differentiated but compressed; collision alone low leverage
Roster lifecycle
  → plausible structural contributor; bounded replacement failed
Development
  → one accepted correction; not primary after correction
Roster quality
  → elite supply exists but rarely co-locates deeply
Rotation / Team Strength
  → healthy, high-fidelity translation
Game outcomes
  → Strength matters; intentional variance preserves upsets
Résumé / seeding
  → may exaggerate nominal gaps; does not create compression
```

No remaining boundary supplies a supported, narrow intervention. The residual
compression is best understood as an equilibrium of intentional abstractions,
not an isolated broken formula.

## Product stopping-point assessment

Normal play has produced a compelling low-Prestige rebuild, gradual improvement,
Tournament qualification, a #16-over-#1 upset, later decline after graduation,
contested Recruiting stories, and durable Player attachment. Static Prestige
preserves recognizable elite and weak Programs. Across accepted long-run work,
many Programs reached #1 Strength or won championships, while temporary strong
Teams remained possible.

The remaining difference is partly expectational: a 32-Program simulation with
equal 12-Player rosters and a Tournament containing half the League should not
be expected to reproduce real NCAA seed amplitude. Further intervention showed
diminishing returns: multiple independent mechanisms had little leverage,
improved one metric while worsening another, or required rules larger than the
demonstrated player problem.

**Final decision:** accept mature hierarchy/compression as a known deferred
limitation for the current product scope. Do not build transfers, roster
management, coaching systems, or universe expansion solely to solve it. Those
features may alter the distribution later if selected for their own player
value.

## Explosive Offseason compatibility postscript

The accepted rare-event layer changed mature mean Player OVR by only `+0.08`
and mean Team OVR by `+0.09`. The strongest Team remained `86.33`, 90+ Programs
remained at zero, and no meaningful elite-Program amplification appeared.
Accepted Explosive Offseasons therefore do **not** reopen this decision-complete
hierarchy/compression investigation.

## Reopening conditions

Reopen only when at least one condition is met:

1. repeated normal play shows mature Tournaments becoming predictably flat,
   interchangeable, or emotionally weak;
2. a future accepted feature materially changes Prestige, Recruiting, roster
   lifecycle, Development, or talent allocation; or
3. a genuinely new causal hypothesis explains why elite talent exists but does
   not co-locate, why static hierarchy does not create enough upper-tail roster
   separation, and why previous Recruiting and recruit-over candidates failed.

The third condition requires a falsifiable prediction distinct from the
rejected mechanisms. A theoretically testable parameter is not sufficient.

## Retained neutral diagnostics

These scripts observe production behavior and remain useful after future
features change the ecosystem:

- `npm run sim:elite-dominance-audit`
- `npm run sim:competitive-compression`
- `node --import tsx scripts/inspectEliteRosterFormation.ts`
- `npm run sim:recruiting-cohort-survival`
- `npm run sim:elite-pursuit-funnel`
- `npm run sim:recruiting-capacity-structure`
- `npm run sim:player-talent-amplitude`
- `npm run sim:dynasty-long-run`

Candidate-only reproduction scripts and their production option plumbing were
removed at closure. Historical formulas and results above are sufficient unless
a deliberate research reopening justifies reconstructing an experiment.
