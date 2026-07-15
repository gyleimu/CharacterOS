# Changelog

## Model Calibration Core

- Added immutable versioned Model Parameter Registry with 54 governed numeric parameters and stable fingerprints
- Added per-category decision responsiveness and five-event overreaction guards so aggregate calibration cannot hide a weak event channel
- Stamped CharacterPhysicsState, serialization, temporal trace, and longitudinal commit fingerprints with parameter-set version
- Added 160 Golden Trajectories across 10 categories, 4 baselines, and 4 horizons, plus 640 decision scenario projections
- Added deterministic generated-sequence properties, metamorphic checks, +/-10% sensitivity probes, and explicit repair asymmetry
- Fixed four-decimal personality integration dead zone by retaining eight-decimal internal velocity/coordinate precision
- Fixed long-term positive evidence repair so trust/fear learning continues after boundary stress reaches a calm state
- Fixed Galaxy cluster metric recomputation bypassing calibration memory parameters
- Added Model Calibration Gate to Unified Quality Gate, CI, and `rc:verify`
- Engineering calibration is not psychological or clinical validation

## Temporal Semantics Core

- Added persistent logical event clock and backward-compatible state serialization
- Added elapsed-time recovery before each forward-timed event
- Added 24-hour semantic repeat saturation with a bounded non-zero impact floor
- Added 14-day personality velocity half-life and post-decay cluster metric synchronization
- Added canonical event timestamps, out-of-order protection, and inherited-clock safeguards
- Exposed temporal trace through physics results, API DTOs, simulation snapshots, and Event Studio
- Added 7-case / 21-assertion Temporal Semantics Audit and integrated it into CI and unified quality gates
- Timing constants remain engineering priors, now versioned and guarded by Golden Trajectory and sensitivity checks

## V13 LLM Boundary RC

- Safe prompt boundary backed by mediated Agent grounding data
- Deterministic Mock Provider with no network or real credentials
- Output validation for diagnosis, mutation, raw state, secrets, truncation, certainty, and safety notices
- Evidence grounding with unsupported-claim rejection and deterministic fallback
- 18-case LLM Boundary Quality Gate with deterministic double replay
- SHA-256 sealed offline Harness and V13 RC manifest
- Dependency security policy and reviewed risk registry
- Real providers remain explicitly deferred

## V10 RC (V10.78)

### Core Reality Audit Suite (V10.67–V10.78)

- **V10.67** Reality Audit — Event → State → Decision chain verification
- **V10.68** Decision Responsiveness Repair — State delta enters decision surface
- **V10.69** Impact / Personality Calibration — Channel delta expected vs actual
- **V10.70** Boundary / Positive Support Calibration — Support no longer over-stresses boundary
- **V10.71** Long-Term Accumulation Calibration — Personality as slow channel verified
- **V10.72** Galaxy Force Saturation + Trust Repair — Diminishing returns + support repair
- **V10.73** Event Type Coverage — 10 event types × baselines × scenarios
- **V10.74** Core Reality Regression Gate — Unified regression gate
- **V10.75** Unified Quality Gate — Benchmark + Reality merged
- **V10.76** Quality Trend Baseline — Regression history tracking
- **V10.77** Known Warning Burn-down — Warning classification + active→0
- **V10.78** RC Freeze Audit — Determinism, mutation safety, release readiness

### Key Metrics (V10 RC)

| Metric | Value |
|--------|-------|
| Tests | 1802 (148 files), 0 failures |
| API Routes | 27 |
| Event Types | 10 |
| Audit Suites | 7 |
| Core Reality Gate | PASS |
| Unified Quality Gate | PASS |
| Active Warnings | 0 |

## V11 RC (V11.10)

### CharacterOS Explorer — Single Character Platform

Six-module platform for exploring one personality's life.

| Module | Status |
|--------|--------|
| Event Studio | Preview + Apply boundary |
| Character State | Human-readable surface |
| Explainability | Evidence-grounded timeline |
| Mind Galaxy | Advanced embed (read-only) |
| Reality Audit | Safety panel |
| Time Machine | Snapshot + restore view |

### Key Metrics (V11 RC)

| Metric | Value |
|--------|-------|
| Explorer Tests | 142 |
| Total Tests | 1973 (159 files) |
| Explorer Modules | 6 |
| Service Methods | 9 (8 read-only, 1 write) |

## V12 RC (V12.10)

### Character Agent SDK — Embeddable Interface Layer

9-module SDK for connecting CharacterOS Core to external applications.

| Module | Status |
|--------|--------|
| Agent DTO Types | ✅ |
| Input Adapter (5 modes) | ✅ |
| Event Candidate Extractor | ✅ |
| Policy Gate (4 policies) | ✅ |
| Context Builder | ✅ |
| Reply Planner (7 intents) | ✅ |
| Writeback Planner | ✅ |
| SDK Service Boundary | ✅ |
| Static SDK Harness | ✅ |

### Key Metrics (V12 RC)

| Metric | Value |
|--------|-------|
| Agent Tests | 163 |
| Total Tests | 2163 |
| Service Methods | 6 (5 read-only, 1 guarded write) |
| Safety Boundaries | 11 |

---

### Release Boundaries

Same as V10/V11 RC — single character, no chat, no multi, no deployment.

---

### Release Boundaries

- Single-character core only
- API-only (no frontend)
- No multi-character (V20 not started)
- No autonomous scheduler
- No server deployment
- No mobile

### Pre-V10 History

See `docs/` for detailed reports from V0.9 through V3.8, V10.10 through V10.29.
