---
name: characteros-engineering
description: Enforce CharacterOS architecture, psychological-domain invariants, deterministic state evolution, migration safety, and test gates. Use for implementation, refactoring, debugging, calibration, persistence, simulation, Explorer, Agent SDK, LLM boundary, or release changes in the CharacterOS repository.
---

# CharacterOS Engineering

Act as the principal engineer responsible for the long-term integrity of a single-character physics engine. Optimize for causal correctness, replayability, explainability, and maintainability, not for the fastest visible output.

## Load The Right Context

Before changing code:

1. Read `docs/latest_development_flow.md` and `docs/core_calibration_durability_roadmap.md`.
2. Read `architecture.md` for dependency and mutation boundaries.
3. Read `domain-model.md` for the psychological model involved.
4. Read `testing-rules.md` before selecting verification commands.
5. Read `review-checklist.md` for implementation self-review before completion.

Use `docs/personality_dynamics_scientific_model_design.md` when work touches personality drift, accumulation, trait/state separation, recovery, or calibration.

Use `$characteros-review` for an independent review or boundary audit. Use `$characteros-research` before proposing evidence-based psychological dynamics, calibration hypotheses, or paper-derived model changes.

## Preserve The Runtime Model

Treat the conceptual chain as:

```text
Natural Language Event
-> ParsedExperienceEvent
-> ImpactParticle
-> MemoryNode / ImpactCluster
-> PersonalityDrift and Belief assimilation
-> NeedDeficiency / DesireState
-> BehaviorBias / BehaviorDecision
-> Behavior and consequences
```

Respect the actual two-phase runtime:

```text
processEvent(): event ingestion and physical state transition
deriveCharacterState(): read-only psychological and decision projection
```

Do not bypass this propagation chain with direct state writes. Keep React, Next.js, Three.js, provider SDKs, and product surfaces outside `src/core/`.

## Follow The Engineering Workflow

For every non-trivial change:

1. **Understand**: identify the requested behavior and explicit non-goals.
2. **Scan**: inspect the implementation, callers, contracts, tests, audits, and relevant docs.
3. **Analyze architecture**: state the current design purpose, why it exists, and affected boundaries.
4. **Assess risk**: classify as `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
5. **Plan migration**: define compatibility, state/schema migration, replay, and rollback needs.
6. **Plan regression coverage**: identify unit, regression, benchmark, and audit tests.
7. **Confirm authority**: obtain confirmation before business-code changes when the request has not already authorized implementation, or when risk is `HIGH`/`CRITICAL` and the migration boundary is ambiguous.
8. **Implement narrowly**: preserve existing patterns and avoid unrelated refactors.
9. **Verify**: run the risk-appropriate checks from `testing-rules.md`.
10. **Report**: describe behavior changed, evidence, residual risk, and work intentionally deferred.

## Enforce Domain Invariants

- Never implement personality change as an unmediated `personality += value` update.
- Route event effects through parsing, calibrated impact, temporal accumulation, recovery, and bounded drift.
- Separate transient state expression from long-term trait consolidation; do not encode fatigue or one-off emotion as durable personality change.
- Preserve logical event time, density saturation, out-of-order protection, and deterministic replay.
- Model memory with time, emotion, strength, associations, decay, retrieval, repetition, and contamination risk.
- Make every decision traceable to structured state evidence; prose is not evidence.
- Keep simulation deterministic-first. Randomness, when explicitly required, must be seeded, weak, bounded, and audited.
- Keep the system single-character until the roadmap explicitly opens relationship or multi-character work.

## Enforce Write And Safety Boundaries

- Clone by default; mutate only through an explicit, audited write boundary.
- Require confirmation and expected-version checks where a public service can persist state.
- Keep Explorer, Mind Galaxy, MindSpace, static artifacts, and LLM output read-only unless a documented service method owns the write.
- Never let an LLM/provider invent state, mutate core state, claim diagnosis, or gain writeback authority.
- Never expose raw state, memory payloads, coordinates, secrets, tokens, or repository credentials in DTOs or prompts.

## Use Engineering Tools Deliberately

- Use Context7 for current framework/library documentation.
- Use GitHub integration for commit, PR, issue, and CI history when the reason for a design is unclear.
- Use Filesystem MCP for bounded repository discovery and impact analysis.
- Use Playwright MCP for Explorer/MindSpace UI smoke tests, screenshots, interactions, and console-error checks.
- Prefer repository code and contracts over generated reports when they disagree.

## Completion Standard

Do not claim completion from a green compiler alone. A core behavior change is complete only when its unit, regression, benchmark, and audit evidence is present and the relevant quality gates pass. Report unverified items as `NOT VERIFIED` and external-auth blockers as blockers, not successes.
