# MVP Scope

## Product MVP

The product MVP should support one complete dynasty-season loop:

- Select one of 32 fictional programs across four conferences.
- Review a roster and set a legal rotation.
- Simulate believable games and inspect final scores and box scores.
- Progress through a season and national tournament.
- Recruit and develop players.
- Advance into the next season with persistent, serializable state.

## Completed MVP foundation

The project currently includes:

- A React, TypeScript, and Vite application shell
- A framework-independent `src/engine` boundary
- A Zustand application store that orchestrates deterministic demo matchups through the public engine API
- Vitest and Testing Library configuration
- Source-of-truth design and architecture documentation
- Lint, type-check, test, and production-build commands
- Deterministic seeded RNG utilities
- A serializable Player model with position-weighted derived overall ratings
- Deterministic generation of individual fictional players
- A serializable Team model with deterministic 12-player roster generation
- A serializable Rotation model with validation and deterministic default allocation
- Derived positional player OFF/DEF and rotation-weighted Team Strength ratings
- Deterministic game outcomes with final scores, winners, and overtime
- Complete full-roster Player box scores with minutes, points, shooting, rebounds, assists, steals, blocks, and turnovers
- Browser Game Presentation V0 with home/away selection, generated rosters, Rotation and Team Strength presentation, final-score and overtime presentation, both Teams' box scores, deterministic re-simulation, and matchup reset
- Rotation Management V0 with exact home-Team minute editing, engine-authoritative validation, visible position and Team budgets, default/current Team Strength comparison, reset to default, simulation gating, and simulation using the edited legal Rotation
- Stable Fictional Basketball Universe V0 with 32 permanent Programs, four Conferences, validated identity/branding metadata, and order-independent deterministic Team/Rotation initialization
- Schedule Generation V0 with 24 complete abstract rounds, 384 canonical games, reciprocal Conference play, distinct non-Conference opponents, exact home/away balance, structured validation, and deterministic input-order-independent generation
- Season State and Progression V0 with initialized Team/Rotation state for all Programs, immutable Schedule structure, strict full-GameResult storage, persistent legal Rotation updates, partial-round support, derived progression and records, structured validation, and JSON-safe pure operations
- AI Round Simulation and Standings V0 with independent per-game seeds, current-Rotation game execution, pending-round simulation and exclusions, complete 384-game Season execution, and derived Conference standings

The accepted outcome model uses derived offense and defense, a small home advantage, and seeded game-level variance. The box-score layer preserves that outcome and allocates internally consistent Player statistics beneath it.

The repository now contains a permanent fictional basketball world rather than only temporary development Teams. `ProgramDefinition` holds stable identity and configuration; each initialized `Team` is the current basketball state for that Program. Given a master dynasty seed, Universe V0 reproducibly generates every opening roster and legal default Rotation with an isolated RNG stream per Program, so Program ordering cannot change another Program's roster.

The browser now supports the first meaningful coaching decision. HOME is temporarily the coached Team in the exhibition workflow; AWAY uses its generated default Rotation. A custom home Rotation persists through Simulate Again and the return to pregame, and resets when the coached home program changes.

The completed infrastructure now supports:

```text
stable fictional Universe
→ legal 24-round regular-season Schedule
→ current Season basketball state
→ completed GameResults
→ derived records and current round
→ autonomous regular-season simulation
→ derived Conference standings
```

Season State stores the facts needed for progression without duplicating mutable records, round counters, completion flags, or standings. The regular-season domain can now deterministically complete all 24 rounds and derive Conference tables.

## Season Presentation V0 — implemented

The application layer lets one controlled Program use its current Season Team and Rotation, play or simulate its scheduled game, resolve the remaining AI games in the round, and inspect updated Season context — program selection, a Season Hub with record/round/next-game/standings/schedule, game prep, and postgame. `controlledProgramId` and a deterministic session seed live in application state, never in `SeasonState`.

## Next major acceptance target

> A user can play through the 24-round regular season from the browser using one controlled program while all other scheduled games resolve through the existing AI simulation pipeline.

This acceptance target is met. The project does not yet contain a postseason/national tournament, recruiting, offseason player development, Dynasty persistence, substitutions, fatigue simulation, multi-position eligibility, or possession simulation. The six-program exhibition UI remains available as a secondary sandbox behind a mode toggle.
