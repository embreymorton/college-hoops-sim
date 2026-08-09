# Simulation Specification

This document records the implemented Team Strength, Single-Game Simulation V0, Player Box Scores V0, Player Season Stats V0, Postseason Simulation V0, and Player Development V0 constraints.

## Status and pipeline

Implemented:

```text
Player/Team generation → Rotation → Player OFF/DEF → Team OFF/DEF/overall
    → seeded team-level outcome → Player box-score allocation
```

The completed single-game pipeline remains a game-level model. Possessions, play-by-play, substitutions, and fatigue remain separate future work.

Single-Game Simulation, Player Box Scores V0, Game Presentation V0, Rotation Management V0, Stable Fictional Basketball Universe V0, Schedule Generation V0, Season State and Progression V0, Season Presentation V0, Season UX Polish V0, Super Sim V0, Player/Team Season Stats, League exploration, Postseason Domain / Simulation and presentation, and Dynasty Foundation + Progression V0 are complete. Universe initialization only supplies deterministic Teams and legal default Rotations to this accepted pipeline; Schedule Generation and Dynasty progression do not alter game scoring, variance, overtime, or box-score formulas. Completed Season and Postseason `GameResult` facts are cloned into Dynasty history before active competition is cleared.

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

## Implemented Player Development V0

Player Development is a pure Dynasty-layer operation over one returning Player. It changes Player attributes and advances class while reusing the existing position-aware `calculateOverall()` function; OVR is never stored or incremented directly. Potential remains fixed.

The development class is the class just completed:

| Completed class | Next class | Seeded target OVR-gain range |
| --- | --- | ---: |
| FR | SO | 2–5 |
| SO | JR | 1–4 |
| JR | SR | 0–3 |

The target is selected as an inclusive deterministic integer, then constrained by pre-development headroom:

```text
current OVR = calculateOverall(Player before development)
target OVR = min(POT, current OVR + seeded class-range draw)
```

These target ranges are mechanics, not guaranteed gains. Attribute caps, positional OVR weights, and the Potential ceiling govern how allocation reaches the target. A Player with `current OVR >= POT` receives no attribute changes, though a non-senior still advances class. Seniors graduate before development and are rejected by `developReturningPlayer()`.

Attribute gains are allocated one point at a time. Every attribute remains eligible while below 99, but position changes its relative selection weight:

| Position | FIN | SHO | PLY | HND | PER D | INT D | REB | ATH | STA |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PG | 2 | 5 | 6 | 6 | 4 | 1 | 1 | 3 | 2 |
| SG | 5 | 6 | 2 | 4 | 5 | 1 | 1 | 3 | 2 |
| SF | 4 | 4 | 3 | 3 | 4 | 3 | 3 | 4 | 2 |
| PF | 6 | 2 | 1 | 1 | 2 | 5 | 6 | 5 | 3 |
| C | 5 | 1 | 1 | 1 | 1 | 7 | 7 | 5 | 3 |

For each allocation draw, each eligible base weight receives independent Player-RNG variation from `0.75×` inclusive to below `1.25×`. A weighted draw selects the attribute. The implementation tentatively adds one point and accepts it only when the existing derived OVR remains at or below POT. Allocation stops when the target OVR or POT is reached, the opportunity is exhausted, or no attribute remains below 99. This creates intentionally uneven Player-specific profiles rather than uniform attribute boosts.

Development randomness uses an independent RNG created from a JSON seed namespace containing:

```text
namespace = college-hoops-sim:player-development:v0
typed numeric/string Dynasty seed
completed season number
Program ID
Player ID
```

There is no shared evolving offseason RNG. The same inputs reproduce the same Player; changing the Dynasty seed changes at least some development, while Program and Player processing order do not affect per-Player results. Development never calls `Math.random()`.

V0 development has no regression and no dependency on playing time, starts, rotation role, Player statistics, Team wins, Postseason success, controlled/AI ownership, Program prestige, conference, coaching, or facilities. All attributes remain within 40–99, Potential does not change, and derived OVR cannot exceed Potential. A Player may stagnate or graduate below Potential.

The accepted canonical 292-returner inspection observed:

| Transition | Count | Average ΔOVR | P50 | P95 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| FR → SO | 96 | +3.56 | +4 | +5 | +5 |
| SO → JR | 98 | +2.63 | +3 | +4 | +4 |
| JR → SR | 98 | +1.28 | +1 | +3 | +3 |

Overall stagnation was 30 of 292 returners, or 10.3%. The observed +5 maximum is not a separately imposed universal rule; it follows from the implemented target ranges and this population's constraints.

Pre-development Potential headroom also showed the intended relationship:

| Headroom | Count | Average ΔOVR | P50 | Maximum | Stagnated |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 0.00 | 0 | 0 | 0.0% |
| 1–2 | 30 | +0.97 | +1 | +2 | 33.3% |
| 3–5 | 64 | +1.88 | +2 | +4 | 18.8% |
| 6–9 | 113 | +2.65 | +3 | +5 | 7.1% |
| 10+ | 85 | +3.26 | +3 | +5 | 0.0% |

The empty zero-headroom bucket reflects this generated sample; direct invariant tests confirm a Player at POT cannot improve. These values are validation observations, not guaranteed distributions. The accepted behavior is that low headroom constrains growth, high headroom permits greater opportunity, and completed class remains independently meaningful.

Inspection found zero Potential violations, attributes above 99, regressions, changed returning IDs, or mutated archived Player snapshots. Same-seed, different-seed, Program-order, Player-order, and JSON-serialization checks all passed.

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

## Implemented Rotation constraint

Each natural position owns exactly 40 minutes, producing 200 regulation player-minutes per Team. Missing Player IDs in a Rotation mean zero minutes. Players cannot consume minutes at another position. This is an intentionally temporary simplification until flexible positional eligibility is explicitly designed.

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
