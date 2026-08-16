# Player Identity Research Archive

> **HISTORICAL / PARKED — NOT PRODUCTION BEHAVIOR**
>
> Read this document only when deliberately reopening Player Identity,
> Player-generation, OVR-valuation, or statistical-translation tuning. Normal
> feature-planning sessions should not read it.

## Production status

- Canonical production Player generation remains active and unchanged.
- Canonical production `calculateOverall()` remains active and unchanged.
- Profile Generation Experiment A V2 is accepted as **experimental input only**;
  it is not production-active.
- OVR Experiment B v1 is **REJECTED / DO NOT ACTIVATE / DO NOT RETUNE IN
  PLACE**.
- Player Development V1, role-aware Rotation, Team Strength, Recruiting, and
  simulation remain accepted/frozen.
- Further Player Identity tuning requires new manual-play evidence before this
  research is reopened.

The investigation separated three interacting layers:

```text
profile generation → OVR valuation → statistical translation
```

It established useful design principles and diagnostic baselines, but selected
no production change. The current Player population is good enough for feature
development.

## Statistical Identity and Superstar Separation characterization

The original manual signal was mixed: one multi-Season run felt homogeneous,
with leaders near `7.3 APG`, `1.7 SPG`, and high-`2s BPG`, while earlier play
had produced memorable counterexamples such as a roughly `25 PPG` scorer,
roughly `9 APG`, and a 51-point game. The earlier examples came from the former
40-MPG environment and cannot be compared directly with current role-aware
minutes.

The deterministic production-path characterization sampled `250` fresh Season
1 Universes (`96,000` Players) and `60` complete Seasons (`23,040` games;
`20,222` qualifying Player-seasons). A repeat produced identical SHA-256 output
`6214655d4904dd30a4dee026c1cce967bdb802da98b382a83c014252dd3b0fa0`.

### Profile supply

- Fresh Universes averaged `2.88` Players at 90+ OVR, `0.28` at 95+, and
  `0.04` at 97+; `95.2%` contained a diagnostic multi-category 90+ profile.
- Conventional elite roles were plentiful, but cross-position supply was
  sparse. Of `5,275` P95 passers, `3,454` were PGs and only four were Centers.
  Of `5,591` P95 rebounders, one was a PG and 25 were SGs.
- Diagnostic skilled-big profiles averaged `0.75` per Universe and appeared in
  `53.2%` of Universes.
- Position-specific height maxima in the sample were 77 inches at PG, 79 SG,
  81 SF, 83 PF, and 86 C.

### Minutes and leader separation

League-high MPG averaged `36.10`; none of the sampled qualifying Player-seasons
reached 38 or 40 MPG. Across 60 Seasons, leader means were `23.41 PPG`, `11.68
RPG`, `7.91 APG`, `1.64 SPG`, and `2.48 BPG`. Scoring leaders reached 25+ in
13 Seasons, never 28+, while the sample still produced 107 40-point games and
six 50-point games.

Attributes translated strongly inside conventional positions:
Playmaking/AST40 correlation was `.715`, Rebounding/REB40 `.829`, Interior
Defense/BLK40 `.694`, and height/BLK40 `.775`. Perimeter Defense/STL40 was
weaker at `.468`. Position priors dominated cross-position outcomes: every one
of 600 Top-10 assist slots belonged to a PG, all 600 rebound slots belonged to
PF/C, and 582 of 600 block slots belonged to Centers.

**Disposition: MIXED.** Scoring, conventional rebounding, PG passing, and C rim
protection were broadly healthy; current minutes softened raw peaks. Steal
identity was the clearest translation-compression signal. Cross-position
passing/rebounding/block identity was both generation- and translation-limited.
Characterization alone authorized no formula change.

## Elite profile and OVR specialization diagnosis

This characterization was formerly tracked under experimental `7B.1A/7B.1B`
labels. Those labels are retired because Phase 7B now names accepted product
features.

The shared talent generator creates clear positional averages while shifting
most attributes upward together for elite Players. Within-position attribute
correlations averaged `.631–.665`. At 95+ OVR no position had an attribute
below 60; SG, SF, and PF had none below 70. This makes elite profiles flatter,
especially for broadly weighted SFs.

Canonical `calculateOverall()` is a rounded position-weighted linear average.
It correctly discounts many position-irrelevant weaknesses, but high OVR near
the 99 cap leaves little compensation room. Controlled specialists often landed
in the mid/high 80s even with several exceptional strengths.

**Diagnosis: BOTH generation and OVR restrict specialization.** Shared talent
generation is the main source of all-around elite profiles. OVR adds
position-dependent completeness gates. Statistical position baselines then
limit whether rare profiles become cross-position production.

Two principles were retained as research guidance, not production rules:

1. OVR should represent total basketball value within a position rather than
   pure attribute completeness.
2. Positions should describe common profiles without making them mandatory.

Any future change must protect the accepted fresh-Universe elite-supply
baseline (`2.88` 90+, `0.28` 95+, `0.04` 97+) and audit every downstream OVR
consumer: Recruit rank/stars, Recruiting decisions, Rotation, Team Strength,
Development/POT headroom, and Recruit POT finalization.

## Profile Generation Experiment A

Former label: `7B.2A`.

Experiment A applied a rare deterministic, clamp-aware redistribution of
position-weighted attribute value after canonical generation. It persisted no
archetype and held selected Players within -1/0 OVR movement. In `96,000`
Players, 2,673 (`2.784%`) were selected. Elite supply stayed nearly unchanged,
but broad weakness removal sometimes drove three or four attributes to the 45
floor. Steals separation also exceeded its preregistered non-targeted gate.

**Disposition: WATCH / ITERATE.** The experiment showed that deterministic
profile reshaping could preserve ecosystem scale, but its weakness distribution
was mechanically implausible.

## Profile Generation Experiment A V2

Former label: `7B.2A.1`.

V2 preserved eligibility, selection, the conventional/unusual mix, weighted
neutrality, strength/weakness limits, and ±1 OVR guardrail. It restricted each
path to one semantically plausible weakness pair and shrank/skipped transfers
that could not fund the nominal budget.

Across the same `96,000` Players, V2 selected the same 2,673, applied 2,652,
and produced 986 defined specialized profiles. Floor saturation improved:

| Floor hits | Baseline | V1 | V2 |
| --- | ---: | ---: | ---: |
| 0 | 97.55% | 82.01% | 93.48% |
| 1 | 2.41% | 9.20% | 6.22% |
| 2 | 0.00% | 5.09% | 0.30% |
| 3+ | 0.04% | 3.70% | 0.00% |

Elite supply per Universe remained stable: 90+ `2.880→2.852`, 95+
`0.280→0.280`, and 97+ `0.040→0.040`. Recruit OVR/POT, star cohorts, Team
Strength, scoring, and MPG remained within gates. Steals separation moved
`+4.98%`, inside the 5% gate but close enough to recheck in any combined audit.

**Disposition: ACCEPTED AS EXPERIMENTAL INPUT ONLY.** Production remains
baseline. The parameters are historical experimental facts, not a queued
activation.

## OVR Experiment B v1

Former label: `7B.2B`.

The preregistered candidate began with raw canonical OVR, added a bounded premium
for three high non-Stamina attributes, added a small position-core completeness
bonus, and subtracted bounded support-skill weakness penalties. Controlled
specialist examples improved plausibly and one-/two-skill extremes stayed low.

Population behavior failed structurally:

| Population | 90+ | 95+ | 97+ per Universe |
| --- | ---: | ---: | ---: |
| Baseline + canonical OVR | 2.880 | 0.280 | 0.040 |
| Baseline + Experiment B | 6.084 | 0.724 | 0.156 |
| Experiment A V2 + canonical OVR | 2.852 | 0.280 | 0.040 |
| Experiment A V2 + Experiment B | 6.360 | 0.760 | 0.156 |

It created 877 new 90+ and 120 new 95+ Players with no elite demotions. Of the
new 90+ Players, 691 (`78.8%`) were complete profiles. Candidate A V2 was not
the cause: baseline profiles alone more than doubled 90+ supply. Recruit rank,
POT-gap, and Steals-separation gates also moved beyond accepted bounds.

**Disposition: REJECTED / DO NOT ACTIVATE / DO NOT RETUNE IN PLACE.** The
premium rewarded naturally strong complete near-elites rather than selectively
correcting undervalued specialists. Its useful lesson is limited: multi-strength
specialists can receive value while one-skill exploits remain rejected, but a
future design would need new evidence and a fundamentally safer targeting and
scale model.

## Rejected and unresolved hypotheses

- Dynamic per-Universe normalization is rejected: identical attributes and
  position must always produce identical OVR.
- Candidate B v1 parameter iteration is not an active path.
- Development Identity Retention is an unanswered compatibility question, not
  a diagnosed Development defect.
- Passing and Steals remain possible translation investigations only if fresh
  play identifies them as the largest blocker.
- Rebounding escape remains deferred until meaningful profile supply exists;
  Blocks flexibility remains a watchpoint.
- Scoring and accepted role-aware minutes are protected absent new evidence.
- Player Identity does not require a full OVR redesign; presentation,
  generation, Development retention, or targeted translation may matter more.

## Reopening criteria

Do not reopen this work because an old plan anticipated it. Reopen only when
fresh manual gameplay provides a concrete, repeated problem such as:

- memorable-looking profiles consistently fail to produce recognizable play;
- Development demonstrably washes out strengths and weaknesses;
- canonical displayed OVR materially damages Player stories or decisions;
- a specific translation such as Passing or Steals is repeatedly compressed;
  or
- existing Player variety is insufficient for an accepted feature.

When evidence earns reopening:

1. name the single largest observed blocker;
2. inspect current production truth;
3. use the smallest diagnostic that can distinguish generation, valuation,
   Development retention, presentation, and translation;
4. preregister ecosystem gates proportional to blast radius;
5. make one bounded candidate change; and
6. return to manual play before expanding scope.

No Phase 7E is selected. After the currently selected Phase 7C and Phase 7D
work, the Roadmap requires a fresh playtest-driven planning checkpoint.
