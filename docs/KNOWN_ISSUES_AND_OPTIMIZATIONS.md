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

## Accepted non-issues

- A high correlation between initial Team Strength and average wins across many seasons is expected because averaging removes game-level variance. Do not tune the simulator solely for that observation; revisit only if individual seasons become too deterministic.
- Full-season and Super Sim performance is acceptable at the current 32-Program / 384-game scale. Do not add concurrency, caching, or mutable summary state without profiling evidence.
