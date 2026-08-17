# Roadmap

`ROADMAP.md` is the single authority for milestone sequencing. It owns the
current **NEXT** marker, when one has been explicitly selected, and later
**PLANNED** work. A deliberate Open Planning Checkpoint may have no **NEXT**.
Completed milestones are
summarized here; implementation detail belongs in its owning production doc,
empirical evidence in `PLAYTESTING.md`, and parked research in conditional-read
archives.

Status meanings: **COMPLETE** = implemented, validated, and accepted;
**FROZEN** = reopen only with new evidence; **NEXT** = the immediate explicitly
selected milestone; **PLANNED** = valid future work that is not automatically
next; **OPEN PLANNING CHECKPOINT** = no successor is currently selected.

## Current Selected Horizon

### NEXT — Phase 7C.2 Records & Milestones V1

The completed-Season Dynasty Record Book is implemented and automated validation
is green. Manual player acceptance remains required before 7C.2 can become
COMPLETE / ACCEPTED / FROZEN.

### PLANNED — remainder of Phase 7C

1. **7C.3 — Awards & Honors** — sequenced after archive/records because
   subjective award formulas may require separate design and tuning.

### After Current Phase 7 Work — Fresh Planning Checkpoint

No later phase or Phase 7E is selected. After Phase 7C and Phase 7D are
accepted, review fresh manual-play evidence and choose what the game most needs
next. Do not automatically reopen Player Identity work or reserve a phase
number for it. Historical research remains available in
`PLAYER_IDENTITY_RESEARCH.md` and requires new gameplay evidence to reopen.

## Numbering and sequencing policy

- A number represents a meaningful player-facing feature, architectural
  capability, or major selected diagnostic—not every helper, UI pass, or test.
- Prefer 2–4 meaningful milestones per phase. Close a phase when new work no
  longer answers its product question.
- Unscheduled ideas belong in `FUTURE_FEATURES.md`; confirmed engineering debt
  belongs in `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`.
- Research uses descriptive labels rather than product-phase numbering unless
  the work is explicitly selected here.
- Formulas, helper names, sample tables, test counts, and acceptance chronology
  do not belong in completed Roadmap entries.

## Completed Phase Summary

### Phase 0 — Foundation — COMPLETE

- Established React, TypeScript, Vite, Zustand, Vitest, deterministic RNG, and
  framework-independent engine boundaries.
- Established serializable domain conventions and source-of-truth docs.

### Phase 1 — Basketball Engine V0 — COMPLETE / FROZEN

- Added deterministic Players, Teams, 12-Player rosters, derived ratings and
  Team Strength, Rotation validation/defaults, game simulation, overtime, and
  reconciled Player box scores.
- Exact current formulas and invariants live in `SIMULATION.md`.

### Phase 2 — First Playable Coaching Loop — COMPLETE

- Delivered Exhibition matchup selection, editable legal Rotations, displayed
  Team strength, deterministic simulation, and full postgame presentation.
- Established engine-authoritative validation and stable re-simulation.

### Phase 3 — League and Season Framework — COMPLETE

- Delivered the stable 32-Program/four-Conference Universe, deterministic
  24-round Schedule, canonical Season progression, AI round simulation,
  standings, Quick Sim, Super Sim, and regular-season presentation.
- Added regular-season Player/Team statistics, leaders, schedules/results,
  Team Details, Player Details, and cross-Program exploration.

### Phase 4 — Postseason V0 — COMPLETE / FROZEN

- Delivered automatic/at-large selection, accepted unified results-only résumé
  seeding, fixed bracket progression, neutral-site simulation, Tournament Hub,
  Quick Sim, Game Prep, completed box scores, and champion derivation.

### Phase 5 — Dynasty Loop Backend — COMPLETE / FROZEN

- Added canonical multi-season `DynastyState`, stable Player identity,
  Recruiting, commitments, Late Recruiting, immutable completed history,
  offseason turnover, Development, exact roster assembly, and atomic rollover.
- Validated repeatable multi-Season lifecycle and long-run economy boundaries.

### Phase 6 — Dynasty Application Loop — COMPLETE / FROZEN

- Made the complete Season → Tournament → Late Recruiting → Offseason → next
  Season loop playable in React/Zustand without duplicating canonical facts.
- Accepted Recruiting IA/readiness/battles, Season/Postseason presentation,
  Super Sim completion, Coaching home, Rotation V1 migration, Simple Rotation,
  and Starting Five/Bench/Reserves presentation.
- Detailed accepted UI patterns live in `UI_DESIGN.md`; causal evidence is
  indexed from `PLAYTESTING_ARCHIVE.md`.

### Phase 7A — Followed Players V1 — COMPLETE / ACCEPTED / FROZEN

- Added stable followed Player IDs, Follow/Unfollow behavior, safe lifecycle
  handling, and a League Following destination with no basketball effect.
- Historical retrieval of departed Players was not part of the original 7A
  milestone; Phase 7B.2 extended this stable-ID foundation.

### Phase 7B — Player & League Stories V1 — COMPLETE / ACCEPTED / FROZEN

- **7B.1 Around the Country / News:** deterministic current-Season stories,
  complete-checkpoint publication, Follow context, and accepted context polish.
- **7B.2 Player Legacy / Alumni:** stable-ID former-Player resolution,
  the Dynasty-aware `active | former | unknown` model, regular-season career
  aggregation, Historical Player Details, and retained Following intent.
- **7B.3 Season Preview:** Season 1 and rollover cast projections, Rounds 1–2
  Hub promotion, persistent active-Season League News access, and reusable
  Player/Program exploration.

Phase 7B added visibility/read models only: no parallel history, Preview/News
persistence, RNG, or simulation changes.

### Phase 7C — History & Recognition V1 — IN PROGRESS

- **7C.1 Season Archive / Yearbook — COMPLETE / ACCEPTED / FROZEN:** added a
  League-owned, completed-Seasons-only History destination with newest-first
  Yearbooks, a controlled-Team recap, selectable league standings/leaders, and
  the full archived Tournament bracket.
- **7C.2 Records & Milestones — IMPLEMENTED / PENDING MANUAL ACCEPTANCE:** adds
  completed-regular-season Single Game, Season, and Career Top 10 records under
  the first-class League History tab.
- **7C.3 Awards & Honors** remains PLANNED.

7C.1 and 7C.2 derive their presentation from `CompletedSeasonArchive` through
pure projections and transient/local UI state. They add no copied historical
summaries or records, canonical mutation, RNG, or simulation behavior.

### Phase 7D — Recruit Attachment V1 — COMPLETE / ACCEPTED / FROZEN

- **7D.1 Recruit Details — COMPLETE / ACCEPTED / FROZEN:** added stable-ID
  Recruit inspection from Board, Battles, and National Class with canonical
  profile and exact ratings, safe derived Recruiting context, contextual
  existing management actions, committed-state resolution, and parent-mode
  return behavior.
- **7D.2 Follow Recruits — COMPLETE / ACCEPTED / FROZEN:** added independent
  stable-ID Recruit follow intent, Follow/Unfollow from Recruit Details, and a
  first-followed Recruiting Following view with live safe status and resolved
  commitments.
- **7D.3 Recruit → Player Continuity — COMPLETE / ACCEPTED / FROZEN:** carries
  followed-person intent into existing Player Following only when canonical
  stable identity proves enrollment at rollover, then retires converted Recruit
  follow ownership.

## Historical Player Identity Research — COMPLETE / PARKED

Characterization separated profile generation, OVR valuation, and statistical
translation. Production Player generation and canonical `calculateOverall()`
remain unchanged. Profile Generation Experiment A V2 is experimental input
only; OVR Experiment B v1 was rejected. No Player Identity tuning phase is
selected. See `PLAYER_IDENTITY_RESEARCH.md` for evidence and reopening criteria.

## Deferred / unscheduled

Persistence/save-load, transfers, injuries, staff, rankings, deeper offseason
decisions, broader Alumni search, postseason/combined career aggregation, and
other unscheduled ideas remain outside this Roadmap until deliberately selected.
See `FUTURE_FEATURES.md`; inclusion there does not imply priority.
