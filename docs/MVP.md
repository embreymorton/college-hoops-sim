# MVP Scope

## Product MVP

The product MVP should support one complete dynasty-season loop:

- Select one of approximately 32 fictional teams across four conferences.
- Review a roster and set a legal rotation.
- Simulate believable games and inspect final scores and box scores.
- Progress through a season and national tournament.
- Recruit and develop players.
- Advance into the next season with persistent, serializable state.

## Completed: engine foundations and Team Strength

The project currently includes:

- A React, TypeScript, and Vite application shell
- A framework-independent `src/engine` boundary
- Zustand available for later application state, but no store yet
- Vitest and Testing Library configuration
- Source-of-truth design and architecture documentation
- Lint, type-check, test, and production-build commands
- Deterministic seeded RNG utilities
- A serializable Player model with position-weighted derived overall ratings
- Deterministic generation of individual fictional players
- A serializable Team model with deterministic 12-player roster generation
- A serializable Rotation model with validation and deterministic default allocation
- Derived positional player OFF/DEF and rotation-weighted Team Strength ratings

## Next active milestone: Single-Game Simulation

The next milestone must allow two generated teams with valid rotations to produce a deterministic, believable game outcome with a final score and internally consistent box score. The scoring model has not been designed or implemented yet.

The project does not yet contain actual game outcomes, final scores, box scores, possession simulation, schedules, standings, season progression, recruiting, offseason development, substitutions, fatigue simulation, multi-position eligibility, saves, or gameplay UI.
