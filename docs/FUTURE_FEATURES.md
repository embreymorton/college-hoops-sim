# Future Features

This is an unscheduled, non-blocking idea bank. Inclusion is not commitment,
priority, or a date. Only deliberate selection in `ROADMAP.md` creates planned
work; this file never owns **NEXT**.

Selected Roadmap features receive at most a short pointer here. Completed
features are removed unless a genuinely future extension remains. Confirmed
defects/debt belong in `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`.

## Selected elsewhere

- **History & Recognition:** Season Archive / Yearbook, Records & Milestones,
  and Awards & Honors are selected under Phase 7C in `ROADMAP.md`.

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
- recruiting class rankings and retrospective class evaluation; and
- dynamic interest from winning or Tournament success.

These ideas would require explicit player-facing rules and, where they affect
attraction/AI/talent movement, fresh calibration. Their existence is not a
reason to retune accepted Recruiting now.

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

Records, Awards, and the initial Season Archive are already selected in Phase
7C; the ideas above are extensions, not expanded 7C scope by default.

## Tournament depth

- bracket-pool or spectator tools;
- bubble/selection-show presentation;
- historical bracket browsing;
- richer neutral-site presentation;
- Conference Tournament systems; and
- expanded fields or alternate formats only after deliberate product design.

## Roster and coaching depth

- manual canonical starters or role definitions with simulation meaning;
- redshirts, medical redshirts, and eligibility exceptions;
- injuries, fatigue, morale, chemistry, and discipline;
- transfers and early professional departures;
- coaching staffs, schemes, practices, and player-development choices;
- substitution patterns and rotation presets; and
- possession-level/live coaching.

These systems would materially change simulation or lifecycle behavior and need
their own selected phases and validation.

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

Program prestige could evolve visibly across a long Dynasty: sustained winning
may raise it and sustained failure may lower it, with gradual changes that keep
one Cinderella run from instantly creating an elite Program and one poor Season
from erasing an established power. Future design may consider wins/losses,
Conference performance, Tournament qualification and advancement,
championships, multi-Season recent performance, and existing/historical
prestige, but no formula or threshold is selected.

The key design decision is whether dynamic prestige begins as descriptive only
or also feeds systems such as Recruiting. Long-term success reasonably could
change Program attractiveness, but Recruiting effects and calibration remain
future decisions. Prestige could also influence job attractiveness and Coach-
career opportunities if that major system is later selected.

## Presentation and broader modes

- save/load and Dynasty management;
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
