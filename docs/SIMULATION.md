# Simulation Specification

This document records the implemented Team Strength, Single-Game Simulation V0, and Player Box Scores V0 constraints.

## Status and pipeline

Implemented:

```text
Player/Team generation → Rotation → Player OFF/DEF → Team OFF/DEF/overall
    → seeded team-level outcome → Player box-score allocation
```

The completed single-game pipeline remains a game-level model. Possessions, play-by-play, substitutions, and fatigue remain separate future work.

Single-Game Simulation, Player Box Scores V0, Game Presentation V0, Rotation Management V0, and Stable Fictional Basketball Universe V0 are complete. Universe initialization only supplies deterministic Teams and legal default Rotations to this accepted pipeline; it changes no simulation rules or constants. Schedule Generation V0 is a separate structure-only layer and does not modify or invoke this simulation pipeline.

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

`simulateGame` takes two Teams, one valid Rotation per Team, and an explicit numeric or string seed. It returns a serializable `GameResult` containing Team IDs, final integer scores, the winner ID, completed overtime-period count, the reproduction seed, and home/away Player-stat arrays. Team and Rotation inputs are not mutated.

The accepted team-level model remains authoritative for final scores and winners. The box-score layer only allocates those completed outcomes; it cannot regenerate or modify them.

### Scoring model

The accepted v0.1 calibration uses a neutral Team strength of `70` and a neutral expected score of `72` points per Team. Each point of offense above or below `70` changes that Team's expected score by `0.65` points. Each point of opposing defense above or below `70` changes it in the opposite direction by `0.45` points.

Home court is worth `3` expected margin points. The model applies half to each side so it changes the expected margin without changing the matchup's expected combined score:

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
