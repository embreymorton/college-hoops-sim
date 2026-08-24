# Future Features

This is an unscheduled, non-blocking idea bank. Inclusion is not commitment,
priority, or a date. Only deliberate selection in `ROADMAP.md` creates planned
work; this file never owns **NEXT**.

Selected Roadmap features receive at most a short pointer here. Completed
features are removed unless a genuinely future extension remains. Confirmed
defects/debt belong in `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`.

## Selected elsewhere

- **History & Recognition:** Awards & Honors remains PLANNED under Phase 7C in
  `ROADMAP.md`; completed Yearbooks, Records, and Recruiting Class
  Retrospectives are production capabilities.

The Roadmap owns its order and scope. It is not specified again here.

## Recruiting depth

- campus visits and signing-day presentation;
- geography, home-state preference, and pipelines;
- facilities, NIL, staff/recruiting bonuses, and program resources;
- playing-time promises and depth-chart opportunity;
- deeper Recruit-specific preferences, as framed under Program Reputation and
  Recruit preferences below;
- a future, unscheduled scouting/uncertainty system that could replace exact
  numeric Recruit attributes, OVR/current ability, and/or Potential/upside with
  player-facing grades, bands, ranges, or similar estimates. Before any design
  or implementation, explicitly define what is known versus estimated or
  hidden; exact grade thresholds and scouting mechanics remain undecided, and
  current exact-value visibility remains unchanged;
- decommitments and transfer-portal interactions;
- recruiting class rankings and class grading/evaluation beyond the accepted
  factual retrospective; and
- dynamic interest from winning or Tournament success.

### Program Reputation and Recruit preferences

A future Recruiting evolution could let Recruits evaluate Program fit through
multiple characteristics rather than Prestige alone. Institutional Prestige
would remain the durable baseline for historical stature, brand, and structural
recruiting gravity, while a separate Program Reputation concept could represent
recent earned competitive standing. Other possible considerations include
playing opportunity, positional fit, current Team strength, Tournament
contention, development track record, role availability, and the existing
coach/relationship effort. Different Recruits could eventually value those
characteristics differently; no preference generation, weights, modifiers, or
battle formula is approved.

This direction could give a sustainably successful low-Prestige Program a
credible path into elite Recruiting battles without making it equally favored
to an established power or erasing institutional advantages. Prestige could
define a Program's natural recruiting neighborhood while Reputation and fit
could expand credible access, initial interest, or continued viability. The
product goal is upward mobility without league-wide flattening—not guaranteed
5-star access or a new balance fix.

### Recruiting assistance

Focus-slot assistance could also help when a commitment frees capacity while
other offered, uncommitted targets remain. A user-triggered `Fill Open Focus`, a
prompt, and automatic reallocation have materially different agency costs; none
is selected. Any assistant behavior must avoid silently making strategic
decisions for the user.

Recruiting battle feedback could communicate qualitative closeness—whether a
target is genuinely competitive, plausibly within reach, or a substantial
long shot—without exposing exact hidden relationship scores or reducing
Recruiting to deterministic arithmetic. Labels, thresholds, information timing,
and eligibility for such feedback require design; this is decision-support UX,
not a selected calibration project.

High-school statistics remain model-undefined because no canonical high-school
season is simulated. If revisited, decide whether displayed values are scouting
context, attribute-derived estimates, competition-adjusted production, or
intentional uncertainty before treating them as facts.

### Recruiting signing stories and history

Finalized Recruiting history could carry more of a Recruit's canonical signing
story into later Player Details: national/position rank, commitment round, final
standing, and notable competing Programs or relationship context when those
facts are actually preserved. This would strengthen Recruit → Player identity
and long-term attachment without fabricating period-by-period history or
changing Recruiting mechanics.

## Player and statistical depth

### Recruit V2 Six-Tier Semantic Alignment — deferred / unscheduled

S0 now uses accepted six-tier ceiling semantics that distinguish High `85–89`
from Very High `90–94`. A future focused question may consider whether Recruit
Talent Profile V2 should formally adopt that finer semantic hierarchy. This is
not a finding that current Recruit output is unhealthy, does not reopen its
probabilities or Candidate B, and is not NEXT. Existing Recruit outputs may
already be classified into the six tiers for diagnostic comparison without
changing generation behavior.

### Player Identity V2 — Profiles, Tendencies & Cross-Position Variety — FUTURE / UNSCHEDULED

Current Player generation, positional OVR, Development, statistical
translation, and Game Simulation remain authoritative and frozen. Prior profile-
redistribution experiments remain historical evidence rather than production,
and the rejected OVR-weighting candidate remains rejected—not a design awaiting
another tuning pass. Full evidence and reopening criteria live in
`PLAYER_IDENTITY_RESEARCH.md`; recording this restructured direction does not
reopen that parked boundary.

Future investigation could treat Player identity as modular layers—generation →
attribute profile → positional valuation → statistical translation →
Development—rather than changing them together. **Position should describe what
is common, not what is possible:** conventional PG, wing, forward, and Center
populations should remain dominant, while rare believable exceptions such as a
6'9" jumbo creator, rebounding PG, passing Center, point forward, stretch big,
or elite specialist with meaningful weaknesses can occasionally emerge. These
are north-star cases, not quotas or guaranteed archetypes.

A profile-first generation experiment could combine talent, listed position,
and rare profile variation to create stronger internal shape and clearer
strengths/weaknesses. Possible families include distributors, scoring/two-way or
jumbo guards; shooters, slashers, point forwards, and defensive wings; and
interior scorers, stretch bigs, rebounders, rim protectors, or passing bigs.
Listed-position size distributions should remain strongly correlated while
allowing rare physical exceptions. No profile templates, probabilities, height
ranges, stored archetype labels, or Player-schema changes are approved.

A later investigation could distinguish ability from behavior: ratings describe
what a Player can do, while possible tendencies describe how he chooses to play.
Usage/scoring aggression, passing, perimeter/rim preference, rebounding, or
defensive aggression are conceptual examples only. Statistical translation
could then combine positional/role priors with ability, behavior, and usage so
exceptional Players can occasionally overcome positional ceilings—a Center can
lead in assists or a guard in rebounds—without erasing normal basketball
distributions. Derived role descriptors such as Point Forward, Passing Big, or
3&D Wing are optional presentation possibilities, not assumed canonical state.

SF versatility remains a focused question: broad all-around profiles may be
valid, but future generation could test whether creator, scorer, 3&D, stopper,
point-forward, and combo-forward shapes produce more distinct identity. Work
should begin with profiles and resulting behavior, then ask whether Development
preserves relative strengths and weaknesses. Only after that evidence should it
ask whether OVR materially misvalues unusual Players; a broad OVR rewrite is not
the starting point and may be unnecessary.

Player Identity V2 could define **who Players are**, while the independent Game
Simulation V2 concept could someday let them **play like who they are** through
possession-level actions and usage. Neither requires or schedules the other.
Any future experiment must preserve rare-profile rarity, healthy elite-OVR and
Team-strength distributions, Recruiting interpretation, accepted statistical
balance, and downstream OVR meaning. Population-level effects—not only handmade
unicorn cases—would be required evidence before acceptance.

### Postseason and combined statistics

- postseason Player totals, averages, leaders, and game logs;
- combined regular-season + Tournament statistics;
- postseason Team statistics; and
- explicit Tournament résumés and signature games.

Current Former Player career aggregation, Career Highs, Dynasty Records, and
Program Player Records are regular-season-only. These future projections should
reuse retained Tournament `PlayerGameStats` through one coordinated statistical
scope expansion without changing current regular-season semantics piecemeal.

### Additional leader views

- shooting percentage with minimum-attempt qualification;
- three-pointers, minutes, efficiency, and class/position filters;
- Conference and freshman leaderboards.

### Record chase and milestone watch

Existing current and historical statistics could make Records active in-season
stories: distance from a Program career or single-season mark, movement into a
top group, and newly broken milestones surfaced through News or another quiet
narrative surface. Any projection must reuse accepted record definitions and
statistical scopes rather than introduce parallel counters or silently combine
regular-season and Tournament production.

## History and immersion beyond selected work

### Historical Explosive Offseason recognition

Current V1 retains official Explosion facts only during the active offseason.
If durable lifecycle-event history is deliberately added later, Career
Progression, Player history, Yearbooks, News, or records could recognize those
events. Until then, historical recognition must not be inferred from raw OVR
deltas. Work Ethic remains stable; progression or regression of that trait is
not part of this idea.

- broad Program Alumni browser and global historical Player search;
- Program rivalries, banners, and history beyond the accepted compact Dynasty
  résumé;
- signature games and player-facing Tournament career summaries;
- polls/rankings and richer résumé context;
- richer broadcast-style story packages beyond the accepted Yearbooks; and
- Conference history and Tournament records.

The initial Season Archive and Records are complete; Awards remains PLANNED in
Phase 7C. The ideas above are extensions, not expanded 7C scope by default.

### Program signature games and memorable moments

Program history could preserve defining games and performances—such as a
#16-over-#1 Tournament upset led by a 29-point Player performance—separately
from statistical leaderboards. Records answer “what are the best statistical
marks?”; signature moments would answer “what games and performances defined
this Program's Dynasty?” Event selection and scoring remain deliberately
undefined. A future code-informed design should first determine what canonical
Tournament, GameResult, and box-score history is retained.

### Program legends / notable alumni

Program Legacy could eventually connect memorable graduated Players to the
Programs where their careers mattered, using notable alumni or Program-specific
historical recognition. Manual play produced attachment to a developed star, a
career rebounding/blocking contributor, and the scorer associated with a major
upset. This does not imply a Hall of Fame, retired numbers, Awards, or a broader
Program alumni-recognition system; those remain distinct possible extensions.

### Senior sendoff and career recap

Departures could give seniors a stronger legacy moment derived from preserved
career facts such as years with the Program, career production, entry/peak/final
OVR, Career Highs, Program Records, Tournament moments, Recruiting origin, and
official lifecycle events where history supports them. This would deepen the
emotional conclusion of a Player era without changing departure eligibility,
inventing Honors, or altering offseason lifecycle mechanics.

### Dynasty series history

Repeated matchups between the controlled Program and another Program could be
summarized from retained regular-season and Tournament results: all-time Dynasty
series record, useful home/away splits, latest result, and Tournament meetings.
This should remain a pure historical projection unless a separately designed
future Rivalry system deliberately adds canonical state or gameplay effects.

## Tournament depth

- bracket-pool or spectator tools;
- richer neutral-site presentation;
- Conference Tournament systems; and
- expanded fields or alternate formats only after deliberate product design.

### Bracketology and Bubble Watch

An in-season “if the Season ended today” outlook could make late games' visible
postseason stakes clearer through a provisional field, projected automatic and
at-large positions, a cut line, and first teams out. The real Tournament
selector, seeding, résumé logic, standings, and results remain authoritative; a
future version should be a separate pure projection over partial-season facts,
with exact projection rules deliberately left for later design rather than fake
probabilities.

## Roster and coaching depth

- **Future Offseason Mechanics:** the accepted six-stage experience is complete
  and is not future work. Its durable presentation container could later host
  separately designed Transfer Portal, Draft/professional departure decisions,
  position changes, staff/coaching decisions, or deeper roster-management
  steps, but none is implied by V1. Rules remain deliberately
  undefined and no direction is selected. Do not build it solely to change
  mature hierarchy; the rejected compression experiments remain conditional-read
  evidence in `DYNASTY_HIERARCHY_RESEARCH.md`.
- manual canonical starters or role definitions with simulation meaning;
- redshirts, medical redshirts, and eligibility exceptions;
- injuries, fatigue, morale, chemistry, and discipline;
- transfers and early professional departures;
- coaching staffs, schemes, practices, and player-development choices;
- substitution patterns and rotation presets; and
- possession-level/live coaching.

These systems would materially change simulation or lifecycle behavior and need
their own selected phases and validation.

### Position changes and positional roster flexibility

Future roster/coaching depth could explore position changes or broader rules
for how incoming Players occupy roster openings. Exact-position scarcity can
produce engaging choices, so one contested natural-C opening is not evidence
that current construction is defective. Any flexibility design must consider
Recruiting capacity, Rotation positional eligibility, roster lifecycle, and
Team Strength/lineup semantics together rather than loosening only one boundary.

### Next Season roster planner

A Program-level planning view could connect returning Players, departing
seniors, current commitments, likely positional openings, and factual depth for
the next Season while Recruiting remains active. It should build on Next Season
Position Outlook, canonical roster/commitment facts, OVR/POT, Rotation concepts,
and roster-size constraints. A first version should favor factual construction
context—and at most a clearly factual projected lineup—over hidden recommendation
scores, automatic roster decisions, or Recruiting-mechanics changes.

### Game Plan V1 / tactical coaching

Game Prep could eventually extend from **who plays** into a few meaningful
**how we play** choices, such as Slow/Balanced/Fast pace and
Inside/Balanced/Perimeter offense, with later defensive concepts possible.
Choices should make Matchup Scout information actionable through real
roster-dependent tradeoffs rather than simple buffs. This is a major gameplay-
system extension that deliberately touches frozen Game Simulation semantics and
therefore requires a separately selected focused design and simulation
investigation; formulas remain undefined here. The possession-based Game
Simulation V2 concept below is one possible deeper foundation, not a prerequisite
or selected dependency.

### Playing time influencing Development

Playing opportunity could someday affect offseason Development, giving Rotation
choices longer-term consequences. This is a gameplay-system concept only:
stars could become self-reinforcing, maximum-minute strategies could become
obviously optimal, bench-development tradeoffs would need careful design, and
injuries, fatigue, or other counterweights might matter. Development V1 is
accepted and frozen and should not be reopened from this single playthrough.

### Draft and professional outcomes

Graduating Players could receive draft or professional destination/history
outcomes that extend their legacy beyond college. This is a major future system,
not a small Alumni enhancement: one-and-done careers, early entry, eligibility,
AI roster consequences, recruiting and roster turnover, prospect evaluation,
and league balance all become design and simulation concerns. No version of
that lifecycle is selected.

## Game Simulation V2 — Possession-Based Simulation — FUTURE / UNSCHEDULED

The accepted and frozen aggregate Game Simulation V1 remains authoritative
production behavior and appropriate for the current product. A possible
long-term V2 could explore an abstract possession/event-driven engine in which
shots, turnovers, fouls, rebounds, and continuations create the final score and
Player box score rather than Player statistics being allocated after an
aggregate result. This is an architectural ceiling for deeper interaction and
immersion, not evidence that V1 is broken or a decision to replace it.

A possession foundation could allow FGA/FGM, three-pointers, free throws,
points, assists, turnovers, steals, blocks, and offensive/defensive rebounds to
emerge from simulated events. It could make Player attributes produce more
recognizable styles and eventually connect Matchup Scout → Game Plan → actual
possessions through scoring options, pace, offensive emphasis, and defensive
focus. Exact possession, usage, attribute, tactic, lineup, and AI formulas are
deliberately undefined.

Canonical game events could support trustworthy play-by-play, Watch Game and
partial-sim experiences, plus factual game-winning shots, buzzer beaters,
comebacks, largest leads, and decisive defensive plays. Those moments could
later feed News, Yearbooks, careers, Program history, Records/Milestones, Senior
Sendoff, and Tournament recaps because presentation would describe what the
simulation actually generated rather than reconstruct a story afterward. No
event schema, live-game interface, wording, or persistence policy is selected.

The accepted Rotation could potentially supply deterministic lineup windows
without requiring an initial substitution-management rewrite. Overtime, foul
trouble, fatigue, tactical substitutions, and literal playbooks remain optional
later complexity rather than first-version assumptions. AI Programs would need
deterministic plans derived from their roster and matchup so user tactics do not
create a structural advantage.

V2 would be high-risk/high-reward calibration work: possession count, shot and
usage distributions, shooting, free throws, turnovers, steals, blocks,
rebounds, assists, scoring, favorite/upset rates, and Tournament behavior all
interact. It must preserve game-scoped deterministic replay—identical canonical
inputs and seed produce the same result and event sequence—and remain performant
at league scale. Architecture would also need to distinguish internal simulation
events from persisted history; selectively retaining controlled, Tournament, or
notable-game logs is one possibility, not an approved storage policy.

A safe future investigation could keep V1 in production while running an
experimental V2 beside it on identical Team/Rotation inputs, comparing scores,
variance, home advantage, favorite/upset rates, Player statistics, shooting
splits, and Tournament behavior. A conceptual progression could examine a
possession skeleton, then Player attribution, Rotation/lineup integration,
coaching tactics, and finally play-by-play/Watch Game. These are investigation
stages, not Roadmap phases, gates, or a commitment to a monolithic rewrite; V2
would need to earn acceptance before any production migration.

## Coach Career & Dynasty Identity

### Create a Coach

An identity-focused Dynasty setup could establish a persistent Coach rather
than representing the user only as the controller of one Program. A first
version could retain Coach name, current Program, seasons coached, career
record, Tournament appearances, championships, and school-by-school history.
Coach attributes, skill trees, perks, RPG-style ratings, and balance effects
remain separate design questions rather than requirements for identity V1.

### Coach Career / Job Market

A larger career system could build on—but need not ship with—Create a Coach:
job offers and a job market, accepting or rejecting opportunities, movement
between Programs, career progression from lower- to higher-prestige jobs,
school-by-school coaching history, and Coach legacy. Hot-seat and firing systems
would be later extensions.

This is substantially larger than Create a Coach because the user-controlled
Program would need to become mutable across a Dynasty career. Hiring AI,
offer probabilities, firing rules, Coach attributes, and progression mechanics
all require separate design before implementation.

## Custom Universe & Replayability

### Create / customize a school

A bounded first version should customize or replace an existing Program slot
inside the current fixed universe structure. Editable canonical metadata could
include Program name, abbreviation, city/state, primary and secondary colors,
structurally valid Conference assignment, starting prestige, and other metadata
already supported by the Program model.

This does not require arbitrary Program/Conference counts, rewritten schedule
generation, different Conference sizes, or custom Tournament sizing. Those are
larger custom-universe extensions.

### Spreadsheet / CSV Program import

A first import workflow should favor CSV Program metadata so files remain easy
to author in Excel or Google Sheets while parsing and validation stay simple.
Potential fields include Program name, abbreviation, city/state, Conference,
colors, starting prestige, and other canonical Program metadata. Existing game
systems should continue generating Players, Recruits, schedules, and results;
V1 should not imply imported rosters, ratings, Recruiting classes, schedules,
or history. Native `.xlsx` support could follow only if useful.

Longer-term extensions may include importable/exportable league templates,
shared custom universes, expanded Conference customization, additional or
generated Programs/Conferences, configurable schedules, and variable league
structures. These must preserve stable identity, validation, deterministic
generation, and generic engine boundaries.

## Dynamic Program World

### Evolving Program prestige

Phase 8A's mutable Dynamic Prestige implementation remains rejected and rolled
back, not awaiting another tuning pass. Directly raising or lowering
institutional Prestige from recent results compressed hierarchy and weakened
long-run differentiation. Static Prestige remains current production truth, and
the completed hierarchy/compression investigation remains closed; its evidence
and reopening criteria live in `DYNASTY_HIERARCHY_RESEARCH.md`.

### Program Reputation — distinct future reframing

A separate future Reputation system could represent what a Program has earned
through a sustained competitive era while leaving institutional Prestige
static. Conceptually, **Prestige is enduring institutional stature; Reputation
is recent earned competitive standing**. Sustained winning, Conference success,
Tournament appearances and runs, championships, strong rosters, or prolonged
decline are possible future inputs, but no formula, window, decay, thresholds,
tiers, UI, or canonical-state design is approved. Reputation should change
gradually enough to represent eras rather than isolated Seasons.

This split could let the world recognize that a Pine Valley has built something
real while preserving the inertia and advantages of established powers. If ever
selected, the product questions are whether sustained success earns meaningful
recognition and Recruiting access, established Programs retain institutional
identity, competitive eras emerge, and league differentiation remains healthy.
That last concern is a guardrail, not a hierarchy-compression justification.
This is neither restored Dynamic Prestige nor permission to reopen frozen
Prestige or Recruiting behavior.

## Presentation and broader modes

- save/load and Dynasty management;
- accessibility and localization expansion;
- spectator / League Observer mode;
- richer responsive/mobile navigation;
- optional presentation themes; and
- export/share tools for Seasons, brackets, and careers.

### Nonconference showcase choices

Instead of a large manual schedule editor, a future preseason decision could let
the coach choose one meaningful nonconference matchup profile—safer,
competitive, or marquee—to create authored risk/reward and Season stories.
Because schedule generation is deterministic and accepted, any selected design
would need to treat determinism, records, Tournament résumé effects, and Program
context together; no exact schedule-generation change is implied.

### Games to watch / round spotlight

League presentation could derive a small set of notable upcoming games from
public facts such as conference position, overall record, recent form/streaks,
Team Strength, rematches, and consequential late-Season matchups. It should not
create canonical importance state or affect simulation; any design should use
understandable deterministic reasons for each spotlight.

## Cross-system visibility — future design lens

A useful future direction may be to make existing systems interlock more
visibly: results into postseason stakes, Recruiting into roster planning and
Player identity, statistics into Record chases, scouting into tactical choices,
careers into sendoffs, and scheduling into Season stakes. This is a design lens,
not a Roadmap commitment, required bundle, or implied sequence.

## Rough scope character — non-authoritative

- **Lower-risk / incremental:** Create a Coach identity-only V1.
- **Medium-scope:** Create/Customize School within the fixed structure; CSV
  Program metadata import.
- **Major future systems:** Coach Career/job market, changing controlled
  Programs, hot-seat/firing behavior, variable-size custom universes, and a
  Program Reputation + Recruit-preferences evolution; Game Simulation V2 is a
  separate high-risk architectural exploration beyond ordinary feature scope.
  Player Identity V2 is likewise a parked, cross-system investigation rather
  than an ordinary ratings tweak.

These labels describe likely implementation risk only. They do not assign
priority, phase numbers, deadlines, or Roadmap sequence.
