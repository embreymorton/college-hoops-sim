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
- Browser Game Presentation V0 with home/away selection, generated rosters, displayed default Rotation minutes and Team Strength, final-score and overtime presentation, both Teams' box scores, deterministic re-simulation, and matchup reset

The accepted outcome model uses derived offense and defense, a small home advantage, and seeded game-level variance. The box-score layer preserves that outcome and allocates internally consistent Player statistics beneath it.

## Current milestone: Rotation Management

> The user can modify a legal Team Rotation, receive immediate validation, see Team Strength update from those choices, and simulate a game using that custom Rotation.

The Rotation Editor is not implemented. The initial editor must preserve the existing natural-position, 40-minutes-per-position, 200-total-minute rules and defer legality and strength derivation to the engine.

## Next major acceptance target

After the first playable rotation-management loop is complete:

> Play through a multi-Team regular season in a stable fictional league while standings and AI results update correctly.

The project does not yet contain a stable league, conferences, schedules, standings, season progression, a national tournament, recruiting, offseason player development, dynasty persistence, substitutions, fatigue simulation, multi-position eligibility, or possession simulation. The current six deterministic demo programs are presentation fixtures, not the planned 32-Team league.
