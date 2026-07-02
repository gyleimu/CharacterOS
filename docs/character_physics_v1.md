# Character Physics V1

CharacterOS is moving from a prompt-centered character engine to an
experience-driven personality system.

The new highest abstraction is the personality galaxy:

```text
Event
↓
Emotion
↓
Memory Node
↓
Impact Particle
↓
Impact Cluster
↓
Personality Drift
```

This does not remove memory, belief, need, desire, or behavior. It changes their
role:

- Emotion, memory, belief, need, desire, and behavior are fast variables.
- Personality is a slow variable.
- Events do not directly rewrite personality.
- Events create memory nodes.
- Events create impact particles.
- Similar particles form clusters.
- Clusters slowly pull the personality core.

## Unified Impact Benchmark

All subsystems communicate through:

```text
impact_score ∈ [0, 1]
```

Bands:

- `0 ~ 0.05`: negligible, 几乎无影响
- `0.05 ~ 0.15`: minor, 轻微影响
- `0.15 ~ 0.3`: normal, 普通影响
- `0.3 ~ 0.5`: major, 重大影响
- `0.5 ~ 0.8`: traumatic, 创伤级
- `0.8 ~ 1`: life_changing, 改变人生轨迹

Current factors:

- intensity
- importance
- relationship_weight
- expectation_gap
- personality_sensitivity

## Personality Core

The current V1 core vector is Big Five:

```text
P = [O, C, E, A, N]
```

Where:

- O: openness
- C: conscientiousness
- E: extroversion
- A: agreeableness
- N: neuroticism

Values are normalized to `[0, 1]`.

## Personality Coordinate Space

Character Physics also defines an expandable coordinate system.

Current active dimensions:

- openness
- conscientiousness
- extroversion
- agreeableness
- neuroticism
- trust
- attachment
- fear
- control

The Big Five vector remains the first drift-compatible vector. The coordinate
space is the broader personality map for future extensions.

## 9D Event Impact Vector

EventImpactVector now uses the full personality coordinate space:

```text
Δ = {
  openness,
  conscientiousness,
  extroversion,
  agreeableness,
  neuroticism,
  trust,
  attachment,
  fear,
  control
}
```

Big Five drift remains as a compatibility projection. Full coordinate drift is
the primary V1 personality-space movement.

## Impact Particle

An event creates an impact particle:

```text
ImpactParticle:
- id
- description
- vector
- impact_score
- emotion
- category
```

The particle has direction and mass. It does not directly change personality.

## Memory Node

Each processed event also creates a MemoryNode:

```text
MemoryNode:
- id
- content
- vector
- importance
- emotion
- recency
- repetition_count
- belief_effect
- time_stamp
- cluster_id
```

MemoryNode uses the full personality coordinate vector. It is stored in
`CharacterPhysicsState.memories` and linked to the cluster formed by the event.

Current boundary:

- Memory decay is implemented as recency decay.
- Memory resonance is not implemented yet.
- MemoryNode generation is deterministic enough for tests and simulation.

## Memory Decay

Memory recency decays over simulated time:

```text
recency(t) = recency(0) * exp(-decay_rate * days_elapsed)
```

Current helper:

```text
effective_memory_weight = importance * recency * repetition_bonus
```

This affects memory availability. It does not directly change personality.

## Impact Cluster

Similar particles accumulate into an impact cluster:

```text
ImpactCluster:
- center_coordinate
- center_vector (Big Five projection)
- mass
- density
- stability
- category
```

Repeated similar experiences create stable clusters.

`center_coordinate` is the primary 9D cluster center. `center_vector` remains as
a Big Five compatibility projection.

## Personality Drift

Personality changes slowly:

```text
P(t+1) = P(t) + Σ(cluster_force) * learning_rate
```

Coordinate drift now uses cluster gravity:

```text
cluster_force = center_coordinate * mass * stability
```

Current default:

```text
learning_rate = 0.03
```

## Repeated Experience Simulation

`simulation/` can run event sequences and record snapshots.

Each snapshot records:

- step
- event_id
- memory_id
- category
- impact_score
- memory_repetition_count
- memory_recency
- memory_effective_weight
- cluster_mass
- cluster_density
- cluster_stability
- cluster_age
- personality coordinate

Run:

```bash
python character_os/simulation_demo.py
```

## 2D Preview

The first preview is a simple SVG projection:

```text
x = trust
y = fear
```

Run:

```bash
python character_os/visualization_preview.py
```

Output:

```text
outputs/personality_space_preview.svg
```

The purpose is to verify the slow-variable rule:

```text
one event: tiny drift
repeated similar events: heavier cluster, stronger long-term pull
```

## Current Code

New modules:

```text
character_os/
├── benchmark/
│   └── impact.py
├── personality/
│   └── vector.py
├── emotion/
│   └── model.py
├── memory/
│   └── node.py
├── cluster/
│   └── impact_cluster.py
├── drift/
│   └── system.py
├── simulation/
│   └── runner.py
├── physics_engine.py
├── physics_demo.py
└── simulation_demo.py
```

Run:

```bash
python character_os/physics_demo.py
```

## Boundary

Character Physics V1 is a foundation layer.

It does not yet replace the old prompt pipeline. The old pipeline remains useful
for LLM-based psychological explanation, while the new physics layer becomes the
source of personality evolution.
