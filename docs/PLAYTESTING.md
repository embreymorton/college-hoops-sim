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

**Phase 8A — Dynamic Program Prestige V1 is IMPLEMENTED / AWAITING MANUAL ACCEPTANCE.**
The selected milestone responds directly to the live low-Prestige rebuild
signal: meaningful sustained results should gradually change future Program
standing and flow through existing Recruiting, without turning one Season into
an instant transformation.

1. Manually verify that the Offseason Prestige summary feels clear, zero change
   is understandable, one result does not feel transformative, and sustained
   success/failure feels meaningful across several Seasons. Automated checks
   found bounded movement, believable mobility and tiers, stable Recruiting,
   and no distribution collapse through a focused 25-Season drift run.
   The acceptance follow-up moved this summary into the Offseason header and
   added derived starting/net/peak and Season-by-Season context to Team Details.
   It also strengthened canonical navigation recovery coverage after the Late
   Recruiting defect recurred while keeping the progression card scoped to the
   Season/Postseason hub context.
2. Continue observing whether Yearbooks and News → inspect → Follow → Alumni
   create durable Player and Program attachment across normal multi-Season play.
3. Monitor genuinely live WATCH items below without promoting them into work
   absent stronger evidence.

This priority list is evidence guidance, not an independent sequencing decision.
The authoritative milestone selection remains in `ROADMAP.md`.

## Current Multi-Season Play Evidence — OBSERVED

A manual Pine Valley Dynasty through approximately Season 8 produced a
compelling low-Prestige rebuild: `1–23 → 2–22 → gradual talent improvement →
Tournament qualification → #16-over-#1 upset → another Tournament appearance →
later decline after key graduations`. Recruiting, Development, Tournament
progression, and roster turnover combined into memorable long-form stories
without making success immediately sustainable. This supports the current
Dynasty loop as fun and attachment-producing; one run does not prove that its
rebuild curve is perfectly balanced.

The run also supplied these current product signals:

- **WORKING:** large and repeated Player gains, attribute-specific offseason
  summaries, and disappointment at limited growth all made Development outcomes
  matter. Offseason Storytelling is producing payoff without evidence to reopen
  accepted Development mechanics.
- **WORKING:** low-OVR/high-POT projects, contested battles, and eventually
  landing four- and five-star Recruits created attachment. Recognizing an early
  elite Recruit years later as a senior national scoring leader strengthened
  the Recruit → Player continuity story and provides evidence for unscheduled
  recruiting-class retrospective ideas.
- **WORKING:** Records supplied durable comparison across Seasons, including a
  47-point Single Game mark later broken by a 52-point game and Players reaching
  Season/Career rebounding, scoring, and blocking lists. Record News correctly
  omitted inherited Season 1 history under its frozen contract.
- **WORKING:** the Recruiting Guide was useful after the player forgot what
  recruiting states meant, supporting lightweight contextual guidance for
  interconnected systems.
- **OBSERVED:** the user often wanted to preserve one or two intentional minute
  assignments, then have an assistant construct or repair a legal Rotation
  around them. Manual edits could temporarily create invalid Rotations and
  required rebuilding the remainder by hand.
- **OBSERVED:** recruiting standing showed Focus, Offer, and rank but not whether
  a contested target was barely behind, meaningfully behind, or effectively out
  of reach. The uncertainty remained exciting, suggesting a need to investigate
  better qualitative feedback without exposing exact hidden scores.
- **OBSERVED:** when a focused Recruit committed, the newly open Focus slot was
  easy to leave unused despite other offered targets. Whether assistance should
  be automatic, prompted, or explicitly user-triggered remains an open design
  question.
- **OBSERVED:** a #16-over-#1 upset led by Lucas Bradley's 29 points felt worthy
  of Program-level remembrance distinct from a statistical Record. Graduated
  Players such as a roughly 91-OVR Tobias Stone and career leaderboard presence
  from Trey Adams also created demand for stronger Program-specific alumni
  memory; these examples are evidence, not canonical recognition rules.

## Live WATCH Items

### Low-prestige rebuild and mature-league ceiling

Pine Valley has felt like a genuine multi-year grind, and mature leagues have
occasionally produced one clear powerhouse with most Programs clustered below.
In the latest multi-Season run, Pine Valley rose from consecutive one- and
two-win Seasons to multiple Tournament appearances and a #16-over-#1 upset, yet
its visible Prestige remained approximately 36 and recruiting still appeared
constrained by its original environment. This is meaningful evidence for
investigating gradual Program-reputation evolution, not proof of a broken
formula or authorization to retune Recruiting. Reopen balance only if repeated
play shows the rebuild is inert or the league loses believable upper-tier
Programs.

### Concentrated single-attribute Development gains

Development V1 creates varied career outcomes, but rare offseason gains can
concentrate heavily in one attribute. Monitor whether this produces implausible
Player identities; do not change Development from isolated examples.

### Rotation secondary-path edge cases

Interior/forward-heavy eligibility and rare large incumbent displacement remain
worth observing. Legal/manual 40-minute assignments are intentional; automatic
default workload realism is resolved and frozen.

### Premium Recruit Offer allocation

Premium Recruits sometimes attract many Board pursuers but fewer Offers. Prior
evidence often traced this to positional Offer capacity or selection of another
target. Any change requires a dedicated diagnostic; it is not part of current
feature work.

### Shot selection and statistical translation

Shot mix is simplified, and Steals/cross-position identities showed the clearest
historical compression. A Single Game steal record around 6 drew attention as
potentially low in one run, but remains a WATCH signal rather than a confirmed
tuning problem. Player Identity tuning remains parked; investigate only if new
manual play identifies a concrete repeated gameplay problem.

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

The Tournament → League → Tournament progression blocker found during play is
**RESOLVED / MANUALLY VERIFIED**. Handoff visibility derives from canonical
Tournament completion plus postseason-phase Recruiting; Continue catches up any
missing completed Tournament Recruiting rounds before entering Late Recruiting.
Navigation remains read-only, repeated navigation cannot consume the action,
and the transition cannot advance twice.

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

Records, Awards, historical Team/game details, News replay, Recruiting
retrospectives, combined statistics, compaction, and simulation/calibration
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
