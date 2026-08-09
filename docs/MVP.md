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
- Season Presentation V0 with 32-Program selection, a permanent Season Hub, Game Prep, postgame, Conference standings, and the controlled Program's full Schedule/results
- Season UX Polish V0 with Dashboard Quick Sim, persistent committed Season Rotations, historical completed-game box-score viewing, and derived Recent Results
- Super Sim V0 with confirmed pacing checkpoints through Round 12 or Round 24 using the canonical Season simulation pipeline

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

Season State stores the facts needed for progression without duplicating mutable records, round counters, completion flags, standings, or Player aggregates. The regular-season domain can now deterministically complete all 24 rounds and derive Conference tables.

## Playable regular season — implemented

The application layer lets one controlled Program complete the full 24-round regular season at three pacing levels, all backed by the same canonical scheduled-game simulation and result-recording pipeline:

- Hands-on: **Manage Rotation → Simulate Game**.
- Normal: **Dashboard Quick Sim** uses the last committed legal current Season Rotation.
- Fast: **Super Sim** resolves pending games through Midseason (Round 12) or End of Regular Season (Round 24).

Legal Rotation changes persist in `SeasonState` and affect later games regardless of pacing path. Every completed result is final and retains its full Player box scores. The Hub derives records, current round, standings, Recent Results, and Schedule presentation from Season facts rather than maintaining duplicate UI truth.

## Next major acceptance target

> **Player Season Stats V0 — NEXT:** derive Player aggregates and game logs from `PlayerGameStats` in the complete `GameResult` values already recorded by the Season.

The next milestone must not add duplicate mutable Player-stat counters to `SeasonState`. It should expose the already-preserved minutes, PTS, REB, AST, STL, BLK, TO, FGM/FGA, 3PM/3PA, and FTM/FTA through derived season totals, averages, percentages, and game logs.

The project does not yet contain a postseason/national tournament, recruiting, offseason player development, Dynasty persistence, substitutions, fatigue simulation, multi-position eligibility, or possession simulation. Postseason remains future work after Player Season Stats V0. The six-program exhibition UI remains available as secondary development tooling.
