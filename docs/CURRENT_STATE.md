# Current Repository State

This is the concise handoff for the repository as it exists today. It records accepted production truth, not future design. The repository is authoritative when this document and code disagree.

## Current product

The application supports a repeatable multi-season Dynasty:

```text
New Dynasty
→ Regular Season
→ Recruiting
→ Tournament
→ Late Recruiting
→ Recruiting Finalization
→ Offseason
→ Player Development
→ Next Season
→ repeat
```

The player-facing product includes:

- deterministic game simulation, Hub Quick Sim, Game Prep, and Box Score presentation;
- V0 Rotation editing;
- schedules, standings, League exploration, and Player season statistics;
- the national Tournament;
- Board + Focus + Offer Recruiting, a generated national board, onboarding, Late Recruiting, and finalization;
- offseason turnover, incoming recruits, Player Development, next-season roster assembly, and Dynasty rollover;
- a unique stored seed for each normal interactive new Dynasty; and
- Super Sim to Midseason and to the end of the regular season.

Program and Conference identity remains fixed. A Dynasty seed is generated once for normal interactive creation; explicit-seed paths remain deterministic.

## Canonical architecture

```text
DynastyState = canonical multi-season domain state
Zustand      = application/session orchestration and presentation state
React        = presentation
Domain/simulation = deterministic pure TypeScript where practical
```

Canonical domain facts are not independently duplicated in Zustand. Domain generation and simulation use explicit deterministic seeded RNG streams; production code does not use `Math.random()`.

## Accepted / Frozen Unless New Evidence Appears

### Recruiting

Board + Focus + Offer is accepted:

```text
Board baseline effort = 3
Focus bonus = +3
Maximum Focus targets = 3
```

Priority `1–5` and normalized attention are removed. AI plans coherently align Focus and Offers and retain valid premium pursuits. Prestige/attraction is accepted.

### Recruit Talent Distribution V1

Recruit Talent V1 uses partially independent readiness and ceiling, with `POT >= OVR`. National Rank uses `56% OVR / 44% POT`. It intentionally creates fewer immediately elite freshmen, raw high-upside prospects, ready-now lower-ceiling prospects, and a wider OVR/POT relationship.

### Player Development V1

Development is:

```text
class baseline
+ POT-headroom opportunity
+ stable hidden Player tendency
+ annual variance / rare breakouts
→ attribute-based development
→ hard POT cap
```

| Completed class | Baseline | Headroom multiplier | Target cap |
| --- | ---: | ---: | ---: |
| FR | 1–4 | 1.20 | 12 |
| SO | 1–3 | 0.90 | 10 |
| JR | 0–2 | 0.65 | 8 |

Tendency shares are weak `30%`, steady `50%`, and strong `20%`. There is no Prestige-based Development modifier. Development V1 is frozen unless new evidence appears.

### Calibration

[CALIBRATION.md](CALIBRATION.md) is the methodology source of truth: direct subsystem diagnostics first; deterministic paired trials; QUICK, STANDARD, ACCEPTANCE, and EQUILIBRIUM tiers; parallel seed execution; LIGHT/FULL audits; and full production fidelity for acceptance.

## Current Rotation production baseline — critical

Current production is **Rotation V0**.

```text
Rotation stores aggregate Player minutes.
Players may receive minutes only at their natural position.

PG = 40
SG = 40
SF = 40
PF = 40
C  = 40
Total = 200
```

There are **no production secondary positions, cross-position minutes, floor-aware canonical Rotation, or user position changes**.

Phase 6E.6A adds a parallel, isolated engine/domain `RotationV1` capability:

```text
RotationV1.minutesByPosition[Floor Position][Player ID] = minutes
```

Every floor position must total 40 minutes, the Team must total 200, and a
Player may total at most 40. Rotation eligibility is derived from the Player's
canonical natural position (`PG → PG/SG`, `SG → SG/SF`, `SF → SF/PF`,
`PF → PF/C`, `C → C/PF`); it is not persisted on `Player`. Aggregate Player
minutes are derived from floor assignments rather than stored independently.
A valid Rotation V0 can be losslessly converted to natural-position-only V1.

Phase 6E.6B adds a representation-neutral engine read boundary. Team Strength,
game simulation, and box-score allocation can consume either valid V0 or V1 by
converging both into derived aggregate Player minutes before basketball math.
Paired deterministic tests prove natural-position-converted V1 produces exactly
the same OFF/DEF/OVR, scores, overtime, winners, and complete Player box scores
as V0, including mixed V0/V1 matchups. Legal true-secondary assignments also
flow through the boundary while natural Player position continues to determine
ratings and statistical tendencies.

No application or production state has migrated: Universe initialization,
default Rotation generation, Season, Postseason, Dynasty, Zustand, and React
all continue to store and produce Rotation V0. No default generator assigns
secondary minutes, and `Player` has no secondary-position field.

> **IMPORTANT — REVERTED WORK**  
> Previous Phase 6E.6 floor-aware Rotation / Secondary Position attempts were reverted. The current repository intentionally uses the clean accepted Rotation V0 implementation. Do not assume `FloorRotation`, `minutesByPosition`, `secondaryPosition`, floor-aware Zustand drafts, secondary-aware default Rotations, or secondary-position UI exist in production. No such artifacts are present under `src` in this clean state. If this changes, report the actual artifact rather than treating it as accepted architecture.

## Position-flexibility diagnostic

Phase 6E.5 is accepted evidence, not an accepted implementation.

- Sample: 288 deterministic rosters across three seeds at Seasons 1, 5, and 10.
- `38` Teams (`13.2%`) had a clear adjacent-position congestion case.
- `63` buried-player pairs had an average contribution gap of `7.54`.
- Candidate Team OVR changes: universal adjacent `+2.21` mean; narrow secondary candidate `+1.92` mean, `+1.74` median, `+5.13` maximum.
- Northbridge / Great Lakes gained approximately `+1.67` under the narrow candidate. Pine Valley gained approximately `+2.05`, without erasing the broader talent hierarchy.

Conclusion: strict natural-position Rotation is a confirmed gameplay limitation. A narrow secondary-position candidate looked more promising than universal adjacency. No production implementation has been accepted.

## Current playtesting and watchpoints

[PLAYTESTING.md](PLAYTESTING.md) is the detailed empirical source of truth. High-value active observations include Position/Rotation flexibility; Tournament balance/seeding; Player Detail and development-history UX; Recruiting Focus-target and commitment visibility; Assistant Fill Remaining Board; the elite Recruit POT-gap watchpoint; persistent Coaching/Rotation navigation; a Season Complete Super Sim idea; League News/Round Recap; Hub/Tournament layout polish; shot selection; offseason League context; followed/favorite Players; and Program records/deeper statistical history. These are observations, not completed features.

Manual Development V1 play produced the intended divergent stories: Lucas Webb moved from `68` OVR through `+12`, `+3`, and `+1` to roughly `84`; Aaron Jackson progressed from `55/97` through `+12` and `+10` to roughly `84`; Silas Matthews rose from about `57/85` to about `82` as a senior, while other Players developed much less. Development V1 is producing meaningful bust/hit/breakout variation and should not be reopened by default.

True powerhouse states can occur: one Northbridge roster reached roughly `87` Team OVR with multiple `90+` and `85+` Players. Mature seasons can still be mostly 70s with the best Teams in the low/mid 80s. Powerhouse frequency and persistence remain a WATCH; current evidence does not justify reopening Recruit Talent V1 or Development V1.

Repeated play has produced 1/16 upsets, low-seed championship runs, and memorable Cinderella outcomes, but extreme seed differences can sometimes hide modest Team OVR differences. Tournament variance is **not** confirmed broken. Diagnose seeding quality versus actual game upset variance before tuning Game Sim.

## Next engineering area

**Position / Rotation Flexibility** remains the next high-priority engineering
area. Phase 6E.6B's representation-neutral engine read boundary and exact V0/V1
simulation equivalence coverage are complete; any application-state or default
generation migration belongs to a separately reviewed later phase. Rotation V0
remains authoritative for all persisted production and application state.

## Documentation map

| Document | Purpose |
| --- | --- |
| [README](../README.md) | Project overview |
| [CURRENT_STATE](CURRENT_STATE.md) | What is true right now |
| [ROADMAP](ROADMAP.md) | Milestone sequencing |
| [ARCHITECTURE](ARCHITECTURE.md) | System boundaries |
| [SIMULATION](SIMULATION.md) | Accepted production formulas and rules |
| [GAME_DESIGN](GAME_DESIGN.md) | Accepted game rules |
| [PLAYTESTING](PLAYTESTING.md) | Observations and evidence |
| [CALIBRATION](CALIBRATION.md) | Tuning methodology |
| [KNOWN_ISSUES_AND_OPTIMIZATIONS](KNOWN_ISSUES_AND_OPTIMIZATIONS.md) | Confirmed unresolved technical/calibration issues |
| [FUTURE_FEATURES](FUTURE_FEATURES.md) | Deferred feature ideas |
