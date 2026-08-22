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

### OPEN PLANNING CHECKPOINT — no NEXT selected

**Phase 8A — Dynamic Program Prestige V1 — REJECTED / ROLLED BACK / DEFERRED.**
Production uses static Prestige. The subsequent hierarchy/compression
investigation is decision-complete: mature compression is an accepted/deferred
limitation for the current scope, and no additional targeted work is
recommended. Historical evidence lives in the conditional-read
[Dynasty Hierarchy Research archive](DYNASTY_HIERARCHY_RESEARCH.md). No
successor milestone has been selected.

### Rotation Assistant V1 — COMPLETE / ACCEPTED / FROZEN

The Preserve & Fill domain operation, Simple Rotation draft integration, player
feedback, and automated coverage are accepted. It preserves edited MPG,
deterministically fills a legal reviewable draft, and leaves Apply as the sole
commit boundary. Apply and Discard clear transient locked state; impossible
constraints retain the draft and surface existing issue feedback without a
silent commit.

### PLANNED — remainder of Phase 7C

1. **7C.3 — Awards & Honors** — remains valid future work whose subjective
   formulas would require separate design and tuning; it is not NEXT.

### Future Phase 8 work

No 8B, 8C, or 8D milestone is defined or selected. The rejected Phase 8A does
not close Phase 7: Awards & Honors and other work that genuinely belongs to
Dynasty stories, attachment, memory, recognition, or history remains valid
unscheduled Phase 7 work.

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

### Next Season Position Outlook V1 — COMPLETE / ACCEPTED

- Recruit Details now shows the controlled Program's factual projected
  natural-position group, current-OVR rank, incoming commitments, and departing
  seniors without forecasting Development, Rotation roles, or playing time.
- The pure Recruiting read model adds no state or mechanics changes and leaves
  the Roadmap at an Open Planning Checkpoint.

### Program Legacy V1 — COMPLETE / ACCEPTED / FROZEN

- Team Details now gives every Program a compact Dynasty résumé and five-Season
  recent trail derived from completed regular-season and Tournament archives.
- Programs without a Tournament appearance receive an aggregate empty-state
  label while individual missed Seasons retain their canonical outcome.
- Added no mutable Program history, simulation behavior, or Prestige mechanics,
  and returned the Roadmap to an Open Planning Checkpoint.

### Offseason Storytelling V1 — COMPLETE / ACCEPTED

- Enriched the existing Offseason turnover report with canonical senior career
  context, top attribute-gain summaries, and one deterministic Biggest Leap
  spotlight without changing Development or rollover mechanics.
- Returned the Roadmap to an Open Planning Checkpoint with no successor selected.

### Recruiting Class Retrospectives V1 — COMPLETE / ACCEPTED / FROZEN

- Added League → History → Recruiting with newest-first finalized national
  signing classes, a controlled-Program filter, and a lean Recruit/Signed/
  Entered/Outcome table linked to active and Former Player Details.
- Derived signees and later outcomes from canonical Recruiting/roster history
  by stable Player ID without new persistence, duplicated history, simulation
  behavior, or exposed Recruiting internals.
- Returned the Roadmap to an Open Planning Checkpoint with no successor selected.

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
- **7C.2 Records & Milestones — COMPLETE / ACCEPTED / FROZEN:** added
  completed-regular-season Single Game, Season, and Career Top 10 records under
  the first-class League History tab, plus strict new Single Game record stories
  in active-Season News after completed history exists.
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
