# Simulation Specification

This document records the implemented Team Strength, Single-Game Simulation V0, Player Box Scores V0, Player Season Stats V0, Postseason Simulation V0, Player Development V1, Recruiting V0, Next-Season Roster Assembly V0, and Dynasty Season Rollover V0 constraints.

## Status and pipeline

Implemented:

```text
Player/Team generation → Rotation → Player OFF/DEF → Team OFF/DEF/overall
    → seeded team-level outcome → Player box-score allocation
```

The completed single-game pipeline remains a game-level model. Possessions, play-by-play, substitutions, and fatigue remain separate future work.

Single-Game Simulation, Player Box Scores V0, Rotation V1, Stable Fictional Basketball Universe V0, Schedule Generation V0, Season State and Progression V0, Super Sim V0, Player/Team Season Stats, League exploration, Postseason, Dynasty progression, Recruiting, rollover, and the player-facing Dynasty lifecycle are complete. Universe initialization supplies deterministic Teams and legal flexible V1 defaults to this accepted pipeline; Schedule Generation and Dynasty progression do not alter game scoring, variance, overtime, or box-score formulas. Completed Season/Postseason `GameResult` facts and finalized Recruiting facts are preserved in their separate Dynasty histories.

AI Round Simulation and Standings V0 is complete and accepted. Season-level automatic simulation composes the existing single-game model without changing its scoring, variance, overtime, or box-score behavior. Each ScheduledGame receives an independent seed derived conceptually as:

```text
Season simulation namespace
+ Season identity
+ ScheduledGame identity
→ independent game simulation seed
```

The actual namespace retains the explicit simulation seed's numeric/string type and includes Season identity, Season number, Universe identity/version, and ScheduledGame ID. This keeps a game's outcome independent of execution order. Scheduled-game and pending-round operations use current Season Team/Rotation inputs and write complete output through `recordGameResult()` without changing the simulation formulas below.

### Season simulation entry points

Playing one scheduled game from Game Prep, Hub Quick Sim, AI rest-of-round simulation, and Super Sim all converge on the same deterministic per-game pipeline:

```text
current Season Team + current committed Rotation
ScheduledGame identity + explicit simulation seed
→ simulateScheduledGame()
→ simulateGame()
→ full GameResult
→ recordGameResult()
```

Each ScheduledGame has an independent derived seed, so changing execution order or choosing a faster UI path does not change its result. For identical Season state, simulation seed, Teams, and Rotations, normal round-by-round progression and Super Sim produce identical `GameResult` values.

Hub Quick Sim resolves only the controlled Program's next ScheduledGame. AI rest-of-round resolves eligible pending games in the current round. Super Sim repeatedly resolves pending rounds through an inclusive target: Round 12 for Midseason or Round 24 for End of Regular Season. It preserves already-completed results, uses every Program's current committed Rotation, and never simulates postseason games.

Every route records the same full `PlayerGameStats` fields: minutes, points, rebounds, assists, steals, blocks, turnovers, field goals made/attempted, three-pointers made/attempted, and free throws made/attempted. Accepted Player Season Stats V0 derives aggregates and game logs from these stored rows; it does not change the game formulas below or add authoritative mutable stat totals to `SeasonState`.

## Implemented Postseason Simulation V0

Postseason simulation begins only after the regular season is complete. Qualified Programs carry exact end-of-regular-season Team and current legal Rotation state into a separate `PostseasonState`; Teams, rosters, ratings, and default Rotations are not regenerated. Legal Postseason Rotation changes may be made between tournament games.

Each Tournament game receives an independent seed derived from the explicit simulation seed with its numeric/string type, the Postseason and Season identity, Universe identity/version, and stable Tournament game ID:

```text
postseason simulation namespace
+ typed explicit simulation seed
+ Postseason / Season identity
+ Tournament game ID
→ independent game simulation seed
```

There is no evolving tournament RNG stream. Ready games therefore produce the same individual results regardless of execution order. Identical Postseason state and simulation seed reproduce the same complete tournament, while a different simulation seed can change outcomes.

All 15 Tournament games call the existing `simulateGame()` and preserve its complete `GameResult` and full home/away `PlayerGameStats` arrays. Postseason adds no score-only shortcut and does not retune scoring, variance, overtime, Player allocation, or upset probabilities.

Tournament games pass `site: "neutral"`. This sets the normal home-court modifier to zero:

```text
neutral site
→ home-court expected-margin modifier = 0
```

The lower numerical seed remains the designated home Program solely for stable `GameResult` orientation and presentation semantics. In Postseason, home designation does not receive the normal three-point basketball home-court modifier. Regular-season callers omit the location option and preserve the accepted default home-site behavior. All existing overtime termination rules remain unchanged, including the pathological maximum-overtime safety fallback documented below.

Postseason results are stored separately from `SeasonState`, so Player Season Stats V0 remains regular-season-only. The retained tournament `PlayerGameStats` can support future postseason Player stats, combined regular/postseason stats, career stats, and tournament records, but those projections are not implemented.

Accepted inspection completed 384 of 384 regular-season games and all 15 tournament games. Field, bracket, and final Postseason validation passed; same-seed reproduction and ready-game execution-order independence passed; a different seed changed tournament outcomes; National Champion derivation and full Player-stat preservation passed; and neutral-site sampling confirmed removal of the normal home-court effect.

The accepted 200-replay diagnostic used one selected 16-Team field across many tournament simulation seeds. Higher seeds generally won more often, seeds 1–8 dominated championships overall, and deeper seeds retained nonzero title probability. Those observations reflect the actual strengths of that inspected field, not universal historical probabilities or permanent balance targets.

## Implemented Player Development V1

Player Development is a pure Dynasty-layer operation over one returning Player. It changes Player attributes and advances class while reusing the existing position-aware `calculateOverall()` function; OVR is never stored or incremented directly. Potential remains fixed.

Development V1 remains a pure Dynasty-layer operation over one returning Player. It changes position-aware attributes and advances class while reusing `calculateOverall()`; OVR is never stored or incremented directly. Potential remains fixed and is always a hard ceiling.

The completed class provides a baseline, not an absolute gain ceiling:

| Completed class | Next class | Baseline range | Headroom multiplier | Per-offseason cap |
| --- | --- | ---: |
| FR | SO | 1–4 | 1.20 | 12 |
| SO | JR | 1–3 | 0.90 | 10 |
| JR | SR | 0–2 | 0.65 | 8 |

For each offseason, Development derives `headroom = POT − current OVR`, selects a stable hidden Player tendency from the Dynasty seed and Player ID, then derives a target increment:

```text
baseline = inclusive class-range draw
opportunity = floor((headroom / 8) × class multiplier × tendency multiplier)
variance = inclusive draw from -1 to +1
breakout = 0, or +3 to +6 when headroom is at least 8
target increment = min(class cap, max(0, baseline + tendency adjustment + opportunity + variance + breakout))
target OVR = min(POT, current OVR + target increment)
```

Tendencies are deterministic but not stored Player attributes: `30%` weak (`0.40×` opportunity, `−1` baseline, `0.30×` breakout chance), `50%` steady (`1.00×`, `0`, `1.00×`), and `20%` strong (`2.10×`, `+2`, `2.00×`). Annual variance remains independent, so a strong developer can disappoint and a weaker developer can still have a good year. Breakout chance is `6% / 3.5% / 1.5%` for FR/SO/JR, multiplied by `min(2, headroom / 20)` and the tendency breakout multiplier.

These are target opportunities, not guaranteed derived gains. Attribute caps, position weights, and the Potential ceiling govern whether allocation reaches the target. A Player at POT receives no attribute changes but still advances class; seniors graduate before Development.

Attribute gains are allocated one point at a time. Every attribute remains eligible while below 99, but position changes its relative selection weight:

| Position | FIN | SHO | PLY | HND | PER D | INT D | REB | ATH | STA |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PG | 2 | 5 | 6 | 6 | 4 | 1 | 1 | 3 | 2 |
| SG | 5 | 6 | 2 | 4 | 5 | 1 | 1 | 3 | 2 |
| SF | 4 | 4 | 3 | 3 | 4 | 3 | 3 | 4 | 2 |
| PF | 6 | 2 | 1 | 1 | 2 | 5 | 6 | 5 | 3 |
| C | 5 | 1 | 1 | 1 | 1 | 7 | 7 | 5 | 3 |

For each allocation draw, each eligible base weight receives independent Player-RNG variation from `0.75×` inclusive to below `1.25×`. Repeated gains to the same attribute are damped by `1 / (1 + 0.35 × prior gains that offseason)`. A weighted draw selects the attribute. The implementation tentatively adds one point and accepts it only when the derived OVR remains at or below POT. Allocation stops at target OVR/POT, opportunity exhaustion, or all attributes reaching 99. This preserves uneven position-aware profiles without requiring every large offseason to concentrate in one skill.

Development randomness uses an independent RNG created from a JSON seed namespace containing:

```text
namespace = college-hoops-sim:player-development:v1
typed numeric/string Dynasty seed
completed season number
Program ID
Player ID
```

The stable tendency uses a separate `college-hoops-sim:player-development-tendency:v1` namespace containing the typed Dynasty seed and Player ID. There is no shared evolving offseason RNG. The same inputs reproduce the same Player; changing the Dynasty seed changes at least some development, while Program and Player processing order do not affect per-Player results. Development never calls `Math.random()`.

Development V1 has no regression and no dependency on playing time, starts, rotation role, Player statistics, Team wins, Postseason success, controlled/AI ownership, Program prestige, conference, coaching, or facilities. All attributes remain within 40–99, Potential does not change, and derived OVR cannot exceed Potential. A Player may stagnate or graduate well below Potential.

The accepted direct diagnostic ran 5,500 deterministic production-API careers. Annual OVR gain median/P90/P95/max was `+2/+7/+9/+12`; `+6`, `+8`, and `+10` gains occurred in `16.0%`, `8.4%`, and `4.4%` of the deliberately high-headroom-balanced sample. High-Potential raw outcomes remained diverse: 55/90 careers were `23.0%` bust, `11.6%` low, `27.6%` solid, `16.0%` hit, and `21.8%` breakout under diagnostic-only total-gain labels. Their senior OVR median/P90/P95/max was `69/81/82/85`, compared with `60/60/60/61` for 55/60.

The full 5-seed × 10-season acceptance run retained valid rosters, Rotations, schedules, Focus state, commitments, lifecycle, history, serialization, and deterministic replay. Season 10 averaged `78.8` active Players at 80+, `21.4` at 85+, `1.8` at 90+, and `0.2` at 95+—well below the pre-Recruit-Talent-V1 inflated ecosystem. It produced a Season-10 Team OVR median/P90/max of `77.3/80.3/84.6`; rare strong contenders remained possible (champion/runner-up strengths ranged to `89.1/88.9`) without a hidden Prestige Development multiplier.

## Implemented Recruiting V0

Recruiting is a deterministic Dynasty-layer simulation targeting the following season. It consumes the active Season's current Teams and projected senior departures, but it neither changes game simulation nor mutates current Teams, Rotations, or Season results.

### National class generation and ranking

Position demand is the sum of all 32 Programs' projected senior departures at that natural position. Generated supply is calculated independently per position:

```text
supply(position) = max(18, ceil(national demand(position) × 1.65))
```

Every generated Recruit already contains his future freshman `Player` value. The generator supplies `classYear: FR`; the accepted Player generator produces exact attributes, height, name, Potential, and stable identity. The Recruiting talent input has a long upper tail:

```text
talent = clamp(52, 88, round(56 + 31 × U^1.55))
U = seeded uniform value in [0, 1)
```

Class quality is:

```text
qualityScore = roundTo2(OVR × 0.72 + POT × 0.28)
```

National order sorts by quality score descending, OVR descending, POT descending, then stable Player ID. Position Rank counts each position within that national order. Stars use exact cumulative class-rank bands:

| National class band | Stars |
| --- | ---: |
| Rank ≤ `ceil(class size × 0.06)` | 5 |
| Rank ≤ `ceil(class size × 0.26)` | 4 |
| Rank ≤ `ceil(class size × 0.72)` | 3 |
| Remaining ranks | 2 |

National Rank, Position Rank, stars, and quality score are immutable facts of that Recruiting class. Future development does not rerank the historical class.

### Attraction, relationships, and decisions

For each Recruit/Program pair:

```text
base attraction = roundTo2(20 + Team.prestige × star sensitivity + affinity)
affinity = seeded integer from -12 through +12
standing = roundTo4(base attraction + accumulated relationship progress)
```

| Stars | Prestige sensitivity | Decision-ready period | Standing threshold | Separation threshold |
| --- | ---: | ---: | ---: | ---: |
| 2 | 0.10 | 4–15 | 42–58 | 2–7 |
| 3 | 0.18 | 7–18 | 56–75 | 4–9 |
| 4 | 0.29 | 10–22 | 74–96 | 6–12 |
| 5 | 0.30 | 11–24 | 64–92 | 4–9 |

All ranges are inclusive seeded integer draws stored on the Recruit. Every active Board target receives 3 relationship-effort units each period, whether offered or not. A Program may Focus at most three active Board targets; each Focus target receives an additional fixed 3 units:

```text
target progress = 3 + (isFocused ? 3 : 0)
```

Neither term is normalized by Board size, other Focus targets, or unused Focus capacity. Inactive targets receive no effort; invalid Focus is cleared during canonical plan cleanup. Board, Focus, and Offer remain separate facts. Standing order is descending standing with stable Program ID as the tie-breaker.

A Recruit may commit only after his decision-ready period and only to a Program that has a valid Active Offer, unfilled capacity at his position, and at least 8 relationship progress. The leading eligible Program must meet both the Recruit's standing threshold and the required lead over the eligible runner-up. Recruits resolve in National Rank order then Player ID; exact standing ties resolve by Program ID. A recorded commitment is final.

Regular-season thresholds never ease. During periods 25–28, only already-ready Recruit confidence changes:

```text
postseason step = period - 24
effective standing threshold = stored threshold - 1.5 × postseason step
effective separation threshold = max(2, stored threshold - 0.75 × postseason step)
```

This modestly makes ready Recruits more decisive as the calendar closes; it does not force premium commitments, and close or insufficiently strong battles may remain unresolved.

### Board construction and AI offers

Boards hold at most 10 targets. Default plans seek at most three candidates per remaining positional opening and cycle across positions. Default priorities by board slot are `5, 4, 3, 3, 2, 2, 1, 1, 1, 1`. For a position, the prestige-shaped target rank is:

```text
ideal position rank = max(1, round(candidate count × (1.08 - prestige × 0.0095)))
candidate utility = -2 × abs(position rank - ideal rank) + base attraction
```

Candidate ties use National Rank then Player ID. AI Programs refresh boards and offers in stable Program-ID order; the controlled Program is excluded from AI management.

AI offer evaluation uses the next planning period, capped at 28:

```text
offer utility =
  qualityScore × (0.5 + prestige × 0.033)
  + (standing - standingThreshold) × (0.65 + planningPeriod × 0.02)
  + (25 - decisionReadyPeriod) × 1.5
  + relationshipProgress × 0.3
  - competingOffers × (3 + planningPeriod × 0.35)
  + uncoveredPremiumUrgency
  - eliteReachPenalty

uncoveredPremiumUrgency =
  stars ≥ 4 and no competing offer
    ? max(0, planningPeriod - 6) × (stars = 5 ? 3 : 1.5)
    : 0

eliteReachPenalty = stars = 5 ? max(0, 65 - prestige) × 0.7 : 0
```

An AI offer switches to a backup only when the utility gain exceeds:

```text
max(3, 10 - planningPeriod × 0.3)
```

AI premium discovery may add or replace unoffered board targets; after Period 7, an uncovered 4/5-star receives more permissive discovery. During postseason endgame preparation, unsigned premium Recruits are considered in National Rank order and autonomous Programs attempt to establish up to two valid offers without replacing the controlled Program's valid offer. Strict positional capacity and final commitments always remain authoritative.

### Calendar and Super Sim equivalence

Periods 1–24 require the corresponding complete regular-season basketball round. Periods 25–28 require the completed Round of 16, quarterfinals, semifinals, and National Championship respectively. Every Program recruits during all four Postseason periods; Tournament success supplies no attraction bonus.

Synchronization is idempotent and resolves each missing Recruiting period one by one in canonical order. It never replaces multiple periods with an aggregate calculation. With unchanged user choices, manual advancement and Super Sim/batched basketball progression therefore produce identical relationship progress, AI changes, offer cleanup, controlled-board backup promotions, and commitments in both regular season and Postseason.

### Late Recruiting and finalization

Late Recruiting is a distinct reviewable phase available only after Period 28; it is not a fictional Period 29+. Existing relationships and valid offers remain authoritative, and all unsigned Recruits are decision-ready for this conclusion of the same market.

Vacancies first use eligible existing-board backups ordered by Focus status, standing descending, National Rank ascending, then Player ID. Autonomous Programs—and the controlled Program only during full automatic finalization—may search the broader unsigned national pool. National candidates use:

```text
late utility = qualityScore × 1.5
             + standing
             - abs(standing - stored standing threshold) × 0.2
```

Unsigned Recruits resolve in National Rank order then Player ID. Only Programs with a valid Active Offer and compatible remaining positional capacity are candidates; highest standing wins, with Program ID breaking ties. Capacity and invalid offers are recalculated after every commitment. Finalization iteratively fills offer vacancies, prepares premium options, and resolves commitments until every projected opening is filled. Lower-tier Recruits remain unsigned when League roster supply is exhausted.

The defensive fallback matcher is not normal Recruiting flow. It runs only if an iterative pass produces zero commitments while openings remain; it uses existing unsigned Recruits, compatible positional capacity, standing, and stable Program ID ordering. Supply is validated before finalization. V0 contains no emergency-Recruit generation path: `emergencyGeneratedRecruits` is always `0`, and normal and fallback resolution use only the originally generated class.

Finalization marks the state `finalized` and appends a structured clone to `completedRecruitingHistory` as a `CompletedRecruitingClass`. Repeating finalization on the already-finalized state is idempotent; a conflicting duplicate target-season archive is rejected.

### Deterministic seed namespaces

Class and decision RNG streams use JSON namespaces containing Recruiting version `v0`, the Dynasty seed with its numeric/string type preserved, target season number, and a stream name. Player generation uses `class:{position}:{index}`. Decision draws use `decision:{playerId}:ready`, `:standing`, and `:separation`. Recruit/Program affinity uses the same version, typed Dynasty seed, target season, stream `program-affinity`, Player ID, and Program ID. There is no shared evolving Recruiting RNG and no `Math.random()`.

### Accepted calibration and validation

One canonical 32-Program inspection observed 88 projected openings and 147 generated Recruits (`1.67×` supply), including nine 5-stars and 30 4-stars. It filled 66 openings by Period 24, 74 by Period 28, and all 88 after 14 Late commitments across three resolution passes. All nine 5-stars and all 30 4-stars signed; neither fallback nor emergency generation was used.

| Phase | Commitments | Average National Rank | Average OVR | Average POT |
| --- | ---: | ---: | ---: | ---: |
| Regular season | 66 | 49.0 | 73.2 | 84.0 |
| Postseason | 8 | 44.0 | 74.6 | 85.4 |
| Late | 14 | 47.2 | 74.2 | 84.3 |

In that canonical sample, average actual commitment periods were approximately 20.2 for 5-stars (earliest 16), 17.9 for 4-stars, and 14.1 for 3-stars. These are observations from generated decisions and competition, not additional constants or guaranteed timing.

Across 100 deterministic strategic scenarios, a lower-ranked early underdog defeated a late favorite about 72% to 28%, while an early underdog pursuing an elite Recruit won about 33% to the late favorite's 67%. These results validate attainable early investment and stronger elite prestige pressure; they are not fixed probabilities.

Across 100 full finalization cycles, every projected opening was filled in all 100. No cycle left a 5-star unsigned; one left a 4-star unsigned because no compatible positional capacity remained. That is an accepted consequence of strict positional capacity plus final commitments, not a defect or a guarantee that every premium Recruit signs. Fallback and emergency Recruit usage were both zero across the 100 cycles. Premium Recruits are strongly prioritized and should not remain unsigned while compatible capacity remains.

## Implemented Next-Season Roster Assembly V0

`assembleNextSeasonRosters()` is a pure construction/validation step over a lifecycle-compatible `OffseasonState`, finalized `CompletedRecruitingClass`, matching `CompletedSeasonArchive`, and Universe. For each Program:

```text
next roster = accepted Offseason returners
            + Recruits committed to that Program
```

Only recorded commitments enroll; unsigned Recruits remain in Recruiting history. The assembler does not regenerate or develop Players, rerun graduation or Recruiting, reconsider destinations, or create replacements. Every Program must exist in all sources, all target-season fields must agree, and each result must contain exactly 12 Players. An 11- or 13-Player result fails rather than being repaired.

An incoming Player is a structured clone of `Recruit.player` with `classYear: "FR"`. Player ID, name, height, natural position, all nine attributes, and Potential remain exact; derived OVR therefore remains exact. Returners are likewise cloned from their already-developed/class-advanced Offseason values. Output is deterministically ordered by `PG, SG, SF, PF, C`, then stable Player ID.

Validation checks Player IDs/names, accepted position-specific height ranges, valid class, integer 40–99 attributes and Potential, `OVR ≤ POT`, exact positional composition, one appearance per returner/commitment, commitment destination, graduate exclusion, and unique active IDs. Historical continuation is semantic: the same person may share an ID across Recruit/active or prior/current snapshots, while an unrelated Recruit may not reuse it.

One accepted 5C.1 canonical inspection observed 290 returners and 94 commitments, producing 384 Players across 32 of 32 exact 12-Player rosters. It found 384 unique active IDs, zero changed returner or Recruit-enrollment IDs, and zero duplicates. Completed Season history, completed Recruiting history, and Offseason input all remained unchanged. These returner/commitment counts describe that sample, not fixed future distributions.

## Implemented Dynasty Season Rollover V0

`rolloverDynastyToNextSeason()` is the atomic pure orchestration boundary. It requires no active Season/Postseason, a prepared Offseason, exactly one matching completed Season archive and finalized Recruiting class, unique Season/Recruiting history keys, finalized active Recruiting equal to its historical snapshot, compatible seasons/Programs, and a valid roster assembly. Failure returns no partial Dynasty and mutates no input.

For every Program, rollover creates a fresh Team from stable Program ID/name/abbreviation, preserved Offseason prestige, and the assembled roster. It then calls the accepted default Rotation generator; prior-season minutes are not reused. Archived Teams and Players remain independent immutable snapshots.

### Season-specific Schedule and Game IDs

The next Schedule seed is the JSON serialization of:

```text
namespace: college-hoops-sim:dynasty-schedule:v0
typed numeric/string Dynasty seed
Season number
```

The existing Schedule generator consumes that value normally. Rollover also supplies the lifecycle Game-ID namespace `season-N`, producing IDs shaped as:

```text
schedule:{universeId}:{universeVersion}:season-N:
round-{round}:game-{index}:{homeProgramId}:{awayProgramId}
```

Other Schedule callers may omit the optional namespace and retain the pre-rollover ID format. Rollover rejects a Game ID found in completed Season history and rejects a next Schedule whose normalized round/orientation structure exactly reproduces the prior Schedule. Identical Dynasty/lifecycle input reproduces the same next Schedule; Program definition order does not affect it.

### Fresh Season and next Recruiting cycle

`initializeSeason()` receives the fresh Teams/Rotations and Schedule, creating Season N+1 with empty `resultsByGameId`. No prior results, records, standings, statistics, Schedule, or Rotations are copied. At initialization, 0 of 384 games are complete, every record derives as 0–0, and the Season is incomplete.

The successful Dynasty postcondition is:

```text
activeSeason              = Season N+1
activePostseason          = null
offseason                 = null
history                   = preserved
completedRecruitingHistory = preserved
controlledProgramId       = preserved
recruiting                = fresh cycle targeting N+2
```

The existing `initializeRecruiting()` immediately derives N+2 positional openings from seniors on the new rosters, generates a season-specific national class, creates default plans for every Program including the controlled Program, and leaves `lastResolvedPeriod = 0`. Existing Recruiting V0 target-season namespaces make the class distinct from prior cycles. Rollover additionally rejects any new Recruit ID that duplicates another new Recruit or collides with completed Season Players, current Players, or prior Recruiting identities.

### Accepted rollover and lifecycle validation

One accepted Season 1 → 2 inspection observed 289 returners, 95 incoming Recruits, and 384 assembled Players after 384 regular-season and 15 Postseason games. Rollover preserved the controlled Program and both histories, cleared Offseason/Postseason state, and created Season 2 with 32 exact rosters and 384 unique Players.

All 32 default Rotations validated with exactly 200 minutes and zero invalid positional assignments. The new Schedule validated at 384 games/24 rounds, with every Program receiving 14 Conference games, 10 non-Conference games, and a 12/12 home-away split. Season 1 and Season 2 shared zero Game IDs and did not have identical Schedule structures.

The resulting Season 2 stored zero results and derived every Program at 0–0. Recruiting targeting Season 3 observed 90 projected openings and generated 151 Recruits, with plans for 32 of 32 Programs and zero resolved periods. Those two counts are canonical sample observations, not fixed rules. Class 3 had zero IDs colliding with active Season 2 Players, historical Players, or prior Recruiting identities and contained no duplicate IDs.

A five-season invariant smoke completed Seasons 1–5 and five rollovers. Completed Season archives grew `1 → 2 → 3 → 4 → 5`; completed Recruiting histories grew by target season `2 → 3 → 4 → 5 → 6`. Every roster, Rotation, Schedule, and finalized Recruiting cycle remained valid, with zero unfilled openings, identity collisions, cross-season Game-ID collisions, emergency Recruits, fallback uses, or lifecycle failures. The multi-season `DynastyState` passed JSON round-tripping. This proves lifecycle/serialization health at the inspected scale, not long-run talent equilibrium or implemented persistence/save UX.

## Accepted Dynasty Long-Run Calibration V0

The accepted inspection exercised the real lifecycle for five deterministic Dynasty seeds and 50 completed Seasons per seed: 250 Season observations and 250 rollovers. Identical configuration replayed deterministically. The full run took approximately `214.8` seconds on the inspection environment. Runtime is an observation, not a gameplay constant or current performance failure.

All values below are observed calibration evidence. They are not hardcoded generation quotas, guaranteed future distributions, or test thresholds.

### Team talent equilibrium

| Window | Average Team OVR | OVR slope / Season | Average Team OVR SD |
| --- | ---: | ---: | ---: |
| Seasons 1–5 | 77.55 | +2.041 | 5.14 |
| Seasons 6–15 | 81.13 | −0.085 | 4.45 |
| Seasons 16–50 | 81.25 | +0.003 | 4.50 |

Late-window slopes by seed were `+0.012`, `+0.010`, `0.000`, `−0.016`, and `+0.008`; their mean was `+0.003` and median `+0.008`. The accepted classification is **STABLE**. The initial Season 1 → 2 increase is a transition from the generated Universe toward the endogenous roster economy, not persistent inflation.

The canonical seed followed this representative path:

| Season | Average Team OVR |
| ---: | ---: |
| 1 | 72.68 |
| 2 | 75.35 |
| 3 | 77.98 |
| 5 | 81.08 |
| 10 | 81.15 |
| 20 | 81.63 |
| 30 | 80.50 |
| 40 | 81.15 |
| 50 | 81.22 |

The late-window Team OVR distribution retained meaningful separation: P10 `75.2`, P25 `78.7`, median `81.9`, P75 `84.6`, and P90 `86.4`. Equilibrium near 81 was an observed outcome of that historical V0 talent model, not a current target; Recruit Talent Distribution V1 and Development V1 later superseded it.

### Player lifecycle and Development

| Class | Average OVR | Average POT | Average POT gap | At POT | Within 3 OVR of POT |
| --- | ---: | ---: | ---: | ---: | ---: |
| FR | 73.63 | 84.22 | 10.59 | 0.0% | 0.0% |
| SO | 77.12 | 84.22 | 7.10 | 0.0% | 14.2% |
| JR | 79.52 | 84.20 | 4.68 | 12.1% | 38.3% |
| SR | 80.74 | 84.16 | 3.42 | 25.0% | 54.0% |

The steady-state population supports `FR < SO < JR < SR` on average; it does not require monotonic growth for every individual Player.

| Transition | Average OVR gain | Median | Zero gain | Gain 3+ |
| --- | ---: | ---: | ---: | ---: |
| FR → SO | 3.50 | 4 | 0.0% | 75.0% |
| SO → JR | 2.41 | 2 | 0.0% | 46.5% |
| JR → SR | 1.24 | 1 | 33.9% | 17.9% |

Development is accepted as healthy rather than materially too strong or weak. Players approach their ceilings without every upperclassman reaching POT, so Potential remains meaningful.

The late window contained 16,806 incoming freshmen averaging `73.63 OVR / 84.22 POT` and 16,799 graduating seniors averaging `80.74 OVR / 84.16 POT`. Incoming and graduating Potential were effectively equal, while the `7.11` OVR difference was bridged by cumulative Development. This replacement flow is the strongest evidence for a stable endogenous talent economy.

Average late-window high-end populations per Season were:

| Threshold | Players / Season |
| --- | ---: |
| OVR ≥ 80 | 165.77 |
| OVR ≥ 85 | 92.64 |
| OVR ≥ 90 | 33.15 |
| OVR ≥ 95 | 4.35 |

These counts are observations, not Recruit-generation or roster quotas.

### Program hierarchy and outcomes

| Prestige band | Average Team OVR | Average Recruit rank | Average Recruit OVR | Average Recruit POT |
| --- | ---: | ---: | ---: | ---: |
| 80–100 | 85.44 | 31.7 | 78.47 | 89.15 |
| 60–79 | 82.36 | 47.4 | 74.71 | 85.27 |
| 40–59 | 77.76 | 70.4 | 69.69 | 80.28 |
| 1–39 | 69.86 | 106.9 | 62.77 | 73.31 |

Prestige correlated `0.773` with Team OVR; Team OVR correlated `0.839` with regular-season winning percentage; and adjacent-season Team OVR correlated `0.890`. Prestige therefore creates meaningful quality and continuity without absolute outcomes.

Across 250 championships, 26 of 32 Programs won at least once. Northbridge won 25, Appalachian Commonwealth 20, and Great Lakes 20. Prestige bands `80–100`, `60–79`, `40–59`, and `1–39` won `112`, `126`, `12`, and `0` titles respectively. No Program received more than `6.2%` of late-window 5-star Recruits. Stronger Programs retained a clear advantage without a single-Team premium-Recruit monopoly or championship lock.

Strict positional Recruiting remained stable at approximately 76–77 active Players per position per Season. Across the full run there were zero invalid rosters, Rotations, or Schedules; unfilled Recruiting/roster openings; Player-ID, Game-ID, or history collisions; history overwrites; emergency Recruits; fallback matcher uses; premium unsigned Recruits with compatible capacity; lifecycle failures; or serialization failures.

### V0 calibration freeze

The pre-V1 Recruit-generation calibration is superseded by the accepted V1 distribution below. Recruiting mechanics, Player Development, roster rollover, and the remaining Dynasty rules are otherwise frozen. Do not casually retune them. Reopen calibration only when new evidence reveals a genuine problem or a future system materially changes talent flow—for example transfers, early professional departures, redshirts/fifth years, dynamic prestige, roster-size or position-flexibility changes, or staff/Development modifiers. UI and application integration alone do not justify recalibration.

The full-snapshot `DynastyState` remained serializable but measured `30.57 MB` after Season 10, `76.20 MB` after Season 25, and `152.27 MB` after Season 50. This approximately linear storage growth is tracked separately as an architecture/scaling watchpoint in `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`; it does not change the stable talent-economy conclusion.

## Accepted Recruit Talent Distribution V1

This section supersedes the earlier Recruit-generation and long-run talent-density observations above. The earlier V0 figures remain historical calibration evidence only; V1 is the source-of-truth distribution for current Dynasty Recruiting.

Recruit generation now samples two separate deterministic qualities before calling the existing position-aware Player generator:

```text
readiness → Player attributes → derived current OVR
ceiling   → Player Potential
```

Readiness is sampled from these organic generation bands: `0.3%` at `86–92`, `8.2%` at `78–86`, `21.5%` at `71–79`, `46.0%` at `60–72`, and `24.0%` at `47–61`. Ceiling is independently sampled: `2.5%` at `88–99`, `15.0%` at `80–90`, `42.5%` at `70–82`, and `40.0%` at `60–74`. A Recruit's Potential is `max(derived OVR, sampled ceiling)`, preserving the fundamental `POT ≥ OVR` invariant without storing mutable OVR.

National Rank remains meaningful but is not an OVR ladder: its deterministic quality score is `56% derived OVR + 44% Potential`, before stable OVR, Potential, and Player-ID tie-breakers. Stars continue to derive from National Rank percentiles. Position-aware attributes, height, identity, position-based OVR calculation, legal Player bounds, and typed seeded namespaces remain unchanged. Season 1 roster generation is intentionally separate and unchanged.

Across 50 deterministic Recruiting classes of the current V0 supply size (about 161 Recruits per class), V1 observed:

| Metric | V1 observed per class |
| --- | ---: |
| 90+ OVR | 0.38 |
| 85+ OVR | 3.84 |
| 80+ OVR | 14.02 |
| OVR below 70 / 65 / 60 | 98.78 / 68.60 / 39.36 |
| 55–64 OVR with 85+ POT | 5.04 |
| 60–69 OVR with 85+ POT | 6.14 |
| 75+ OVR with POT gap at most 5 | 29.74 |

The same sample observed Recruit OVR `P10/P25/P50/P75/P90 = 53/60/66/73/79`, Potential `67/71/76/81/86`, and Potential-minus-OVR `0/0/8/16/24`. Correlations became Rank↔OVR `-0.889`, Rank↔POT `-0.685`, and OVR↔POT `0.342` (versus the earlier near-perfect V0 ordering). This is accepted evidence of meaningful readiness/ceiling variation, not hardcoded class quotas.

The current 5-seed × 10-season equilibrium smoke remained deterministic and structurally valid: all 50 recruiting cycles filled every opening with zero fallback/emergency Recruits, invalid Focus states, duplicate commitments, or lifecycle failures. By Season 10 it averaged `74.2` active Players at 80+, `20.2` at 85+, and `2.0` at 90+ per 384-player League, down from the pre-V1 talent-rich equilibrium. Team OVR averaged `76.28` in the late window, with clear Prestige separation (`79.36`, `77.41`, `73.28`, `66.74` for 80–100 through 1–39 bands).

Player Development is unchanged. The V1 smoke shows no continuing talent inflation; its mature high end is below the earlier directional density target, so Development is not currently a candidate for an inflation reduction. Any future adjustment to Development, NBA/early departures, transfers, redshirts, roster capacity, or Recruit supply requires a new isolated talent-flow calibration.

## Implemented Player Season Stats V0

Player Season Stats adds no game-outcome formulas, randomness, or simulation-mode metadata. It runs only after canonical results exist:

```text
simulateGame()
→ full PlayerGameStats
→ record GameResult
→ later aggregate Player season statistics / chronological game logs
```

Game Prep simulation, Hub Quick Sim, AI round simulation, and Super Sim are statistically equivalent inputs to this layer. If they produce the same canonical `GameResult` values, they produce identical Player Season Stats. Partial Seasons include only completed results; pending ScheduledGames contribute nothing.

Each Program projection returns one row per current roster Player. Individual, Program-wide, and Season-wide APIs expose exact totals for games played, minutes, points, rebounds, assists, steals, blocks, turnovers, FGM/FGA, 3PM/3PA, and FTM/FTA. The domain retains full numeric precision and leaves display rounding to future presentation.

Games played counts participation rather than box-score-row presence:

```text
gamesPlayed = count(completed games where Player minutes > 0)
```

A completed Team game with a stored zero-minute row remains in the chronological Player game log with `didPlay: false`, but it does not increment `gamesPlayed`.

Per-game values use the derived games-played denominator:

```text
MPG = total minutes / gamesPlayed
PPG = total points / gamesPlayed
RPG = total rebounds / gamesPlayed
APG = total assists / gamesPlayed
SPG = total steals / gamesPlayed
BPG = total blocks / gamesPlayed
TOPG = total turnovers / gamesPlayed
```

Shooting percentages use aggregate Season makes and attempts, never an average of game percentages:

```text
FG% = total FGM / total FGA
3P% = total 3PM / total 3PA
FT% = total FTM / total FTA
```

A zero games-played or zero-attempt denominator returns numeric `0`, never `NaN` or `Infinity`. Results and game logs are serializable, pure, and independent of `resultsByGameId` insertion order; logs sort chronologically by Schedule round and canonical game index.

Accepted full-season inspection reported 32 Programs, 384 of 384 completed regular-season games, 384 current-roster Player stat lines, and passing validation. Derived totals reconciled to raw `PlayerGameStats`, zero-minute games did not falsely increment games played, all numbers remained finite, JSON round-tripping passed, and logs remained chronological. Observed scoring hierarchy and game-to-game variance were plausible but are not calibration targets.

## Implemented Team Season Stats V0.1

Team Season Stats adds no simulation behavior, randomness, or mutable Season counters. It is a pure regular-season projection over completed Program games:

```text
completed regular-season GameResults
→ canonical final scores + participating Team PlayerGameStats
→ Team totals and rates
```

`gamesPlayed` counts completed regular-season games for the Program. Team points and points allowed come from canonical final scores. Rebounds, assists, steals, blocks, turnovers, and shooting makes/attempts sum the Program's stored Player rows.

Derived rates are:

```text
PPG          = points / gamesPlayed
Opponent PPG = pointsAllowed / gamesPlayed
Margin/game  = (points − pointsAllowed) / gamesPlayed
RPG          = rebounds / gamesPlayed
APG          = assists / gamesPlayed
SPG          = steals / gamesPlayed
BPG          = blocks / gamesPlayed
TOPG         = turnovers / gamesPlayed

FG% = total FGM / total FGA
3P% = total 3PM / total 3PA
FT% = total FTM / total FTA
```

Shooting percentages use aggregate makes divided by aggregate attempts, never averages of game percentages. Zero attempts return numeric `0`; zero completed games return safe zero totals and rates. `TeamSeasonStats` remains regular-season-only and does not modify game simulation or `SeasonState`.

## Quick Sim Game Leaders projection

The completed Quick Sim card derives whole-game PTS, REB, and AST leaders from the canonical home plus away `PlayerGameStats` in one stored `GameResult`. A leader may come from either Program. Ties resolve deterministically by the target statistic, minutes, then stable Player ID; an all-zero category displays no arbitrary leader. This is presentation projection only and creates no alternate result, leaderboard state, or simulation formula.

## Accepted Rotation V1

Canonical `RotationV1.minutesByPosition` stores Player-minute assignments for
each floor position. PG, SG, SF, PF, and C each total exactly 40 minutes, Team
minutes total 200, and no Player may exceed 40 aggregate minutes. Aggregate
Player minutes are derived from the five buckets.

Eligibility is derived from natural position and is not stored on Player:

```text
PG → PG / SG
SG → SG / SF
SF → SF / PF
PF → PF / C
C  → C / PF
```

Fresh Universe, Exhibition, and Dynasty rollover defaults use the deterministic
flexible generator. It begins with the unchanged V0 natural allocation, converts
it losslessly, and applies legal substitutions using balanced contribution
`(OFF + DEF) / 2`: minimum advantage `5`, maximum secondary minutes per Player
`8`, maximum aggregate minutes `40`, buried baseline maximum `9`, displaced
incumbent minimum `20`, and the accepted V0-capped-player exception at `36`.
Tie-breaking is stable and consumes no RNG.

Existing V1 rotations are never regenerated during Season progression,
Postseason transition, cloning, archives, drafts, or simulation. V0 remains only
at compatibility, normalization, conversion, equivalence-test, and historical
diagnostic boundaries. Accepted WATCH metrics are 36→40-minute frequency,
interior/forward-heavy secondary paths, and rare large incumbent displacement.

## Implemented v0.1 derived strength

Player offense and defense are pure, deterministic functions of current attributes and position. They accept no RNG, do not mutate inputs, and are never stored on Player. Current attributes retain their shared validation requirement: every rating must be finite and within the inclusive 40–99 range. Every positional weight set sums to `1.00`.

### Player offense

```text
OFF = finishing × Fin weight
    + shooting × Sht weight
    + playmaking × Play weight
    + ballHandling × Handle weight
    + athleticism × Ath weight
    + rebounding × Reb weight
```

| Position | Finishing | Shooting | Playmaking | Ball handling | Athleticism | Rebounding |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| PG | 10% | 25% | 27% | 25% | 10% | 3% |
| SG | 23% | 33% | 10% | 18% | 12% | 4% |
| SF | 24% | 24% | 14% | 14% | 16% | 8% |
| PF | 36% | 20% | 6% | 6% | 20% | 12% |
| C | 48% | 8% | 4% | 4% | 21% | 15% |

### Player defense

```text
DEF = perimeterDefense × PerD weight
    + interiorDefense × IntD weight
    + rebounding × Reb weight
    + athleticism × Ath weight
```

| Position | Perimeter defense | Interior defense | Rebounding | Athleticism |
| --- | ---: | ---: | ---: | ---: |
| PG | 60% | 3% | 5% | 32% |
| SG | 55% | 5% | 10% | 30% |
| SF | 34% | 23% | 20% | 23% |
| PF | 12% | 40% | 28% | 20% |
| C | 5% | 47% | 30% | 18% |

Position therefore changes how the same attribute profile translates into OFF/DEF. Potential and class year do not affect current ratings.

Stamina does not directly enter Player OFF/DEF. It already contributes 4–7% of derived Player overall depending on position, and overall drives default Rotation allocation. Stamina can therefore affect Team Strength indirectly through minutes without being double-counted as skill. In-game fatigue remains deferred.

### Team aggregation

A Rotation must pass the implemented validation rules before strength is calculated. Invalid rotations are rejected with a `RangeError` containing the validation messages rather than normalized.

```text
Team OFF = Σ(Player OFF × assigned minutes) / 200
Team DEF = Σ(Player DEF × assigned minutes) / 200
Team overall = (Team OFF + Team DEF) / 2
```

Zero-minute Players contribute nothing. Team aggregation is also pure and deterministic: identical Team and Rotation inputs return identical strength values without mutation. Player OFF/DEF and Team OFF/DEF/overall retain normal JavaScript floating-point precision; the implementation performs no intermediate or final rounding. Inspection tools round only their displayed output to one decimal place.

These formulas are the implemented and validated v0.1 baseline. Their exact constants are documented for reproducibility and tuning, not as permanent balance commitments or required prestige-tier targets.

## Implemented Single-Game Simulation V0

`simulateGame` takes two Teams, one valid Rotation per Team, an explicit numeric or string seed, and an optional game site. The site defaults to `home`, preserving accepted regular-season behavior; callers may explicitly select `neutral`. It returns a serializable `GameResult` containing Team IDs, final integer scores, the winner ID, completed overtime-period count, the reproduction seed, and home/away Player-stat arrays. Team and Rotation inputs are not mutated.

The accepted team-level model remains authoritative for final scores and winners. The box-score layer only allocates those completed outcomes; it cannot regenerate or modify them.

### Scoring model

The accepted v0.1 calibration uses a neutral Team strength of `70` and a neutral expected score of `72` points per Team. Each point of offense above or below `70` changes that Team's expected score by `0.65` points. Each point of opposing defense above or below `70` changes it in the opposite direction by `0.45` points.

At the default home site, home court is worth `3` expected margin points. The model applies half to each side so it changes the expected margin without changing the matchup's expected combined score:

```text
Expected home score = 72
    + (home OFF − 70) × 0.65
    − (away DEF − 70) × 0.45
    + 1.5

Expected away score = 72
    + (away OFF − 70) × 0.65
    − (home DEF − 70) × 0.45
    − 1.5
```

Team overall is not used in either equation.

At a neutral site, both `+1.5` and `−1.5` terms become zero. Every other expected-score, variance, score-bound, overtime, and box-score rule remains unchanged. Neutral designation therefore changes no tuning constant other than whether the existing home-court modifier is applied.

### Regulation variance and score bounds

Seeded uniform RNG values are converted to standard-normal values with the Box–Muller transform:

```text
Z = sqrt(−2 × ln(max(U₁, Number.EPSILON))) × cos(2πU₂)
```

One shared game-environment draw with standard deviation `4` is added to both Teams. Each Team also receives an independent draw with standard deviation `8`:

```text
Shared environment ~ Normal(0, 4)
Home variation    ~ Normal(0, 8)
Away variation    ~ Normal(0, 8)

Raw home score = Expected home score + Shared environment + Home variation
Raw away score = Expected away score + Shared environment + Away variation
```

Each raw regulation score is rounded to the nearest integer and clamped to the inclusive `35–130` safety range. The shared draw allows games to be broadly high- or low-scoring, while the independent draws create uncertainty in the result and margin.

### Overtime

If regulation is tied, each overtime period scales the original expected regulation scores by `5 / 40`, adds a fresh shared normal draw with standard deviation `1.5`, and adds fresh independent Team draws with standard deviation `3`:

```text
OT shared variation ~ Normal(0, 1.5)
OT Team variation   ~ Normal(0, 3)

Home OT points = max(0, round(Expected home score × 5/40
    + OT shared variation + Home OT variation))

Away OT points = max(0, round(Expected away score × 5/40
    + OT shared variation + Away OT variation))
```

Overtime points are added to the existing score, `overtimePeriods` is incremented, and another overtime is simulated whenever the cumulative score remains tied. The explicit safety limit is `10` overtime periods. If the score is still tied after that pathological case, one point is awarded to the Team with the higher expected score; an exact expected-score tie favors the home Team. This fallback does not consume a coin flip and guarantees termination.

### Accepted v0.1 constants

| Constant | Value |
| --- | ---: |
| Baseline regulation score | 72 |
| Reference Team strength | 70 |
| Points per offensive rating point | 0.65 |
| Points suppressed per defensive rating point | 0.45 |
| Home-court expected margin | 3 |
| Shared regulation standard deviation | 4 |
| Independent Team regulation standard deviation | 8 |
| Minimum regulation score | 35 |
| Maximum regulation score | 130 |
| Overtime length scale | 5 / 40 |
| Shared overtime standard deviation | 1.5 |
| Independent Team overtime standard deviation | 3 |
| Maximum simulated overtime periods | 10 |

These values are now the accepted and documented v0.1 baseline. They remain centralized in the simulation module so later balance work can change them deliberately. The model is intentionally simple; a possession-based model may be introduced later if it provides clear value, but it is not a current commitment.

## Implemented Player Box Scores V0

Each `GameResult` contains `homePlayerStats` and `awayPlayerStats`. Each array follows Team roster order and contains one row for every rostered Player, including explicit all-zero rows for zero-minute Players.

`PlayerGameStats` contains:

- `playerId`, `minutes`, and `points`
- `rebounds`, `assists`, `steals`, `blocks`, and `turnovers`
- `fieldGoalsMade` and `fieldGoalsAttempted`
- `threePointersMade` and `threePointersAttempted`
- `freeThrowsMade` and `freeThrowsAttempted`

### Minutes

Regulation minutes come directly from the valid Rotation and total exactly `200` per Team. Each overtime adds the milestone-defined `5` Team player-minutes. Those minutes are assigned deterministically, one each to the five active Players ranked by regulation minutes, Player offense, and stable Player ID. No live substitution or fatigue model is implied.

```text
Team box-score minutes = 200 + (5 × overtimePeriods)
```

### Points and shooting

The completed Team score is allocated one point at a time among active Players using seeded weighted selection. Define normalized rating and clamping helpers as:

```text
N(rating) = (rating − 40) / 59
clamp(value, low, high) = min(high, max(low, value))
```

For each active Player, a scoring rating and opportunity weight are calculated once per game:

```text
Scoring rating = Player OFF × 0.45
               + shooting × 0.30
               + finishing × 0.25

Ability multiplier = exp((Scoring rating − 70) / 25)
Performance multiplier = exp(Z × 0.30), where Z ~ Normal(0, 1)

Scoring opportunity weight = minutes
                           × Ability multiplier
                           × Performance multiplier
```

Each point in the authoritative Team score is then assigned through a weighted categorical draw over active Players. This makes the sum exact by construction. Zero-minute Players have zero opportunity.

After Player points are fixed, each total is decomposed into two-point field goals, three-point field goals, and made free throws. Shooting and position influence three-point involvement; finishing and athleticism influence two-point and free-throw involvement. Attribute-informed efficiency estimates then generate missed attempts without changing points.

Target three-point and free-throw shares are:

```text
Target 3-point share = clamp(
    0.14 + N(shooting) × 0.28 + position adjustment,
    0.04,
    0.48
)

Target FT share = clamp(
    0.10 + N(finishing) × 0.10 + N(athleticism) × 0.04,
    0.08,
    0.25
)
```

| Position | 3-point share adjustment |
| --- | ---: |
| PG | +0.04 |
| SG | +0.06 |
| SF | +0.02 |
| PF | −0.04 |
| C | −0.10 |

The target number of points from threes receives `Normal(0, 2)` variation, and the target made-free-throw count receives `Normal(0, 1.5)` variation. The implementation enumerates every non-negative integer combination of `2PM`, `3PM`, and `FTM` that reconstructs the allocated Player points, then chooses the combination minimizing:

```text
abs(3 × 3PM − target 3-point points) / 3
    + abs(FTM − target FT points) / 2
```

Missed attempts use attribute-informed efficiency values:

```text
2P% = clamp(
    0.40 + N(finishing) × 0.19 + N(athleticism) × 0.04
         + Z × 0.025,
    0.35,
    0.68
)

3P% = clamp(
    0.26 + N(shooting) × 0.18 + Z × 0.02,
    0.22,
    0.48
)

FT skill = (shooting + ballHandling) / 2

FT% = clamp(
    0.58 + N(FT skill) × 0.25 + Z × 0.025,
    0.50,
    0.92
)
```

With `Poisson(λ)` denoting the existing seeded integer count sampler, misses are:

```text
2P misses ~ Poisson(
    2PM × (1 − 2P%) / 2P% + (minutes / 40) × 0.35
)

3P misses ~ Poisson(
    3PM × (1 − 3P%) / 3P%
        + (minutes / 40) × 0.30 × (0.50 + N(shooting))
)

FT misses ~ Poisson(FTM × (1 − FT%) / FT%)

FGM = 2PM + 3PM
FGA = FGM + 2P misses + 3P misses
3PA = 3PM + 3P misses
FTA = FTM + FT misses
```

Every row enforces:

```text
FGM ≤ FGA
3PM ≤ 3PA
3PM ≤ FGM
3PA ≤ FGA
FTM ≤ FTA

points = 2 × (FGM − 3PM) + 3 × 3PM + FTM
```

### Other statistics

Rebounds, assists, steals, blocks, and turnovers are independent seeded Poisson counts. Define the shared two-attribute factor as:

```text
R(primary, secondary, a, b) = clamp(
    1 + (primary − 70) × a + (secondary − 70) × b,
    0.35,
    1.75
)

minute scale = minutes / 40
```

The position baselines are per 40 minutes:

| Position | REB | AST | STL | BLK | TO |
| --- | ---: | ---: | ---: | ---: | ---: |
| PG | 4.00 | 6.00 | 1.25 | 0.15 | 2.50 |
| SG | 4.80 | 3.00 | 1.15 | 0.25 | 1.80 |
| SF | 6.20 | 2.70 | 1.00 | 0.55 | 1.60 |
| PF | 8.00 | 1.60 | 0.75 | 1.05 | 1.40 |
| C | 9.50 | 1.30 | 0.55 | 1.55 | 1.50 |

Expected values are:

```text
REB λ = position REB × minute scale
      × R(rebounding, athleticism, 0.012, 0.003)

AST λ = position AST × minute scale
      × R(playmaking, ballHandling, 0.013, 0.004)

STL λ = position STL × minute scale
      × R(perimeterDefense, athleticism, 0.010, 0.004)

Height factor = clamp(1 + (height − 78) × 0.04, 0.65, 1.40)

BLK λ = position BLK × minute scale × Height factor
      × R(interiorDefense, athleticism, 0.012, 0.003)
```

Turnovers also respond to scoring involvement:

```text
Minute share = minutes / 200
Scoring share = points / max(1, Team score)

Involvement factor = clamp(
    0.75 + 0.25 × Scoring share / max(Minute share, 0.01),
    0.65,
    1.40
)

Turnover skill factor = clamp(
    1 + (70 − ballHandling) × 0.010
      + (playmaking − 70) × 0.003,
    0.55,
    1.55
)

TO λ = position TO × minute scale
     × Involvement factor × Turnover skill factor
```

Each statistic is sampled as `Poisson(λ)`. These are game-level allocations, not events linked to opponent possessions.

### Determinism, ordering, and scope

Box-score generation continues from the same explicit seeded RNG after the final Team outcome has been resolved. Home Player stats are allocated first, then away Player stats. Full-roster rows remain in Team roster order; weighted selection also iterates active Players in roster order. Identical complete inputs and seed therefore produce deeply equal `GameResult` values.

The final Team scores, winner, and overtime count are determined before either box score is generated. Box-score RNG consumption cannot change them. This is a game-level statistical allocation model, not possession-by-possession simulation. Assists are not reconciled to made field goals, defensive events are not reconciled to opponent outcomes, and rebounds are not linked to missed shots. Cross-team consistency diagnostics are a future consideration.

The constants and formulas above are the accepted Player Box Scores V0 baseline. They remain centralized in the simulation module for deliberate future tuning.

### Implemented invariants

- The same inputs and seed produce deeply equal results.
- No simulation code calls `Math.random()`.
- Each game terminates and has one winner after overtime.
- Scores are non-negative integers.
- Player points sum exactly to the authoritative Team score.
- Team minutes total exactly `200 + (5 × overtimePeriods)`.
- Every shooting line satisfies its make/attempt and point-reconstruction equations.
- Every statistic is a non-negative integer.
- Zero-minute Players receive explicit all-zero rows.
- Inputs are not mutated.
- Inputs and results survive a JSON serialize/parse round trip.

Deterministic inspection across `10,000` Team box scores observed zero failures for point reconciliation, minute reconciliation, zero-minute behavior, and integer/shooting arithmetic across `120,000` Player rows. These are validation observations, not tuning targets.

Unit tests lock down deterministic behavior, accepted outcome regression values, box-score reconciliation, attribute effects, overtime allocation, rotation rejection, serialization, and non-mutation. Deterministic inspection commands report broad outcome and Player-stat distributions over many seeds. Statistical assertions use generous bounds so they detect structural errors rather than harmless tuning changes.
