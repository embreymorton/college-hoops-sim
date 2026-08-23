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
- personality and deeper Recruit preferences;
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

### Recruiting assistance

Focus-slot assistance could also help when a commitment frees capacity while
other offered, uncommitted targets remain. A user-triggered `Fill Open Focus`, a
prompt, and automatic reallocation have materially different agency costs; none
is selected. Any assistant behavior must avoid silently making strategic
decisions for the user.

`Fill Remaining Board` is useful, but a large assistant-added group can obscure
the targets the player chose manually. A future Board organization pass could
distinguish target provenance through grouping, tags, or filtering—conceptually
`My Targets` and `Assistant Suggestions`—without changing capacity, eligibility,
or Fill Remaining selection behavior. The exact presentation is undecided.

Board cleanup could also offer a deliberate way to remove or hide Recruits who
committed elsewhere. Manual bulk `Clear Unavailable`, filtering, and a grouped
unavailable section preserve different amounts of history and agency; none is
selected, and automatic removal is not assumed preferable.

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

## Player and statistical depth

### Player Identity / statistical variety — PARKED

Rare cross-position identities, Development identity retention, Passing/Steals
translation, and profile labels remain ideas rather than selected work. No
Player Identity phase is scheduled. Canonical generation and OVR remain active;
full historical evidence and reopening criteria live in
`PLAYER_IDENTITY_RESEARCH.md`.

### Postseason and combined statistics

- postseason Player totals, averages, leaders, and game logs;
- combined regular-season + Tournament statistics;
- postseason Team statistics; and
- explicit Tournament résumés and signature games.

Current Former Player career aggregation is regular-season-only. These future
projections should reuse retained Tournament `PlayerGameStats` without changing
current regular-season semantics.

### Additional leader views

- shooting percentage with minimum-attempt qualification;
- three-pointers, minutes, efficiency, and class/position filters;
- Conference and freshman leaderboards.

### Player personal bests / career highs

Player Details could derive PTS/REB/AST/STL/BLK single-game highs with opponent
and game context from retained results. This would be historical presentation,
not mutable achievement or milestone state. Whether the scope is regular-season
only or includes Tournament games remains deliberately undecided because current
career-history aggregation is regular-season-only. Long manual play strengthened
the motivation: a 40-point game felt immediately worth “immortalizing,” while a
59-point historical Record Book discovery remained enjoyable many Seasons later.

### Program record extensions

Program/Team Details could derive Program-specific single-game, Season, and
career records from retained history so memorable performances remain attached
to the school where they happened. This would complement the existing global
Dynasty Record Book and the separate, deliberately undefined signature-games
concept; it need not create mutable record or achievement state.

## History and immersion beyond selected work

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
upset. This does not imply a Hall of Fame, retired numbers, Awards, or separate
Program Record Books; those remain distinct possible extensions.

### Dynasty series history

Repeated matchups between the controlled Program and another Program could be
summarized from retained regular-season and Tournament results: all-time Dynasty
series record, useful home/away splits, latest result, and Tournament meetings.
This should remain a pure historical projection unless a separately designed
future Rivalry system deliberately adds canonical state or gameplay effects.

## Tournament depth

- bracket-pool or spectator tools;
- bubble/selection-show presentation;
- richer neutral-site presentation;
- Conference Tournament systems; and
- expanded fields or alternate formats only after deliberate product design.

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

Dynamic Program Prestige remains an unscheduled world-evolution concept after
Phase 8A was rejected and rolled back. It should be considered only for its own
player value, not as a hierarchy fix; retaining static Prestige remains valid.
Rejected models and reopening evidence live in
`DYNASTY_HIERARCHY_RESEARCH.md`. Long Pine Valley play raises a narrower future
product question—whether sustained résumé success at a difficult rebuild should
create an appropriate sense of structural progress—but modest results, low-seed
bids, and short Tournament runs do not establish that Prestige is broken or
satisfy the existing reopening criteria.

## Presentation and broader modes

- save/load and Dynasty management;
- accessibility and localization expansion;
- spectator / League Observer mode;
- richer responsive/mobile navigation;
- optional presentation themes; and
- export/share tools for Seasons, brackets, and careers.

### Games to watch / round spotlight

League presentation could derive a small set of notable upcoming games from
public facts such as conference position, overall record, recent form/streaks,
Team Strength, rematches, and consequential late-Season matchups. It should not
create canonical importance state or affect simulation; any design should use
understandable deterministic reasons for each spotlight.

## Rough scope character — non-authoritative

- **Lower-risk / incremental:** Create a Coach identity-only V1.
- **Medium-scope:** Create/Customize School within the fixed structure; CSV
  Program metadata import; dynamic Program prestige.
- **Major future systems:** Coach Career/job market, changing controlled
  Programs, hot-seat/firing behavior, and variable-size custom universes.

These labels describe likely implementation risk only. They do not assign
priority, phase numbers, deadlines, or Roadmap sequence.
