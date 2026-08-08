# Simulation Specification

This document defines constraints for the next milestone; no simulator exists yet.

## Goal

Given two valid teams, their rotations, simulation configuration, and a seed, pure TypeScript logic returns a complete `GameResult` with a believable final score and box score.

## Planned inputs

- Two teams with unique IDs and valid player rosters
- One legal rotation per team
- Explicit simulation configuration
- A deterministic seed or seeded RNG state

## v0.1 rotation constraint

Each natural position owns exactly 40 minutes, producing 200 regulation player-minutes per team. Missing player IDs in a Rotation mean zero minutes. Players cannot consume minutes at another position. This is an intentionally temporary simplification until flexible positional eligibility is explicitly designed.

## v0.1 derived strength

The simulator will receive derived player offense and defense ratings rather than stored mutable ratings. Formulas preserve full numeric precision and remain intentionally tunable.

Player offense weights:

| Position | Finishing | Shooting | Playmaking | Ball handling | Athleticism | Rebounding |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| PG | 10% | 25% | 27% | 25% | 10% | 3% |
| SG | 23% | 33% | 10% | 18% | 12% | 4% |
| SF | 24% | 24% | 14% | 14% | 16% | 8% |
| PF | 36% | 20% | 6% | 6% | 20% | 12% |
| C | 48% | 8% | 4% | 4% | 21% | 15% |

Player defense weights:

| Position | Perimeter defense | Interior defense | Rebounding | Athleticism |
| --- | ---: | ---: | ---: | ---: |
| PG | 60% | 3% | 5% | 32% |
| SG | 55% | 5% | 10% | 30% |
| SF | 34% | 23% | 20% | 23% |
| PF | 12% | 40% | 28% | 20% |
| C | 5% | 47% | 30% | 18% |

Potential and class year never affect current OFF/DEF. Stamina is not weighted again: it already contributes modestly to overall and can therefore influence default minutes, while fatigue remains deferred.

Team offense and defense weight each active player's derived rating by `assigned minutes / 200`. Zero-minute players contribute nothing, and invalid rotations are rejected rather than normalized. Team overall is the balanced average of team offense and defense; it is a diagnostic convenience rather than a third independent formula. No strength values are stored on Player or Team.

## Planned output

`GameResult` should contain team identities, final score, player statistics, team totals, and enough metadata to reproduce or debug the run. All output must be serializable.

Initial `PlayerGameStats` should stay small and support score reconstruction. Exact fields and simulation granularity will be decided during the simulation milestone, before implementation.

## Simulation approach

Start with a simple possession-based model:

1. Estimate pace and a finite number of possessions.
2. Select lineups and allocate involvement from the rotation.
3. Resolve possession outcomes using relevant offense, defense, stamina, and seeded randomness.
4. Aggregate player events into team totals.
5. Resolve ties with overtime possessions.

This is a direction, not a commitment to detailed play-by-play, coaching AI, injuries, fouls, substitutions, or advanced tactics in the first version.

## Required invariants

- The same inputs and seed produce deeply equal results.
- No simulation code calls `Math.random()`.
- Each game terminates and has one winner after overtime.
- Scores are non-negative integers.
- Player scoring totals equal team scoring totals.
- Player minutes approximately reconcile with regulation and overtime team-minute totals, within an explicitly documented rounding tolerance.
- Players outside the rotation receive no minutes unless a later rule explicitly allows it.
- Inputs are not mutated.
- Inputs and results survive a JSON serialize/parse round trip.

## Testing and tuning

Unit tests should lock down deterministic RNG sequences, rating derivation, outcome aggregation, overtime, and all invariants above. Statistical tests may check broad ranges over many seeds, but should use generous bounds so they detect structural errors rather than harmless tuning changes. Balance constants belong in named configuration, not scattered magic numbers.
