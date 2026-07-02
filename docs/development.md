# CharacterOS Development Document

## Current Version

CharacterOS is currently in V10.29 (Continuous Life single-character closed loop).

The project has evolved from a prompt-centered character engine through V3 infrastructure hardening and V10 Continuous Life longitudinal simulation into a stable single-character physics engine with a complete commit lifecycle (preview → apply → rollback).

Current emphasis:

```text
single character
psychological physics core
personality galaxy
parameter evolution
homeostasis
recovery
continuous life simulation (dry-run default)
longitudinal commit lifecycle
differentiated decision pipeline
```

Do not treat the project as a chatbot or a story generator.

The central question is:

```text
How does a person become who they are?
```

## Current Core Flow

```text
Natural Language Event
-> ParsedExperienceEvent
-> ImpactParticle
-> MemoryNode
-> ImpactCluster
-> PersonalityDrift
-> BeliefState
-> NeedDeficiency
-> DesireState
-> BehaviorBias
-> BehaviorDecision
```

The character should act from internal state, not from plot needs.

## Current Foundation Layers

CharacterOS now treats the character as a layered dynamic system:

```text
Biological Nature
-> Psychological Boundary
-> Personality Core
-> Belief System
-> Need Deficiency
-> Desire
-> Behavior
-> Experience
-> Memory Galaxy
-> Personality Drift
```

Newer architecture adds an even deeper parameter layer:

```text
Parameter Layer
-> Evolution Layer
-> Homeostasis Layer
-> Mind Architecture
-> Behavior
```

Values are not the core.

Evolution is the core.

## Development Principles

- Do not rewrite V1.
- Do not break the existing runnable pipeline.
- Do not expand into multi-character systems yet.
- Do not build world simulation yet.
- Do not prioritize 3D visualization before the physics core is stable.
- Do not hand-tune thousands of exact parameters.
- Prefer relative values, baselines, inertia, accumulation, homeostasis, recovery, and calibration.
- Every new core behavior should be testable as pure logic before API or Dashboard work.
- Single-character philosophy remains protected.
- Self-action candidates are signals only — never executed.
- Dry-run is the default; commit requires explicit opt-in and auth.

## Current Completed Systems

### Core V0 Subsystems (all implemented)
MemoryNode, ImpactParticle, ImpactCluster, PersonalityCoordinate, PersonalityDrift, PsychologicalBoundary, BiologicalNature, TraceReplay, Continuous Tick, Action Noise, Procedural Memory, Social Mask, Reward Dopamine, Homeostasis, Meaning System, Time Perception, World Model, Boredom Inspiration, Belief Evolution, Attention System

### V10 Continuous Life (all implemented)
- V10.1-V10.10: Life tick scheduler, energy/fatigue, sleep/wake, dream, boredom/inspiration, random thought, self-action candidate, dry-run runner, persistence boundary, continuous living stable
- V10.12-V10.16: Differentiated decision pipeline, explainability, life decision context, stable QA
- V10.17-V10.19: Longitudinal single-character simulation harness, API, governance audit
- V10.20-V10.27: finalStateForCommit design, types, commit preview, commit apply design, audit repository, commit apply core, commit apply API, commit rollback API
- V10.28: Code review fixes (rollback conflict semantics, audit status, state fingerprint, corrupt JSON handling, shared simulation limits, commit route helpers)

### V3 Infrastructure (complete)
State integrity, export/import safety, transaction trace, history audit, defensive copies, test isolation, API key protection, tag normalization, attention diagnostic, calibration observability

### V6 Benchmark (complete)
Benchmark types, directional assertion, runner, report API, V2.1 2000-matrix + 200-focus regression suite

### V7-V8 Mind Graph (complete)
Graph types, builder, projection, semantic expansion, snapshot API, layout data model

### V4-V5 Temporal Process (complete)
Temporal process interface, adapters, unified tick trace, subprocess instrumentation

## Current Verification Standard

```text
npm run build        → tsc --noEmit
npm test             → vitest (129 files, 1363 tests)
npm run next:build   → 26 API routes
npx tsx outputs/run-benchmark-v2-1.ts  → V2.1 regression
```

All must pass before marking a stage stable.

## Known Limitations (V10.28)

```text
No ACID cross-file transaction between state and audit writes
No autonomous background scheduler (characters don't run without API calls)
No relationship system (single-character only)
No multi-character society
No world simulation
Commit persistence is deferred in dry-run simulate route (uses internal clone)
```

## Current API Routes (26)

### Life Simulation
- POST /api/characters/[characterId]/life/simulate
- POST /api/characters/[characterId]/life/simulate/commit/preview
- POST /api/characters/[characterId]/life/simulate/commit/apply
- POST /api/characters/[characterId]/life/simulate/commit/rollback

### Character Physics
- GET|POST|DELETE /api/characters/[characterId]/physics
- POST /api/characters/[characterId]/physics/parse
- POST /api/characters/[characterId]/physics/simulate
- POST /api/characters/[characterId]/physics/tick
- GET /api/characters/[characterId]/physics/calibration
- POST /api/characters/[characterId]/physics/adjustment/apply
- GET /api/characters/[characterId]/physics/adjustment/history
- POST /api/characters/[characterId]/physics/adjustment/rollback

### Decision & Editor
- GET /api/characters/[characterId]/decision
- POST /api/characters/[characterId]/editor/preview
- POST /api/characters/[characterId]/editor/apply
- GET /api/characters/[characterId]/editor/history
- POST /api/characters/[characterId]/editor/rollback

### Import/Export
- GET /api/characters/[characterId]/export
- POST /api/characters/[characterId]/import/validate
- POST /api/characters/[characterId]/import/apply
- GET /api/characters/[characterId]/import/history

### Graph & Trace & Benchmark
- GET /api/characters/[characterId]/graph
- GET /api/trace/replay/summary
- GET /api/trace/replay/calibration
- GET /api/benchmark/report

## Long-Term Roadmap

```text
V1  Single-character psychological loop          ✅ Complete
V2  Personality Galaxy                            ✅ Complete
V3  Infrastructure hardening                      ✅ Complete
V4  Temporal process system                       ✅ Complete
V5  Impact benchmark and calibration              ✅ Complete
V6  Benchmark system                              ✅ Complete
V7-V8 Mind graph system                           ✅ Complete
V10 Continuous life + longitudinal simulation     ✅ Complete (V10.28)
V11 Explainability expansion                      📋 Charter exists
V20 Multi-character relationship networks         ❌ Future
V50 Emergent stories                              ❌ Future
V100 Emergent societies                           ❌ Future
```

Current work remains grounded in the single-character core.

Multi-character systems come later.
