# CharacterOS Architecture Reference

## Architectural Goal

CharacterOS is a deterministic-first, single-character psychological simulation kernel. Product surfaces observe and explain the kernel; they do not define psychological truth or own arbitrary mutation authority.

## Layer Map

```text
Input adapters
  Natural language, journal, story, plugin, tool input
        |
        v
Application/service boundaries
  Explorer service, Agent SDK service, API contracts
        |
        v
Core event and physics pipeline
  Event parser -> impact -> memory/cluster -> drift/belief -> state
        |
        v
Derived read models
  Need -> desire -> strategy -> action surface -> explainability
        |
        v
Audit and quality gates
  Reality, determinism, temporal, calibration, grounding, security
        |
        v
Product surfaces
  Explorer, Mind Galaxy, MindSpace, static harnesses
```

Dependencies point inward. `src/core/` must not import React, Next.js, Three.js, route handlers, provider clients, or persistence adapters.

## Runtime Phases

### Event ingestion and physics mutation

```text
Natural Language Event
-> ParsedExperienceEvent
-> ImpactParticle
-> MemoryNode
-> ImpactCluster
-> PersonalityDrift
-> Belief evidence assimilation
-> CharacterPhysicsState + trace
```

`processEvent()` owns the physical transition. Preserve logical event time, bounded impact, recovery/decay, idempotent identity, ordering protection, and deterministic replay.

### Derived decision read model

```text
CharacterPhysicsState
-> NeedDeficiency
-> DesireState
-> ActivatedSchema / BehaviorStrategy
-> ActionSurface / BehaviorDecision
-> SocialMask / WorldModel / Meaning / Embodiment views
```

`deriveCharacterState()` and related builders derive views without inventing or secretly persisting state.

## Ownership Boundaries

| Layer | May read core state | May mutate core state | Rule |
|---|---:|---:|---|
| Core pure builders/audits | Yes | No | Deterministic and clone-safe |
| Physics transition | Yes | Explicitly | Trace every accepted transition |
| Explorer preview/state/explain | Yes | No | DTOs omit raw internals |
| Explorer apply | Yes | Confirmation-gated | Create audit and rollback reference |
| Agent planning/context/reply | Bounded DTO only | No | No writeback authority |
| Agent apply writeback | Yes | Confirmation/policy-gated | Single explicit service boundary |
| LLM/provider adapter | Grounding bundle only | Never | Language adapter, not character |
| UI and visualization | Read model only | Never directly | No imports from mutation internals |

## State And Persistence

The durable-state direction is event log plus transactional snapshots:

- append-only event identity and idempotency key;
- expected-version conflict detection;
- atomic state snapshot plus audit commit;
- replay verification and engine semantics version;
- rollback through an explicit audited operation, not hidden assignment.

Do not add persistence by letting API routes write JSON or database records independently of the service boundary.

## Personality Dynamics Direction

The current coordinate/drift model is an engineering model. Its planned scientific hardening separates:

1. long-term trait baseline;
2. transient state expression;
3. state distribution over time;
4. context-specific profiles;
5. plasticity, attractor strength, consolidation, and uncertainty.

Introduce that model in shadow mode before replacing decision inputs. See `docs/personality_dynamics_scientific_model_design.md`.

## Product And Provider Boundary

- Explorer and MindSpace are observers, not sources of personality values.
- Static artifacts are generated outputs; fix their generator rather than hand-editing generated files.
- LLM providers receive redacted, structured grounding and return candidate language only.
- Validation, grounding, fallback, and policy checks occur before delivery or writeback.

## Forbidden Couplings

- UI -> direct physics mutation
- LLM text -> direct event apply
- API route -> unversioned state overwrite
- audit -> mutation
- wall-clock/random ID -> deterministic DTO or replay identity
- one event -> unconstrained permanent trait rewrite
- benchmark fixture -> production special case
