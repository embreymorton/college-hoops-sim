# Playtesting

## Purpose and status vocabulary

This is the active empirical front door. It owns current playtesting priorities,
genuinely live WATCH signals, current gameplay evidence, and concise recent
acceptance evidence. `ROADMAP.md` alone owns **NEXT** and **PLANNED**.

Closed causal history lives in `PLAYTESTING_ARCHIVE.md`; parked Player Identity
experiments live in `PLAYER_IDENTITY_RESEARCH.md`; the decision-complete
hierarchy investigation lives in `DYNASTY_HIERARCHY_RESEARCH.md`. Those are
conditional reads, not fresh-session requirements.

Evidence follows:

```text
observation → evidence → question → investigation → decision
```

**OBSERVED** is unvalidated manual evidence; **INVESTIGATING** has earned a
diagnostic; **RESOLVED** is implemented and validated; **WATCH** is acceptable
but worth monitoring.

## Current Playtesting Priorities

The repository is at an **OPEN PLANNING CHECKPOINT — no NEXT selected**.

1. Continue normal multi-Season play and observe whether the accepted attachment
   loop—Recruit decisions, News, Following, Player careers, Alumni, Records,
   Yearbooks, and retrospectives—continues to create memorable stories.
2. Monitor only the unresolved signals in **Live WATCH Items** below; do not
   promote one into work without stronger evidence and explicit Roadmap
   selection.
3. Preserve frozen boundaries. Recruit Talent Profile V2, S0 career-stage/POT
   continuity, ordinary Development V1, Explosive Offseasons + Work Ethic V1,
   static Prestige, Rotation, Team Strength, and Game Simulation are not active
   calibration projects.

Awards & Honors and other planned/optional ideas are not NEXT. This priority
list guides evidence gathering; it does not select a successor.

## Current Multi-Season Gameplay Evidence

A voluntary Pine Valley Dynasty lasting roughly 14 Seasons remains strong
qualitative evidence that the loop can sustain long-form engagement. The
low-Prestige rebuild stayed difficult, with modest results, low-seed Tournament
appearances, and short runs even after meaningful roster improvement. That is a
durable story, not proof that the rebuild curve is perfect or that static
Prestige is defective.

Attachment increasingly came from remembered decisions and consequences rather
than ratings alone. Recruiting choices, followed alternatives, later Player
Development, News, Records, and retrospectives made old decisions easy to revisit.
Next Season Position Outlook and Board Organization improved decision context;
Followed Recruit → Player continuity preserved interest after enrollment.

The accepted history and presentation layers are working together: News creates
discovery, Following enables retrieval, Player Details shows progression and
career production, Program History/Records add context, and Yearbooks preserve
completed Seasons. Continue observing this compound loop rather than treating
each surface as an isolated feature.

## Latest Accepted Milestone Evidence

### Rare Development Breakouts / Explosive Offseasons + Work Ethic Reveal V1 — ACCEPTED / FROZEN

Production-faithful paired validation used 10 deterministic Dynasty seeds, 10
complete Seasons per seed, and mature Seasons 7–10.

#### Frequency and class representation

- 2,227 eligible mature opportunities;
- `4.45%` observed roll against the configured `4.5%`;
- 53 official events, or `1.77` per league offseason;
- `2.38%` official rate among eligible opportunities; and
- `20/17/16` events across FR→SO/SO→JR/JR→SR.

The finite sample's freak tail contained one +17, two +18, and two +19 events;
the deterministic +20 path remains test-reachable. No sampled +20 is consistent
with “possible but legendary,” not evidence that the path is absent.

#### Player stories and roster impact

Accepted event stories distributed as:

- late bloomer `24.53%`;
- project → contributor `45.28%`;
- project → star `22.64%`; and
- star → superstar `7.55%`.

Average roster-rank improvement was `5.92`; `64.15%` moved from outside the
rotation to the top eight and top five, `58.49%` reached the top three, and
`22.64%` became their Program's #1 Player. These measures established narrative
consequence beyond aggregate OVR movement.

#### Ecosystem safety

| Metric | Baseline | Explosions |
| --- | ---: | ---: |
| Mature mean Player OVR | 75.11 | 75.19 |
| Mature Player OVR SD | 7.47 | 7.48 |
| Players 95+ | 25 | 31 |
| Players 98+ / 99 | 2 / 2 | 2 / 2 |
| Mean Team OVR | 78.22 | 78.31 |
| Team OVR SD | 3.90 | 3.87 |
| 90+ Program-seasons | 0 | 0 |
| Strongest Program | 86.33 | 86.33 |

There was no broad inflation, stronger maximum Team, additional 98/99 Player,
or meaningful elite-Program amplification. The closed hierarchy/compression
investigation remains closed.

#### Manual acceptance

The user response was strongly positive: the Development presentation and
career stories felt fun; Work Ethic and Explosion independence produced clear
stories; and the final Player Details placement and event-backed hero treatment
were accepted. A deterministic seed made targeted UI reproduction practical.
Naturally failing to encounter a controlled-Program Explosion over several
Seasons felt appropriate because the event is meant to remain rare. Production
frequency was not inflated for manual visibility.

## Live WATCH Items

### Low-Prestige rebuild and structural progress

Pine Valley suggests that the long rebuild can be engaging, but continue
observing whether structural progress feels legible and whether low-Prestige
Programs can build satisfying arcs without making static Prestige irrelevant.
This does not reopen the decision-complete hierarchy investigation by itself.

### Elite Recruit Offer coverage

Premium Recruits may occasionally lack an elite Offer deep into a cycle.
Observed scarcity can reflect positional capacity or alternative-target choice,
not necessarily AI failure. Reopen only with cohort evidence that compatible
elite Programs systematically leave viable premium targets uncovered.

### Concentrated ordinary Development gains

Rare official Explosive Offseasons intentionally create large position-aware
multi-attribute gains and are not defects by magnitude alone. Continue watching
only for implausible concentration in **ordinary** Development or incoherent
Player identity, and distinguish any evidence from the immutable event fact.

### Rotation secondary-path edge cases

Interior/forward-heavy eligibility and rare large incumbent displacement remain
worth observing. Legal manual 40-minute assignments are intentional; automatic
default workload realism and stable validation-row geometry are resolved.

### Recruiting exact-position friction

Exact-position vacancies can make desirable Recruits unavailable. Preserve this
player-facing friction as evidence for a future deliberately selected roster or
Recruiting design; Rotation flexibility does not silently change natural-
position scholarship capacity.

### Shot selection and single-game Steals upper tail

Shot mix remains simplified, and the long-run single-game Steals tail may be
compressed. A roughly 14-Season Record Book topped out at seven steals. That is
an evidence question, not yet a tuning problem; Player Identity and Game Sim
remain parked/frozen without a focused diagnostic.

### Persistence and historical-state growth

Save/load remains absent, active Dynasty state is session-limited, and full
snapshot history grows materially across Seasons. These are real future
product/engineering concerns, not current gameplay blockers or an implied NEXT.

### Test-infrastructure contention

Lifecycle-heavy tests can exceed the default five-second timeout during highly
contended full-suite runs while passing alone. Treat this as an infrastructure
WATCH unless a product mismatch reproduces; do not hide it with arbitrary
retries.

## Accepted Boundaries Relevant to Playtesting

- Work Ethic is hidden for Recruits, Unknown for freshmen, and stable/revealed
  after the first offseason. It informs ordinary Development only.
- An official Explosion is a separate rare annual event and is never inferred
  from a large gain. POT remains absolute.
- Recruit V2 and S0 continuity investigations are resolved and archived; no
  Recruit or S0 talent-profile calibration remains open.
- Static Prestige is production truth. Dynamic Prestige is rejected/rolled
  back, and mature compression is an accepted/deferred limitation.
- Exact Recruit ratings remain production visibility; scouting uncertainty is
  future-only.
- Current Player Identity and Game Simulation are good enough for continued
  feature planning and require new focused evidence to reopen.

## Evidence Maintenance

Keep this file live and concise. When an investigation closes, retain only the
current decision and move its causal/quantitative detail to
`PLAYTESTING_ARCHIVE.md` or the relevant research owner. Do not let resolved
milestones remain under Live WATCH, and do not use this document to infer NEXT.
