# Known Issues and Optimizations

This file tracks accepted bugs, technical debt, maintainability concerns, performance/scaling risks, and current-design watchpoints. It is not a roadmap or product-feature backlog. Unscheduled gameplay/presentation ideas belong in `FUTURE_FEATURES.md`; deliberately sequenced work belongs in `ROADMAP.md`. Remove or mark an item resolved when implementation addresses it.

## Open items

### P1 — Correct Super Sim completion-summary wording

The current summary derives “games simulated” from the controlled Program's record delta. If its target-round game was already complete but Super Sim resolves only remaining AI games, the UI can misleadingly show `0 games simulated` and a `0-0` segment.

Derive and distinguish:

- total newly resolved ScheduledGames; and
- controlled-Program games resolved in the segment.

Omit the `0-0` segment line when no controlled game was resolved. Do not add mutable counters to `SeasonState`; compare before/after results and newly completed ScheduledGame IDs.

### P2 — Harden stale Super Sim requests

The UI hides Midseason after Round 12 and all Super Sim actions after regular-season completion. The store request path should also reject or safely no-op stale/programmatic requests. Keep the Season bulk operation's target-round validation.

### P3 — Profile result-map insertion only if scale requires it

`recordGameResult()` copies and deterministically orders `resultsByGameId`. This is acceptable for Universe V0's 32 Programs and 384 regular-season games. Optimize only if profiling finds a real bottleneck at larger scale, while preserving immutable operations, deterministic serialization, JSON safety, and stable ScheduledGame-ID lookup.

### P3 — Allow future Super Sim interruption points

Super Sim can run straight to a target because no current event requires a decision between games. Accepted Recruiting V0 remains compatible by resolving every missing Recruiting period canonically in order from the saved plan, without mandatory input every round; Recruiting itself is not a reason to force interruption.

If later injuries, availability changes, Player decisions, or explicitly designed mandatory recruiting events require attention between games, bulk progression should be able to stop, resolve the required decision, and optionally continue. Do not implement interruption now.

### P3 — Retain Exhibition as development tooling

Exhibition remains useful for isolated simulation, Rotation, and presentation testing. Keep useful shared tooling, but do not let it compete with the permanent Season flow as primary product navigation.

### P3 — Rotation depth / universal games-played watchpoint

Player Season Stats inspection observed a Season in which all 12 Charlotte Tech Players recorded positive minutes in all 24 games. The stats layer is behaving correctly: positive minutes count as a game played, while zero minutes produce a DNP without incrementing `gamesPlayed`.

The future balance question is whether accepted Rotation V0 eventually needs tighter seven-to-ten-Player regular rotations, occasional deep-bench DNPs, or more situational participation. Do not tune Rotation generation now. Revisit only if universal bench participation makes roster management less meaningful, Player season production less believable, or future development decisions less interesting. This is a low-priority design watchpoint, not an implementation defect or MVP blocker.

### P3 — Concentrated single-attribute offseason gains

Aggregate Player Development V0 calibration is accepted. Its intentionally uneven, position-aware allocation can occasionally produce large gains in one skill; the canonical single-offseason inspection included examples such as `INT D +8` and `ATH +7` while overall development, Potential limits, and class curves remained healthy.

This is a non-blocking micro-level calibration watchpoint, not a bug or a reason to smooth Player-specific profiles prematurely. Dynasty Long-Run Calibration V0 validated League-wide OVR equilibrium and class progression, but it did not deeply evaluate the basketball flavor of individual attribute shapes. Revisit only with attribute-level population evidence; do not conflate it with the now-resolved talent-inflation question.

### P3 — Strict positional Recruiting capacity may become restrictive

Recruiting V0 intentionally replaces projected departures by exact natural position. Long-run calibration found stable positional populations, zero unfilled openings, and no premium Recruit stranded while compatible capacity remained, so the current model is structurally healthy.

Revisit only if future generic scholarships, multi-position Players, position changes, cuts, walk-ons, transfers, or early departures loosen the roster model. Any change must update roster construction, offer capacity, and Rotation legality together rather than weakening only Recruiting validation.

### P3 — Dynasty history and serialized-state growth

Accepted long-run calibration measured the full-snapshot serialized `DynastyState` at `30.57 MB` after Season 10, `76.20 MB` after Season 25, and `152.27 MB` after Season 50. Growth is approximately linear at roughly 3 MB per completed Season and is material even though 50-Season JSON serialization remained correct.

Before production-scale save support or very long playable Dynasties, evaluate save-file size, browser persistence limits, load/parse time, memory use, and history-rendering cost. Preserve canonical historical `GameResult`, Player, Team, and Recruiting facts. Do not prematurely prescribe a database, compression format, pruning policy, binary serialization, IndexedDB, backend persistence, or stat-reconstruction model. This is a measured scaling watchpoint, not a current correctness defect.

### P3 — Rotation Editor ordering and announcements

Player rows may reorder when ratings/minutes change, and dynamic Rotation validation could provide stronger live-region announcements. Both are accepted at the current scale. Revisit stable editing order or accessibility announcements only if user testing shows the current interaction is distracting or unclear.

### P3 — Cross-team box-score reconciliation

Player Box Scores V0 reconciles Player points, shooting arithmetic, and Team minutes, but assists, rebounds, and defensive events are not possession-linked to opponent events. This is an accepted game-level allocation model. Revisit only if future advanced statistics or possession-level features require stronger cross-team event consistency; do not add a second outcome model.

### P3 — Protected conference-champion top-four seeds may need revisiting after universe expansion

Postseason V0 intentionally guarantees every regular-season Conference champion a protected seed in the top four. This works cleanly for the current 32 Programs, four Conferences, 16-Team field, and four protected Conference champions, and it intentionally makes Conference titles highly valuable.

If the universe later adds substantially more Programs or Conferences, expands the tournament field, introduces Conference tournaments, or develops materially different Conference strengths, automatic qualification and top-seed protection should be reconsidered separately. Future options could include automatic bids without top-four protection, champion seed floors, selection/seeding ratings, or Conference-tournament automatic bids. Do not change V0 behavior now; this is a scaling/design watchpoint, not a bug or MVP blocker.

Optional Tournament-expansion ideas are listed separately in `FUTURE_FEATURES.md`.

### P3 — First-round conference rematch avoidance

Postseason V0 intentionally permits same-Conference Round-of-16 matchups under its accepted fixed-seed bracket. The first accepted Postseason inspection produced multiple such Conference rematches; this is valid bracket behavior, not a correctness bug.

Because Conference opponents already play a regular-season double round robin, repeated first-round matchups may eventually make tournament draws feel less fresh. A future improvement could preserve seed lines and bracket fairness while avoiding same-Conference Round-of-16 matchups where possible. Any such system must remain deterministic, avoid materially distorting seed value, terminate reliably, and never depend on an uncontrolled random retry loop. Do not implement this now; revisit after gameplay experience or universe expansion. This is a presentation/game-design quality watchpoint, not an MVP blocker.

Optional Tournament-depth ideas are listed separately in `FUTURE_FEATURES.md`; this entry remains here because it records a quality/scaling risk in the accepted fixed bracket.

### P3 — Application session store growth

The current Zustand application/session store orchestrates canonical `DynastyState` plus controlled-Program session presentation: regular-season and Tournament Rotation drafts, viewed-result IDs, navigation, Quick Sim, Super Sim, round progression, and lifecycle handoffs. It remains manageable at the current scale, but serialized Dynasty/history state grows materially across many Seasons as documented above.

Do not refactor merely for cleanliness. Preserve one clear application/session boundary, keep basketball, Tournament, and Recruiting rules in their domain layers, and avoid duplicate derived state or a generalized state framework. This is a maintainability watchpoint, not an MVP blocker.

### P3 — Render-time navigation side effects

Some regular-season and Postseason screens defensively handle stale or invalid presentation state by invoking Zustand navigation actions during React render. This appears to be fallback behavior rather than a normal product path, but state updates during render can become problematic under Strict Mode or more complex navigation.

Do not refactor this during Postseason polish. Future cleanup should prevent invalid views at the action/store boundary and/or use effect-based redirects. Revisit if React warnings, Strict Mode behavior, or Dynasty navigation complexity make the pattern observable. This is not an MVP blocker.

## Resolved / monitor-only

### P2 — Long-run talent equilibrium / initial OVR inflation — RESOLVED

Dynasty Long-Run Calibration V0 completed 250 Seasons across five deterministic seeds. Average Team OVR stabilized at `81.25` over Seasons 16–50 with a mean slope of `+0.003` per Season; individual seed slopes ranged from `−0.016` to `+0.012`. The earlier Season 1 → 2 increase was part of the initial generated-roster transition, not persistent inflation. Incoming and graduating populations had nearly identical average Potential, while accepted Development bridged their OVR difference.

Recruit generation, Recruiting calibration, Player Development, roster rollover, and their combined V0 talent economy are frozen. Reopen only with new evidence or a future talent-flow system such as transfers, early departures, eligibility changes, dynamic prestige, roster/position flexibility, or staff/Development modifiers.

### P2 — Recruit enrollment and exact next-season rosters — RESOLVED

Phase 5C.1 now assembles each next-season roster solely from accepted Offseason returners and that Program's finalized commitments. It preserves stable person identity, excludes graduates and unsigned Recruits, enrolls commitments as freshmen, validates every Player and Program relationship, and requires exactly 12 Players rather than repairing invalid inputs.

### P2 — Repeatable rollover, Schedule identity, and next Recruiting cycle — RESOLVED

Phase 5C.2 now performs an atomic pure rollover into a fresh Season, generates legal default Rotations, derives a deterministic season-specific Schedule and collision-free Game IDs, preserves histories and controlled Program identity, and immediately initializes Recruiting for the following target season. A five-season smoke found zero lifecycle, roster, Rotation, Recruiting, Player-identity, or cross-season Game-ID failures.

### P2 — Completed-season Player history preservation — RESOLVED

Phase 5A `CompletedSeasonArchive` now clones the complete valid `SeasonState` and `PostseasonState`, including canonical `GameResult` and `PlayerGameStats` facts, before active competition is cleared. Archived Player snapshots remain unchanged during offseason development. Historical UI, career projections, and save/load remain separate future work.

### P2 — Stable returning Player IDs — RESOLVED

Phase 5A development creates new immutable Player values while preserving returning Player IDs, names, height, position, and Potential. Class and attributes may change without mutating archived Player versions. Canonical inspection found zero changed returning IDs and passed Program/Player-order-independence checks.

### P3 — UI stylesheet boundary

Postseason Presentation established the anticipated feature-level boundary with `src/styles.css` plus `src/postseason.css`. This addresses the original stylesheet-growth concern at the current scale; monitor for real cross-feature coupling, but do not perform another CSS refactor merely for organization.

## Accepted non-issues

- A high correlation between initial Team Strength and average wins across many seasons is expected because averaging removes game-level variance. Do not tune the simulator solely for that observation; revisit only if individual seasons become too deterministic.
- Full-season and Super Sim performance is acceptable at the current 32-Program / 384-game scale. Do not add concurrency, caching, or mutable summary state without profiling evidence.

### Current tournament upset rates are not automatically a tuning problem

The current 16-Team tournament selects the top half of a 32-Program universe. The quality gap between its #1 and #16 seeds is naturally much smaller than the gap between real-world NCAA #1 and #16 seeds selected from hundreds of Division I programs, so lower-seed upset rates may be meaningfully higher than historical March Madness rates.

Do not retune Game Simulation solely because V0 seed upset percentages differ from real NCAA history. Revisit only if repeated gameplay shows that seed value feels meaningless, strong Teams lack a meaningful advantage, or tournament outcomes feel excessively random. The accepted championship seed-band diagnostic currently shows that higher seeds retain strong overall tournament value; deeper seeds still winning occasionally is intentional upset potential, not automatically a defect.
