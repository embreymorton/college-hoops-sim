# Dedicated Offseason Experience V1 — Design and Architecture Contract

Status: **COMPLETE / ACCEPTED.**

This document records the accepted Hybrid Offseason Timeline contract and its
production boundaries. Existing lifecycle, Recruiting, Development, archive,
roster, and rollover behavior remains authoritative.

## Product outcome and V1 boundary

V1 makes the existing offseason feel like a coherent college-basketball phase:

```text
Tournament complete
→ Late Recruiting
→ Recruiting Class
→ Departures
→ Development
→ Roster Review
→ Ready for Season
```

The player receives a dedicated offseason identity, Season N → N+1 context, a
visible timeline, one active stage, safe read-only review of completed stages,
and one obvious progression action. This is a hybrid: progression remains
guided, while completed information and safe Dynasty exploration remain
available.

V1 includes:

- a dedicated Offseason shell beginning at Late Recruiting;
- the six player-facing stages above, with `Ready for Season` as the final
  action state rather than a separate content-heavy screen;
- a presentation-focused Late Recruiting market;
- completed-stage revisit semantics;
- safe League, History, Team, Player, Recruit, and completed-Tournament
  exploration;
- existing canonical progression commands; and
- responsive behavior at approximately 390px.

V1 does not include Transfers, professional or early-entry departures, position
changes, coaching/staff changes, new Development or Recruiting mechanics,
class grades/rankings, Awards, new roster-capacity rules, persistence, or new
simulation systems. Incoming Class is not a separate click-through stage: it is
featured inside Roster Review, where the player can understand signees in the
context of the complete next roster.

## Current production lifecycle

The current lifecycle is:

1. The regular Season and Tournament finish. Recruiting may be at the genuine
   regular-season Period 24 boundary or synchronized through postseason Period
   28.
2. `deriveDynastyProgressionAction(dynasty)` returns
   `enter-late-recruiting` only from canonical completed-Tournament and eligible
   Recruiting facts.
3. Zustand's idempotent `enterLateRecruiting()` command synchronizes any missing
   postseason Recruiting periods and calls `prepareLateRecruiting()`. That pure
   operation prepares existing offers/market facts and changes
   `RecruitingState.phase` to `late`. It does not begin Offseason.
4. `finalizeRecruitingClass()` calls `autoFinalizeRecruiting()`. It
   deterministically fills all remaining positional openings, changes the phase
   to `finalized`, and appends one immutable `CompletedRecruitingClass` snapshot.
   The active Season and Tournament still exist; `offseason` is still null.
5. `beginDynastyOffseason()` calls `beginOffseason()`. This validates the
   completed Season/Tournament, appends the `CompletedSeasonArchive`, derives
   every Program's non-senior returning roster, applies deterministic
   Development and class advancement to all returners, clears `activeSeason`
   and `activePostseason`, and creates `OffseasonState`.
6. During this state, graduating seniors remain available in the immutable
   completed archive but are absent from temporary returning rosters. Finalized
   Recruits remain in Recruiting history and have not yet been enrolled into a
   canonical active Team. `assembleNextSeasonRosters()` is a pure projection
   that combines developed returners, the finalized class, and archive facts;
   the current Offseason UI already uses it to preview the exact next roster.
7. `beginNextSeason()` calls `rolloverDynastyToNextSeason()`. This atomically
   validates and assembles every 12-Player roster, creates the next Season's
   Teams, generates fresh default Rotations and a new deterministic schedule,
   clears `offseason`, and initializes Recruiting for Season N+2. The store then
   performs existing stable-ID Recruit-follow transfer and resets session UI.

### Mutation, archive, roster, and RNG timing

`beginOffseason()` is atomic for archive creation, senior exclusion, and all
returning-player Development. It is not atomic for Recruit enrollment or next
Season creation. Those occur only at `rolloverDynastyToNextSeason()`.

The completed Season archive is finalized at `beginOffseason()`, after the
Recruiting class has already been finalized. Development is calculated and
stored in `OffseasonState.returningPlayers` at that same boundary. Recruits
become canonical active-roster Players, Teams/default Rotations are regenerated,
the schedule is generated, and the new Recruiting cycle is created only during
rollover. Team Strength remains derived from the resulting Team and Rotation.

All randomness remains behind existing deterministic seeded namespaces. Screen
render, timeline navigation, stage revisit, and roster preview consume no RNG.
The new experience must never call Development, Recruiting finalization,
roster assembly as a mutation, or rollover from render/effect code.

## Recommended V1 architecture: presentation staging

Use **Approach A — presentation staging**.

The canonical operations already retain everything needed for an honest staged
reveal: pre-Development Players and seniors in the completed archive,
post-Development returners in `OffseasonState`, finalized signees in
`CompletedRecruitingClass`, and the exact pure roster assembly. Splitting those
mutations would reopen frozen lifecycle, Development, archive, and roster
contracts without adding V1 player choice. Presentation staging preserves
determinism, identity, validation, and long-run behavior.

The timeline is only partly derivable from `DynastyState` alone:

- canonical facts fully determine the lifecycle region, available commands,
  stage data, and which stages can possibly exist;
- they determine Late Recruiting while `phase === 'late'`, Recruiting Class
  while `phase === 'finalized' && offseason === null`, and the availability of
  all turnover results while `offseason !== null`; but
- after `beginOffseason()`, canonical state intentionally applies Departures and
  Development together. It cannot say whether the player has already viewed
  Departures or advanced the presentation reveal to Development.

Therefore use a small transient **presentation cursor**, not a second lifecycle
truth. Suggested shape:

```ts
type OffseasonPresentationStage =
  | 'departures'
  | 'development'
  | 'roster-review'
  | 'ready-for-season'
```

Zustand may own this cursor as session/UI state. It must never authorize domain
mutation, be persisted as canonical Dynasty state, or claim that Departures or
Development have not happened. Reset/normalize it whenever the canonical
offseason identity (`completedSeasonNumber` and `targetSeasonNumber`) changes.

Add one pure projection, following existing naming conventions, conceptually:

```text
deriveOffseasonExperience(dynasty, presentationCursor)
→ season transition identity
→ ordered stages with active/completed/upcoming status
→ active-stage read model
→ safe revisitable stages
→ canonical progression action
```

The projection clamps stale or impossible cursor values against canonical
facts. React renders it. Zustand dispatches existing commands. Do not broaden
`deriveDynastyProgressionAction()` into an intra-offseason wizard: it should
remain the authority for the cross-phase Tournament → Late Recruiting recovery.
The offseason projection composes with it and may translate the existing action
to the player-facing label `Begin Offseason`; it must not duplicate its
eligibility logic.

## Stage contract

| Stage | Canonical source | Active behavior | Completed revisit |
| --- | --- | --- | --- |
| Late Recruiting | active `RecruitingState.phase === 'late'` | Existing Board/Focus/Offer/details and Finalize command | Read-only summary only after finalization; never reopen management |
| Recruiting Class | finalized active Recruiting plus matching completed class | Deliberate class review; existing Begin Offseason command | Read-only finalized class |
| Departures | completed archive plus `OffseasonState` | Graduating-senior farewell context | Read-only |
| Development | archived pre-values plus offseason returners | Previous/new OVR, delta, top canonical attribute gains, Biggest Leap | Read-only; never rerun Development |
| Roster Review | pure roster assembly plus finalized class | Returning core, incoming freshmen, position groups, size, derived roster OVR | Read-only |
| Ready for Season | valid Offseason facts and exact roster assembly | Existing `beginNextSeason()` command | Not revisitable after rollover in V1 |

Future stages are visible but disabled. Completed stages use check marks and are
clickable only when their canonical facts remain available. Selecting one
changes the viewed presentation, not the active lifecycle checkpoint. The
primary CTA always reflects the furthest unlocked/current progression stage,
so reviewing an older stage cannot make an old action executable again.

`Recruiting Class` intentionally precedes `beginOffseason()`: its CTA performs
that existing canonical transition. `Departures`, `Development`, and `Roster
Review` advance only the transient presentation cursor. `Ready for Season`
alone exposes the existing rollover command.

## Late Recruiting presentation

When the completed Tournament makes the canonical progression resolver
available, player-facing copy may say `Begin Offseason`; dispatch still goes
through `enterLateRecruiting()`. That command remains route-independent and
retains Period 24 recovery, non-qualifier, champion, and already-advanced safety.
After it succeeds, route to the dedicated shell with Late Recruiting active.

Keep My Board and all existing Recruiting controls. For V1, add a presentation
filter/grouping over existing safe target status:

- **Available**: unsigned Recruits who can still participate in the market;
- **My Board**: the existing controlled Program targets, preserving management;
- **Committed / Unavailable**: collapsed or visually subordinated and strictly
  non-interactive where existing rules disallow action.

Necessary V1 work is the dedicated context, remaining-market emphasis, existing
needs/capacity facts, and clear finalization. Board provenance (`My Targets`
versus assistant-added), broad Board restructuring, and new filters are useful
follow-ups but are not required and must not expand this milestone.

## Shell, exploration, and navigation

Reuse the existing Program-accent header, section/card/table language, local
horizontal-scroll conventions, detail routes, and exploration history. Replace
the normal `Tournament / Coaching / Recruiting / League` primary strip while the
offseason experience is active with:

1. `OFFSEASON` identity and Season N → N+1 context;
2. the timeline;
3. active or reviewed stage content;
4. a persistent primary progression area; and
5. visually secondary exploration actions.

Recommended secondary destinations are `League`, `History`, and `Completed
Tournament`; existing Team/Player/Recruit details remain reachable from their
source content. Coaching is not a primary offseason destination because there
is no canonical active Team/Rotation between `beginOffseason()` and rollover.
Recruiting management is active only during Late Recruiting; finalized class
views are read-only.

Exploration routes push the originating offseason view onto the existing
exploration history and never clear or advance the presentation cursor. Back
returns to the same viewed stage. A route-independent offseason shell fallback
should remain visible on eligible detail/history routes, analogous to the
accepted Dynasty progression fallback, so exploration cannot hide the current
CTA. Navigation never executes progression.

## Responsive hierarchy

Desktop uses a single horizontal stage rail below the Offseason header, main
content beneath it, and a clear footer/sticky-within-content progression area.
At approximately 390px, keep the rail on one line with **local horizontal
scroll**, snap active stage into view, use compact label/check/status treatment,
and provide accessible button names. This matches existing local-overflow
patterns better than wrapping an ordered lifecycle into ambiguous rows.

The document/body must not overflow. Wide Recruiting, Development, and roster
tables scroll only inside their containers. The active stage heading and CTA
remain visible and full-width where appropriate; completed-stage buttons remain
large enough to use without competing visually with the active stage.

## Risk assessment

| Area | V1 impact and guardrail |
| --- | --- |
| Canonical state | No schema change. Read `DynastyState`, archives, Recruiting, and Offseason facts only. |
| Lifecycle | Reuse `enterLateRecruiting`, `finalizeRecruitingClass`, `beginDynastyOffseason`, and `beginNextSeason`; each canonical transition executes once. |
| Persistence | No new persistence. Presentation cursor is transient and normalized from canonical offseason identity. |
| RNG | No new RNG and no RNG from render/navigation/revisit. Existing deterministic operations remain unchanged. |
| Recruiting | Frozen mechanics are read-only dependencies; only context/grouping and command placement change. |
| Development | Frozen calculation is untouched; present stored pre/post facts after `beginOffseason()`. |
| Roster assembly | Frozen pure assembly is reused for preview and existing rollover validation; no parallel roster. |
| Season archive | Frozen archive construction and historical projections remain unchanged. |
| Navigation | Intentional extension: preserve offseason origin/cursor through exploration and provide a route-independent shell fallback. |
| Responsive UI | Moderate complexity: scrollable timeline plus several wide data sets require explicit containment tests. |

The only lasting architecture extension should be the pure offseason experience
read model and its explicitly transient presentation cursor. Accepted lifecycle,
Recruiting, Development, roster, Tournament, and archive systems remain
read-only dependencies.

## Eventual implementation test contract

### Projection and timeline

- Derive the correct lifecycle region, active/viewed stage, completed stages,
  locked stages, revisitable stages, and canonical action.
- Prove the projection is deterministic, pure, navigation-independent, and
  clamps stale presentation cursors.
- Prove reviewing a completed stage never changes the furthest unlocked stage
  or progression action.

### Late Recruiting and class finalization

- Recognize Late Recruiting as the first offseason experience stage without
  changing `RecruitingState.phase` semantics.
- Preserve Board, Focus, Offer, relationship, commitment, and capacity behavior.
- Cover champion and non-qualifier paths, genuine Period 24 recovery, already
  synchronized Period 28, navigation away/back, and repeated clicks.
- Keep committed/unavailable Recruits non-interactive and exclude unsigned
  surplus from the finalized class review.
- Preserve stable Recruit identities and finalized-class revisit.

### Departures, Development, and roster review

- Show exactly the archived graduating seniors and no returning Player as a
  departure.
- Match Development previous/current values and attribute gains to archive and
  `OffseasonState`; revisiting never mutates Players or consumes RNG.
- Match incoming Recruits to finalized commitments and the roster review to
  canonical `assembleNextSeasonRosters()` output, with exactly 12 unique Players
  per Program and no duplicate enrollment.

### Navigation and progression

- Preserve stage/cursor through League, History, Team, Player, Recruit, and
  completed-Tournament exploration, including app Back behavior.
- Keep the current lifecycle CTA available on eligible exploration routes.
- Prove render, route changes, Back, and completed-stage clicks never progress.
- Prove every canonical command executes at most once and repeated clicks cannot
  duplicate archives, classes, Development, rosters, or rollover.
- Preserve `deriveDynastyProgressionAction()` as the Tournament handoff
  authority and retain all existing transition regression tests.

### Responsive and regression

- At 390px, assert no body/document overflow, usable locally scrolling timeline,
  visible active heading/CTA, and contained large tables/lists.
- Preserve Tournament → Late Recruiting, Recruiting finalization,
  `beginOffseason()`, roster assembly, next-Season rollover, Recruit-follow
  continuity, deterministic simulation, archive/history, and Rotation tests.

## Future scalability

The ordered stage descriptor/read-model boundary can later add Transfer
Decisions, Draft Decisions, Transfer Portal, professional/early departures,
position changes, or staff steps without redesigning global navigation. Such a
stage may provide content and declare canonical availability, but any future
mechanic must introduce its own deliberately accepted domain command and facts;
the presentation cursor must never become a generic mutable lifecycle engine.
No future stage or order is selected by this contract.
