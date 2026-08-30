# Recruiting V2 — Experimental Design & Prototype Record

> **Status: EXPERIMENTAL DESIGN / PROTOTYPE EVIDENCE / FUTURE / UNSCHEDULED /
> NOT IMPLEMENTED IN PRODUCTION / NOT ACCEPTED / NOT PRODUCTION TRUTH**

Recruiting V1 remains the authoritative production system. `ROADMAP.md` remains
at the Open Planning Checkpoint with no `NEXT` selected. This document does not
select Recruiting V2.

An experimental branch reached a broad playable Recruiting V2 vertical slice,
but the user intentionally withheld acceptance. The current position is:

> Recruiting V2 is interesting and substantially richer, but the user is not
> yet sure it is the desired finished product.

A future review should decide what to keep, simplify, redesign, reject, or
eventually rebuild. This record is deliberately portable: it preserves the
design and experiment evidence without depending on prototype source files.

## 1. Purpose and boundary

This document owns the durable record of why Recruiting V2 was explored, what
the experiments demonstrated, which approaches failed, and which product and
technical questions remain open. It is a design and experiment record for a
fresh review—not an implementation manual, production specification, tuning
contract, acceptance report, or cutover plan.

Nothing here changes accepted Recruiting V1 behavior, its production UI, or
the normal Dynasty lifecycle. Any future V2 would require deliberate selection,
fresh design review, implementation, validation, manual playtesting, acceptance,
and targeted documentation closure before it could become production truth.

## 2. Why Recruiting V2 was explored

The triggering playtest signal was structural:

> In a low-Prestige Pine Valley rebuild, the player could wait several
> Recruiting periods, identify elite/5-star Recruits that AI Programs were not
> seriously pursuing, enter late, and repeatedly sign talent far above the
> Program's normal recruiting position.

This was more than a coefficient problem:

- the loophole was repeatable;
- voluntarily avoiding it did not make the national market feel intelligent;
- earlier attempts to increase elite targeting tended to move AI attention
  around rather than reliably close the structural opening; and
- the user was not strongly attached to the V1 Board / Focus / Offer interaction
  as the foundation of the future experience.

Those signals justified exploring Recruiting from first principles while
leaving production V1 protected.

## 3. Product north star

> Recruiting should be a strategy game about identifying Players a Program has
> credible reasons to win, deciding which ambitious battles are worth pursuing,
> building meaningful recruiting relationships, managing scholarship risk,
> evaluating uncertain talent, and reacting to an intelligent national market.

The intended experience favors meaningful portfolio decisions over weekly
busywork. Challenge should come from intelligent AI, incomplete information,
timing, relationship investment, real scholarship tradeoffs, and coherent
roster/class construction—not arbitrary difficulty or repetitive point
allocation. Cinderella opportunities should remain possible when geography,
opportunity, priorities, timing, or market circumstances make them credible.
Recruits should feel like distinct people whose recruitment can become a story.

## 4. Design principles that survived experimentation

### Recruit identity

A Recruit can combine hometown/geography, public rank and stars, a small
priority profile, a decision tendency, public evaluation, and Program-specific
scouting knowledge. Priority concepts explored included:

- Institutional Prestige;
- Winning / Program Reputation;
- Playing Opportunity; and
- Close to Home.

The experiments did not freeze priority counts, weights, distributions, or
generation formulas.

### Fit is not attainability

- **Fit** explains why the Recruit may like the Program.
- **Attainability / battle quality** explains why the Program believes it can
  compete in the actual recruitment.

An open market may make a pursuit strategically attractive, but market openness
must never improve the Recruit's fit with that Program.

### Scouting uncertainty

Canonical Player truth still exists underneath Recruiting, but the player does
not automatically know it. The selected product principle was:

> Recruiting shows what the staff believes.
> Enrollment reveals what the Player actually is.

Public rank/stars and Program-specific staff evaluation should remain visibly
distinct. Pre-enrollment views should use categorical evaluation and confidence,
not expose canonical OVR, POT, or exact attributes.

### Tracking and Pursuit

`Track` is mechanically inert organization. `Pursue` represents real staff
attention that builds relationship and scouting knowledge. No Focus mechanic
or weekly points allocation is required. The meaningful decision is which
portfolio of Recruits receives active attention.

### Time, relationships, and Offers

Early investment matters. Late entry naturally begins behind established
relationships, and relationship investment does not transfer when a Program
switches targets. A Scholarship Offer is real: it reserves legal capacity and
must remain committable.

### Recruit narrowing

The strongest prototype used:

```text
Open → Serious Consideration → Finalists → Committed
```

Decision tendency influenced timing. Finalists closed ordinary late entry,
while earlier stages could still admit constrained movement.

### AI class portfolios

Programs should construct coherent classes, not greedily score each Recruit in
isolation. Need coverage, attainable core targets, alternatives, upside,
scholarship legality, timing, and class balance belong in one portfolio decision.

## 5. What the experiments taught us

### A one-shot portfolio planner was insufficient

The first Program-level planner behaved more coherently than V1, but too many
elite Recruits still received weak competition. Program-level planning was
necessary, not sufficient.

### Repeated full-market optimization was rejected

Allowing every Program to repeatedly recalculate its entire optimal portfolio
from the current market made the ecosystem collectively too risk-averse.
Programs fled crowded elite battles, oscillated or converged poorly, shifted too
much attention down the class, and created more Pine Valley-style late-entry
opportunities. Elite-market coverage became materially worse.

> AI Programs should not recalculate their entire optimal recruiting portfolio
> from scratch every period.

A durable core with bounded, event-driven response was healthier than wholesale
periodic churn.

### Raw Pursuer count was not a competition model

> Six pursuing Programs may still be a winnable battle.
> One entrenched leader may make a two-Program market nearly unwinnable.

This led to battle-quality reasoning using relationship position, fit, Program
strength relative to actual competitors, playing opportunity, and remaining
decision runway. Battle quality made portfolio choices and exploit diagnostics
more intelligible, but it did not by itself create enough elite participation.

### Excessive conservatism was the main portfolio leak

The funnel evidence showed that Programs generally discovered credible
high-level candidates but selected too few of them. Mandatory needs, realistic
targets, and fallback protection consumed most pursuit capacity. The problem
was less about candidate discovery than insufficient bounded ambition.

### Protected ambitious participation was the strongest breakthrough

The strongest tested portfolio model preserved class-completion work while
giving each Program bounded room for a credible higher-upside pursuit.

> Competent Programs need enough strategic ambition to take sensible high-end
> swings instead of optimizing only against recruiting failure.

This is an experimental portfolio principle, not a production slot, quota, or
tuning constant. It should be reconsidered conceptually before any rebuild.

### Offers and recovery needed lifecycle awareness

Offering every active target early produced poor conversion and tied up legal
capacity. A healthier model allowed Pursuit to earn Serious Consideration but
required a real Offer before Finalists. Material losses—not routine weekly
replanning—triggered recovery through prepared alternatives or the legitimate
late market. A rare deterministic safety layer completed otherwise illegal AI
classes without pretending that emergency completion was normal recruiting.

## 6. Key experimental evidence

These prototype diagnostics explain design decisions. They are approximate,
scenario-dependent evidence—not acceptance thresholds or future tuning targets.

| Diagnostic | Comparison | Experimental reading |
| --- | ---: | --- |
| Top-25 mean Pursuers | `1.48 → 2.62` | Bounded ambition materially improved elite participation. |
| Top-25 markets with zero/one Pursuer | `58% → 32%` | Forgotten elite markets became less common. |
| Top-25 serious competitors | `1.36 → 2.35` | Added attention was meaningfully competitive, not merely nominal. |
| Competitive multi-Program Top-25 markets | `32% → 57%` | More elite recruitments became real battles. |
| Pine forgotten-star exploit opportunities | `15.8 → 9.5` | The motivating late-entry opening declined substantially. |

Ranks 26–75 remained healthy; elite improvement did not collapse the middle
market.

Stage-aware Offering compared with broadly Offering early produced roughly:

- commitments: `56 → 86`;
- Programs naturally complete at that checkpoint: `7.5 → 24 of 32`;
- scholarship shortfall: `1.23 → 0.28`; and
- Offer conversion: `52% → 65%`.

Event-driven recovery then improved natural completion from approximately
`24 / 32` Programs to `28 / 32`. The strongest full-cycle prototype used a
small final safety layer to guarantee legal AI classes. Mature commitment
sources were approximately:

| Source | Share |
| --- | ---: |
| Original core relationships | `40%` |
| Original ambitious targets | `23%` |
| Prepared fallback relationships | `26%` |
| Legitimate late-market recruiting | `6%` |
| Deterministic safety completion | `4.5%` |

More than 89% of commitments therefore came from original or deliberately
prepared relationships. Final prototype evidence also demonstrated all 32
Programs completing, exactly 12 Players per Program, accepted 2–3
natural-position roster legality, stable Recruit-to-Player identity,
deterministic/order-independent behavior, and compatibility with the existing
version-neutral finalized Recruiting / roster-assembly boundary.

Defensive completion showed a noticeable PG skew. Treat that as a future
**WATCH** question about class construction and safety selection—not as an
accepted defect or authorization to tune production.

## 7. Strongest experimental backend model

The strongest tested candidate was a deterministic, Program-portfolio system
with canonical Recruit identity, Program-specific knowledge, bounded ambition,
stage-aware Offers, atomic outcomes, and event-driven recovery:

```text
Recruit class + Recruit identity
→ preseason Program pursuit portfolios
→ active Pursuits build relationship and scouting knowledge
→ Program-specific fit + battle evaluation
→ stage-aware Scholarship Offers
→ Serious Consideration
→ Finalists
→ atomic commitments
→ material-loss recovery
→ prepared alternatives / legitimate late market
→ rare deterministic class-completion safety
→ finalized Recruiting class
→ normal roster assembly
```

Important boundaries were:

- deterministic results and independence from Program/Recruit iteration order;
- one stable Recruit-to-Player identity through enrollment;
- atomic Offer/commitment legality rather than accidental order priority;
- durable core Pursuits with bounded response instead of wholesale replanning;
- fit, battle quality, relationship, and scouting knowledge as distinct ideas;
- final output normalized to a version-neutral enrollment fact; and
- no requirement that downstream roster assembly understand V1 or V2 workflow
  internals.

## 8. Strongest player-facing UX contract

The broad playable prototype supported a five-mode Recruit-centric workspace:

```text
Targets | Discover | Roster | National | Guide
```

`Targets` was the working home. `Discover` found and compared candidates;
`Roster` explained next-season needs and scholarship legality; `National`
showed public market context; and Recruit Details carried the complete identity,
evaluation, fit, relationship, stage, Offer, and decision story.

The strongest interaction contract was:

- public Recruit identity, rank/stars, priorities, stage, finalists, Offers,
  and commitments;
- private staff evaluation expressed as Current Ability grade, Upside,
  Scouting Confidence, and bounded observations;
- dimension-level `Your fit` explanations rather than a composite score;
- separate categorical Relationship and competitive Standing;
- active Pursuit count plus a qualitative Staff Load instead of weekly points;
- Track, Pursue/Stop, Offer/Withdraw, and period advancement as the principal
  actions;
- a concise Offer-capacity preview using accepted Required / Flexible / Full
  roster language;
- actionable loss/recovery updates and `Still Open` discovery;
- Finalists withdrawal as a real exit with no re-entry; and
- mobile behavior designed for approximately 390px without shrinking dense
  desktop tables into unreadable layouts.

For the controlled Program, final safety completion could never silently award
a mystery Recruit. The tested product boundary required an explicit assisted
`Complete Class` choice among legal, scouting-safe candidates.

This UX was functional enough for broad play, but it was not manually accepted
as the desired finished product. Its five-mode hierarchy, information density,
terminology, and amount of recruiting ceremony all remain reviewable.

## 9. Privacy and authority decisions

The prototype enforced privacy in read models rather than trusting UI components
to hide sensitive fields.

- Before enrollment, no player-facing Recruiting projection exposed canonical
  OVR, POT, or exact basketball attributes—not through display, sorting,
  filters, tooltips, accessibility text, or hidden component props.
- A Coach could see only that Program's private scouting, fit, relationship,
  and management facts.
- National and Observer views were public-only. Switching the Viewed Program
  did not grant access to an AI Program's private evaluation or relationship
  knowledge.
- Internal battle scores, attainability, commitment odds, planner roles,
  relationship points, and safety/recovery labels remained hidden.
- Public priorities and unranked Serious Schools / Finalists explained the
  recruitment without revealing exact preference calculations.

These are among the strongest candidates to preserve in any future redesign,
even if the surrounding mechanics or UI are simplified.

## 10. What remains uncertain or questionable

The prototype answered feasibility questions, not the final product question.
A fresh review should challenge at least the following:

- Is the richer system more fun and emotionally engaging over repeated Seasons,
  or does it become another dense management surface?
- Are five modes the right hierarchy, or can the same decisions be expressed
  more simply?
- Does scouting uncertainty create satisfying judgment and discovery, or merely
  obscure information the player wants?
- Are public priorities, categorical fit, Relationship, and Standing clear
  enough without exposing formulas—and are they too many adjacent concepts?
- Does bounded ambition generalize across seeds, Program tiers, roster needs,
  and long-run Dynasties without feeling artificial?
- Are Serious Consideration and Finalists paced well enough to create urgency
  without forcing excessive monitoring?
- Is the Scholarship Offer timing contract intuitive, and how much over-offer
  flexibility, if any, should exist?
- Does recovery create believable contingency planning without making losses
  inconsequential?
- Can rare safety completion remain truly exceptional, legal, positionally
  neutral, and invisible for AI Programs?
- How should the controlled Program fail or receive assistance at the final
  boundary without a tedious or gamey emergency flow?
- Which transient recruiting events need durable history after the active class
  is archived?
- Does the model preserve enough legitimate Cinderella wins while removing the
  forgotten-star exploit?

No counts, weights, thresholds, category mappings, timing values, formulas, or
acceptance gates should be inferred from the prototype.

## 11. Deliberately deferred

The experiments intentionally did not settle or activate:

- production migration, save/version strategy, V1 replacement, or cutover;
- final Recruit priority generation and weighting;
- exact fit, scouting, relationship, standing, battle, or decision formulas;
- exact Pursuit capacity and Staff Load thresholds;
- final Offer limits or any controlled over-offering model;
- Official Visits and other high-impact recruiting events;
- public-ranking error and partially hidden priorities;
- Recruit archetype labels and richer basketball-identity presentation;
- National class rankings and class grades;
- full persistent recruiting activity history;
- difficulty settings;
- geography pipelines, facilities, NIL, staff bonuses, and promises;
- decommitments and Transfer Portal recruiting; and
- production documentation closure or acceptance thresholds.

These are future options, not omissions that must all be added to a V2 rebuild.

## 12. Fresh-review checklist

Before deciding whether any of Recruiting V2 should be rebuilt or selected, a
fresh chat should:

1. Verify current production truth, accepted/frozen boundaries, and Roadmap
   status from `CURRENT_STATE.md`, the Roadmap Current Selected Horizon, and the
   current playtesting evidence.
2. Review production Recruiting V1 as the control: identify what is already fun,
   understandable, stable, and reusable—not only what V2 tried to replace.
3. Reconfirm that the Pine Valley forgotten-elite exploit, or a related current
   player problem, still warrants reopening a frozen core system.
4. Treat this record's metrics as prototype evidence and rerun only the smallest
   production-faithful diagnostics needed for the present decision.
5. Evaluate the version-neutral finalized Recruiting / roster-assembly boundary
   as the preferred downstream seam, while verifying its current production
   contract before relying on it.
6. Review the product decisions separately: portfolio AI, lifecycle narrowing,
   scouting uncertainty, meaningful Offers, privacy/authority, and the five-mode
   UX need not be accepted or rejected as one package.
7. Decide what can be simplified. Favor the smallest model that preserves
   intelligent markets, credible ambition, relationship value, scholarship
   risk, Recruit identity, and understandable stories.
8. Use a new focused design/investigation before implementation. Do not treat
   the historical prototype architecture, constants, or terminology as a
   specification.
9. Require deterministic/order-independent validation, market and class-health
   evidence, legal roster completion, normal lifecycle compatibility, desktop
   and approximately 390px review, and manual playtesting before acceptance.
10. Select Recruiting V2 in `ROADMAP.md` only through an explicit user decision.

The central future decision is not whether the prototype worked. It broadly did.
The decision is whether its strongest ideas can become a simpler, clearer, and
more enjoyable finished Recruiting game than production V1.
