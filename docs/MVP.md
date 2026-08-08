# MVP Scope

## Product MVP

The product MVP should support one complete dynasty-season loop:

- Select one of approximately 32 fictional teams across four conferences.
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

The accepted outcome model uses derived offense and defense, a small home advantage, and seeded game-level variance. The box-score layer preserves that outcome and allocates internally consistent Player statistics beneath it.

The browser now supports the first meaningful coaching decision. HOME is temporarily the coached Team in the exhibition workflow; AWAY uses its generated default Rotation. A custom home Rotation persists through Simulate Again and the return to pregame, and resets when the coached home program changes.

## Next active phase: League and Season Framework

The immediate next milestone is a Stable Fictional Basketball Universe: approximately 32 stable fictional programs in four conferences, with deterministic identities, prestige, presentation metadata, and initial roster generation. Exact programs and conference assignments are not designed yet.

## Next major acceptance target

> A stable fictional league exists and the user can progress through a regular season while all Teams play games and standings update correctly.

The project does not yet contain a stable league, conferences, schedules, standings, season progression, a national tournament, recruiting, offseason player development, dynasty persistence, substitutions, fatigue simulation, multi-position eligibility, or possession simulation. The current six deterministic demo programs are presentation fixtures, not the planned 32-Team league.
