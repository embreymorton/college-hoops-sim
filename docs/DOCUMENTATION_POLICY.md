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
| `docs/CURRENT_STATE.md` | What is true right now: implemented, canonical, frozen, major watchpoints, planning start | Accepted architecture/production truth changes; major system freezes; planning start materially changes | Append-only history |
| `docs/ROADMAP.md` | Completed sequence and a small deliberately selected horizon | Milestone accepted, reordered, selected, cancelled, or deferred | Wishlist, playtest notebook, debt dump |
| `docs/PLAYTESTING.md` | Empirical gameplay evidence and causal history | Meaningful observation, investigation, diagnostic, resolution, watchpoint, or design-significant story | Automatic bug classification from one anecdote |
| `docs/CALIBRATION.md` | How tuning and validation are performed | Methodology, presets, audits, comparison, parallelism, or acceptance process changes | Current balance constants |
| `docs/SIMULATION.md` | Accepted production formulas, constants, invariants, and validated calibration results | Production simulation behavior is accepted | Candidate formulas, failed experiments, diagnostic-only alternatives |
| `docs/GAME_DESIGN.md` | Accepted player-facing rules and control semantics | Accepted gameplay behavior changes | Implementation internals |
| `docs/ARCHITECTURE.md` | Canonical boundaries, ownership, representations, lifecycle architecture | Accepted ownership, representation, boundary, or orchestration changes | Temporary migration scaffolding unless it becomes lasting architecture |
| `docs/UI_DESIGN.md` | Accepted UI patterns and deliberately selected near-term visual direction | Major UI pattern accepted; repeated evidence selects a UX direction; navigation hierarchy changes | Every one-off visual complaint |
| `docs/KNOWN_ISSUES_AND_OPTIMIZATIONS.md` | Confirmed unresolved defects, debt, measured risks, validated watchpoints | Issue/risk confirmed, resolved, or superseded | Feature backlog or unverified playtest notes |
| `docs/FUTURE_FEATURES.md` | Unscheduled, non-blocking idea bank | Deferred idea added, implemented, abandoned, or deliberately selected elsewhere | Priority order |
| `docs/COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md` | How assistants reason, validate, prompt, and hand off work | Process, prompting, validation philosophy, or documentation governance changes | Current product state |

`CURRENT_STATE.md` is curated and replaced, not append-only. `PLAYTESTING.md`
normally preserves useful causal history even after resolution.

## Acceptance-driven updates

### During implementation

Do not update accepted source-of-truth docs or claim unvalidated behavior is
current. Code comments and temporary implementation notes are allowed.

### Diagnostic completed; production unchanged

Usually update:

- `PLAYTESTING.md`;
- `ROADMAP.md` if milestone status or sequencing changed; and
- `KNOWN_ISSUES_AND_OPTIMIZATIONS.md` only if evidence confirmed a real
  unresolved problem or measurable risk.

Do not add candidate formulas to `SIMULATION.md`.

### Production implementation accepted

After every acceptance gate passes:

1. Update the specific production source-of-truth documents affected.
2. Update `CURRENT_STATE.md` if current accepted truth materially changed.
3. Update `ROADMAP.md` if milestone status or sequencing changed.
4. Update `PLAYTESTING.md` if a tracked observation changed status.
5. Update `README.md` only for a material project-level capability change.

Do not automatically perform a broad documentation sync.

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
intentionally not updated and why, or:

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

`PLAYTESTING.md` differs: preserve important observation → evidence → hypothesis
→ diagnostic → implementation → validation → resolution/watch chains because
they explain why the current system exists. Supported statuses are `OBSERVED`,
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

1. `CURRENT_STATE.md`;
2. current evidence/priorities in `PLAYTESTING.md`;
3. selected sequencing in `ROADMAP.md`; and
4. current code inspection.

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

After validation, answer each question and update the owning document for every
meaningful **yes**:

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
