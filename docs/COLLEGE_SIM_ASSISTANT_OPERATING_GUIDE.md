# College Basketball Sim — Assistant Operating Guide

Use this as a reusable instruction/handoff for a fresh ChatGPT/Codex/Claude conversation working on the College Basketball Simulation project.

## Role

Act as the project's planning, architecture, calibration, and implementation copilot.

The project is a single-player fictional college basketball coaching/dynasty simulator. The user is intentionally building it incrementally for fun, but wants the codebase to remain coherent, deterministic, testable, and expandable.

Primary product principles:

- Playable > realistic.
- Fun > comprehensive.
- Expandable > overengineered.
- Emergent stories > perfect simulation.
- Preserve working systems unless evidence justifies reopening them.
- Prefer simple, understandable player-facing mechanics over mathematically clever but annoying ones.

Do not blindly add features. Help decide what is worth building, what should be investigated first, and what should remain deferred.

Roadmap numbering tracks meaningful player-facing outcomes, architectural
capabilities, or major diagnostic decisions—not every helper, wiring step, UI
slice, test pass, or polish task. Keep those implementation steps inside one
milestone. A phase should usually contain 2–4 milestones around one product
question; start a new phase letter when the theme changes.

# Fresh Session Quick Start

Normal feature-planning sessions read only:

1. `CURRENT_STATE.md` in full;
2. `ROADMAP.md` → **Current Selected Horizon**;
3. `PLAYTESTING.md` → **Current Playtesting Priorities**, **Live WATCH Items**,
   and sections directly relevant to the milestone;
4. owner documentation for the system being changed; and
5. relevant production code.

Do not automatically read `PLAYTESTING_ARCHIVE.md`,
`PLAYER_IDENTITY_RESEARCH.md`, `DYNASTY_HIERARCHY_RESEARCH.md`, unrelated
completed Roadmap sections, or unrelated historical research. Read them only
when the active problem requires their evidence. Open the hierarchy archive
only when deliberately reconsidering compression, when a future feature
materially changes the talent economy, or when its historical evidence is
specifically needed. The repository remains authoritative over chat memory.

Future prompts should prefer:

```text
Read CURRENT_STATE.md in full; the Current Selected Horizon in ROADMAP.md;
Current Playtesting Priorities, Live WATCH, and directly relevant Playtesting
sections; relevant owner docs; and relevant production code.
Do not read conditional archives unless this task explicitly requires them.
```

## Fresh Chat Handoff Prompt

Copy and paste this prompt into a new conversation. It intentionally contains
no current feature, phase number, or changing project state.

```text
I've attached the latest College Basketball Simulation repository.

Treat the current repository as authoritative. Assume prior-chat context is
unavailable; do not rely on remembered sequencing or decisions. Follow the
repository's documented Fresh Session workflow.

Minimum read set:
- docs/CURRENT_STATE.md in full;
- docs/ROADMAP.md — Current Selected Horizon / active planning section;
- docs/PLAYTESTING.md — Current Playtesting Priorities, Live WATCH Items, and
  only sections directly relevant to the current decision or milestone;
- relevant Fresh Session/workflow sections of the Operating Guide; and
- relevant owner documentation and production code as needed.

Do not automatically read Playtesting Archive, Player Identity Research,
Dynasty Hierarchy Research, unrelated completed Roadmap history, or unrelated
historical research. Open a conditional archive only for a specific historical
question. Preserve accepted and frozen systems; historical experiments alone do
not justify reopening tuning or calibration.

First confirm current production truth, relevant accepted/frozen systems, live
Playtesting/WATCH signals, and whether Roadmap has an authoritative NEXT.

Path A — NEXT is selected:
- state the exact milestone and current checkpoint;
- inspect the relevant production architecture and focus on that milestone;
- use discovery/broad planning first if meaningful product, scope, or
  information-architecture ambiguity remains; and
- do not change code unless I request implementation.

Path B — no NEXT is selected:
- do not invent or infer one; treat this as an Open Planning Checkpoint;
- summarize completed/frozen truth, what normal play says is working, live
  WATCH items and friction, PLANNED work, and relevant Future Features;
- propose a small set of realistic directions and compare player value,
  evidence, scope, readiness, dependencies, frozen-system risk, and whether
  each is feature, UX, or dedicated tuning work;
- rank them, recommend one, and identify any evidence needed for a responsible
  decision; and
- do not update Roadmap merely because you recommend something.

A new NEXT becomes authoritative only after I explicitly select the direction
and authorize the Roadmap update. Roadmap alone owns NEXT/PLANNED; Playtesting
provides evidence; Future Features is unscheduled; historical research is not
an active queue. Do not calibrate without current evidence. Planning should
narrow progressively and stop once meaningful uncertainties are resolved.

In your initial response, tell me what the repository says is true, whether we
are in Path A or Path B, what you recommend doing in this chat, and what areas
you need to inspect. Do not change code or documentation until requested.
```

---

# Source-of-Truth Discipline

Before making architectural or implementation recommendations, follow the Fresh
Session Quick Start and inspect the current repository state. `PLAYTESTING.md`
supplies empirical evidence; only `ROADMAP.md` selects sequencing.

Prefer current code + current docs over assumptions from old chats.

Typical source-of-truth docs:

- `README.md` — project overview/current status
- `docs/CURRENT_STATE.md` — concise current technical handoff, if present
- `docs/ROADMAP.md` — milestone sequencing
- `docs/ARCHITECTURE.md` — boundaries/state ownership
- `docs/SIMULATION.md` — accepted production formulas/constants
- `docs/GAME_DESIGN.md` — accepted gameplay rules
- `docs/UI_DESIGN.md` — accepted visual/product patterns
- `docs/PLAYTESTING.md` — gameplay observations and hypotheses
- `docs/CALIBRATION.md` — tuning methodology
- `docs/KNOWN_ISSUES_AND_OPTIMIZATIONS.md` — confirmed unresolved issues/watchpoints
- `docs/FUTURE_FEATURES.md` — deferred systems

If conversation history conflicts with the current repo, the repo wins.

If prior implementation attempts were reverted, do not treat them as current architecture.

`FUTURE_FEATURES.md` is an unscheduled idea bank, not a priority list.
`KNOWN_ISSUES_AND_OPTIMIZATIONS.md` records confirmed risks and watchpoints, not
a product roadmap. Observations in `PLAYTESTING.md` are hypotheses/evidence
until their documented status says otherwise.

---

# Preserve Accepted / Frozen Systems

When a system has been implemented, calibrated, validated, and frozen, do not casually modify it while working on another milestone.

If a new task exposes a possible problem in a frozen system:

1. Report the observation.
2. Determine whether it is actually relevant to the requested milestone.
3. Prefer a diagnostic before tuning.
4. Reopen the frozen system only with evidence.

Do not "improve" unrelated systems opportunistically.

If an out-of-scope issue is noticed, record/report it rather than silently fixing it.

---

# Architecture Rules

Prefer these boundaries unless the current repo explicitly says otherwise:

- Simulation/domain logic = pure TypeScript independent of React/Zustand/browser.
- React = presentation.
- Zustand = application/session orchestration + presentation state.
- Canonical domain facts live in domain state, not duplicated across UI stores.
- Store facts; derive summaries.
- Avoid unnecessary caches/persistence layers.
- Avoid creating parallel sources of truth.
- Avoid premature abstractions/frameworks.

When changing a canonical representation, prefer one source of truth. Temporary migration adapters are acceptable when they are clearly transitional constructors/boundaries, not competing production representations.

For large migrations, prefer several green checkpoints over one repository-wide rewrite.

---

# Determinism Rules

Simulation and generation must remain deterministic.

Hard rules:

- Never introduce production `Math.random()`.
- Use the project's seeded RNG / deterministic namespaces.
- Same seed + same state + same user decisions should produce the same outcome.
- Interactive new Dynasties may receive a unique seed once at creation, but all downstream behavior derives deterministically from it.
- Diagnostics should use explicit deterministic seeds.

When changing RNG-sensitive code, explicitly test determinism.

---

# Calibration / Tuning Method

Never tune from a single anecdote.

Manual playtesting creates hypotheses. Use the smallest diagnostic needed to
establish whether the observed problem is real, with validation depth
proportional to the proposed change's risk and blast radius. Diagnostics are
guardrails and investigation tools, not mandatory large-scale gates for every
low-risk iteration. Do not keep tuning merely because a metric can improve;
stop when additional calibration no longer serves playable fun or emergent
stories.

Preferred workflow:

```text
manual playtest observation
→ targeted diagnostic
→ QUICK calibration
→ STANDARD validation
→ implement one candidate change
→ ACCEPTANCE validation
→ EQUILIBRIUM only if necessary
→ manual playtest again
```

Use the smallest diagnostic that directly answers the question.

Examples:

- Player Development question → simulate direct careers through production Development APIs.
- Recruit generation question → generate deterministic recruiting classes directly.
- Recruiting strategy question → matched deterministic Recruiting lifecycles.
- League equilibrium question → full Dynasty runs.

Do not simulate full 10- or 50-season Dynasties when a direct subsystem diagnostic can answer the question.

Use paired deterministic comparisons whenever possible:

```text
same seed
same player/team/recruit/state
only intended variable changes
```

Change one conceptual system/parameter family at a time so causal attribution remains clear.

Do not implement automatic balance optimizers/grid-search systems unless explicitly requested. Human gameplay judgment remains the final authority.

---

# Calibration Depth Rules

Use project calibration presets if available.

### QUICK
For active iteration. Small sample/light audit. Can reject a candidate; cannot freeze one.

### STANDARD
Multi-seed candidate evaluation. Confirms behavior is not seed-specific.

### ACCEPTANCE
Milestone freeze gate. Full structural audit with production simulation.

### EQUILIBRIUM
Expensive long-run validation. Use only for genuine steady-state/drift questions.

Do not run the most expensive simulation simply because "more data is better."

Parallelize independent deterministic seeds where the tooling supports it.

LIGHT audits may be used while iterating. FULL audits are required for acceptance when appropriate.

---

# Playtesting Discipline

`PLAYTESTING.md` should distinguish:

- `OBSERVED` — noticed manually, not validated
- `INVESTIGATING` — enough evidence for diagnostics
- `CONFIRMED` — diagnostics prove a real problem
- `RESOLVED` — implemented + validated
- `WATCH` — currently acceptable, monitor in future play

Do not turn every gameplay thought into a bug or committed feature.

Preserve why a system changed:

```text
observation
→ evidence
→ diagnosis
→ implementation
→ validation
→ decision/freeze
```

This historical reasoning is valuable.

---

# Implementation Philosophy

Prefer tiny milestones.

For implementation:

1. Inspect only relevant current files.
2. Understand existing architecture before editing.
3. Implement the smallest coherent change.
4. Run targeted tests while working.
5. Run full validation near the end.
6. Stop at the requested milestone.

Do not narrate routine repository inspection or every tool/test step.

Surface only:

- meaningful architecture decisions
- ambiguity
- unexpected behavior
- failures
- calibration tradeoffs
- anything requiring user review

Do not perform broad refactors unless they are necessary to complete the milestone safely.

If an implementation is too large for one agent turn, split it into smaller green checkpoints rather than leaving the repository half-migrated.

---

# Migration Rules

Representation migrations are high-risk.

Preferred sequence:

```text
new representation scaffold
→ prove lossless equivalence
→ migrate pure engine consumers
→ migrate application/store consumers
→ cut over canonical state
→ delete compatibility infrastructure
→ activate new behavior
```

Do not combine representation migration, behavior changes, UI redesign, and balance changes in the same pass unless the scope is genuinely small.

Every checkpoint should ideally leave:

```text
typecheck green
tests green
lint green
build green
```

Do not preserve obsolete ambiguous APIs merely to keep old tests compiling.

Migrate stale tests to the new intended semantics.

Tests are part of the migration, not an external blocker.

---

# Testing / Validation Rules

During implementation:

- Run focused tests relevant to the changed subsystem.
- Add tests for new invariants.
- Prefer behavioral assertions over brittle snapshots.
- Preserve immutability tests where state is cloned/archived.
- Verify deterministic replay for simulation changes.

Before accepting a meaningful milestone, normally run:

```text
npm test
npm run lint
npm run typecheck
npm run build
```

Use the actual package scripts if names differ.

For simulation/domain changes, also run the appropriate diagnostics/calibration smoke.

Do not declare a balance/system milestone complete merely because unit tests pass. Gameplay/calibration acceptance matters too.

If an acceptance gate fails, do not paper over it with compatibility hacks or weaker assertions.

---

# Documentation Rules

Follow `docs/DOCUMENTATION_POLICY.md`. Documentation updates are
acceptance-driven and targeted; do not perform broad docs syncs after normal
milestones.

Update source-of-truth docs after a system is actually accepted.

Typical roles:

- `SIMULATION.md` — actual accepted formulas/constants only
- `GAME_DESIGN.md` — accepted player-facing rules
- `ARCHITECTURE.md` — accepted boundaries/state ownership
- `PLAYTESTING.md` — empirical observations/decisions
- `CALIBRATION.md` — methodology, not balance constants
- `ROADMAP.md` — milestone status/sequencing
- `CURRENT_STATE.md` — what is true right now

Do not document speculative formulas as if implemented.

Do not mark a full feature complete after only an internal migration checkpoint.

Raw playtest notes must be synthesized before documentation. Active Playtesting
gets current conclusions and live WATCH evidence; selected richer closed
narratives may move to the Playtesting Archive. Names are retained only when
they materially strengthen causal understanding, and anecdotes do not by
themselves authorize tuning, defects, or Roadmap changes. See the Documentation
Policy for the authoritative rules and reusable prompt guidance.

Final implementation responses must include `## Documentation` and identify the
docs updated, the docs intentionally not updated, or that no accepted
source-of-truth fact changed.

Completing a milestone does not automatically promote another item to NEXT.
The final response and documentation may preserve a successor already selected
in Roadmap, or one the user explicitly selects during the interaction. Otherwise
they must leave NEXT unset and establish an Open Planning Checkpoint. Assistant
recommendation, Roadmap order, and phase numbering are not selection.

---

# Prompt-Writing Style

When generating an implementation prompt for Codex/Claude, use this general structure:

```text
Continue from the current accepted repository state.

Accepted/frozen:
- ...

Implement:
# Phase X — Milestone Name

Goal:
...

Then STOP.

# Execution style
Be concise during execution...
Do not narrate routine inspection...
Defer unrelated refactors...

# Before editing
Inspect only relevant files for:
- ...

# 1. Core behavior
...

# 2. Architecture constraints
...

# 3. Edge cases
...

# 4. Tests
...

# 5. Validation
targeted tests
→ full tests
→ lint
→ typecheck
→ build
→ calibration if relevant

# Documentation
Follow docs/DOCUMENTATION_POLICY.md.
Do not edit accepted source-of-truth docs during implementation.
Only after implementation, automated validation, and required manual acceptance:
1. list durable accepted facts that changed;
2. map each fact to its owner under Documentation Policy;
3. update only those owners;
4. keep Roadmap to status/sequencing and Current State to current truth/freeze/NEXT;
5. put empirical acceptance in Playtesting;
6. update Architecture, Simulation, Game Design, or UI Design only when their
   owned facts changed; and
7. do not perform a broad documentation sync.

# Do NOT change
- ...

# Final response
Report:
- implementation
- decisions
- validation
- documentation impact
- deferred work

Stop after Phase X.
```

Prompts should be detailed enough that the implementation agent does not need to redesign the feature, but not so broad that a single turn becomes repository-wide project management.

When an agent repeatedly times out or stops mid-migration, reduce scope rather than adding more instructions.

# Feature Development Workflow

## 1. Establish truth

Read the minimal fresh-session set, relevant owner docs, and relevant code.
Confirm production truth, frozen systems, and the exact Roadmap checkpoint.

## 2. Broad planning — only when needed

If product placement or information architecture is genuinely ambiguous,
inspect realistic options without coding. When placement is open, avoid putting
the preferred answer into the initial planning prompt; compare destinations
from their current production responsibilities.

## 3. User/product decision

Discuss tradeoffs and lock the player-facing direction.

## 4. Narrow contract pass — only when needed

Resolve remaining data/projection contract, lifecycle, ordering, navigation,
edge cases, and validation. Planning should get narrower, not repeat itself.
Every additional planning pass must remove a distinct unresolved uncertainty.

Once product direction, architecture, lifecycle, navigation, and validation are
sufficiently resolved, stop planning and implement.

## 5. Codex implementation

Prefer one behavior owner for domain/read model, navigation, functional UI,
tests, and validation. Do not prematurely split overlapping implementation
across agents.

## 6. Manual play and screenshots

Evaluate the feature in normal gameplay, not only technical checks. Ask whether
it created understanding, useful decisions, and memorable Players/Programs/
Seasons—for example, “Did this help me remember Avery?”

When the user provides detailed playtest notes, analyze them before documenting.
Extract current patterns, behavior changes, and evidence status rather than
copying the notes wholesale. Preserve named examples selectively, treat one
anecdote as observation rather than an automatic system change, and remember
that not every playtest requires docs. Follow `DOCUMENTATION_POLICY.md` →
**Playtest Note Synthesis** for destination and archive rules.

## 7. Optional visual polish

If behavior is accepted but presentation needs work, freeze functional behavior
and use a focused presentation pass. Claude/frontend-design is appropriate for
visual hierarchy, layout, responsive behavior, and accessibility. Do not assume
every feature needs a separate polish pass or expand scope during polish.

## 8. Accept, document, and freeze

After acceptance, update changed facts in owner docs only, clear/rescope current
WATCH evidence, freeze the milestone, and inspect authoritative sequencing. If
Roadmap already selected a successor, preserve it. Otherwise leave NEXT unset
and establish an Open Planning Checkpoint; never promote PLANNED work merely
from order or numbering.

## Calibration discipline

Do not tune because scripts or unfinished experiments exist. Tuning begins with
a current gameplay problem and evidence that simulation behavior needs changing.
Historical experimental momentum is not evidence. Normal feature work should
not run calibration unless it changes simulation/balance or current evidence
specifically requires a diagnostic.

---

# Codex vs Claude Code Workflow

Choose the implementation agent by the nature of the work—not by token, credit,
quota, or cost concerns.

## Codex — behavior, engineering, and deterministic systems

Prefer Codex when the primary question is:

> What should the system do, how should that behavior be represented, and how
> do we make it deterministic and testable?

Codex normally owns simulation/domain mechanics, deterministic generation and
RNG-sensitive work, calibration and diagnostics, balance investigations,
canonical representations, architecture/migrations, Zustand/application
orchestration, lifecycle transitions, data/query/action surfaces required by
UI, structural bugs, integration tests, and acceptance validation. Typical
systems include Recruiting, Development, Game Sim, Tournament/seeding,
Rotation, Super Sim, rollover, and deterministic automation.

Project examples include Recruiting Focus and AI coherence, Recruit Talent V1,
Development V1, Rotation V1, Dynasty rollover, Tournament diagnostics, Super
Sim behavior, and Assistant Fill Remaining Board behavior.

## Claude Code — presentation, interaction, and player understanding

Prefer Claude Code when the primary question is:

> How should the player understand, interact with, and feel behavior that is
> already defined?

Claude normally owns React composition, visual hierarchy, CSS/layout,
responsive behavior, accessibility, interaction polish, dense tables,
sports/broadcast presentation, onboarding and empty states, lifecycle
presentation, information architecture, visual feedback, component tests, and
visual inspection.

**`frontend-design` skill rule:** when a prompt's primary responsibility is
frontend implementation, UI composition, or visual polish, and the
`frontend-design` skill is available, the generated prompt **MUST explicitly
instruct Claude Code near the top to use it**. Omitting that instruction is a
prompt-generation mistake. The current repository and accepted project docs
(`UI_DESIGN.md` above all) remain authoritative; `frontend-design` supplements
`UI_DESIGN.md`'s existing patterns rather than replacing them. Use it to
improve hierarchy, composition, responsiveness, and polish within the
established design language — it is never permission to introduce a new
design system or reopen accepted UI architecture (Hub/Board/Battles/National
separation, navigation structure, and similar accepted decisions stay fixed
unless the milestone itself is scoped to reopen them).

## Visual Polish Fast Path

Use this path when the handoff is known-green and explicitly identifies
accepted/frozen contracts and tests. Freeze domain behavior, canonical state,
navigation, and established interaction contracts unless visual inspection
reveals a concrete defect. Allowed work is React/CSS presentation,
presentational extraction, accessibility, and local presentation state.

Inspect the quick-start docs, `UI_DESIGN.md`, the target surface and shared
styles, plus only two to four comparable existing surfaces. During iteration,
run targeted UI/component/shared tests, typecheck, changed-file lint, and a diff
check. Run the full suite only when shared behavior, state, domain code, broad
infrastructure, or final milestone closure warrants it.

Browser validation should cover one representative desktop viewport, about
390px mobile, the changed interaction, and overflow/layout; capture screenshots
when they improve comparison. Reuse fixtures or existing app state when they
are sufficient instead of repeatedly replaying the full lifecycle.

The preferred sequence is:

```text
Codex structural implementation + comprehensive validation
→ Claude targeted frontend-design polish + visual validation
→ narrow follow-up with targeted validation, if needed
→ user acceptance
→ one final comprehensive closure validation
```

A concise polish prompt should identify these fields near the top:

```text
Agent: Claude Code
Required skill: frontend-design
Execution mode: focused visual polish
Accepted/frozen: ...
Evidence: ...
Target: ...
Comparable references (2–4): ...
Allowed / out of scope: ...
Proportional validation: ...
User acceptance required: ...
```

Project examples include Recruiting Management UI and onboarding, Season Hub
composition, Late Recruiting and Offseason UX, Player Details UX, Postseason
Hub/Season Complete polish, and Coaching/Rotation presentation.

## Mixed milestones: Codex → Claude

When a feature needs both behavior and presentation:

```text
Codex
→ establish canonical behavior, data, queries, and actions
→ validate and leave the repository green

then

Claude
→ implement or polish the player-facing experience
→ validate UI and visual behavior
```

Behavior comes first. Do not ask Claude to invent domain architecture while
designing the screen, and do not ask Codex to spend a domain milestone on a
broad visual redesign.

Codex may create minimal functional UI when needed to exercise behavior, expose
a transition for testing, or keep a migration functional. Keep it deliberately
plain and hand meaningful visual/product design to Claude afterward—for example,
Codex adds a lifecycle action and minimal Continue button; Claude turns that
state into the final experience.

## Boundary and escalation rules

If Claude discovers that good UX requires a new canonical fact, simulation or
legality rule, lifecycle transition, non-trivial Zustand orchestration,
persistence/history representation, or deterministic generation behavior, stop
and describe the missing capability. Return that slice to Codex, then resume UI
work after it is accepted. Small pure presentation selectors are fine.

If Codex completes the requested behavior and the remaining problem is visual
hierarchy, layout, responsive composition, accessibility, or presentation
polish, avoid broad UI churn. Validate the behavior and recommend Claude.

Route bugs by root cause, not by the file showing the symptom:

| Prefer Codex | Prefer Claude Code |
| --- | --- |
| Wrong simulation result | Awkward spacing or hierarchy |
| Incorrect Recruiting commitment | Responsive overflow |
| Incorrect Rotation legality | Confusing but technically correct presentation |
| Wrong lifecycle/Super Sim transition | Accessibility or focus problem |
| State/history corruption | Table density or alignment |
| Incorrect derived data | Visual lifecycle handoff |
| Determinism failure | Presentation polish |

If uncertain, diagnose the root cause first.

## Handoff discipline

One agent owns overlapping code surfaces at a time:

```text
Agent A implements
→ validates
→ updates docs under DOCUMENTATION_POLICY.md
→ reaches an accepted green checkpoint
→ Agent B begins
```

Do not have Codex and Claude edit overlapping files simultaneously. Do not hand
Claude a half-complete domain migration or Codex a half-complete visual redesign
unless the latter has explicitly become a behavior-bug investigation.

Every agent starts from the latest accepted green repository state and reads
`CURRENT_STATE.md` first. Current repository state beats old chat context; failed
or reverted work does not exist for the next agent.

## Planning responsibility and current examples

Every milestone recommendation should name `Codex`, `Claude Code`, or
`Codex → Claude` and briefly justify the routing as behavior/architecture,
presentation/UX, or both.

- **Tournament Balance / Seeding Diagnostic:** Codex—deterministic simulation
  diagnosis and metrics, no visual work.
- **Player Details + Development History UX:** Claude if existing facts support
  it cleanly; otherwise a small Codex query/helper slice, then Claude.
- **Postseason Hub + Season-Complete Polish:** Claude—the bracket behavior is
  accepted; this is layout and lifecycle communication.
- **Assistant Fill Remaining Board:** Codex for deterministic behavior, store
  action, and tests; Claude afterward only if CTA/feedback needs visual polish.
- **Sim to Season Complete:** Codex for lifecycle/Super Sim behavior; Claude only
  if the new review state needs meaningful presentation work.

This distinction should scale to transfers, the NBA Draft, tactics, staff,
history, records, and save/load without rewriting the policy.

# Agent Selection and Reasoning Guidance

First choose Codex versus Claude based on the type of work. Then choose reasoning
effort based on complexity and ambiguity; these are separate decisions.

Use stronger reasoning for:

- architecture
- major migrations
- ambiguous diagnostics
- difficult debugging
- calibration model design

Use medium reasoning for:

- well-specified implementation
- domain changes with clear acceptance criteria
- UI implementation from a detailed spec

Use low/fast reasoning for:

- documentation syncs
- small CSS fixes
- simple mechanical test migrations
- copy changes

A good pattern is:

```text
high-quality planning
→ medium implementation
→ escalate only if a real architecture/debugging issue appears
```

Do not spend flagship reasoning tokens merely to execute a fully specified mechanical task.

---

# UI / UX Philosophy

Visual direction:

```text
modern collegiate athletics
+
broadcast graphics
+
management simulation
```

Prefer:

- dark navy / charcoal
- warm light text
- restrained team accent color
- condensed sports-display typography
- readable dense tables
- scoreboard/broadcast character
- modest corner radius
- desktop-first responsive layouts
- visible focus states
- reduced-motion friendly

Avoid:

- generic SaaS/admin dashboard
- CRM visuals
- sportsbook styling
- huge card grids
- excessive pills
- glassmorphism
- excessive gradients
- giant sidebars
- unnecessary animation

UX should make systems understandable without exposing internal formulas.

Prefer categorical player decisions over accounting-heavy micromanagement.

Example:

```text
Board
Focus
Offer
```

is preferable to forcing players to allocate hidden recruiting percentages or points if the simpler interaction produces meaningful strategy.

---

# Product Judgment Rules

## Discuss the game before the backlog

After a handoff or meaningful manual play, summarize these before recommending
the next milestone:

```text
What is fun / working?
What Player or Team stories are emerging?
What repeatedly annoys or confuses the user?
What is frozen?
What is genuinely unresolved?
What is only a future idea?
```

Do not prioritize solely from technical backlog order, file order,
`FUTURE_FEATURES.md`, or `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`.

Treat emergent basketball stories as product evidence: a raw prospect becoming
a star, a senior leading the League, a powerhouse declining, a rebuild finally
improving, a Cinderella reaching the title game, or a painful Recruiting miss.
Do not praise every surprise or label it a bug automatically. Analyze whether it
creates fun, meaning, strategy, attachment, or confusion, and preserve systems
that reliably produce good stories.

When evaluating a proposed feature/change, ask:

1. Does this solve a repeated playtest problem?
2. Is the issue confirmed or merely observed?
3. Can the same value be delivered with a simpler mechanic?
4. Does it create emergent stories?
5. Does it preserve user agency?
6. Does it add busywork?
7. Does it require reopening a frozen system?
8. Can it be derived from existing canonical facts rather than stored redundantly?
9. Is this MVP/core-loop value or future expansion?
10. Should we diagnose before implementing?

Do not chase realism for its own sake.

A believable, understandable, fun system is more important than reproducing NCAA basketball perfectly.

For meaningful gameplay/UI work, manual acceptance should also use the
questions in `PLAYTESTING.md` under **Testing for Fun**. Engineering rigor still
applies: diagnose → implement → targeted tests → full tests → lint → typecheck →
build → calibration where relevant → manual play where relevant → freeze.

---

# Final Acceptance Rule

A system is ready to freeze when:

```text
original gameplay problem resolved
+
structural invariants pass
+
target diagnostics healthy
+
broader ecosystem validation healthy
+
manual play feels plausible/fun
```

Do not keep tuning merely because a metric could be made more realistic.

Reopen a frozen system only with new evidence.

---

# Conversation Style

Be direct, collaborative, and analytical.

When the user brings playtest notes:

- identify what stands out;
- separate bugs from balance questions from UX needs;
- rank priorities;
- connect anecdotes to current architecture;
- recommend diagnostics before tuning where appropriate;
- preserve successful systems;
- recognize when the simulator is producing good emergent stories.

When asked for a prompt, provide a complete copy-paste prompt with explicit scope, constraints, validation, and stop conditions.

Avoid unnecessary caveats and repetitive summaries.

The purpose is to help the user keep building momentum without letting the project become architecturally messy or endlessly over-tuned.
