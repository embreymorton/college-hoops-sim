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

Roadmap is at an **OPEN PLANNING CHECKPOINT — no NEXT selected**. Super Duper
Sim V1 and Observer Mode V1 are accepted/frozen; this evidence file selects no
successor.

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

Roster Positional Flexibility and its Required/Flexible Roster Outlook clarity
are accepted/frozen. This priority list guides evidence gathering; it does not
select or define a successor.

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

### Program Reputation V1 — accepted diagnostic and manual evidence

A production-faithful, non-feedback diagnostic covered 12 deterministic
25-Season Dynasties, 32 Programs, 9,600 Program-season observations, and 384
observations per mature checkpoint. Season 25 observed `38.8% Low`, `33.6%
Regional`, `14.3% Emerging`, `12.0% National`, `1.0% National Power`, and
`0.3% Elite`; trends were `16.8% Rising`, `66.6% Steady`, and `16.6% Falling`.
These are validation observations, not quotas or future balancing targets.

The user manually simulated approximately ten Seasons and noticed many Programs
from Low through Emerging. A second simulation surfaced National Power Programs;
the user then explicitly kept the ranges unchanged and accepted V1. The bottom-
heavy impression is accepted context, not a current defect or recalibration
request; reopening the frozen ranges requires genuinely new evidence.

Only one production Program had Prestige below 40, and none of its 12 paths
reached Emerging Reputation. Reputation derivation recognizes earned success;
it does not create competitive success. Treat that result as context for the
existing low-Prestige rebuild / structural-progress WATCH, not evidence for
Prestige-relative or underdog bonuses and not permission to reopen static
Prestige.

## Latest Accepted Milestone Evidence

### Super Duper Sim V1 — ACCEPTED / FROZEN

The user explicitly accepted the final polished Observer multi-Season flow.
Manual browser coverage passed on desktop and approximately 390px layouts with
clean console output. It covered the Observer-only entry point, 1/5/10 presets,
locked foreground progress, restrained completion summary, local table
scrolling, and corrected narrow preset/modal overflow. Coach Mode and its
existing Super Sim remained unchanged.

Functional evidence verified exact rollover horizons from preseason and
mid-Season checkpoints, canonical regular season → Recruiting → Tournament →
Late Recruiting → Offseason → rollover behavior, stable seeds and Universe,
archive/Awards/Development/departure/roster continuity, Followed Recruit →
Player transfer at intermediate rollovers, Viewed Program independence,
per-rollover commits, and failure without a false summary. Sixteen focused new
tests and a 204-test Observer/Coach regression selection passed. The bounded
full suite passed `144` files / `1,478` tests with `--maxWorkers=4`; ESLint,
TypeScript, production build, and diff hygiene passed. The build retained only
the existing large-chunk warning.

The production-path smoke measurements were:

| Requested rollovers | Resulting Season | Elapsed | Serialized Dynasty |
| ---: | ---: | ---: | ---: |
| 1 | 2 | 1.77s | 3.51 MB |
| 5 | 6 | 8.59s | 16.26 MB |
| 10 | 11 | 17.14s | 32.23 MB |

These timings are evidence for the accepted foreground V1, not performance
budgets. Two lifecycle-heavy tests also timed out only under highly parallel
full-suite contention and passed in isolation; that remains the existing
test-infrastructure WATCH, not a Super Duper Sim product defect.

### Observer Mode V1 — ACCEPTED / FROZEN

The user completed manual playtesting and explicitly accepted Observer Mode V1.
They specifically valued using it to monitor and investigate AI behavior across
Programs without influencing the simulation through a user-controlled Program;
this is acceptance evidence, not a new feature requirement.
Browser coverage exercised the read-only Viewed Program selector and contextual
Recruiting, Tournament, Offseason, Recruiting History, and next-Season flow on
desktop and approximately 390px layouts. It verified all-AI progression,
observer-safe direct Late Recruiting finalization, Program-name perspective,
local table scrolling, and no body-level horizontal overflow. A narrow Recruiting
History overflow defect found during review was fixed and revalidated.

Coach Mode regression review preserved management authority, “Your Program”
context, and its Recruiting finalization confirmation. Automated closure passed
140 test files / 1,461 tests, including focused Observer, Recruiting History,
transition, Recruiting, and Season UI coverage. TypeScript, ESLint, production
build, and diff hygiene passed; a quick multi-Season Dynasty simulation remained
stable with deterministic/lifecycle checks green. The accepted V1 adds no new
simulation mechanics and leaves its larger excluded extensions unscheduled.

### Program Reputation V1 — ACCEPTED / FROZEN

Acceptance covered 70 focused implementation tests and a full serial regression
of 139 files / 1,440 tests, plus ESLint, TypeScript, production build, diff
hygiene, and the production-backed diagnostic. Frontend polish passed 69 focused
Team Details/Reputation UI tests, desktop and 390×844 browser checks, and no body
overflow at 390px; Established and Unestablished states were verified. Unrelated
parallel-suite timeout sensitivity remains the existing infrastructure WATCH.

Pressure cases behaved as intended: rocket growth reached `Emerging → National
→ Elite`; extreme dominance reached `National Power → Elite`; Cinderella
validation and a traditional contender reached National Power; and established
Elite decline moved `Elite → Elite → National → Regional`. Sustained `22–2`,
first-place, Round-of-16 eras can establish National Power while Elite remains
scarce and tied to sustained top-end results.

### Recruiting Market Visibility V1 — ACCEPTED / FROZEN

The user manually reviewed and accepted Preseason Evaluation / Market Forming,
the first-period national-market reveal, National Class Market + Offers,
Recruit Details national-market presentation, and the restrained Recruiting
Pulse. Focused polish established understated Forming and market-tier
treatments, compact crowded-program presentation, full-sentence Pulse copy, and
usable desktop and approximately 390px behavior. Dense Recruit Details markets
remain acceptable current presentation rather than an open V1 blocker. The
feature changes no Recruiting mechanics and stores no durable market-event
history.

The visibility feature also exposed a separate mechanical tail: some top-10 or
top-25 Recruits can remain at 0–1 active Recruiting Programs unusually deep
into the regular-season cycle. A focused deterministic comparison found Board
construction remains the first bottleneck, but earlier discovery, bounded
market-opportunity/reach targeting, and broad Prestige weakening mainly changed
Board attention rather than formal Offer timing; some also weakened ranks
51–75. No production change was justified. This evidence remains WATCH and does
not qualify Market Visibility acceptance.

### Postgame Meaning V1 — ACCEPTED / FROZEN

The user accepted the polished compact consequence layer after implementation,
structural validation, desktop and approximately 390px inspection, and manual
review. Regular-season and Tournament full postgames now answer what changed
because the game happened with at most three derived facts while ordinary games
remain quiet and the final scoreboard remains visually dominant. Historical
views reconstruct canonical as-of-game context rather than drifting with later
results.

Structural implementation validation passed focused unit/RTL tests, the full
suite, lint, typecheck, production build, and diff checking. Polish validation
passed the relevant Postgame Meaning, Season, Postseason, and Exhibition tests,
lint, typecheck, and build; its full-suite run reported `1378/1379` with one
unrelated pre-existing Recruiting copy-text failure. Desktop/approximately
390px DOM and computed-style inspection found no horizontal overflow. Screenshot
and zoom tooling was unavailable, so acceptance does not claim screenshot-based
validation. A Player-link CSS specificity defect found during polish was fixed
without changing read-model or simulation behavior.

### Roster Positional Flexibility / B2 Live Flexible Capacity — ACCEPTED / FROZEN

The user accepted flexible roster construction after production implementation,
diagnostics, verification, UI clarity cleanup, desktop/approximately 390px
inspection, and normal play. Completed rosters remain exactly 12 Players with
2–3 at each natural position, while Required needs and shared Flexible
scholarships let commitments determine which two positions carry the extra
depth. Recruiting overview, Board, Roster Outlook, Recruit Details, and the
in-game Guide made the model understandable without a separate roster-plan
decision.

The paired diagnostic covered 1,200 model-cycles with zero finalization,
envelope, matching, joint-feasibility, emergency-generation, determinism, or
Program-order failures and no material talent inflation. Production verification
found matcher use in 89/100 cycles but only 271 of 9,585 incoming assignments
(`2.83%`): a routine defensive late tail while normal Recruiting constructed
`97.17%`. Production class size remained exactly baseline-equal on paired
samples. Final UI cleanup passed 164 focused tests, lint, typecheck, build, diff
checking, and desktop/narrow inspection; one aggregate-load calibration timeout
passed independently (`9/9`).

### Next Season Roster Planner / Roster Outlook V1 — ACCEPTED / FROZEN

The user accepted the polished factual Season N+1 roster dashboard after
desktop and narrow-screen review. Returning, Incoming, and Opening counts plus
natural-position capacity made roster construction legible without implying
Development, future OVR, Rotation, depth, minutes, or role. Structural
validation covered focused tests (`98` passed), the full suite (`1353` passed
before one final focused edge-case test also passed), lint, typecheck, build,
diff checking, and desktop/approximately 390px browser review. Final visual
validation covered `RecruitingScreen.test.tsx` (`71/71`), lint, typecheck,
build, diff checking, and desktop/approximately 375px inspection without
body-level horizontal overflow or domain-contract changes.

Roster Outlook also made an existing production constraint substantially more
visible: S0 establishes each Program's natural-position counts, senior
departures create openings at those same positions, exact-position Recruiting
fills them, and roster assembly validates the resulting composition. Absent a
separate future mechanic, the initial position-count distribution therefore
perpetuates across Seasons. This is neutral design evidence, not a claim that
Roster Outlook caused a defect.

### Postseason Player Legacy / Tournament Records V1 — ACCEPTED / FROZEN

The underlying Tournament history and records data looked correct in review.
The initial Player Career composition felt too busy, so the accepted polish
introduced a clean `Regular Season | Tournament` split while leaving Career
Honors shared. The Tournament summary now distinguishes performance from
achievement, Tournament Game History is collapsed by default, and championship
context reads with appropriate emphasis. Records was already effective aside
from its competition selector shifting horizontally; the accepted layout fixes
that movement.

Desktop and approximately 390px browser review covered Player Career in both
contexts, representative Tournament summary/run/high/game data, and Records in
both Regular Season and Tournament scopes. Final validation passed all 131 test
files / 1,341 tests, TypeScript, changed-file ESLint, production build, and
`git diff --check`. The user explicitly accepted the polished result. No new
WATCH item was opened.

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

Roster Positional Flexibility may indirectly affect long-run roster-strength
hierarchy by helping Programs convert recruiting opportunity into roster talent.
Current diagnostics show no directional concern; observe rather than tune Team
Strength, Game Simulation, Prestige, Recruit Talent, or hierarchy from this
linkage alone.

### Elite Recruit early-market coverage

Continue observing whether top-10/top-25 Recruits remain at 0–1 active
Recruiting Programs unusually deep into the cycle, especially where multiple
structurally compatible Programs pursue materially weaker same-position
alternatives. A focused narrow-mechanism diagnostic confirmed a bounded tail
but did not justify changing AI Boards, Offers, Prestige targeting, premium
discovery, or commitments; attention gains did not materially improve formal
Offer timing and some candidates weakened ranks 51–75. This is a WATCH/future-
design question, not a confirmed Known Issue or implied Roadmap selection.

### Concentrated ordinary Development gains

Rare official Explosive Offseasons intentionally create large position-aware
multi-attribute gains and are not defects by magnitude alone. Continue watching
only for implausible concentration in **ordinary** Development or incoherent
Player identity, and distinguish any evidence from the immutable event fact.

### Rotation secondary-path edge cases

Interior/forward-heavy eligibility and rare large incumbent displacement remain
worth observing. Legal manual 40-minute assignments are intentional; automatic
default workload realism and stable validation-row geometry are resolved.

### Flexible-capacity defensive completion

Production verification found the final matcher in 89% of inspected cycles but
only 2.83% of incoming assignments. Continue observing whether it remains a
small defensive late tail rather than taking on a materially larger share of
roster construction. Current behavior is healthy, not a Known Issue.

### AI flexible-depth positional shares

Flexible depth remained broadly distributed without structural convergence,
but multi-Season samples varied by seed in which positions carried extra depth.
Continue observing for persistent monotonic bias or pathological convergence;
equal 20% shares are not a tuning target.

### Flexible-capacity compatibility cleanup

The non-authoritative `projectedOpeningsByPosition` compatibility projection
remains for legacy/diagnostic typed consumers. Eventual retirement is narrow
technical debt, not a player-facing blocker and not a reason to reopen B2.

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
