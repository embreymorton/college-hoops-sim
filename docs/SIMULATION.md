# Simulation Specification

This document records the implemented Team Strength prerequisite and constraints for the next milestone. No game simulator exists yet.

## Status and pipeline

Implemented:

```text
Player/Team generation → Rotation → Player OFF/DEF → Team OFF/DEF/overall
```

Next:

```text
Team OFF/DEF + seeded game variance → GameResult
```

The second pipeline is a milestone boundary, not an implemented scoring formula.

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

## Next milestone: Single-Game Simulation

The next milestone should take two valid Teams, their Rotations, derived strengths, and an explicit seed and return a serializable `GameResult` with a believable final score and internally consistent Player and Team box scores.

Planned inputs:

- Two teams with unique IDs and valid player rosters
- One legal rotation per team
- A deterministic seed or seeded RNG state

Planned output:

`GameResult` should contain team identities, final score, player statistics, team totals, and enough metadata to reproduce or debug the run. All output must be serializable.

Initial `PlayerGameStats` should stay small and support score reconstruction. Exact fields and simulation granularity will be decided during the simulation milestone, before implementation.

The initial simulator should use the simplest deterministic game-level model that produces believable, testable outcomes. A possession-based model may be introduced later if it provides clear value; it is not a current commitment. No scoring, pace, variance, overtime, or box-score allocation formula has been selected yet.

### Required future invariants

- The same inputs and seed produce deeply equal results.
- No simulation code calls `Math.random()`.
- Each game terminates and has one winner after overtime.
- Scores are non-negative integers.
- Player scoring totals equal team scoring totals.
- Player minutes approximately reconcile with regulation and overtime team-minute totals, within an explicitly documented rounding tolerance.
- Players outside the rotation receive no minutes unless a later rule explicitly allows it.
- Inputs are not mutated.
- Inputs and results survive a JSON serialize/parse round trip.

### Future testing and tuning

Unit tests should lock down deterministic RNG sequences, rating derivation, outcome aggregation, overtime, and all invariants above. Statistical tests may check broad ranges over many seeds, but should use generous bounds so they detect structural errors rather than harmless tuning changes. Balance constants belong in named configuration, not scattered magic numbers.
