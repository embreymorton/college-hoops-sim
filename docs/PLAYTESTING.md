# Playtesting

## Purpose and status vocabulary

This is the active empirical front door. It owns current playtesting priorities,
genuinely live WATCH signals, current gameplay evidence, and concise recent
acceptance evidence. `ROADMAP.md` alone owns **NEXT** and **PLANNED**.

Closed causal history lives in `PLAYTESTING_ARCHIVE.md`; parked Player Identity
experiments live in `PLAYER_IDENTITY_RESEARCH.md`; the decision-complete
hierarchy investigation lives in `DYNASTY_HIERARCHY_RESEARCH.md`. Those are
conditional reads, not fresh-session requirements.

Evidence follows:

```text
observation → evidence → question → investigation → decision
```

**OBSERVED** is unvalidated manual evidence; **INVESTIGATING** has earned a
diagnostic; **RESOLVED** is implemented and validated; **WATCH** is acceptable
but worth monitoring.

## Current Playtesting Priorities

The repository is at an **OPEN PLANNING CHECKPOINT — no NEXT selected**.

1. Continue normal multi-Season play and observe whether the accepted attachment
   loop—Recruit decisions, News, Following, Player careers, Alumni, Records,
   Yearbooks, and retrospectives—continues to create memorable stories.
2. Monitor only the unresolved signals in **Live WATCH Items** below; do not
   promote one into work without stronger evidence and explicit Roadmap
   selection.
3. Preserve frozen boundaries. Recruit Talent Profile V2, S0 career-stage/POT
   continuity, ordinary Development V1, Explosive Offseasons + Work Ethic V1,
   static Prestige, Rotation, Team Strength, and Game Simulation are not active
   calibration projects.

Awards & Honors is accepted/frozen; other optional ideas are not NEXT. This
priority list guides evidence gathering; it does not select a successor.

## Current Multi-Season Gameplay Evidence

A voluntary Pine Valley Dynasty lasting roughly 14 Seasons remains strong
qualitative evidence that the loop can sustain long-form engagement. The
low-Prestige rebuild stayed difficult, with modest results, low-seed Tournament
appearances, and short runs even after meaningful roster improvement. That is a
durable story, not proof that the rebuild curve is perfect or that static
Prestige is defective.

Attachment increasingly came from remembered decisions and consequences rather
than ratings alone. Recruiting choices, followed alternatives, later Player
Development, News, Records, and retrospectives made old decisions easy to revisit.
Next Season Position Outlook and Board Organization improved decision context;
Followed Recruit → Player continuity preserved interest after enrollment.

The accepted history and presentation layers are working together: News creates
discovery, Following enables retrieval, Player Details shows progression and
career production, Program History/Records add context, and Yearbooks preserve
completed Seasons. Continue observing this compound loop rather than treating
each surface as an isolated feature.

## Latest Accepted Milestone Evidence

### Awards & Honors V1 — ACCEPTED / FROZEN

Focused formula investigation and mature-Dynasty validation across Recruiting,
Development, rollover, and historical Player lifecycles supported the accepted
Candidate C production model and removal of the unnecessary Availability
Multiplier. Deterministic replay, iteration-order independence, archive
durability, live-projection-to-persistence equality, reveal timing, and News
deduplication were verified.

Functional and structural UI validation covered the Final Four announcement,
pending/resolved MOP, dedicated Awards navigation, Conference switching,
condensed Yearbooks, and active/former Player Career Honors. Desktop and 390px
responsive review, bounded visual polish, and final user review completed the
acceptance sequence. The seven previously outstanding Player Career History and
Recruiting failures were subsequently corrected as stale/ambiguous test
assumptions or fixtures, with no production-logic changes. Final validation is
fully green: focused corrective tests `84/84`, full suite `1328/1328`, ESLint,
typecheck, and `git diff --check` all passed. Awards opened no new WATCH item.

### Program Trajectory V1 — ACCEPTED / FROZEN

The user manually reviewed and accepted the full-history Program Trajectory on
Team Details for desktop and narrow presentation. The factual Season rows made
long-term Program movement legible while preserving the existing résumé,
Program Player Records, and restrained Team Details hierarchy. Acceptance covers
the distinction between unavailable incoming-class history and a genuine
zero-signee class. No subjective progress grade or change to Prestige,
Recruiting, Team Strength, competition, or Dynasty lifecycle behavior was
needed.

## Live WATCH Items

### Low-Prestige rebuild and structural progress

Pine Valley suggests that the long rebuild can be engaging, but continue
observing whether low-Prestige Programs can build satisfying arcs without making
static Prestige irrelevant. Program Trajectory now provides a better factual
cross-Season view of Team strength, results, and incoming classes, resolving the
immediate visibility gap; it does not prove that the underlying rebuild curve is
perfect. This WATCH remains live and does not reopen the decision-complete
hierarchy investigation by itself.

### Elite Recruit Offer coverage

Premium Recruits may occasionally lack an elite Offer deep into a cycle.
Observed scarcity can reflect positional capacity or alternative-target choice,
not necessarily AI failure. Reopen only with cohort evidence that compatible
elite Programs systematically leave viable premium targets uncovered.

### Concentrated ordinary Development gains

Rare official Explosive Offseasons intentionally create large position-aware
multi-attribute gains and are not defects by magnitude alone. Continue watching
only for implausible concentration in **ordinary** Development or incoherent
Player identity, and distinguish any evidence from the immutable event fact.

### Rotation secondary-path edge cases

Interior/forward-heavy eligibility and rare large incumbent displacement remain
worth observing. Legal manual 40-minute assignments are intentional; automatic
default workload realism and stable validation-row geometry are resolved.

### Recruiting exact-position friction

Exact-position vacancies can make desirable Recruits unavailable. Preserve this
player-facing friction as evidence for a future deliberately selected roster or
Recruiting design; Rotation flexibility does not silently change natural-
position scholarship capacity.

### Shot selection and single-game Steals upper tail

Shot mix remains simplified, and the long-run single-game Steals tail may be
compressed. A roughly 14-Season Record Book topped out at seven steals. That is
an evidence question, not yet a tuning problem; Player Identity and Game Sim
remain parked/frozen without a focused diagnostic.

### Persistence and historical-state growth

Save/load remains absent, active Dynasty state is session-limited, and full
snapshot history grows materially across Seasons. These are real future
product/engineering concerns, not current gameplay blockers or an implied NEXT.

### Test-infrastructure contention

Lifecycle-heavy tests can exceed the default five-second timeout during highly
contended full-suite runs while passing alone. Treat this as an infrastructure
WATCH unless a product mismatch reproduces; do not hide it with arbitrary
retries.

## Accepted Boundaries Relevant to Playtesting

- Work Ethic is hidden for Recruits, Unknown for freshmen, and stable/revealed
  after the first offseason. It informs ordinary Development only.
- An official Explosion is a separate rare annual event and is never inferred
  from a large gain. POT remains absolute.
- Recruit V2 and S0 continuity investigations are resolved and archived; no
  Recruit or S0 talent-profile calibration remains open.
- Static Prestige is production truth. Dynamic Prestige is rejected/rolled
  back, and mature compression is an accepted/deferred limitation.
- Exact Recruit ratings remain production visibility; scouting uncertainty is
  future-only.
- Current Player Identity and Game Simulation are good enough for continued
  feature planning and require new focused evidence to reopen.

## Evidence Maintenance

Keep this file live and concise. When an investigation closes, retain only the
current decision and move its causal/quantitative detail to
`PLAYTESTING_ARCHIVE.md` or the relevant research owner. Do not let resolved
milestones remain under Live WATCH, and do not use this document to infer NEXT.
