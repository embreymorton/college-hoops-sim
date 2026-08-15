# Known Issues and Optimizations

This file tracks accepted bugs, technical debt, maintainability concerns, performance/scaling risks, and current-design watchpoints. It is not a roadmap or product-feature backlog. Unscheduled gameplay/presentation ideas belong in `FUTURE_FEATURES.md`; deliberately sequenced work belongs in `ROADMAP.md`. Remove or mark an item resolved when implementation addresses it.

A `PLAYTESTING.md` observation is not a known issue. Add it here only after
diagnostic or engineering evidence confirms a real unresolved defect, debt item,
measured scaling risk, or validated watchpoint. Follow
`DOCUMENTATION_POLICY.md` when status changes.

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

### P3 — Concentrated single-attribute offseason gains

The `INT D +8` and `ATH +7` examples came from the superseded Development V0
checkpoint and are historical, not confirmed descriptions of Development V1.
Development V1 still allocates attribute-level growth unevenly and may warrant a
future population-shape diagnostic only if new play exposes a problem.

This is a non-blocking micro-level calibration watchpoint, not a bug or a reason to smooth Player-specific profiles prematurely. Dynasty Long-Run Calibration V0 validated League-wide OVR equilibrium and class progression, but it did not deeply evaluate the basketball flavor of individual attribute shapes. Revisit only with attribute-level population evidence; do not conflate it with the now-resolved talent-inflation question.

### P3 — Strict positional Recruiting capacity may become restrictive

Recruiting intentionally replaces projected departures by exact natural
position. Rotation V1 floor flexibility does not change roster construction,
Recruiting openings, Offer capacity, or Player positional identity. Long-run
calibration found this structure healthy.

Revisit only if future generic scholarships, multi-position Players, position changes, cuts, walk-ons, transfers, or early departures loosen the roster model. Any change must update roster construction, offer capacity, and Rotation legality together rather than weakening only Recruiting validation.

### P3 — Dynasty history and serialized-state growth

Accepted long-run calibration measured the full-snapshot serialized `DynastyState` at `30.57 MB` after Season 10, `76.20 MB` after Season 25, and `152.27 MB` after Season 50. Growth is approximately linear at roughly 3 MB per completed Season and is material even though 50-Season JSON serialization remained correct.

Before production-scale save support or very long playable Dynasties, evaluate save-file size, browser persistence limits, load/parse time, memory use, and history-rendering cost. Preserve canonical historical `GameResult`, Player, Team, and Recruiting facts. Do not prematurely prescribe a database, compression format, pruning policy, binary serialization, IndexedDB, backend persistence, or stat-reconstruction model. This is a measured scaling watchpoint, not a current correctness defect.

### P3 — Active Dynasty persistence / browser navigation — FUTURE

Current active Dynasty state is session/in-memory limited. One browser-Back
incident lost unsaved progress, strengthening the future need to restore an
active Dynasty and validate navigation/reload behavior. This is not yet evidence
of an intended in-app navigation regression and is not an active blocker or a
reason to displace Phase 6E.10. Do not prescribe storage, save-slot, backend, or
routing architecture before that work is selected.

### P3 — Rotation Editor stable validation layout

Repeated play confirmed that the `Player total must remain within 0–40`
validation message dynamically changes row/table height and causes distracting
layout resizing. Preserve invalid-state feedback, but a future presentation fix
should keep row height stable and surface the reason in a fixed validation area
or summary. Validation logic itself is not at issue. Player reordering and
live-region announcements remain lower-priority watchpoints.

### P3 — Cross-team box-score reconciliation

Player Box Scores V0 reconciles Player points, shooting arithmetic, and Team minutes, but assists, rebounds, and defensive events are not possession-linked to opponent events. This is an accepted game-level allocation model. Revisit only if future advanced statistics or possession-level features require stronger cross-team event consistency; do not add a second outcome model.

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

### P3 — Recruit commitment News rank wording — RESOLVED

The standard five-star template previously placed overall national rank next to
position (`the No. 7 PG nationally`), which could read as a position rank.
Phase 7B.1 post-acceptance polish now says `the No. 7 overall recruit and a
five-star PG`; the distinct No. 1 treatment remains intact. Recruiting rank
facts and mechanics were always correct and remain unchanged.

### P2 — Exact-40-minute flexible defaults — RESOLVED / MANUALLY CONFIRMED

Phase 6E.9 found `301/10,297` active Rotation Players at exactly 40, all from
flexible natural `36→40` promotion. Phase 6E.9B reserved natural 36 for Team
top-three OVR Players and removed that automatic promotion; FULL `5 × 10`
acceptance found zero exact-40 defaults across `16,717` active Rotation Players.
Charlotte Tech/Northbridge manual play then found no default above 36, a
reasonable elite-core `36/29/29/29` distribution, and no universal 40-minute
League leaders. The watchpoint is closed/frozen. Secondary-path mix and rare
large incumbent displacement remain observational WATCH items.

### P2 — Tournament seed-label alignment — RESOLVED

Phase 6E.7 confirmed weak mature seed/OVR alignment while the actual-strength
win curve remained healthy. Phase 6E.7B preserved the exact selected field and
seeded all 16 Programs together through the existing results-only résumé
comparator. FULL `5 × 10` paired acceptance improved Season 5+ seed/OVR
correlation from `0.386` to `0.439`, mean rank error from `3.99` to `3.80`, and
top-four accuracy from `42.5%` to `49.2%`; résumé correlation rose to `0.927`.
Automatic bids still guarantee entry, Game Sim remains unchanged, and the new
seeding rule is frozen unless new evidence appears.

### P2 — Long-run talent equilibrium / initial OVR inflation — RESOLVED

Dynasty Long-Run Calibration V0 completed 250 Seasons across five deterministic seeds. Average Team OVR stabilized at `81.25` over Seasons 16–50 with a mean slope of `+0.003` per Season; individual seed slopes ranged from `−0.016` to `+0.012`. The earlier Season 1 → 2 increase was part of the initial generated-roster transition, not persistent inflation. Incoming and graduating populations had nearly identical average Potential, while accepted Development bridged their OVR difference.

The V0 equilibrium result is historical lifecycle evidence. Its talent and
Development behavior was superseded by Recruit Talent Distribution V1 and
Player Development V1, which are the current frozen production systems. Reopen
only with new evidence or a future talent-flow system.

### P2 — Recruit enrollment and exact next-season rosters — RESOLVED

Phase 5C.1 now assembles each next-season roster solely from accepted Offseason returners and that Program's finalized commitments. It preserves stable person identity, excludes graduates and unsigned Recruits, enrolls commitments as freshmen, validates every Player and Program relationship, and requires exactly 12 Players rather than repairing invalid inputs.

### P2 — Repeatable rollover, Schedule identity, and next Recruiting cycle — RESOLVED

Phase 5C.2 now performs an atomic pure rollover into a fresh Season, generates legal default Rotations, derives a deterministic season-specific Schedule and collision-free Game IDs, preserves histories and controlled Program identity, and immediately initializes Recruiting for the following target season. A five-season smoke found zero lifecycle, roster, Rotation, Recruiting, Player-identity, or cross-season Game-ID failures.

### P2 — Completed-season Player history preservation — RESOLVED

Phase 5A `CompletedSeasonArchive` now clones the complete valid `SeasonState` and `PostseasonState`, including canonical `GameResult` and `PlayerGameStats` facts, before active competition is cleared. Archived Player snapshots remain unchanged during offseason development. Historical UI, career projections, and save/load remain separate future work.

### P2 — Stable returning Player IDs — RESOLVED

Phase 5A development creates new immutable Player values while preserving returning Player IDs, names, height, position, and Potential. Class and attributes may change without mutating archived Player versions. Canonical inspection found zero changed returning IDs and passed Program/Player-order-independence checks.

### P3 — Recruiting page density and fragmented guidance — RESOLVED

Phase 6E.16A consolidated the Recruiting page: a local `.recruiting-screen`
wrapper tightened the top-of-page rhythm, `RecruitingOverview` replaced the
Positional Needs table with one compact Board/Signed/Openings/Offers/Needs
snapshot, the Board count no longer duplicates beside `Fill Remaining Board`,
and a new `Guide` mode became the one coherent explanation destination for
Board/Focus/Offers/Readiness/battle standing. Late Recruiting's zero-openings
state now reads as a completed class while retaining the required Finalize
action. Board/Battles/National architecture and all Recruiting mechanics are
unchanged. See `UI_DESIGN.md`.

### P3 — Season Hub and League information hierarchy — RESOLVED

Phase 6E.16B tightened Hub vertical rhythm, distinguished unresolved Focus
Targets from signed Commits, integrated the Recruiting Update recap inside the
Hub Recruiting module, replaced the Hub's Conference-switcher with the
controlled Program's own Conference standings (heading now names that
Conference) composed side by side with Recent Results on desktop, and removed
the root League screen's redundant Back button and duplicate `League` heading
while preserving Team/Player detail Back navigation. League → Teams remains
the only league-wide Conference destination; no duplicative Conference
Standings tab was added. See `UI_DESIGN.md`.

### P3 — Quick Sim game-card footprint and result hierarchy — RESOLVED

Phase 6E.16B (two manual-play passes) treats the pregame `NextGameCard` and
completed `CompletedMatchupCard` as stable states of one card: both share a
21rem desktop minimum-height floor sized to the compacted completed-game
content, and the completed-game scoreboard/Game Leaders are constrained to a
narrow ~21rem measure with a dense row-strip leader layout (deduping repeated
Program identity when every leader shares one Team). Verified by direct pixel
measurement that `Advance to Next Round`/`Super Sim` hold an identical
vertical position before and after Quick Sim at desktop width. No stored
results, statistics, or simulation behavior changed; no fixed pixel height is
imposed on narrow/mobile widths, which keep natural responsive growth. See
`UI_DESIGN.md`.

### P3 — UI stylesheet boundary

Postseason Presentation established the anticipated feature-level boundary with `src/styles.css` plus `src/postseason.css`. This addresses the original stylesheet-growth concern at the current scale; monitor for real cross-feature coupling, but do not perform another CSS refactor merely for organization.

### P3 — `SeasonApp.test.tsx` intermittent assertions — RESOLVED

The two recurring cases shared an uncontrolled-fixture cause rather than store
leakage or product behavior. `SeasonApp.test.tsx` exercised normal interactive
selection, which intentionally creates a unique UUID-backed Dynasty seed each
time. Under some valid generated boards, signing one focused Recruit filled the
position and correctly made another same-position target no longer active, so
the test's assumption that the Focus-row count must decrease by exactly one was
false. Under some valid game results, a top scorer's points equaled another stat
in his row (observed `14` and `35` matching minutes), so `getByText(points)` was
ambiguous.

The file now fixes its application-boundary UUID per test and restores the mock
afterward; the dedicated interactive-seed tests continue to cover unique real
Dynasty creation. The Focus test asserts the committed Recruit appears in
Commits and that exact identity is absent from unresolved Focus, without making
an invalid claim about other targets whose position can become filled. The box-
score test resolves the intended Player row and the semantic `Player`/`Pts`
columns before asserting exact values. Store reset already covered every
session field, RTL cleanup already unmounted after every test, and no timer or
async leak was found.

Before the fix, bounded isolated repetition reproduced Focus on run 9 and the
box-score ambiguity on run 4. Afterward both passed `10/10`; the complete
`SeasonApp.test.tsx` file passed `10/10`. No retries, sleeps, skips, timeout
changes, or production changes were introduced. This specific reliability
issue is resolved.

### P3 — Full-suite lifecycle-test timeout under worker contention — WATCH

Repeated default full-suite validation exposed a separate resource-contention
watchpoint: three lifecycle-heavy tests timed out near the default five-second
limit in one run, and `keeps manual and Super Sim basketball and Recruiting
outcomes identical` timed out again in a later run. Each passed alone
(`0.88–3.36s`) and the three affected files passed together (`31/31`); three
full runs with `--maxWorkers=4` also passed. No result mismatch or product bug
reproduced. Do not paper over this with retries or longer per-test timeouts;
profile or right-size suite concurrency in a separately scoped reliability
milestone if default-run contention continues.

The Tournament completion escape-path diagnostic produced another instance on
the default full-suite command: `keeps manual and Super Sim basketball and
Recruiting outcomes identical` in `src/store/dynastyStore.integration.test.ts`
timed out after taking `6.414s` against the five-second limit. The exact test
passed alone (`1.76s`), its full file passed `12/12`, and the subsequent default
full suite passed. The lifecycle change added assertions only after the
Super Sim work measured by this test and did not change production behavior;
this recurrence remains consistent with the existing worker-contention WATCH.

### P2 — Elite Recruit POT-gap compression — RESOLVED / FROZEN

A production-path sample of 250 deterministic Recruiting classes (`40,202`
Recruits) found zero POT gap for `70.1%` of 5★, `85.6%` of 80+ OVR, `90.9%`
of 85+ OVR, and `97.3%` of 90+ OVR Recruits. Median gap was zero for 5★ and
every 80+ cohort. This confirms that elite/high-OVR Recruit starting profiles
are structurally compressed against visible Potential, reducing development
runway. No negative gaps occurred. This is not evidence against Player
Development V1. Recruit Talent V1 remains unchanged pending a separately scoped
calibration-design milestone; do not tune generation directly from this note.

The calibration-design pass traced the mechanism to independent readiness and
raw ceiling: `82.5%` of raw ceilings are capped at 82, while readiness can
generate much higher current OVR. Candidate B's independently seeded bounded
runway passed all `22/22` precommitted gates across the paired 500-class sample
(`80,453` Recruits). It reduced zero gap from `70.54% → 21.68%` for 5★,
`86.07% → 30.94%` for 80+, and `91.75% → 32.75%` for 85+, while preserving
exact attributes/OVR and limiting overall POT mean movement to `+0.255`.
Production now invokes that exact canonical helper. A 500-class activation
audit matched the accepted experimental output exactly by Recruit ID for
attributes, OVR, final POT, national/position rank, and stars. Candidate B is
the production default; this issue is resolved and the calibrated behavior is
frozen unless new evidence appears.

## Accepted non-issues

- A high correlation between initial Team Strength and average wins across many seasons is expected because averaging removes game-level variance. Do not tune the simulator solely for that observation; revisit only if individual seasons become too deterministic.
- Full-season and Super Sim performance is acceptable at the current 32-Program / 384-game scale. Do not add concurrency, caching, or mutable summary state without profiling evidence.

### Current tournament upset rates are not automatically a tuning problem

The current 16-Team tournament selects the top half of a 32-Program universe. The quality gap between its #1 and #16 seeds is naturally much smaller than the gap between real-world NCAA #1 and #16 seeds selected from hundreds of Division I programs, so lower-seed upset rates may be meaningfully higher than historical March Madness rates.

Do not retune Game Simulation solely because V0 seed upset percentages differ from real NCAA history. Revisit only if repeated gameplay shows that seed value feels meaningless, strong Teams lack a meaningful advantage, or tournament outcomes feel excessively random. The accepted championship seed-band diagnostic currently shows that higher seeds retain strong overall tournament value; deeper seeds still winning occasionally is intentional upset potential, not automatically a defect.

Repeated manual play now justifies the planned diagnostic in `PLAYTESTING.md`:
measure seeding/ranking quality, actual OVR gaps, and matchup variance separately
before changing anything. This investigation does not itself establish a bug.
