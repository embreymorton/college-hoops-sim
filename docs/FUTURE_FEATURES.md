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

### Recruiting battle feedback and assistance

Future Recruiting presentation could give qualitative distance-to-leader
feedback for contested targets—enough to distinguish a close battle from a long
shot without necessarily exposing exact hidden scores or eliminating
uncertainty. The player-facing language, information boundary, and derivation
must be designed from current Recruiting architecture before implementation.

Focus-slot assistance could also help when a commitment frees capacity while
other offered, uncommitted targets remain. A user-triggered `Fill Open Focus`, a
prompt, and automatic reallocation have materially different agency costs; none
is selected. Any assistant behavior must avoid silently making strategic
decisions for the user.

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
- Conference and freshman leaderboards; and
- historical Season leaderboards once an archive experience exists.

## History and immersion beyond selected work

- broad Program Alumni browser and global historical Player search;
- richer Program history, rivalries, and banners;
- signature games and player-facing Tournament career summaries;
- polls/rankings and richer résumé context;
- broadcast-style story packages and Season retrospectives;
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

## Tournament depth

- bracket-pool or spectator tools;
- bubble/selection-show presentation;
- historical bracket browsing;
- richer neutral-site presentation;
- Conference Tournament systems; and
- expanded fields or alternate formats only after deliberate product design.

## Roster and coaching depth

- **Offseason roster management:** an unscheduled feature family that could add
  player-valued offseason decisions, transfers, early departures, or roster
  roles. Its rules remain deliberately undefined and no direction is selected.
  Do not build it solely to change mature hierarchy; the rejected compression
  experiments live in `DYNASTY_HIERARCHY_RESEARCH.md`.
- manual canonical starters or role definitions with simulation meaning;
- redshirts, medical redshirts, and eligibility exceptions;
- injuries, fatigue, morale, chemistry, and discipline;
- transfers and early professional departures;
- coaching staffs, schemes, practices, and player-development choices;
- substitution patterns and rotation presets; and
- possession-level/live coaching.

These systems would materially change simulation or lifecycle behavior and need
their own selected phases and validation.

### Rotation locks and assistant repair

A coaching-assistance concept could let the user lock a small number of
intentional minute assignments, then ask the existing assistant/default
Rotation behavior to construct a valid remainder around them where possible.
This mirrors Recruiting's useful pattern of manual priorities followed by
`Fill Remaining`, without selecting a final interaction or algorithm.

A smaller related action could attempt to repair an invalid manual Rotation
while preserving valid intentional choices instead of resetting everything.
Treat this as part of the same design family unless code inspection establishes
a meaningfully independent, lower-scope contract.

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

### Dynasty seed input and display

The simulation is already deterministic. A relatively low-risk setup extension
could allow a user-entered Dynasty seed, generate one when the field is blank,
display the active seed somewhere discoverable, and support copying/sharing it
to replay the same generated universe with another Program. Replayability is
expected only within a compatible simulation/game version; later generation or
simulation changes may produce different results from an older seed. This does
not imply a save/version-migration system or prescribe the exact seed UI.

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
`DYNASTY_HIERARCHY_RESEARCH.md`.

## Presentation and broader modes

- save/load and Dynasty management;
- League-tab Team/Program header consistency with the established Season,
  Coaching, and Recruiting surfaces, without inventing content solely to fill a
  header;
- accessibility and localization expansion;
- spectator / League Observer mode;
- richer responsive/mobile navigation;
- optional presentation themes; and
- export/share tools for Seasons, brackets, and careers.

## Rough scope character — non-authoritative

- **Lower-risk / incremental:** visible and user-enterable Dynasty seed; Create
  a Coach identity-only V1.
- **Medium-scope:** Create/Customize School within the fixed structure; CSV
  Program metadata import; visible/dynamic Program prestige.
- **Major future systems:** Coach Career/job market, changing controlled
  Programs, hot-seat/firing behavior, and variable-size custom universes.

These labels describe likely implementation risk only. They do not assign
priority, phase numbers, deadlines, or Roadmap sequence.
