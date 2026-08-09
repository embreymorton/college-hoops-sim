# Known Issues and Optimizations

This is a concise engineering memory for accepted, non-blocking follow-ups. It is not a second roadmap and does not change the next milestone. Remove or mark an item resolved when the relevant work lands.

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

### P2 — Preserve completed-season Player history before multi-season play

The active Season currently retains each full `GameResult`, including all Player box scores. Before replacing it during a future offseason transition, preserve completed-season Player history through a deliberate Season snapshot or derived archive. Do not build that archive now.

### P2 — Keep returning Player IDs stable

Before progression or offseason work, ensure every returning Player keeps the same `playerId` across seasons so career statistics, progression, awards, and historical GameResults remain attributable.

### P3 — Allow future Super Sim interruption points

Super Sim can run straight to a target because no current event requires a decision between games. If injuries, availability changes, Player decisions, or recruiting decisions are later introduced, bulk progression should be able to stop, resolve the required decision, and optionally continue. Do not implement interruption now.

### P3 — Retain Exhibition as development tooling

Exhibition remains useful for isolated simulation, Rotation, and presentation testing. Keep useful shared tooling, but do not let it compete with the permanent Season flow as primary product navigation.

### P3 — Rotation depth / universal games-played watchpoint

Player Season Stats inspection observed a Season in which all 12 Charlotte Tech Players recorded positive minutes in all 24 games. The stats layer is behaving correctly: positive minutes count as a game played, while zero minutes produce a DNP without incrementing `gamesPlayed`.

The future balance question is whether accepted Rotation V0 eventually needs tighter seven-to-ten-Player regular rotations, occasional deep-bench DNPs, or more situational participation. Do not tune Rotation generation now. Revisit only if universal bench participation makes roster management less meaningful, Player season production less believable, or future development decisions less interesting. This is a low-priority design watchpoint, not an implementation defect or MVP blocker.

### P3 — Protected conference-champion top-four seeds may need revisiting after universe expansion

Postseason V0 intentionally guarantees every regular-season Conference champion a protected seed in the top four. This works cleanly for the current 32 Programs, four Conferences, 16-Team field, and four protected Conference champions, and it intentionally makes Conference titles highly valuable.

If the universe later adds substantially more Programs or Conferences, expands the tournament field, introduces Conference tournaments, or develops materially different Conference strengths, automatic qualification and top-seed protection should be reconsidered separately. Future options could include automatic bids without top-four protection, champion seed floors, selection/seeding ratings, or Conference-tournament automatic bids. Do not change V0 behavior now; this is a scaling/design watchpoint, not a bug or MVP blocker.

### P3 — First-round conference rematch avoidance

Postseason V0 intentionally permits same-Conference Round-of-16 matchups under its accepted fixed-seed bracket. The first accepted Postseason inspection produced multiple such Conference rematches; this is valid bracket behavior, not a correctness bug.

Because Conference opponents already play a regular-season double round robin, repeated first-round matchups may eventually make tournament draws feel less fresh. A future improvement could preserve seed lines and bracket fairness while avoiding same-Conference Round-of-16 matchups where possible. Any such system must remain deterministic, avoid materially distorting seed value, terminate reliably, and never depend on an uncontrolled random retry loop. Do not implement this now; revisit after gameplay experience or universe expansion. This is a presentation/game-design quality watchpoint, not an MVP blocker.

### P3 — UI stylesheet growth

The primary application stylesheet has grown substantially as the Season UI has expanded. This is not currently a functional or performance problem, and architectural cleanliness alone does not justify a CSS refactor before Postseason Presentation.

If tournament and bracket styles make the main stylesheet difficult to navigate or create accidental cross-feature coupling, consider a small feature-level boundary such as `src/styles.css` plus `src/postseason.css`, or another minimal organization consistent with the project. Do not introduce CSS Modules, Tailwind, CSS-in-JS, or another styling framework without a separate reason. This is a maintainability watchpoint, not an MVP blocker.

### P3 — Application session store growth

The current Zustand Season/application store has grown while coordinating the controlled Program, `SeasonState`, presentation navigation, Quick Sim, Super Sim, and historical-result viewing. Postseason Presentation will add orchestration for the active `PostseasonState` alongside the completed regular season.

Do not refactor or rename the store preemptively. If tournament integration makes it difficult to reason about, consider extracting small Postseason-specific orchestration helpers while preserving one clear application/session state boundary. Do not move basketball rules into Zustand, duplicate Postseason-derived state, or introduce a large generalized state framework. A future Dynasty root state is the more appropriate time to reconsider top-level store naming and organization. This is a maintainability watchpoint, not an MVP blocker.

## Accepted non-issues

- A high correlation between initial Team Strength and average wins across many seasons is expected because averaging removes game-level variance. Do not tune the simulator solely for that observation; revisit only if individual seasons become too deterministic.
- Full-season and Super Sim performance is acceptable at the current 32-Program / 384-game scale. Do not add concurrency, caching, or mutable summary state without profiling evidence.

### Current tournament upset rates are not automatically a tuning problem

The current 16-Team tournament selects the top half of a 32-Program universe. The quality gap between its #1 and #16 seeds is naturally much smaller than the gap between real-world NCAA #1 and #16 seeds selected from hundreds of Division I programs, so lower-seed upset rates may be meaningfully higher than historical March Madness rates.

Do not retune Game Simulation solely because V0 seed upset percentages differ from real NCAA history. Revisit only if repeated gameplay shows that seed value feels meaningless, strong Teams lack a meaningful advantage, or tournament outcomes feel excessively random. The accepted championship seed-band diagnostic currently shows that higher seeds retain strong overall tournament value; deeper seeds still winning occasionally is intentional upset potential, not automatically a defect.
