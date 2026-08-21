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
is no active replacement design and the Roadmap is at an Open Planning Checkpoint.

1. Continue observing whether Yearbooks and News → inspect → Follow → Alumni
   create durable Player and Program attachment across normal multi-Season play.
2. Monitor genuinely live WATCH items below without promoting them into work
   absent stronger evidence.

The next unresolved Program-hierarchy question is captured below as the
unscheduled **Elite Program Dominance Audit**. It is not Roadmap NEXT and does
not authorize calibration or implementation.

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

### Long-run Program hierarchy — CONFIRMED / ACCEPTANCE BLOCKER

A paired three-seed, 25-Season diagnostic compared the production Dynasty loop
with Dynamic Prestige against a tooling-only pre-8A baseline that held Prestige
static. By Season 25, Dynamic Prestige reduced Prestige standard deviation from
`13.3` to `9.3` and the top-to-bottom range from `55` to `38`; all `85+` and
`39-or-lower` Programs disappeared. It also reduced Team OVR standard deviation
from `4.00` static to `3.23` dynamic at that checkpoint and weakened premium
Recruit concentration and the Prestige/class-quality relationship.

The missing powerhouse ceiling is not primarily an 8A regression. Across 2,400
Program-Seasons per branch, static Prestige produced zero `90+` Team OVRs, only
22 `85+` occurrences, and a maximum of `89.25`; Dynamic Prestige produced zero,
24, and the same maximum. Both branches compressed sharply from the starting
Universe by Season 5. This is an existing mature talent-economy limitation that
Dynamic Prestige modestly worsens, while Dynamic Prestige independently erases
the reputation tails it is intended to make mobile rather than eliminate.

A follow-up static-Prestige talent trace located the main roster bottleneck.
Classes contain roughly 160 Recruits, including about 13 at `80+` OVR, 3–4 at
`85+` OVR, 24 at `85+` POT, and seven at `90+` POT. Recruiting can concentrate
about three premium Recruits in the best class and 7–8 across two classes. The
larger loss occurs during realization: among fully observed `85+` POT signees,
only `44–48%` reached `85` OVR, `8–11%` reached `90`, and average unused ceiling
at graduation was about `7.6` OVR points. Strong rosters did form, but senior
classes frequently owned 70–109 rotation minutes and their departure immediately
reduced Team OVR by roughly 2–5 points.

Team Strength is not concealing monster rosters. Its correlation with
rotation-weighted Player OVR was `0.995–0.996`, with only about a `0.2` point
average difference. A 90 Team OVR therefore requires nearly all 200 rotation
minutes to be supplied by roughly 90-level two-way contributors; five uniform
90 starters with 80-level backups produced only `88.45`. Treat the ceiling as a
Development-realization and elite-cohort-overlap issue first, with talent supply
and Recruiting dispersion secondary rather than absent.

A three-seed × 25-Season static-Prestige Development experiment compared the
production baseline with two narrow high-POT variants. Candidate A added at
most two annual opportunity points while `85+`/`90+` POT Players retained large
headroom. It raised `85+` POT average peak OVR from `81.08` to `82.73`, reduced
unused POT from `7.64` to `5.99`, increased `85+` Team occurrences from `22` to
`31`, and produced one two-Season `85+` run. Mature league Team OVR rose only
about `0.2–0.3`, SD and the weak tail remained intact, and recruiting classes
were exactly unchanged. Player variance also remained substantial: peak SD was
`6.73`, 25% of annual transitions still gained zero, and some `95+` POT Players
still graduated around 69 OVR.

Candidate A nevertheless did not restore the intended monster-roster tail: its
maximum was `89.52`, it produced no `90+` Team, and only three `88+`
Program-Seasons—the same count as baseline. Candidate B's probabilistic
`JR→SR` relief was too weak, leaving unused POT at `7.05`, producing 24 `85+`
Team occurrences, and retaining the baseline `89.25` maximum.

The final Candidate A+ experiment increased Candidate A's high-end opportunity
maximum from two to three points for `90+` POT Players with at least 12 points
of headroom. It improved the `90+` POT cohort's average peak from `84.77` to
`85.88`, reduced unused POT from `8.00` to `6.88`, and raised the share reaching
85/90 OVR from `58.2%`/`35.5%` to `64.5%`/`38.3%`. The additional realization
arrived mainly late: first attainment of 90 OVR was nearly unchanged through
the junior Season, while the senior share rose. That individual improvement did
not translate into stronger elite-roster overlap. Candidate A+ produced 32/3/0
`85+`/`88+`/`90+` Team occurrences versus Candidate A's 31/3/0, the same elite
run lengths, and only raised the maximum from `89.52` to `89.63`. Its mature
league Team mean was just `0.04` higher, with the same weak-Team floor and
slightly greater champion concentration.

Candidate A is therefore the accepted production Development model; Candidate
A+ is rejected as a meaningful improvement. Production parity reproduced every
recorded Candidate A headline metric exactly. The accepted static-Prestige
control has Season-25 Team OVR mean/SD/min/max/range of
`76.97`/`4.06`/`63.40`/`84.07`/`20.67`, 31/3/0 `85+`/`88+`/`90+` Team
occurrences, a `89.52` maximum, `0.608` adjacent-Season top-four retention, and
longest elite runs of 2/1/0 Seasons. Its three runs produced 14/15/14 unique
champions with leading shares of `16%`/`24%`/`20%`. This is now the control for
Dynamic Prestige validation. The narrow Development correction is **COMPLETE /
ACCEPTED / FROZEN**; do not create another variant from this result.

Do not tune Recruiting, Recruit generation, graduation, Rotation, or Team
Strength directly from these diagnostics. Static Prestige plus accepted
Development is production truth. No follow-up Prestige model is selected.

The focused expectation-relative comparison is now complete and the tested
candidate is **REJECTED**. A small QUICK screen selected rank-surprise bands of
`5 / 11 / 17` (deadband / two-point / three-point threshold) for the paired
three-seed × 25-Season run. Expected rank came from current Prestige's
league-relative position in the immutable starting distribution; regular-season
résumé rank plus the existing bounded Tournament floors supplied effective
actual rank. The candidate made `50.6%` of annual changes zero and hit `±3` in
only `3.6%`, but by Season 25 its pooled Prestige SD/range had fallen to
`8.87 / 44`, with no `85+` or `90+` Programs. Current 8A finished at
`9.76 / 45`, with four `85+` Programs; static remained `13.31 / 55`.

The candidate preserved the low tail better than current 8A (`5` Programs at
`45` or lower and `2` at `39` or lower, versus `2 / 0`) and retained meaningful
mobility (`17` ending observations at `+10`, one at `+20`, and eight at `-10`
across 96 seed/Program endings). It did not preserve the elite tail. Team
hierarchy stayed close to current 8A (28 `85+`, three `88+`, zero `90+` Team
occurrences; maximum `89.52`), Recruiting remained healthy but below static
concentration, and champion diversity remained broad (`11 / 16 / 16` unique
champions; leading shares `16% / 20% / 16%`). No lifecycle failure occurred.

The failure is structural rather than a need for more threshold search: the
highest starting tier maps to expected rank `#1`, so repeated credible top-eight
Seasons exert one-way downward pressure, while the lowest tier has mirrored
one-way upward pressure. A final wider `7 / 13 / 19` QUICK check only delayed
the problem; Great Lakes declined from `91` to `77` over 25 Seasons. Current
Prestige plus an expectation deadband is therefore **not enough memory under
this exact-rank mapping**. Do not promote the candidate or silently accept 8A.
This result does not identify a preferred successor.

A final 25-Season screen tested a three-Season rolling résumé with `3 / 2 / 1`
recency weights while retaining the expectation-relative `5 / 11 / 17` movement
rules. It also failed: Season-25 Prestige SD/range was `9.88 / 45`, no Program
remained at `85+`, and added inertia mainly delayed flagship decline. Great
Lakes moved `91 → 80` and Northbridge `88 → 73`; no Program moved `±20`.
Recruiting and lifecycle health remained valid. The candidate was rejected
without a multi-seed gate because it clearly missed the continuation thresholds.

Phase 8A is therefore **REJECTED / ROLLED BACK / DEFERRED**. The production
contract is static Prestige. Future work, only if explicitly selected, should
investigate the underlying Dynasty ecosystem and reconsider Prestige from first
principles without treating any rejected model as design guidance.

### Elite Program Dominance Audit — UNSCHEDULED DIAGNOSTIC

Central question:

> **Under static Prestige, does the simulation naturally produce durable elite
> Programs, meaningful weak Programs, powerhouse runs, and believable hierarchy
> turnover? If not, where does the causal chain first break?**

The audit exists to distinguish whether the rejected Dynamic Prestige models
were themselves the primary problem or whether an earlier part of the Dynasty
ecosystem does not consistently produce durable powerhouse performance. Neither
conclusion is presumed. The diagnostic should trace:

```text
Prestige → Recruiting outcomes → roster formation
→ Development / Player realization → Team Strength
→ game outcomes → Season résumé
```

The goal is to identify the first stage where expected Program hierarchy stops
translating into downstream advantage:

1. **Prestige → Recruiting:** measure premium and 5-star destinations;
   top-10/top-25/top-50 Recruit distribution; incoming class OVR, POT, and
   quality rank; elite Program premium-battle win/loss rates; and separation
   among elite, middle, and weak Prestige tiers. Do not presume Recruiting is
   underpowered.
2. **Recruiting → roster quality:** determine whether class advantages create
   sustained Team Strength/OVR rank, top-3/top-5/top-8 Player quality, starter
   quality, depth, and high-OVR Player counts. Trace graduation, roster turnover,
   and year-to-year strength volatility. Development is accepted/frozen; its
   downstream effects may be diagnosed without presuming revision.
3. **Team Strength → game outcomes:** measure favorite win rates for near-even,
   small, moderate, large, and extreme Strength gaps. Also inspect elite-versus-
   weak results, upset and blowout frequency, low-loss Season frequency, and
   whether clearly strong Teams experience excessive schedule-level variance.
   Do not presume Game Simulation creates too many upsets.
4. **Game outcomes → Season résumé:** compare records, Team Strength rank, and
   résumé rank; inspect schedule and Conference effects, Tournament qualification
   and seeding, and how often elite Teams produce top-5, top-10, and top-16
   résumés. Do not presume résumé logic is too harsh.

A useful longitudinal view would follow several initially elite, middle, and
weak Programs across many static-Prestige Seasons:

| Season | Recruit class rank | Incoming talent | Team Strength rank | Record | Résumé rank | Tournament result |
| ------ | -----------------: | --------------: | -----------------: | -----: | ----------: | ----------------- |
| N | — | — | — | — | — | — |

Named Programs may illustrate a causal pattern, but no conclusion should rest
on one Program. Interpretation should remain open to:

- **Recruiting bottleneck:** elite Prestige does not create sufficient talent advantage.
- **Roster/Development bottleneck:** recruiting advantage exists but does not
  become sustained roster strength.
- **Strength translation bottleneck:** roster advantage exists but Team Strength
  does not represent it sufficiently.
- **Game outcome bottleneck:** clearly stronger Teams lose too frequently.
- **Résumé bottleneck:** strong Seasons are not recognized appropriately.
- **No major bottleneck:** static-Prestige hierarchy is already plausible and
  the rejected Prestige models were the main issue.
- **Mixed/systemic result:** several smaller effects collectively limit durable hierarchy.

> Accepted/frozen systems may be **diagnosed** without being reopened.

Recruiting, Development, Team Strength, Game Simulation, résumé logic, and other
frozen systems become gameplay-change candidates only if audit evidence
specifically implicates them. Their presence in the causal chain schedules no
revision.

The product standard is a Dynasty capable of durable but replaceable elite
Programs, meaningful weak identities, multi-Season powerhouse runs, occasional
collapses and rebuilds, upward mobility, competitive and champion variety, and
understandable relationships among recruiting talent, roster quality, and
results. The audit would determine whether the current simulation already
supports those outcomes and, if not, why. No replacement Prestige model or
implementation work is selected.

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
