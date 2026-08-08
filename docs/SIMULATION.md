# Simulation Specification

This document records the implemented Team Strength and team-level Single-Game Simulation V0 constraints.

## Status and pipeline

Implemented:

```text
Player/Team generation → Rotation → Player OFF/DEF → Team OFF/DEF/overall
    → seeded team-level game result
```

Next within the single-game milestone:

```text
GameResult → internally consistent Team and Player box scores
```

The team-level result is implemented. Box-score allocation and any finer simulation model remain separate future work.

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

`simulateGame` takes two Teams, one valid Rotation per Team, and an explicit numeric or string seed. It returns a minimal serializable `GameResult` containing Team IDs, final integer scores, the winner ID, completed overtime-period count, and the reproduction seed. Team and Rotation inputs are not mutated.

The initial game-level model deliberately stops at the final Team score. It does not simulate possessions, pace, shooting attempts, Player statistics, Team box-score totals, substitutions, or fatigue.

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

### Implemented invariants

- The same inputs and seed produce deeply equal results.
- No simulation code calls `Math.random()`.
- Each game terminates and has one winner after overtime.
- Scores are non-negative integers.
- Inputs are not mutated.
- Inputs and results survive a JSON serialize/parse round trip.

### Deferred box-score constraints

When Player and Team box scores are explicitly scoped, Player scoring must reconcile with Team scores, minutes must reconcile with regulation and overtime duration under a documented rounding rule, and Players outside the Rotation must receive no minutes unless a later rule allows it.

Unit tests lock down deterministic behavior, outcome invariants, strength effects, home-court direction, overtime resolution, rotation rejection, serialization, and non-mutation. The deterministic inspection command reports broad distributions over many seeds. Statistical assertions use generous bounds so they detect structural errors rather than harmless tuning changes.
