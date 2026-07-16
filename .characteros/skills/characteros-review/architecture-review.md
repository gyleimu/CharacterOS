# CharacterOS Architecture Review Rules

## Dependency Direction

Expected flow:

```text
Input adapters
-> application and service boundaries
-> core event and physics pipeline
-> derived read models
-> audits and quality gates
-> product surfaces
```

Dependencies must point inward. Flag any of these as boundary violations:

- `src/core/` importing React, Next.js, Three.js, route handlers, persistence adapters, provider SDKs, or product components;
- UI or visualization code mutating physics state directly;
- an API route writing state without the owning service, confirmation, expected version, and audit;
- an LLM or provider response becoming state without validation, policy, preview, confirmation, and the explicit write boundary;
- an audit, preview, derive, explainability, or visualization path mutating input state;
- duplicated state authority across JSON files, database adapters, services, and session stores;
- generated outputs becoming the editable source of truth.

## Runtime Ownership

Review the two runtime phases separately:

```text
processEvent()          -> accepted physical transition
deriveCharacterState() -> read-only psychological and decision projection
```

`processEvent()` may own bounded mutation and trace creation. Derived builders must remain clone-safe and must not persist inferred values.

## Causal Chain

Trace event-driven changes through:

```text
ParsedExperienceEvent
-> ImpactParticle
-> MemoryNode / ImpactCluster
-> PersonalityDrift and Belief assimilation
-> NeedDeficiency / DesireState
-> Decision influence and candidate surface
-> Explanation trace
```

Flag shortcuts that write later stages directly, derive evidence from prose, or make decision changes without structured state evidence.

## Time And Determinism

Check that replay-sensitive identity and behavior use logical event time, stable ordering, engine semantics version, and deterministic content. Flag new wall-clock or unseeded randomness in builders, plans, previews, audits, snapshots, or replay paths.

Operational timestamps are allowed only when they are explicitly observational and excluded from deterministic identity and state evolution.

## Durable State

For persistence changes, require:

- append-only event identity and idempotency;
- expected-version conflict detection;
- atomic state, event, trace, snapshot, and audit commit;
- replay verification;
- explicit rollback semantics;
- no partial success after a failed commit.

## Product Boundaries

- Explorer, MindSpace, Mind Galaxy, static artifacts, and SDK harnesses consume bounded read models.
- Agent and LLM layers may plan language and writeback requests but never own core mutation.
- Multi-character or relationship behavior remains prohibited until the active roadmap opens that scope.
- Simulation output must not be presented as diagnosis or empirically validated personality measurement.
