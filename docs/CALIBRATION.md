# Calibration Methodology

This document defines how the project tunes and validates simulation systems efficiently without sacrificing production fidelity. It records process, not current balance constants or accepted numerical results.

## Documentation roles

- `CALIBRATION.md`: tuning methodology and validation rules.
- `PLAYTESTING.md`: empirical gameplay observations and questions.
- `SIMULATION.md`: accepted production formulas, constants, and validation results.
- `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`: confirmed unresolved issues and watchpoints.
- `ROADMAP.md`: milestone sequencing.

Historical Player Identity/OVR experiments are preserved in
`PLAYER_IDENTITY_RESEARCH.md`. They are not an active tuning queue and should
not be run or continued without a fresh gameplay problem.

## Production fidelity

Calibration calls real production domain APIs. It does not use fast Game Sim, approximate Seasons, fake Recruiting outcomes, simplified Postseason logic, or alternate Development behavior.

Independent Dynasty seeds may run in parallel, but their results are aggregated in requested seed order. Parallelism changes execution time only; it must not change RNG consumption, state transitions, basketball outcomes, or deterministic output.

## Tuning ladder

```text
MANUAL PLAYTEST OBSERVATION
        ↓
TARGETED DIAGNOSTIC
        ↓
QUICK
        ↓
STANDARD
        ↓
IMPLEMENT CANDIDATE
        ↓
ACCEPTANCE
        ↓
EQUILIBRIUM only if necessary
        ↓
MANUAL PLAYTEST AGAIN
```

Not every question needs every stage. A direct subsystem diagnostic can replace a short Dynasty run when it answers the question more directly.

## Choosing the smallest useful diagnostic

Use direct production APIs for narrow questions, such as one Player's Development, Recruit generation, relationship gain, or shot selection. Use short Dynasty runs for roster quality, rebuild experience, Prestige hierarchy, and Recruiting roster filling. Use long equilibrium runs only for decades-scale drift, championship concentration, state/history growth, or unhealthy steady-state convergence.

Do not run `5 × 50` merely because more data exists.

## Long-run presets and audits

| Preset | Configuration | Audit | Intended question |
| --- | --- | --- | --- |
| `quick` | 1 seed × 3 Seasons | LIGHT | Did a candidate move behavior in the intended direction? |
| `standard` | 3 seeds × 10 Seasons | LIGHT | Does the behavior survive multiple deterministic seeds? |
| `acceptance` | 5 seeds × 10 Seasons | FULL | Is the production path broadly safe and healthy? |
| `equilibrium` | 5 seeds × 50 Seasons | FULL | Does long-run state converge and remain healthy? |

Explicit `--seeds`, `--seasons`, `--workers`, and `--audit` values override preset defaults. `--workers 1` forces sequential execution for debugging. Otherwise the runner uses a bounded worker count appropriate to the requested seeds and host.

LIGHT retains core correctness checks: valid rosters, Rotations, Schedules, Recruiting finalization, filled openings, Focus invariants, duplicate commitments, lifecycle failures, and identity validity. FULL additionally performs history immutability/collision, serialization, state-growth, and historical-ID audits. Audit level changes only what tooling checks; it never changes simulated state.

Examples:

```text
npm run sim:dynasty-long-run -- --preset quick
npm run sim:dynasty-long-run -- --preset standard
npm run sim:dynasty-long-run -- --preset acceptance
npm run sim:dynasty-long-run -- --preset equilibrium
npm run sim:dynasty-long-run -- --seeds 5 --seasons 10 --workers 1 --audit full
```

Use `--json` only when machine-readable output is useful; it supplements, rather than replaces, the readable report. When redirecting a package-script result, use npm's `--silent` flag to suppress its command banner.

## Comparison rules

- Use deterministic seeded RNG only; never use `Math.random()`.
- Capture a baseline, change one conceptual system or parameter family, rerun the same seeds, then compare before broadening validation.
- Prefer paired trials: same seed, same state, same Player/Recruit/Team, with only the intended variable changed.
- Do not tune from one anecdote. Manual play creates hypotheses, not automatic balance changes.
- Do not introduce auto-tuning, grid search, or automated constant rewriting. Calibration remains human-guided game design.

Prefer qualitative hierarchy and reasonable ranges over false precision. For example, “Pine rarely beats an elite Program for a premium Recruit” is usually more useful than an arbitrary exact signing percentage unless a quantitative invariant is required.

## Acceptance and stopping rules

A QUICK result can reject a candidate; it cannot freeze a system. Freeze a system only after appropriate acceptance validation and manual-play sanity checking.

Stop tuning when:

1. the original playtest problem is resolved;
2. structural invariants pass;
3. targeted diagnostics are qualitatively healthy;
4. broader ecosystem validation reveals no new blocker; and
5. manual play feels plausible.

Do not keep adjusting merely because a metric could be made more realistic. Reopen a frozen system only with new evidence or a new talent-flow/system design.

## Recommended calibration report

```text
Problem
Baseline
Change
Targeted result
Broader result
Structural health
Manual-play implication
Decision: ACCEPT / REJECT / WATCH
```
