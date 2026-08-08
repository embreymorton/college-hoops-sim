# Simulation Specification

This document defines constraints for the next milestone; no simulator exists yet.

## Goal

Given two valid teams, their rotations, simulation configuration, and a seed, pure TypeScript logic returns a complete `GameResult` with a believable final score and box score.

## Planned inputs

- Two teams with unique IDs and valid player rosters
- One legal rotation per team
- Explicit simulation configuration
- A deterministic seed or seeded RNG state

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

