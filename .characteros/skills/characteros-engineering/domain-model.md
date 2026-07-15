# CharacterOS Domain Model

## Core Principle

A character is an evolving causal system shaped by experience, memory, interpretation, needs, and recovery. The model is a simulation, not a medical or psychological diagnosis.

## Primary Entities

### ParsedExperienceEvent

Structured interpretation of input evidence. Preserve source text boundaries, category, emotion, intensity, confidence, logical occurrence time, repetition, and context. Parsing confidence limits downstream certainty.

### ImpactParticle

Calibrated, bounded event effect. It carries direction and magnitude into relevant channels. It is evidence for later state evolution, not permission to overwrite personality directly.

### MemoryNode

An experienced episode with time, emotion, importance, links, retrieval strength, and decay/reinforcement behavior. Memory payloads are private core data and should be exposed through bounded DTOs only.

### ImpactCluster

Accumulated related evidence. Cluster force must saturate and show diminishing marginal effect. Repetition, recency, novelty, and context determine effective contribution.

### Personality State

The current implementation uses coordinates plus drift/velocity. Treat these as engineering state, not empirically validated trait scores. Preserve slow-channel behavior and bounded updates.

The target model separates:

- trait baseline: long-term attractor;
- transient state: current expression;
- state distribution: mean, variance, inertia over time;
- context profile: relationship, achievement, social, fatigue, and other domains;
- dynamics parameters: plasticity, attractor strength, consolidation, and uncertainty.

### BeliefState

Evidence-weighted interpretation learned from events and memories. Beliefs strengthen, weaken, compete, and decay; they must cite supporting evidence and cannot be generated from explanation prose alone.

### NeedDeficiency And DesireState

Read models derived from current state, beliefs, boundary, emotion, and context. They are not independent mutable truth. Deficiency creates motivational pressure; desire expresses a direction for reducing or managing it.

### Boundary, Emotion, Energy, And Recovery

Fast or medium channels that shape current expression and decision capacity. Fatigue, acute fear, or boundary stress should normally alter state and action tendency before they alter long-term trait baselines.

### Decision Surface

Contains structured candidates, scores, rank, strategy tags, risk profile, and approach style. It consumes scenario relevance plus grounded state deltas. Natural-language explanation describes this surface; it does not create it.

### Trace And Audit

Every accepted transition should be reconstructable from event, parsed evidence, impact, state diff, decision influence, and engine semantics version. Audits are read-only and fail closed on missing grounding.

## Invariants

1. No direct personality rewrite from input or UI.
2. No durable change without calibrated evidence and temporal semantics.
3. No decision explanation without structured causal references.
4. No LLM authority over core state or writeback.
5. No hidden mutation in preview, audit, derive, or visualization paths.
6. No multi-character/relationship engine until the roadmap opens that boundary.
7. No claim of scientific or clinical validity without external empirical calibration.

## Current Scientific Limitation

The system has strong engineering audits, but engineering consistency is not psychological validity. Parameter weights remain hypotheses until calibrated against longitudinal observations. Use uncertainty, shadow evaluation, and versioned parameters; never tune solely to make fixtures pass.
