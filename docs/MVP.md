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

The accepted outcome model uses derived offense and defense, a small home advantage, and seeded game-level variance. The box-score layer preserves that outcome and allocates internally consistent Player statistics beneath it.

The repository now contains a permanent fictional basketball world rather than only temporary development Teams. `ProgramDefinition` holds stable identity and configuration; each initialized `Team` is the current basketball state for that Program. Given a master dynasty seed, Universe V0 reproducibly generates every opening roster and legal default Rotation with an isolated RNG stream per Program, so Program ordering cannot change another Program's roster.

The browser now supports the first meaningful coaching decision. HOME is temporarily the coached Team in the exhibition workflow; AWAY uses its generated default Rotation. A custom home Rotation persists through Simulate Again and the return to pregame, and resets when the coached home program changes.

The completed pre-Season infrastructure supports:

```text
stable fictional Universe
→ legal 24-round regular-season Schedule
```

The active Season State layer now supplies the fact storage and pure derivations needed for that progression, while automatic game execution remains separate.

## Active milestone: Season State and Progression V0

The implementation under review can initialize serializable Season basketball state, persist legal Rotation changes, record complete GameResults by ScheduledGame ID in any order, and derive current round, completion, and Program/Conference records. It does not automatically simulate scheduled games or calculate standings.

## Next major acceptance target

> A Season object can advance through scheduled rounds while completed GameResults are recorded deterministically and current Program records can be derived from those results.

The project does not yet contain automatic AI round simulation, standings, a season interface, a national tournament, recruiting, offseason player development, dynasty persistence, substitutions, fatigue simulation, multi-position eligibility, or possession simulation. The current six-program exhibition UI remains unchanged.
