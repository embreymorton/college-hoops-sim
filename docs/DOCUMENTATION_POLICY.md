# Documentation Policy V1

> **Documentation is event-driven, not periodically synchronized.**

Implementation or diagnostic work should follow this lifecycle:

```text
implementation / diagnostic
→ validation
→ acceptance decision
→ targeted documentation update
```

Each accepted milestone updates only the documents whose source-of-truth facts
changed. Broad documentation reconciliation is not the default.

The Final Documentation Cohesion + Fresh-Context Handoff V1 reconciliation is
complete. Do not schedule repeated documentation-sync milestones; normal future
work follows this policy's targeted acceptance updates.

## Ownership matrix

| Document | Owns | Update when | Do not use for |
| --- | --- | --- | --- |
| `README.md` | Concise project overview and major playable capability | Player-facing capability or overall project status materially changes; entry path changes | Milestone internals, diagnostic history, exact constants, backlogs |
| `docs/CURRENT_STATE.md` | Current production truth, frozen boundaries, live WATCH summary, and a concise mirror of the Roadmap planning checkpoint | Accepted truth/freeze changes or Roadmap NEXT/open-checkpoint status changes | History, acceptance chronology, experiment details |
| `docs/ROADMAP.md` | The authoritative NEXT when one is selected, later PLANNED work, open-checkpoint status, and compact completion status | Milestone accepted, reordered, selected, cancelled, or deferred | Implementation detail, research notebooks, acceptance logs |
| `docs/PLAYTESTING.md` | Current priorities, live WATCH items, active empirical evidence, and concise recent acceptance evidence | Current observation, priority evidence, watchpoint, or narrative acceptance changes | Product sequencing, closed-history bulk, experiment mechanics |
| `docs/PLAYTESTING_ARCHIVE.md` | Conditional-read closed playtesting evidence and causal history | Closed evidence no longer affects current planning but remains useful | Current priorities, NEXT, normal session reading |
| `docs/CALIBRATION.md` | How tuning and validation are performed | Methodology, presets, audits, comparison, parallelism, or acceptance process changes | Current balance constants |
| `docs/SIMULATION.md` | Accepted production formulas, constants, invariants, and validated calibration results | Production simulation behavior is accepted | Candidate formulas, failed experiments, diagnostic-only alternatives |
| `docs/GAME_DESIGN.md` | Accepted player-facing rules and control semantics | Accepted gameplay behavior changes | Implementation internals |
| `docs/ARCHITECTURE.md` | Canonical boundaries, ownership, representations, lifecycle architecture | Accepted ownership, representation, boundary, or orchestration changes | Temporary migration scaffolding unless it becomes lasting architecture |
| `docs/UI_DESIGN.md` | Accepted UI patterns and deliberately selected near-term visual direction | Major UI pattern accepted; repeated evidence selects a UX direction; navigation hierarchy changes | Every one-off visual complaint |
| `docs/KNOWN_ISSUES_AND_OPTIMIZATIONS.md` | Confirmed unresolved defects, debt, measured risks, validated watchpoints | Issue/risk confirmed, resolved, or superseded | Feature backlog or unverified playtest notes |
| `docs/FUTURE_FEATURES.md` | Unscheduled, non-blocking idea bank | Deferred idea added, implemented, abandoned, or deliberately selected elsewhere | Priority order |
| `docs/PLAYER_IDENTITY_RESEARCH.md` | Historical/parked Player Identity experiments, evidence, and reopening criteria | Only when deliberately reopening or adding evidence to that research | Production truth or normal feature-session reading |
| `docs/DYNASTY_HIERARCHY_RESEARCH.md` | Decision-complete Dynasty hierarchy/compression evidence, rejected experiments, and reopening criteria | Only when deliberately reopening hierarchy research, when a future feature materially changes the talent economy, or when its history is specifically needed | Production truth, active tuning, or normal feature-session reading |
| `docs/COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md` | How assistants reason, validate, prompt, and hand off work | Process, prompting, validation philosophy, or documentation governance changes | Current product state |

`CURRENT_STATE.md` is curated and replaced, not append-only. `PLAYTESTING.md`
is an active front door; detailed closed causal history moves to
`PLAYTESTING_ARCHIVE.md` when it begins to obscure current evidence. Large
topic-specific research belongs in its dedicated conditional-read owner rather
than being duplicated across front-door or general archive documents.

## Sequencing authority

Only `ROADMAP.md` owns **NEXT** and **PLANNED** sequencing.

- **NEXT** means the immediate milestone explicitly selected by the user. There
  may be at most one, and there is no requirement that one always exist.
- **PLANNED** means valid future work, not an automatic commitment to immediate
  priority.
- **OPEN PLANNING CHECKPOINT** means accepted work has closed and no successor
  is explicitly selected. Roadmap intentionally has no NEXT; Current State
  mirrors that condition instead of creating a separate priority list.
- `CURRENT_STATE.md` mirrors the concise Roadmap checkpoint: its exact NEXT when
  present, or `No NEXT selected — Open Planning Checkpoint` when absent.
- `PLAYTESTING.md` supplies evidence and priorities but never selects NEXT.
- `FUTURE_FEATURES.md` contains unscheduled ideas and never uses NEXT.
- research/archive documents never select product sequencing.

Planning can change Roadmap sequence only when the user explicitly chooses a
sequencing decision. An assistant recommendation is not a selection. Informal
interest, document order, phase number, the nearest PLANNED item, Playtesting
priority, Future Features, and historical experimental momentum do not select
work. If the user's intent is ambiguous, leave NEXT unchanged or unset.

Explicit selection and production acceptance are different documentation
moments. After the user selects a candidate, `ROADMAP.md` and the matching
planning mirror in `CURRENT_STATE.md` may update immediately because they record
**sequencing authority**, not accepted production semantics. This normally
converts future fresh sessions from Path B to Path A. If the user explicitly
defers documentation, the workstream is selected only in the current session;
a fresh chat remains Path B until those front doors are synchronized. See the
Operating Guide's **Path B → Path A after explicit user selection**.

Production owner docs still wait for implementation, validation, and required
user acceptance. A NEXT-selection update must not pre-document proposed
simulation, architecture, UI, or game-design semantics as current truth.

The supported selection flow is:

```text
Open Planning Checkpoint → fresh planning → assistant recommendation
→ user discussion → explicit user selection → Roadmap update → authoritative NEXT
```

## Anti-bloat and conditional-read rules

- **Current State:** if text mainly answers “how did we get here?”, move it.
  If the file grows materially beyond roughly 200–250 lines, audit ownership
  before adding more.
- **Roadmap:** completed milestones normally need only a status and 1–3 durable
  outcome bullets. Formulas, helpers, gates, samples, and acceptance chronology
  belong elsewhere.
- **Playtesting:** keep priorities and live WATCH items near the top. Archive
  closed evidence when it pushes current evidence down.
- **Future Features:** do not duplicate a selected Roadmap specification or a
  completed feature.
- **Research:** use descriptive experiment names, not product-phase numbering,
  unless the experiment is itself a selected Roadmap milestone.

When completed or parked research overwhelms Current State, Roadmap, or active
Playtesting, extract it to a conditional-read research/archive document. Active
docs retain only status, relevant conclusion, and a link; evidence is preserved.

## Playtest Note Synthesis

Raw user playtest notes are evidence inputs, not documentation-ready prose.
Analyze them in conversation first, then extract:

- what worked or confused the user;
- what changed user behavior or created attachment;
- what repeated and may indicate a systemic issue;
- what was only an isolated anecdote; and
- what is WORKING, OBSERVED, WATCH, CONFIRMED/DEFECT, RESOLVED, or a FUTURE
  IDEA.

The default transformation is:

```text
raw playthrough anecdotes → product evidence/pattern → concise documentation
```

Do not maintain a chronological diary of every Player, Recruit, Program, score,
or performance. Not every playtest session requires a documentation update; if
no durable/current evidence changed, `Documentation: none required` is valid.

### Selective named examples

Preserve a specific Player, Recruit, Program, or game only when the concrete
example materially improves causal understanding—for example, it is the
clearest live signal, explains why behavior changed, forms an important multi-
Season narrative, triggered Follow/inspect/recruit interest, or is deliberately
tracked across sessions. Usually one strong exemplar is better than a list.

Use this test: if removing the name/details does not weaken the causal record,
summarize the pattern. If it does, retain one concise example. Do not overcorrect
into automatically nameless documentation; emotional and behavioral evidence
such as “I followed him,” “I remembered her next Season,” “this upset mattered,”
or “I wanted to inspect that Program” is valid product evidence.

Named examples are development evidence, not canonical world history. Mentioning
an entity does not create permanent simulation metadata, a hidden Hall of Fame,
a feature requirement, or a commitment to preserve it forever. Canonical world
history remains in Dynasty state and archives.

### Destination rules

- **Current State:** named anecdotes are almost never appropriate; record the
  durable product truth.
- **Roadmap:** named anecdotes are almost never appropriate; record product need,
  status, and sequencing.
- **Active Playtesting:** use a selective exemplar only when it materially
  explains a current priority, WATCH item, acceptance signal, or behavior.
  Summarize repeated same-pattern examples rather than listing them.
- **Playtesting Archive:** selected named narratives are appropriate when they
  preserve why a system changed, why a feature was accepted, or what long-term
  attachment felt like. Still synthesize; never copy a game-by-game diary.
- **Research documents:** concrete examples may remain when they directly
  support the research evidence; do not move them into active Playtesting solely
  because they name a Player.

### Anecdote, escalation, and migration

One disappointing Recruit, frequent-looking box-score outlier, or memorable arc
normally begins as OBSERVED, WATCH, or a useful example—not a systemic defect,
tuning requirement, or Roadmap change. Repeated normal-play evidence may justify
escalation. Never run calibration solely because one playthrough had an outlier.

While evidence affects current planning, keep its concise conclusion in active
`PLAYTESTING.md`. After acceptance/resolution or when it is no longer active,
retain a short closure if useful and move richer durable narrative to
`PLAYTESTING_ARCHIVE.md`. Do not permanently duplicate the same detailed story
in both files.

### Reusable workflow

```text
raw user notes
→ analyze in chat
→ classify observations
→ extract patterns and behavior changes
→ choose only materially useful named exemplars
→ update active Playtesting only with current evidence
→ archive selected closed narratives later when useful
```

Prompts for playtest-note documentation passes must say: synthesize rather than
copy; preserve names only when they strengthen the causal record; put current
conclusions/WATCH items in active Playtesting; put selected closed narratives in
the archive; and keep anecdotes out of Current State and Roadmap.

## Acceptance-driven updates

### During implementation

Do not update accepted source-of-truth docs or claim unvalidated behavior is
current. Code comments and temporary implementation notes are allowed.

Exploratory planning is also not accepted truth. Do not put proposed
architecture in `ARCHITECTURE.md`, proposed UI in `UI_DESIGN.md`, or speculative
behavior in production owner docs. Update accepted docs only after implementation,
automated validation, and required manual acceptance.

The implementation completion report still includes `## Documentation` and
states one of:

- documentation intentionally deferred while required polish/user acceptance
  remains;
- exact docs updated and why acceptance was not pending or closure was
  explicitly authorized; or
- no accepted source-of-truth fact changed.

The normal implementation wording is:

```text
## Documentation

Documentation intentionally not updated. The feature is awaiting required user
acceptance and/or frontend polish before targeted closure.
```

### Diagnostic completed; production unchanged

Usually update:

- `PLAYTESTING.md`;
- `ROADMAP.md` if milestone status or sequencing changed; and
- `KNOWN_ISSUES_AND_OPTIMIZATIONS.md` only if evidence confirmed a real
  unresolved problem or measurable risk.

Do not add candidate formulas to `SIMULATION.md`.

### Production implementation accepted

After every required acceptance gate passes, begin with the Documentation
Decision Checklist rather than a presumed file list:

1. List the durable accepted facts that changed.
2. Map each fact to its owner in the matrix above.
3. Update only those owner documents.
4. Update Roadmap when milestone status/sequence changed and Current State when
   current truth, freeze state, or its mirrored NEXT changed.
5. Put empirical manual acceptance in Playtesting.
6. Update README only for a material project-level capability change.

Do not automatically perform a broad documentation sync.

Presentation-only polish defaults to **no documentation update**. Update docs
only when polish establishes/materially changes a reusable UI pattern, resolves
a tracked Playtesting/Known Issue item, or changes milestone acceptance/status.

### Failed or reverted implementation

Never leave source-of-truth documentation claiming reverted work exists.
Record only durable lessons where they belong:

- process lesson → this policy or the operating guide;
- gameplay lesson → `PLAYTESTING.md`;
- confirmed technical issue → `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`.

Failed implementation architecture is not current architecture.

## Definition of Done

Every implementation or diagnostic prompt should include:

```text
# Documentation

Follow docs/DOCUMENTATION_POLICY.md.

Only after acceptance gates pass:
- identify which source-of-truth facts changed;
- update only the docs responsible for those facts;
- do not perform a broad documentation sync;
- do not document speculative or failed behavior.
```

Milestone-specific instructions may narrow this further. Typical impact:

- diagnostic: `PLAYTESTING.md`, plus Roadmap status if appropriate; no
  `SIMULATION.md` change;
- accepted simulation change: `SIMULATION.md`, `GAME_DESIGN.md` if the
  player-facing rule changed, `PLAYTESTING.md`, `CURRENT_STATE.md`, `ROADMAP.md`;
- accepted UI milestone: `UI_DESIGN.md`, tracked Playtesting resolution,
  Roadmap status, and Current State only for a major capability change.

Future implementation agents must include a `## Documentation` section in the
final response. Report either the exact documents updated and why, documents
intentionally deferred and why, or:

```text
Documentation: none required.
No accepted source-of-truth fact changed.
```

## Current truth and historical evidence

`CURRENT_STATE.md`, `SIMULATION.md`, `GAME_DESIGN.md`, and `ARCHITECTURE.md`
prioritize current accepted truth. Historical material may remain only when it
is useful and labeled clearly, for example `Historical V0 baseline` or
`Superseded by Phase …`.

When a later model replaces an older one, state the relationship explicitly.
Do not leave an old paragraph declaring a system frozen while a later section
quietly supersedes it.

`PLAYTESTING.md` keeps current evidence and concise conclusions. Preserve useful
closed observation → evidence → hypothesis → investigation → decision chains in
`PLAYTESTING_ARCHIVE.md` when they no longer affect active planning. Large
topic-specific research belongs in a conditional research owner such as
`PLAYER_IDENTITY_RESEARCH.md`. Supported evidence statuses are `OBSERVED`,
`INVESTIGATING`, `CONFIRMED`, `RESOLVED`, and `WATCH`.

## Staleness and duplication

When a current system changes, search all docs for its prior major terminology,
such as `Rotation V0`, `Priority 1–5`, `Development V0`,
`natural-position-only`, or `Recruiting UI future`. Classify every occurrence as
valid history or stale current-state language. Correct only stale language; do
not blindly rewrite history.

A fact has one primary home. Other docs summarize and link:

```text
exact Rotation constants       → SIMULATION.md
player-facing Rotation rules   → GAME_DESIGN.md
Rotation state representation  → ARCHITECTURE.md
current status and freeze      → CURRENT_STATE.md
why Rotation changed           → PLAYTESTING.md
```

Do not create a new document automatically for every system. Add one only when
existing docs cannot clearly own the durable information, the topic has enough
complexity to justify a source of truth, and a separate document materially
reduces duplication.

## Planning authority

Fresh planning sessions determine priorities from:

1. current truth and the selected/open checkpoint in `CURRENT_STATE.md` and
   `ROADMAP.md` (Roadmap is the only NEXT/PLANNED authority);
2. current evidence/priorities in `PLAYTESTING.md`;
3. actual production code and reusable seams;
4. relevant owner documentation;
5. Known Issues as secondary discovery;
6. Future Features as secondary discovery; and
7. conditional research only when a specific candidate requires it.

`FUTURE_FEATURES.md` is a parking lot. An idea can remain there indefinitely.
Repeated evidence plus deliberate selection moves it into Roadmap; reword or
remove duplicate future-only language at that point.

`PLAYTESTING.md` `OBSERVED` does not equal a known issue. Move an observation to
Known Issues only after diagnostic or engineering evidence confirms a real
unresolved defect, debt item, scaling risk, or validated watchpoint.

## Examples

1. **Tournament seeding diagnostic completes; production unchanged:** update
   Playtesting and Roadmap status. Do not update Simulation or Game Design.
2. **Tournament formula changes and is accepted:** update Simulation, Game
   Design if player-facing behavior changed, Playtesting, Current State, and
   Roadmap.
3. **Quick Sim spacing is fixed:** update UI Design only if it establishes a
   reusable pattern, Playtesting if it resolves a tracked complaint, and Roadmap
   if it was a named milestone. README and Current State probably stay unchanged.
4. **Architecture migration is reverted:** do not update current production
   docs. Record only a durable lesson if valuable.
5. **Transfer portal is proposed but deferred:** update Future Features only;
   do not add it to Roadmap automatically.
6. **Player Details + Development History is accepted:** update UI Design,
   Playtesting, Roadmap, Current State if playable capability materially changed,
   and README only if its overview benefits.

## Documentation decision checklist

After validation and required user acceptance, answer each question and update
the owning document for every meaningful **yes**. A closure prompt must not
assume that README plus six or seven owner docs all need edits:

- Production simulation behavior changed? → `SIMULATION.md`
- Player-facing rules changed? → `GAME_DESIGN.md`
- Canonical architecture/state changed? → `ARCHITECTURE.md`
- UI/product pattern changed? → `UI_DESIGN.md`
- Playtest observation/status changed? → `PLAYTESTING.md`
- Milestone selection/status changed? → `ROADMAP.md`
- Confirmed issue became new/resolved/superseded? → Known Issues
- Deferred idea changed status? → Future Features
- Project-level capability changed materially? → `README.md`
- Current truth/freeze/planning start changed materially? → `CURRENT_STATE.md`

## Broad and periodic audits

Reserve broad documentation reconciliation for:

- a major phase boundary;
- a major architecture replacement;
- a fresh-context/project handoff;
- detected contradiction or staleness; or
- a public release or major checkpoint.

After roughly 5–10 meaningful accepted milestones, or at a major phase end, a
lightweight consistency audit may check stale versions, implemented features
still listed as future, resolved issues still active, conflicting `NEXT`
priorities, and missing links. Do not rewrite documentation merely for style.

### Phase-close hygiene

At phase close, perform one small targeted check:

- mark the accepted work complete/frozen and compress its Roadmap entry;
- inspect the Roadmap for an already explicitly selected successor;
- if a successor was already selected, preserve it and mirror it in Current
  State;
- if none was selected, do not infer one: leave NEXT unset and establish an
  Open Planning Checkpoint in Roadmap and Current State;
- replace the Current State checkpoint rather than appending chronology;
- remove/reword Future Features entries that shipped or became selected; and
- clear resolved WATCH language and archive closed Playtesting evidence when it
  no longer affects current planning.

Completing a milestone does not automatically promote the next listed Roadmap
item to NEXT. A documentation agent must not infer NEXT from file order, phase
number, the nearest PLANNED item, Playtesting, Future Features, or its own
recommendation. Preserve only an already authoritative Roadmap successor, or a
direction the user explicitly selects during the interaction.

Do not turn this checklist into a repository-wide rewrite after every phase.
