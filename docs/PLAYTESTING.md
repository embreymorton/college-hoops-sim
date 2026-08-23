# Playtesting

## Purpose and how to read this file

This is the active empirical front door for feature planning. It owns current
priorities, live WATCH items, current gameplay evidence, and concise recent
acceptance evidence. It does **not** select Roadmap sequencing; only
`ROADMAP.md` owns **NEXT** and **PLANNED**.

Raw user playtest notes are evidence inputs, not documentation-ready prose.
Synthesize current patterns, behavior changes, and status before adding them;
see `DOCUMENTATION_POLICY.md` → **Playtest Note Synthesis**.

Normal sessions should read this current portion, then only sections directly
relevant to the active milestone. Closed causal history lives in
`PLAYTESTING_ARCHIVE.md`; detailed parked Player Identity experiments live in
`PLAYER_IDENTITY_RESEARCH.md`. Neither archive is a normal read requirement.

Evidence uses this loop:

```text
observation → evidence → question/hypothesis → investigation → decision
```

Statuses: **OBSERVED** is unvalidated manual evidence; **INVESTIGATING** has
earned a diagnostic; **CONFIRMED** is established; **RESOLVED** is implemented
and validated; **WATCH** is currently acceptable but worth monitoring.

## Current Playtesting Priorities

**Phase 8A — Dynamic Program Prestige V1 is REJECTED / ROLLED BACK / DEFERRED.**
Production uses static Prestige again. Long-run testing established that the
implemented V1 and two follow-up model families compressed durable Program
hierarchy too strongly. Dynamic Prestige remains a possible concept, but there
is no active replacement design.

1. Continue observing whether Yearbooks and News → inspect → Follow → Alumni
   create durable Player and Program attachment across normal multi-Season play.
2. Preserve the completed very-high-OVR causal evidence while the selected
   Roadmap design milestone evaluates Recruit talent-profile coherence rather
   than repeating the diagnostic or tuning Development.
3. Monitor genuinely live WATCH items below without promoting them into work
   absent stronger evidence.

The Elite Program Dominance / Competitive Compression investigation is
**decision-complete**. Ordinary Recruiting micro-rule experiments are closed.
Broader offseason-management mechanics remain optional future work, not an
active evidence priority, implementation, or Roadmap successor.

This priority list is evidence guidance, not an independent sequencing decision.
The authoritative milestone selection remains in `ROADMAP.md`.

## Current Multi-Season Play Evidence — OBSERVED

A voluntary Pine Valley Dynasty lasting roughly 14 Seasons is strong qualitative
evidence that the current loop can sustain long-form engagement. The rebuild
remained difficult, with generally modest results, low-seed Tournament
appearances, and short runs even after meaningful roster improvement. That
difficulty created a durable story rather than proving either that the rebuild
curve is ideal or that static Prestige is broken.

The clearest product pattern was that attachment increasingly came from
remembered decisions and their later consequences, not ratings alone. One
natural-C opening forced a choice between Kobe Russell and Gavin Nichols;
Russell signed with Pine Valley, Nichols was followed after signing elsewhere,
and their Development was compared for several Seasons. Later results made the
original decision feel validated. Followed Recruit/Player continuity, stable
identity, Records, News, and retrospectives made that story easy to revisit.

The run supplied these additional signals:

- **WORKING:** Next Season Position Outlook materially improved live Recruit
  evaluation by placing exact OVR/POT beside projected roster competition. This
  validates the accepted V1 without automatically expanding it.
- **RESOLVED:** `Fill Remaining Board` remains useful, while accepted Recruiting
  Board Organization & Cleanup V1 now separates assistant-added targets from
  manually chosen targets without changing Fill selection behavior.
- **WORKING:** Rotation Assistant `Fill Remaining` made it substantially easier
  to preserve a deliberate minutes increase for one Player and build a legal
  Rotation around that choice.
- **WORKING:** Recruiting Class Retrospectives were explicitly enjoyable and
  connected earlier evaluations to later outcomes; seeing a former 63/85
  Recruit become an 81-OVR junior made the class history meaningful.
- **WORKING:** Records and News sustained historical exploration many Seasons
  later. A discovered 59-point game and Kobe Russell's Season/Career rebounding
  ranks were memorable, while Darnell Green's 40-point game created an immediate
  desire for discoverable Player career highs and Program memory; the accepted
  Player Records Expansion now makes both available from Player and Team
  Details.
- **WORKING:** the historical disappearing Tournament → Late Recruiting action
  did not recur during the long run. This is meaningful additional manual
  validation of the accepted canonical progression architecture, not proof that
  regression is mathematically impossible.
- **RESOLVED:** the previously fragmented Offseason presentation supplied the
  selection evidence for Dedicated Offseason Experience V1. The accepted Hybrid
  Offseason Timeline now gives Late Recruiting, class review, Departures,
  Development, Roster Review, and the next-Season handoff one coherent identity.
- **RESOLVED:** Matchup Scout V1 and Game Prep Rotation Experience V1 replaced
  the older Rotation-centered composition with an accepted pregame hierarchy,
  restrained opponent context, default Simple Rotation, guarded Advanced
  access, and a compact Expected Rotation without changing simulation or
  Rotation mechanics.
- **OBSERVED:** qualitative Recruiting uncertainty remains valuable. While
  second for PG Tyler Allen, the user wanted to know whether the gap was truly
  competitive or a long shot without seeing exact hidden relationship scores.
- **RESOLVED:** canonical manual/assistant provenance and counted Board groups
  keep player choices visible, while atomic `Clear Unavailable` removes
  committed-elsewhere and position-filled targets without deleting relationship
  history or refilling opened slots. The accepted desktop and approximately
  390px presentation closes this workflow friction without changing Board
  capacity or Recruiting selection mechanics.
- **RESOLVED:** focused Recruiting/store/UI validation passed (including the
  recorded 122-test and 77-test runs), TypeScript, ESLint, production build, and
  visual/browser-console checks passed. The full parallel run recorded 1204
  passes and 41 load-related five-second timeouts; representative affected
  Postseason and Dynasty-transition suites passed independently 23/23, so this
  is not evidence of a Recruiting regression.
- **OBSERVED:** exact-position capacity made the Russell/Nichols choice engaging
  while also raising neutral interest in future position changes or broader
  roster flexibility. One decision does not establish a Recruiting defect.
- **OBSERVED:** memorable individual performances and Program-specific history
  continue to create demand beyond global leaderboards. Future presentation can
  remain derived from retained results rather than assume mutable achievement
  state.

Overall, the dominant friction in this run shifted toward lifecycle
presentation, information architecture, workflow, and historical surfacing
rather than basic simulation correctness. That is useful product evidence, not
a claim that simulation work is permanently complete.

## Live WATCH Items

### Long-run Program hierarchy — CONFIRMED / DECISION-COMPLETE

Mature compression is real but accepted for the current product scope after a
multi-system investigation. It is not an active tuning priority. Deliberate
reopening conditions and historical evidence live in
[DYNASTY_HIERARCHY_RESEARCH.md](DYNASTY_HIERARCHY_RESEARCH.md).

### Low-prestige rebuild

Pine Valley still felt like a genuine grind after roughly 14 Seasons: improved
rosters did not consistently translate into strong résumés, Tournament bids
were generally low seeds, and runs were short. Continued manual recruiting work
renewed interest in structural Program progress, but a difficult rebuild
remaining difficult may be intended. The unresolved product question is whether
actual sustained résumé success receives an appropriate sense of structural
progress. This run does not select Dynamic Prestige, propose a formula, or meet
the existing reopening bar for the decision-complete hierarchy investigation.

### Elite Recruit offer coverage

**WATCH:** one top five-star PG reportedly had no Offers around Round 10 and was
available to Pine Valley. This may be plausible market behavior, a positional
supply edge case, or incomplete AI coverage. Before treating it as a defect,
measure how often elite/top-ranked Recruits remain unoffered deep into a cycle
and under what positional and class-supply conditions. No Recruiting AI or
supply change is authorized by this example.

### Recruit Talent Profile V2 — RESOLVED / ACCEPTED / FROZEN

V1's independent readiness and raw-ceiling rolls created too few elite-ceiling
Recruits and gave those rare ceilings the class-wide readiness mix. Development
was not the cause: matched OVR/POT/headroom profiles developed similarly across
origins. V2 therefore adopted a soft joint model in which realized readiness
selects a loose ceiling distribution; it does not derive POT directly from OVR
or readiness and adds no persistent archetype.

V2A proved the direction but was too aggressive. B1 and B4 located the healthy
region, and their refined calibration became production. A final
micro-adjustment that reduced low-readiness `85–94` supply was rejected: it
modestly harmed project supply with negligible lifecycle improvement. The
rejected adjustment is not production behavior.

The production activation audit covered approximately `80,204` Recruits in
`500` classes. OVR mean/median remained `66.40/67`, OVR 80+ was `8.11%`, and
readiness↔raw-ceiling correlation was a deliberately loose `0.080`. Raw
90+/95+/97+/99 rates were `8.55%/2.98%/0.66%/0.23%`; final POT rates were
`9.31%/2.99%/0.66%/0.23%`. Headroom `0–3/4–7/8–12/13–19/20+` was
`25.40%/14.98%/15.88%/19.91%/23.84%`.

Premium composition remained varied: Top-25 POT95+ was `11.62%`, 5★ POT95+
was `16.52%`, 4–5★ POT95+ was `8.84%`, 5★ ready/low-headroom was `67.21%`, and
4–5★ high-headroom projects were `14.24%`. Assignment remained healthy: the
largest single-Program Top-25 class was `4`; `0/879` Program/classes signed 5+;
there were zero commitment shortfalls, unsigned compatible 4–5★ Recruits, or
lifecycle failures. Lower-Prestige Programs still received projects and
occasional elite-potential Recruits.

Full Dynasty validation established a gradual S0-to-endogenous transition with
S0 share reaching zero by Season 5. Mature Seasons 5–10 stabilized near `78.07`
average Team OVR and `3.67` SD, with zero 90+ Teams and approximately
`37.93/7.63/0.87` Players at 85+/90+/95+. Static Prestige remained meaningful,
the strongest Programs moved only modestly, and competition outputs remained
coherent. The stronger junior/senior elite population is accepted as benign and
desirable at league scale, not a reason for more Recruit calibration.

Recruit readiness/current ability, Candidate B, ranking/stars, Recruiting,
Development, and downstream competition systems remain frozen and unchanged.
No Recruit Talent Profile calibration is open.

### S0 Current Ability / Career-Stage Generation — RESOLVED / ACCEPTED / FROZEN

The focused continuity audit found that legacy S0 class year was effectively
independent of roster talent: FR/SO/JR/SR mean OVR all sat near `70.4`, S0
freshmen produced 90+/93+ current ability materially more often than Recruit V2
entrants, and older classes did not represent accumulated career development.
The accepted solution retained each Program's fixed talent-slot budget and
class counts, then assigned class ownership through deterministic priority:

```text
FR -0.90 | SO -0.30 | JR +0.35 | SR +0.55
priority = class location + logistic noise × 1.25
```

Production uses the versioned
`college-hoops-sim:s0-career-stage-priority:candidate-a:v1` namespace keyed by
typed Universe seed, Program ID, class token index, and class year. Wide noise
keeps every class eligible for every roster opportunity; there are no class OVR
caps, and 99 OVR remains mechanically possible for FR/SO/JR/SR.

The live audit covered 1,000 Universes, 32,000 paired Programs, and 384,000 S0
Players. FR/SO/JR/SR mean OVR became `68.83/69.95/71.19/71.62`, with medians
`69/70/71/72` and P99 `87/88/89/90`. Freshman universe incidence was `29.7%`
at 90+, `8.7%` at 93+, `3.1%` at 95+, `0.4%` at 97+, and `0.1%` at 98+;
freshmen were the national best Player in `11.9%` of Universes. Sophomores
retained `20.92%/21.12%/21.42%` of Top 5/10/25 places and `20.60%` of national
best-Player outcomes.

National Top-10 class share was `13.49%/21.12%/30.81%/34.58%` for
FR/SO/JR/SR: accepted older-player advantage without age monopoly. Two 99 OVR
Players appeared, one SO and one SR; absent FR/JR 99s in a finite sample do not
change their structural possibility.

Program strength was exact before and after assignment. Mean/median/SD Team
OVR remained `70.397/70.417/5.989`; paired MAE and maximum movement were zero,
rank correlation was `1.000`, Prestige↔Team OVR remained `0.9318`, and all
32,000 Programs retained identical Team OVR. Best/Top-3/Top-5/all-12 depth
remained `80.10/77.10/75.30/70.40`. The milestone changed who owns talent by
class, not how much talent a Program receives.

### S0 POT / Career-Profile Continuity — RESOLVED / ACCEPTED / FROZEN

The legacy class-specific headroom model overlinked OVR and POT, suppressed
polished freshmen and projects, and forced seniors near their ceiling. The
endogenous Recruit V2 → unchanged Development reference instead established a
fixed broadly stable POT marginal, decreasing-but-persistent project tails, and
an OVR↔POT relationship that strengthens with career stage.

Diagnostic Candidates A through A4 showed that prior × compatibility ×
correction models could preserve either ceiling supply or healthy carrier
composition, but did not naturally preserve both without increasingly large
corrections. The accepted simplification modeled `P(ceiling tier | OVR, stage)`
directly across Limited `60–74`, Normal `75–84`, High `85–89`, Very High
`90–94`, Elite `95–96`, and Exceptional `97–99`, then made one shared legal
integer draw. The High / Very High split produced materially different and
useful Player populations.

Production activation covered 500 Universes and 192,000 Players and matched the
validated diagnostic exactly. FR/SO/JR/SR mean POT was
`79.49/79.10/79.05/78.71`; mean headroom narrowed
`10.69/9.19/7.85/7.09`; and OVR↔POT correlation strengthened
`0.381/0.477/0.571/0.629`, far below legacy near-determinism. Junior and senior
HR13+ remained `23.2%/19.6%`, with HR20+ at `7.4%/5.6%`. This is modestly more
developmental than the endogenous lifecycle and was accepted as healthy for
specialized S0 initialization.

POT99 appeared for `363/192,000` Players (`0.19%`, `0.73` per Universe), across
OVR `47–98`; carrier mean OVR rose from approximately `70` for freshmen to `80`
for seniors, and no sampled POT99 Player was already 99 OVR. Season Preview
showed varied leading-freshman stories rather than automatic POT99 pairings.
Production was user-playtested and accepted. Recruit V2, Development, S0
current ability, Program talent budgets, and all downstream systems remained
unchanged; no S0 talent-profile calibration remains open.

### Concentrated single-attribute Development gains

Development V1 creates varied career outcomes, but rare offseason gains can
concentrate heavily in one attribute. Monitor whether this produces implausible
Player identities; do not change Development from isolated examples.

### Rare Development Breakouts / Explosive Offseasons — PLANNED PRODUCT QUESTION

Normal Development V1 annual gains are capped at approximately `+12` FR→SO,
`+10` SO→JR, and `+8` JR→SR. Future work may investigate whether extremely rare
transformational offseasons should exceed those normal caps while POT remains
absolute. This is not a confirmed defect, is not NEXT, does not globally reopen
or raise ordinary Development caps, and must not compensate for Recruit talent-
profile shortcomings. If selected later, first measure whether the caps
actually truncate breakout outcomes before considering at most one isolated
candidate.

### Rotation secondary-path edge cases

Interior/forward-heavy eligibility and rare large incumbent displacement remain
worth observing. Legal/manual 40-minute assignments are intentional; automatic
default workload realism is resolved and frozen.

### Recruiting position friction

Exact-position vacancies can make desirable Recruits unavailable and feel
annoying during normal Recruiting. Preserve this player-facing observation for
future feature planning on its own merits; rejected hierarchy experiments do
not authorize another Recruiting micro-rule.

### Shot selection and statistical translation

Shot mix is simplified, and Steals/cross-position identities showed the clearest
historical compression. The roughly 14-Season Record Book topped out at seven
steals in one game, strengthening earlier qualitative concern without proving a
tuning problem. The evidence question is whether the long-run upper tail is
appropriately rare or structurally compressed. Player Identity and Game Sim
tuning remain parked/frozen pending a focused diagnostic and stronger evidence.

### Persistence and history growth

Save/load is absent and serialized Dynasty history grows across Seasons. These
are future product/engineering concerns, not confirmed blockers for the current
feature milestone.

## What Is Working / Fun Right Now

- Recruiting creates risk/reward choices rather than automatic elite classes.
- Low-Prestige programs can feel like real multi-year rebuilds.
- Development produces busts, modest careers, hits, and rare stars.
- Tournament upsets and painful exits create distinct Season stories.
- Graduation, Recruiting, Development, and rollover make rebuilding cyclical.
- News makes Players and Programs discoverable during ordinary progression.
- Following, Alumni, and Historical Player Details preserve attachment after
  graduation.
- Season Preview introduces names before current results create stories.

Preserve these strengths. A surprising result is evidence to interpret, not an
automatic defect.

## Recent Accepted-Phase Evidence

### Dedicated Offseason Experience V1 — ACCEPTED / FROZEN

Manual play accepted the dedicated Offseason identity, six-stage timeline,
stage structure, and final presentation polish as a substantial improvement to
the previously fragmented lifecycle. Completed-stage review remained clearly
separate from the furthest/current progression state, safe League/History/
completed-Tournament/detail exploration did not hide or corrupt the handoff,
and the polished integrated header CTA, simplified Late Recruiting composition,
anchored Roster Review summary, and compact Ready for Season conclusion were
all accepted. This is strong qualitative UX acceptance, not simulation evidence.

Automated closure passed 1,211 tests across 115 files, ESLint, TypeScript, and
the production build; the final focused transition/offseason suite passed 23
tests. A live lifecycle walkthrough covered confirmation and every stage, with
no browser console errors. At approximately 390px, the document remained within
the viewport while the timeline and wide tables scrolled locally. Existing
Recruiting, Development, roster assembly, archive, Tournament, simulation, RNG,
and rollover behavior remained unchanged.

### Rotation Assistant V1 — ACCEPTED / FROZEN

Manual Simple Rotation acceptance confirmed that edited MPG receives a clear
Locked treatment, Fill Remaining preserves those values exactly while producing
a legal 200-minute draft, and canonical Rotation changes only after Apply.
Apply and Discard both clear transient locked state; Discard restores the last
committed values. An over-constrained preserved draft kept every locked value,
disabled Apply, showed the existing minute-total feedback, and left canonical
state unchanged. Desktop presentation remained clear, and a small acceptance
fix made the three actions fully reachable without horizontal overflow at
390px.

### Matchup Scout V1 + Game Prep Rotation Experience V1 — ACCEPTED / FROZEN

The finalized regular-season and Tournament Game Prep surfaces were visually
accepted with the same hierarchy: matchup/pregame hero, contained Matchup Scout,
then Rotation Preparation. The Scout keeps early samples restrained, surfaces
distinctive league-relative opponent observations only when earned, selects
production-first Players to Watch with compact Top-10 PPG/RPG/APG distinctions,
and adds recent form, meaningful streaks, and the latest regular-season prior
meeting where available. Tournament form can lead the recent-results sequence
without entering the regular-season statistical profile.

Simple is accepted as the default controlled Rotation presentation, with
Advanced progressively disclosed. Manual and automated checks confirmed that
dirty Simple work must be Applied or Discarded before switching, invalid
Advanced work remains visible until completed or reset, and simulation stays
blocked while unresolved draft state differs from canonical Rotation. The
opponent Expected Rotation focuses on the projected PG–C five and positive-
minute bench, with compact reserves and deeper Player/Team navigation.

Closure verification included focused projection, navigation, draft-safety,
synchronization, simulation-gating, and shared-surface coverage; the full suite
passed 1,226 tests across 117 files. ESLint, TypeScript, production build, and
`git diff --check` passed. Desktop and 390px browser checks found no body-level
overflow or console warnings/errors; Simple and Advanced retained local table
overflow where needed.

### Program Legacy V1 — ACCEPTED / FROZEN

Direct inspection confirmed a deliberate empty state before Season 1 history,
then a compact all-Program Dynasty résumé and Recent Seasons trail after
rollover. Desktop presentation kept current Team information prominent; at
390px, the summary and recent rows stacked without body overflow while Team
averages, results, leaders, and roster remained usable. Multi-rollover tests
confirmed records, appearances, titles, runner-up finishes, best results, and
newest-first capping remain pure projections over canonical archives. Final
closure also verified that never-qualified Programs receive the aggregate `No
Tournament Appearances` label while Recent Seasons preserve `Did Not Qualify`,
and that National Champion emphasis remains presentation-only.

### Offseason Storytelling V1 — ACCEPTED

Direct inspection of a canonical Season 1 Offseason confirmed that every
graduating senior retained representation with observed Program-tenure context,
the Biggest Leap matched the largest returning-Player OVR gain, positive
attribute gains remained readable and capped, unchanged Players degraded safely,
and a 390px viewport had no body-level overflow. Development mechanics and
Offseason progression remained unchanged.

### Phase 7C.2 — Records & Milestones V1 — ACCEPTED / FROZEN

Manual play accepted History as the fifth League tab with Yearbooks and Records,
the simultaneous Single Game / Single Season / Career Top-10 presentation, one
PTS/REB/AST/STL/BLK selector, live regular-season contributions, provisional
`LIVE` Season rates, and stable-ID Player detail round trips. Shared derivation
removed the earlier repeated Season-stat work; category changes are cheap view
selection and long-history work scales approximately linearly.

Record-breaking Single Game News was also accepted after Season 1: only strict
new regular-season Dynasty highs qualify, same-game categories combine, generic
duplicate performance stories are suppressed, and ties, Top-10-only entries,
and postseason performances do not qualify. Existing News ranking, grouping,
Following, and entity navigation remain intact.

### Player Records Expansion V1 + Details IA — ACCEPTED / FROZEN

Manual play accepted Career Highs and Program Player Records as useful,
straightforward Dynasty attachment surfaces. The initial combined Details pages
also exposed a real information-hierarchy problem: current-season facts and
long-term history made Team and Player Details feel cluttered when presented in
one long flow. The accepted follow-up keeps entity headers persistent and uses
Team `Overview | History` plus Player `Overview | Career`; Former Player Details
adapts the same organization without inventing current-season content.

The accepted V1 remains regular-season-only and derived from canonical archived
plus active results. It preserves League Records, qualification, deterministic
ties, provisional `LIVE` Season rates, rollover deduplication, stable-ID
active/former navigation, and Back behavior. Program Career totals include only
production accumulated while representing that Program. No mutable achievement
state, Tournament statistics, persistence, or simulation behavior was added.

Final post-polish closure passed 1,237 tests across 117 files, ESLint,
TypeScript, and the production build. Focused IA coverage passed 72 tests across
five files. Browser inspection at 390×844 found no document-level overflow and
confirmed compact tabs and clean selected-panel structure; desktop inspection
confirmed the intended header → tabs → selected-content hierarchy with no
browser warnings or errors.

The Tournament → League → Tournament progression blocker found during play is
**RESOLVED / MANUALLY VERIFIED**. Handoff visibility derives from canonical
Tournament completion through one pure resolver, including the genuine lagging
regular-season Period 24 boundary. Continue catches up all missing completed
Tournament Recruiting rounds before entering Late Recruiting. The contextual
Tournament action and route-independent shell fallback use the same command;
navigation remains read-only, repeated navigation cannot consume the action,
and the transition cannot advance twice. Manual verification at a 390px viewport
confirmed the fallback and CTA stay within the viewport after navigating from a
completed non-qualifier Tournament to League.

The completed Tournament presentation redesign is **IMPLEMENTED / VERIFIED**.
Tournament now uses the same single Season Complete bar below navigation, while
a canonical title-game recap owns champion, runner-up, final score, overtime,
and existing box-score access. The controlled Program strip owns `Finish`, so a
non-qualifier reads `Did Not Qualify` without dominating the national recap.
Focused Tournament/lifecycle coverage passed, and manual 390px verification
confirmed the required section order, one continuation CTA, no body/document
overflow, full-width actions, Recruiting after the recap, and bracket-only
horizontal scrolling.

### Recruiting Class Retrospectives V1 — ACCEPTED / FROZEN

The user manually accepted League → History → Recruiting: newest-first finalized
national signing classes, all signed Recruits with unsigned surplus excluded,
the lean Recruit/Signed/Entered/Outcome table, All Programs default with a Your
Program filter, and stable-ID active/Former Player detail round trips that retain
class and filter context. Incoming and unavailable identities remain correctly
unlinked, while hidden Recruiting mechanics never appear.

Focused projection, Recruiting History, History navigation, lifecycle outcome,
and return-state coverage passed alongside the full test, lint, typecheck,
build, and diff-check gates. Browser verification at 390px found no body-level
horizontal overflow and no console errors. The fresh browser Dynasty had no
finalized class for a populated live visual pass; populated class-detail states
were instead exercised through DOM/tests. This acceptance closes the factual
retrospective only—it does not resolve broader Awards, recognition, or
Recruiting-analytics questions.

### Phase 7D.3 — Recruit → Player Continuity — ACCEPTED / FROZEN

Followed Recruit continuity into existing Player Following worked as expected
and was manually accepted. Stable identity carries attachment through commitment,
Offseason, and rollover for both the user's signees and Recruits signing
elsewhere. The verified active-roster ID becomes canonical `followedPlayerIds`
intent, converted Recruit ownership is retired, existing Player-follow order and
semantics remain intact, and unresolved Recruit IDs do not fabricate continuity.

The Tournament non-qualifier → Coaching blocker encountered during this pass is
**FIXED / MANUALLY VERIFIED**. A non-qualifier uses retained completed-Season
Roster/Rotation Coaching, both modes remain usable, Tournament navigation
recovers, and no fake participation or canonical competition mutation occurs.

### Phase 7D.2 — Follow Recruits — ACCEPTED / FROZEN

The user reported that Follow Recruits “works as expected” and accepted the
milestone. The frozen V1 supports Follow/Unfollow from Recruit Details,
first-followed Recruiting Following order, live safe current-class status,
resolved commitments that remain visible, direct Unfollow, and Recruit Details
round-trip navigation. Follow remains independent from Board, Focus, and Offer.
The surface mirrors accepted League Following interaction language; Recruit →
Player continuity was not part of 7D.2 acceptance.

### Phase 7D.1 — Recruit Details — ACCEPTED / FROZEN

- The user's central finding was: “It is definitely very useful to get insights
  into what recruits are good at.” Exact canonical OVR, POT, and nine-rating
  presentation supplied that value without synthetic strength/weakness labels.
- Board, Battles, and National Class entry paths and parent-mode return behavior
  worked as intended.
- The polished identity-first hierarchy, safe Recruiting context,
  committed-state treatment, and contextual versions of existing Board, Focus,
  and Offer actions improved the inspect → decide → act loop and were accepted.
- **Tournament-complete progression recovery — FIXED / MANUALLY VERIFIED.** The
  canonical-state-derived Late Recruiting handoff remained reachable after the
  user navigated away from the completed Tournament and back through the final
  regular-season review.
- This acceptance does not claim Recruit following or Recruit → Player
  continuity UI; those remain Phase 7D.2 and Phase 7D.3 work respectively.

### Phase 7C.1 — Season Archive / Yearbook — ACCEPTED / FROZEN

Manual acceptance established that History belongs to League. Its original
7C.1 secondary-action placement was subsequently promoted by implemented 7C.2
to a first-class League tab without changing the accepted Yearbook. The
Yearbook lists only completed Seasons newest-first and reads as one recap: Champion / Season
identity, Your Season, Season Around the League, then the full archived
Tournament bracket.

The controlled-Team section combines summary, Team Leaders, and Tournament Run.
League context uses one Final Standings card with a conference selector and one
Statistical Leaders card with a category selector; controlled conference and
PPG are the defaults, with all conferences and PPG/RPG/APG/SPG/BPG top tens
available. Statistics are regular-season only. Desktop paired cards stack on
mobile, and the accepted 390px layout has no body overflow.

Stable-ID Player links reach current details for active Players and
Former/Alumni details for departed Players, fail quietly when unresolved, and
return to the same Yearbook on Back. The Tournament is a full read-only
archived bracket without active simulation or game-detail affordances. All of
this remains projection and local presentation state over canonical completed
archives; 7C.1 did not add copied summaries or a season-specific Player route.

Records, Awards, historical Team/game details, News replay, combined
statistics, compaction, and simulation/calibration
changes remain outside accepted 7C.1 scope.

### Phase 7B — Player & League Stories — ACCEPTED / FROZEN

The accepted loop is:

```text
Season Preview → notice Player/Program → inspect → Follow
→ News during Season → Alumni after career
```

News acceptance established complete-checkpoint publication, useful Player and
Program navigation, Follow context, restrained outcome/multi-achievement copy,
and readable 390px presentation. Multi-Season play produced memorable stories,
including a discovered scorer followed through his senior Tournament exit.

Alumni acceptance established `active | former | unknown` resolution, retained
Follow intent, regular-season career aggregation, Historical Player Details,
Final/Peak OVR, Final Ratings, progression, and optional Recruiting Origin.

Season Preview acceptance established Season 1 and rollover cast projections,
Rounds 1–2 Hub promotion, persistent active-Season League News retrieval,
entity exploration, and local table scrolling at 390px. No Phase 7B feature
added simulation behavior or parallel canonical history.

Detailed acceptance narratives are preserved in `PLAYTESTING_ARCHIVE.md`.

## Parked Player Identity Evidence

Manual play produced both homogeneous-feeling Seasons and memorable outliers.
Diagnostics separated generation/profile supply, OVR valuation, role-aware
minutes, and statistical translation. The product decision is unchanged:

- current Player population is good enough for feature development;
- canonical generation and `calculateOverall()` remain production truth;
- Profile Generation Experiment A V2 is experimental input only;
- OVR Experiment B v1 is rejected; and
- tuning requires new gameplay evidence before reopening.

See `PLAYER_IDENTITY_RESEARCH.md` only when a current problem deliberately
reopens that work.

## Historical Evidence Index

- Recruiting concentration, Talent/POT, Development, Rotation, Tournament,
  Recruiting IA, UI polish, Coaching, Followed Players, and Phase 7B acceptance:
  `PLAYTESTING_ARCHIVE.md`
- Player Identity characterization and experiments:
  `PLAYER_IDENTITY_RESEARCH.md`
- Accepted simulation/calibration formulas:
  `SIMULATION.md`
- Confirmed engineering issues and resolved ledger:
  `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`

## Maintenance rule

Keep Current Playtesting Priorities and Live WATCH Items near the top. If closed
evidence pushes them down, summarize the durable conclusion and archive the
detail before adding more. At phase close, retain only evidence that still
affects current planning and move detailed closed narratives to
`PLAYTESTING_ARCHIVE.md`.
