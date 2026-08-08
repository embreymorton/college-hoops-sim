# Roadmap

Each milestone should remain small enough to test independently. Starting a later milestone or adding a new system requires an explicit scope discussion.

## 1. Foundation, domain, and generation — complete

- React, TypeScript, Vite, Zustand, and Vitest tooling
- Engine/UI dependency boundaries and source-of-truth documentation
- Serializable Player, Team, and Rotation domain models
- Position-aware derived Player overall
- Deterministic seeded RNG
- Fictional Player and 12-player Team generation
- Rotation validation and deterministic default rotations

## 2. Team Strength — complete

- Derived position-aware Player offense and defense
- Rotation-weighted Team offense and defense
- Derived Team overall
- Deterministic, pure calculations with zero influence from zero-minute players
- Constructed and large-sample validation of offensive and defensive identities

## 3. Single-Game Simulation — complete

- Define a minimal serializable team-level `GameResult`. — complete
- Simulate deterministic final scores, winners, home advantage, and overtime. — complete
- Define `PlayerGameStats` and allocate consistent Team and Player box scores. — complete
- Tune broad realism using deterministic statistical tests. — complete

Team outcomes, final scores, full-roster Player statistics, shooting arithmetic, minute reconciliation, and deterministic statistical inspection are implemented.

## 4. Game Presentation

- Connect the engine through an application-state adapter.
- Add a minimal matchup setup and box-score UI.
- Keep simulation behavior independent from React.

## 5. Season Framework

- Define the fictional league of approximately 32 teams in four conferences.
- Add schedules, standings, season progression, and a national tournament.

## 6. Dynasty Loop

- Add recruiting, player development, roster turnover, and offseason progression.
- Add save/load support and multi-season continuity.

## Deferred until explicitly scoped

- Multi-position eligibility
- Tighter or more realistic rotations
- Player roles and playing-time expectations
- Explicit Player or Team archetypes
- Advanced tactics and detailed play-by-play
- Injuries and transfers
- NIL and finances
- Coaching and staff systems
- Real-world teams or data
- Multiplayer
