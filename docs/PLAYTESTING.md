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

**Phase 7C.2 Records & Milestones V1 — IMPLEMENTED / PENDING MANUAL
ACCEPTANCE.** Initial play found the query-like scope/category form less
history-forward than the app's established leader presentation and exposed a
noticeable Season-record delay. The implemented refinement now shows all three
record scopes together for one selected category and shares historical
derivation work. Follow-up play accepted that structure and speed, exposed a
reproducible Tournament → League → Tournament Late Recruiting blocker, and
selected a live regular-season Records refinement. The blocker is now resolved
from canonical lifecycle state, and Records overlay active Single Game/Career
facts plus provisional LIVE Season rates. Automated projection and navigation
coverage is green; normal player play remains the acceptance gate.

The pending build also adds strict record-breaking Single Game stories to News
after Season 1. Automated coverage verifies historical and running baselines,
all five categories, canonical same-round order, combined-category copy,
generic-story deduplication, and postseason exclusion. Manual acceptance should
confirm their prominence within the existing roughly-12-story collapsed feed
and the Player/Program navigation round trip.

1. Continue observing whether Yearbooks and News → inspect → Follow → Alumni
   create durable Player and Program attachment across normal multi-Season
   play.
2. Play League → History → Records across early and multi-Season Dynasties;
   assess whether the three scopes and supplied context make legends easy to
   discover and compare, including live updates and Player Details round trips.
3. Reverify completed Tournament → League → Tournament → Late Recruiting in
   normal play after the canonical handoff recovery.
4. Trigger record-breaking games during Seasons 2+ and verify combined copy,
   Follow markers, feed prominence, Show All behavior, and Player/Program Back
   navigation; confirm ties and Tournament performances remain ordinary News.
5. Monitor genuinely live WATCH items below without promoting them into work
   absent stronger evidence.

This priority list is evidence guidance, not an independent sequencing decision.
The authoritative milestone selection remains in `ROADMAP.md`.

## Live WATCH Items

### Low-prestige rebuild and mature-league ceiling

Pine Valley has felt like a genuine multi-year grind, and mature leagues have
occasionally produced one clear powerhouse with most Programs clustered below.
This remains interesting/acceptable. Reopen only if repeated play shows the
rebuild is inert or the league loses believable upper-tier Programs.

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
historical compression. Player Identity tuning remains parked. Investigate only
if new manual play identifies a concrete repeated gameplay problem.

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
