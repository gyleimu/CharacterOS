# Character Physics Engine V1 Upgrade Blueprint

This document is the long-term constitution for CharacterOS.

Current execution flow is tracked in:

```text
docs/latest_development_flow.md
```

The short-term priority is V2 Personality Galaxy core. 3D visualization,
multi-character systems, world simulation, relationship graphs, and benchmark
standardization are intentionally deferred.

Current V0.x functionality must not be deleted. The project should evolve
gradually from a prompt-centered character engine into an experience-driven
character physics engine.

## Core Idea

Characters are not static attribute bundles.

A character is a dynamic system in a multidimensional personality space.
Experiences form impact factors. Impact factors form clusters. Clusters slowly
pull the personality core over time. The character evolves along a worldline.

## First Principles

- Do not rewrite everything from scratch.
- Do not delete existing features.
- Do not implement all theory in one pass.
- Analyze first.
- Abstract first.
- Build data structures first.
- Build pure logic first.
- Refactor gradually.

## Personality Is Not A Profile

Personality is a core vector.

Initial vector:

```text
P = [O, C, E, A, N]
```

Where:

- O: openness
- C: conscientiousness
- E: extroversion
- A: agreeableness
- N: neuroticism

Future vector:

```text
P = [
  open,
  conscientious,
  extroversion,
  agreeableness,
  neuroticism,
  trust,
  ambition,
  attachment,
  fear,
  control,
  morality
]
```

## Events Do Not Directly Change Personality

Forbidden:

```text
if breakup:
    neuroticism += 0.2
```

Actual path:

```text
Event
↓
Emotion
↓
Memory
↓
Belief
↓
Need Deficiency
↓
Desire
↓
Behavior
↓
Repeated Behavior
↓
Personality Drift
```

Personality is a slow variable.

Emotion and memory are fast variables.

## Event Impact Vector

Each event produces:

```text
EventImpactVector = [
  Δopenness,
  Δconscientiousness,
  Δextroversion,
  Δagreeableness,
  Δneuroticism,
  Δtrust,
  Δattachment,
  Δfear,
  Δcontrol
]
```

It also has:

- intensity
- importance
- emotion
- relationshipWeight
- expectationGap
- personalitySensitivity

Unified output:

```text
impactScore ∈ [0, 1]
```

Bands:

- `0 ~ 0.05`: negligible, 几乎无影响
- `0.05 ~ 0.15`: minor, 轻微影响
- `0.15 ~ 0.3`: normal, 普通影响
- `0.3 ~ 0.5`: major, 重大影响
- `0.5 ~ 0.8`: traumatic, 创伤级
- `0.8 ~ 1`: life_changing, 改变人生轨迹

## Memory Galaxy Model

Memory is not a list. It is a space.

MemoryNode:

- vector
- emotion
- importance
- recency
- repetitionCount
- beliefEffect
- timeStamp
- clusterId

Memory can:

- decay
- reinforce
- reactivate
- resonate
- cluster

## Impact Cluster

Similar experiences accumulate.

Examples:

- betrayal cluster
- success cluster
- love cluster
- trauma cluster
- friendship cluster

Cluster:

- centerCoordinate
- centerVector
- mass
- density
- stability
- category
- age

Large repeated clusters become gravitational structures.

Implementation note: `centerCoordinate` is the primary personality-space center.
`centerVector` can remain as a projection for compatibility.

## Personality Drift

The personality core is slowly pulled by clusters:

```text
P(t+1) = P(t) + Σ(cluster_force) * learningRate
```

Personality changes must be slow.

Events must never instantly rewrite personality.

## Parameter Evolution System

The long-term goal is not to manually tune thousands of values.

The goal is to design how parameters evolve.

CharacterOS should avoid excessive precision. Values are relative, not exact.

Allowed representations:

```text
very_low
low
normal
high
very_high
```

or broad numeric ranges:

```text
0 ~ 100
0 ~ 1
```

Humans do not contain exact internal numbers.

### Baselines

Every character should possess personal baselines:

```text
baseline_anxiety
baseline_loneliness
baseline_self_control
baseline_curiosity
baseline_trust
```

After temporary fluctuations, values gradually return toward the character's own baselines.

Different characters should not share one universal default mind.

### Inertia

Parameters should not change instantly.

General form:

```text
current_value += (target_value - current_value) * inertia_rate
```

Personality, emotion and belief all possess resistance.

Large changes require time.

### Homeostasis

Humans continuously seek equilibrium:

```text
joy     -> calmness
sadness -> recovery
trauma  -> adaptation
```

Homeostasis opposes unlimited amplification.

Change and stability coexist.

Homeostasis should become a central CharacterOS system.

### Accumulation Instead Of Direct Modification

Events should not directly modify parameters.

Preferred path:

```text
Events
↓
Factors
↓
Accumulation
↓
Threshold
↓
Parameter evolution
```

Long-term accumulation should matter more than isolated events.

### Recovery

Parameters should recover gradually.

Not all damage is permanent.

Not all wounds disappear.

Recovery speed differs between characters and may itself change with age and experience.

### Parameter Network

Parameters should influence each other.

Example:

```text
fatigue
↓
self_control decreases
↓
psychological_boundary weakens
↓
emotion_amplification increases
```

Parameters should form a network, not independent sliders.

### Random Noise

Weak unknown fluctuations should exist:

```text
weather
hormones
sleep quality
unknown reasons
```

Randomness should never dominate personality.

### Statistical Distribution

Most characters should remain near normal ranges.

Extreme personalities should be rare.

Use distributions rather than manually assigning extreme values everywhere.

### Auto Calibration

Future versions should observe:

```text
breakdown frequency
social behavior
recovery speed
adaptation speed
```

and gradually self-correct to approach believable human behavior.

### Evolution Layer

CharacterOS should be organized conceptually as:

```text
Parameter Layer
↓
Evolution Layer
↓
Homeostasis Layer
↓
Mind Architecture
↓
Behavior
```

Do not design parameters.

Design parameter evolution.

Humans are not fixed numbers.

Humans maintain themselves while changing.

## Time Dimension

The system is not just spatial. It is temporal.

```text
(x, y, z, t)
```

Personality is a worldline:

```text
Personality(t)
```

Timescales:

- Emotion Time: seconds
- Memory Time: days
- Belief Time: months
- Personality Time: years

## Future Directions

Do not implement these yet. Preserve conceptual interfaces.

- Embedding Space
- Automatic Cluster Algorithm
- Potential Field
- Dynamic System
- Bayesian Belief Update
- Markov Emotion Process
- Relationship Graph Network
- Phase Transition

## Code Structure Goal

```text
personality/
memory/
emotion/
belief/
need/
desire/
behavior/
relationship/
cluster/
drift/
benchmark/
time/
math/
simulation/
```

Avoid god objects.

Prefer:

- low coupling
- domain-driven design
- Entity + Component + System
- testability
- compatibility with V0.x

## Current Implementation Target

Do not implement advanced theory yet.

Current target:

- analyze current project
- define upgrade route
- establish type system
- implement PersonalityVector
- implement personality coordinate space
- implement EventImpactVector on the full personality coordinate space
- implement MemoryNode generation from processed events
- implement minimal MemoryNode recency decay
- implement ImpactCluster
- implement PersonalityDrift
- implement repeated-event simulation snapshots
- write tests
- keep existing V0.x functionality running

Final direction:

```text
Character Physics Engine
```

Not:

```text
Prompt Character Engine
```
