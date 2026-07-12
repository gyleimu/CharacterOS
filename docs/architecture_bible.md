# CharacterOS Architecture Bible

## Philosophy

CharacterOS is not a chatbot.

CharacterOS is not trying to generate stories.

CharacterOS is an experiment on digital minds.

The purpose is to explore one question:

```text
How does a person become who they are?
```

Characters are not defined by traits.

Characters are defined by experiences.

## Core Loop

```text
Experiences
-> Memories
-> Beliefs
-> Deficiencies
-> Desires
-> Emotions
-> Thoughts
-> Decisions
-> Actions
-> Consequences
-> New Experiences
```

This loop never stops.

## Current Runtime Shape

The architecture above is the philosophical loop.

The current codebase intentionally runs it as two phases:

```text
Phase 1: Event ingestion and physics mutation
Natural language event
-> ParsedExperienceEvent
-> ImpactParticle
-> MemoryNode
-> ImpactCluster
-> PersonalityDrift
-> Belief evidence assimilation
-> State and trace persistence
```

```text
Phase 2: Derived decision read model
Current CharacterPhysicsState
-> NeedDeficiency
-> DesireState
-> BehaviorBias
-> BehaviorDecision
-> WorldModel / Meaning / SocialMask / Embodiment views
```

This distinction matters.

`processEvent()` mutates the physical character state.

`deriveCharacterState()` derives the current psychological and behavioral view from that state.

`simulation/runner.ts` replays physics transitions. It does not automatically emit a final behavior decision unless a caller derives the state after replay.

## Product And Adapter Boundaries

```text
CharacterOS Core (headless, deterministic-first)
├── Physics / Memory / Belief / Need / Decision
├── Reality and quality audits
├── Explorer service contracts
└── Agent / LLM boundary contracts

Product surfaces
├── Explorer static artifact
├── MindSpace 3D read-only advanced observer
└── API routes
```

React, Next.js and Three.js belong to product surfaces. They must not be imported by `src/core/` and they have no direct state mutation authority. MindSpace visualizes semantic projections; it is not the source of personality physics values.

## Character Is Not The LLM

The LLM is not the character.

The LLM is only the deep reasoning engine.

The character itself exists in:

```text
Memories
Beliefs
Relationships
Emotions
Deficiencies
Desires
Habits
Instincts
```

Models can be replaced. CharacterOS remains.

## Continuous Living

Humans do not constantly think.

Humans constantly live.

Most of the time:

```text
Life
-> Instinct
-> Habit
-> Action
```

Only under uncertainty or conflict:

```text
Reflection
-> Deep Thinking
-> Decision
```

Characters should continue changing even when nobody is watching.

## Multi-Layer Mind Architecture

```text
Layer 0  Procedural Memory
Layer 1  Instinct
Layer 2  Habit System
Layer 3  Emotion System
Layer 4  Relationship System
Layer 5  Belief System
Layer 6  Deficiency and Desire System
Layer 7  Reflection System
Layer 8  Deep Thinking System
```

Deep Thinking is where an LLM may be used. It should be rare, threshold-triggered, and replaceable.

## Meta State System

Personality parameters are not fixed.

The parameters themselves are alive. Humans continuously change the way they experience the world.

Meta states influence all lower layers:

```text
Meta State
-> Mind
-> Beliefs
-> Desires
-> Emotions
-> Behavior
```

Meta parameters include:

```text
Memory Strength
Forgetting Speed
Attention
Psychological Boundary
Emotional Sensitivity
Resilience
Self-Control
Curiosity
Trust Growth Rate
Trust Decay Rate
Trauma Amplification
Loneliness Tolerance
Attachment Style
Need Satisfaction Threshold
```

These parameters are dynamic. They change throughout life.

Current Meta State V0 implementation:

```text
memoryStrength
forgettingSpeed
attention
emotionalSensitivity
resilience
selfControl
curiosity
trustGrowthRate
trustDecayRate
traumaAmplification
lonelinessTolerance
attachmentStyle
needSatisfactionThreshold
```

Continuous Tick V1 uses meta state to influence:

```text
effective memory decay rate
deep thinking threshold
emotional sensitivity drift
resilience drift
self-control drift
trauma amplification drift
attention drift
```

## Parameter Evolution System

The goal of CharacterOS is not to manually tune thousands of values.

The goal is to design how parameters evolve.

Values are not the core.

Evolution is the core.

Dedicated documents:

```text
docs/parameter_system.md
docs/parameter_evolution.md
docs/homeostasis_system.md
docs/recovery_system.md
```

### Relative Values

Avoid excessive precision.

Values are only relative.

Useful forms:

```text
very_low
low
normal
high
very_high
```

or broad ranges:

```text
0 ~ 100
0 ~ 1
```

Absolute precision is unnecessary.

Humans do not have exact numbers inside themselves.

### Baseline System

Every character should possess baselines.

Examples:

```text
baseline_anxiety
baseline_loneliness
baseline_self_control
baseline_curiosity
baseline_trust
```

After temporary fluctuations, values gradually return toward their own baselines.

Different characters have different baselines.

### Inertia System

Parameters should not change instantly.

Core rule:

```text
current_value += (target_value - current_value) * inertia_rate
```

Personality possesses resistance.

Emotion possesses resistance.

Beliefs possess resistance.

Large changes require time.

### Homeostasis System

Humans continuously seek equilibrium.

Examples:

```text
joy     -> calmness
sadness -> recovery
trauma  -> adaptation
```

Homeostasis opposes unlimited amplification.

Everything tends toward balance.

Change and stability coexist.

Homeostasis should become one of the most important systems inside CharacterOS.

Core principle:

```text
Life is not endless change.
Life is balance within change.
```

### Accumulation Instead Of Direct Modification

Events should not directly modify parameters.

The preferred route is:

```text
Events
-> Factors
-> Accumulation
-> Threshold
-> Parameter evolution
```

Long-term accumulation should matter more than isolated events.

### Recovery System

Parameters should recover gradually.

Not all damage is permanent.

Not all wounds disappear.

Recovery speed differs between characters.

Recovery itself changes with age and experiences.

### Parameter Network

Parameters should influence each other.

Example:

```text
fatigue
-> self_control decreases
-> psychological_boundary weakens
-> emotion_amplification increases
```

Parameters should form networks instead of independent values.

### Random Noise

Introduce unknown fluctuations.

Examples:

```text
weather
hormones
sleep quality
unknown reasons
```

Not everything should be explainable.

Small randomness should exist.

Randomness should be weak.

Randomness should never dominate personality.

### Statistical Distribution

Most characters should remain near normal ranges.

Extreme personalities should be rare.

Use probability distributions rather than manually assigning extreme values.

### Auto Calibration

Future versions should automatically adjust parameters by observing:

```text
breakdown frequency
social behavior
recovery speed
adaptation speed
```

The purpose is to approach believable human behavior.

### Evolution Layer

CharacterOS should contain:

```text
Parameter Layer
-> Evolution Layer
-> Homeostasis Layer
-> Mind Architecture
-> Behavior
```

Do not design parameters.

Design parameter evolution.

Humans are not fixed numbers.

Humans change.

Humans recover.

Humans adapt.

Humans repeat.

Humans fluctuate.

Humans seek balance.

The greatest ability of humans may not be change.

It may be maintaining themselves while changing.

## Social Mask And Multi-State

Humans do not always express their true thoughts.

True feelings, conscious explanations, spoken words and final behavior may diverge:

```text
True State
-> Conscious State
-> Social Mask
-> Language
-> Behavior
```

Current Social Mask V0 contains:

```text
trueState
consciousState
expressedState
behaviorState
maskPressure
honestyLevel
selfDeceptionLevel
lieType
conflictLevel
conflicts
```

Supported lie types:

```text
none
social_lie
kind_lie
malicious_lie
self_protection_lie
```

Social Mask V0 uses:

```text
PersonalityCoordinate
MetaState
PsychologicalBoundary
DesireState
BehaviorBias
BehaviorDecision
EmbodiedAction
```

This layer does not rewrite the decision. It explains how the same internal state may become a different conscious explanation, spoken line, and embodied behavior.

## Attention System

Attention determines what a character notices.

Different emotional and meta states produce different attentional biases:

```text
Love       -> attention focuses on one person
Anxiety    -> attention focuses on danger
Loneliness -> attention focuses on relationships
Stress     -> attention focuses on control or threat
```

Current Attention System V0 contains:

```text
danger
relationship
reward
novelty
control
```

Attention V0 uses:

```text
MetaState
PsychologicalBoundary
ExperienceEvent tags
```

It outputs:

```text
AttentionProfile
dominantChannel
noticedTags
attention score
reasons
```

Attention does not call the LLM. It is a lower-level perception filter.

## Memory Galaxy Model

Memory should not be represented as a list.

Memory behaves like a physical space:

```text
Memory node = particle
Importance = mass
Similarity = attraction
Time = decay
Center = personality core
Boundary = forgetting layer
Clusters = galaxies
```

Similar memories attract each other. Abandonment memories form an abandonment cluster. Love memories form a love cluster. Clusters eventually become personality.

## Trauma Model

Trauma behaves like a gravity well.

Old pain attracts new experiences. Trauma amplifies reactions. Trauma acts like a black hole inside the memory galaxy.

## Context Loading

An entire life should never be sent to the model.

```text
Layer 1  Core memories       Always loaded
Layer 2  Near-core memories  Loaded when relevant
Layer 3  Middle memories     Loaded only when strongly related
Layer 4  Boundary memories   Normally ignored
```

Strong triggers may reactivate boundary memories.

## Belief Evolution

Beliefs are not instant labels.

Beliefs are slow variables shaped by repeated evidence:

```text
Memory evidence
-> Belief support
-> Slow strengthening or weakening
-> Need and desire changes
```

Current Belief Evolution V0 contains:

```text
assimilateMemoryIntoBeliefs
evolveBeliefsForTick
BeliefEvolutionTrace
```

Events can add belief evidence through memories. Continuous Tick then slowly moves belief strength toward current memory support.

This layer does not directly rewrite personality. It also does not require LLM reasoning.

## Continuous Tick System

Characters should eventually run continuously.

Tick:

```text
Emotion update
Relationship update
Need update
Memory decay
Habit strengthening
Belief evolution
Reflection
```

Only when conflict exceeds a threshold:

```text
DeepThinking()
```

Most of the time:

```text
No LLM
```

Current Continuous Tick also updates:

```text
Memory recency decay
Memory effective weight decay
Psychological boundary recovery
Meta state slow drift
Attention profile before and after tick
Procedural routine slow decay
Reward state recovery
Homeostasis regulation
Belief strength evolution
Boredom and inspiration pressure
Recovery trace
Subjective time perception
Deep Thinking recommendation
```

## Procedural Memory

Humans do not think about everything.

Many behaviors are automatic:

```text
Phone vibration -> checking messages
Door in front of body -> opening it
Stress -> falling back to familiar routines
```

Current Procedural Memory V0 contains:

```text
ProceduralRoutine
ProceduralCue
ProceduralActivation
```

It uses:

```text
cueTags
strength
repetitionCount
MetaState.selfControl
MetaState.attention
PsychologicalBoundary.stressLoad
```

It outputs:

```text
cueMatch
automaticity
activationScore
action
reasons
```

Repeated routines strengthen. Unused routines decay slowly through Continuous Tick.

## Reward And Dopamine System

Humans are not goal machines.

Humans often chase rewards rather than achievements:

```text
Need
-> Desire
-> Action
-> Reward
-> Adaptation
-> New Desire
```

Current Reward V0 contains:

```text
dopamineLevel
dopamineThreshold
rewardSensitivity
noveltyNeed
adaptationRate
craving
```

Reward processing outputs:

```text
pleasure
rewardPredictionError
thresholdDelta
cravingDelta
adaptation
reasons
```

Repeated rewards produce hedonic adaptation. The same reward creates less pleasure over time. Harmful repeated rewards may still increase craving even when pleasure is weak.

Continuous Tick slowly recovers reward state toward baseline.

## Homeostasis And Adaptation

Humans do not change infinitely.

Every system seeks some kind of balance:

```text
excitement -> calm
sadness -> recovery
success -> adaptation
trauma -> rebuilding with scars
```

Current Homeostasis V0 contains:

```text
stabilitySetPoint
changeResistance
recoveryBias
moderationBias
scarRetention
```

It regulates:

```text
MetaState
PsychologicalBoundary
RewardState
```

It outputs:

```text
pressure
resistance
regulatedMetaState
regulatedBoundary
regulatedRewardState
reasons
```

Homeostasis is not a reset button. It pulls the system toward equilibrium while preserving inertia and scars.

This layer should be treated as a foundational principle, not just a feature module.

Many future systems can be understood as homeostasis expressed at different levels:

```text
emotion recovery
personality inertia
relationship repair
trauma adaptation
dopamine adaptation
psychological boundary change
belief stabilization
```

Detailed design:

```text
docs/homeostasis_system.md
docs/recovery_system.md
```

## Meaning System

Need, reward and meaning are independent systems.

Meaning may override reward.

Meaning may override pain.

People sometimes suffer willingly for things they believe matter.

Current Meaning V0 contains:

```text
MeaningAnchor
dominantAnchor
meaningIntensity
painTolerance
rewardOverride
existentialClarity
reasons
```

Meaning anchor types:

```text
relationship
self_protection
growth
truth
dignity
stability
```

Meaning V0 uses:

```text
BeliefState
NeedDeficiency
DesireState
PersonalityCoordinate
RewardState
```

It answers:

```text
What feels worth enduring pain for?
Can meaning override immediate reward?
Is the character clear about why they continue?
```

## Time Perception

Time is subjective.

Characters do not only experience clock time.

They experience interpreted time:

```text
waiting -> time stretches
loneliness -> time slows
fear -> time becomes heavy
joy / absorption -> time compresses
reward -> time feels shorter
```

Current Time Perception V0 contains:

```text
objectiveDuration
subjectiveDuration
multiplier
mode
waitingLoad
lonelinessLoad
absorptionLoad
distressLoad
reasons
```

Modes:

```text
compressed
normal
stretched
frozen
```

Time Perception V0 is produced for:

```text
events
continuous ticks
```

It helps explain why three days of waiting may feel psychologically longer than three ordinary days.

## World Model And Interpretation

Reality is not the same as the character's interpretation of reality.

Characters live inside subjective worlds:

```text
objective event
-> belief filter
-> emotional filter
-> memory pressure
-> time perception
-> subjective reality
```

Current World Model V0 contains:

```text
frame
subjectiveReality
confidence
distortionLevel
threatBias
trustBias
ambiguity
evidence
alternatives
```

Interpretation frames:

```text
threat
repair
rejection
opportunity
unknown
```

World Model V0 is produced for:

```text
event processing
derived current state
```

It keeps track of the gap between what happened and what the character believes happened.

## Boredom And Inspiration

Boredom is not useless.

Boredom can become:

```text
Curiosity
Exploration
Daydreaming
Creative pressure
Small action
```

Inspiration should not depend only on deep reasoning. It often appears when the mind has enough quiet space to recombine memories:

```text
rest
low stimulation
daydreaming
recovery
curiosity
```

Current Boredom / Inspiration V0 contains:

```text
boredomLevel
stimulationNeed
daydreamingTendency
creativePressure
restlessness
```

Continuous Tick V0 produces:

```text
explorationDrive
inspirationChance
restQuality
optional inspiration spark
```

This layer does not call the LLM and does not directly rewrite personality. It models low-level internal pressure during ordinary living.

## Embodiment Layer

Humans are not pure thoughts.

Humans have bodies. Humans are imperfect. Intention and behavior are not identical.

```text
Decision
-> Motor System
-> Noise
-> Final Action
```

Behavior contains randomness. Influencing factors include fatigue, hunger, age, pain, excitement, fear, and stress.

Imperfection is not a bug. Imperfection is humanity.

Current Embodiment V0 implementation:

```text
BehaviorDecision.mostLikelyAction
-> ActionNoise
-> EmbodiedAction.finalAction
```

Action Noise V0 uses:

```text
MetaState.selfControl
MetaState.resilience
MetaState.emotionalSensitivity
PsychologicalBoundary.stressLoad
PsychologicalBoundary.integrity
fatigue
pain
fear
excitement
skill
deterministic randomness
```

It outputs:

```text
intendedAction
finalAction
tone
noiseLevel
selfControlAvailable
misfireRisk
reasons
```

This layer does not rewrite the character's decision. It models how the same intention may become colder, shakier, more avoidant, or more impulsive when filtered through body, stress and limited control.

## Plot Emergence

Traditional writing:

```text
Plot
-> Characters react
```

CharacterOS:

```text
World
-> Characters
-> Interactions
-> Plot emerges
```

Characters should drive the story, not serve the plot.

## Current Implementation Mapping

Already implemented (core systems):

```text
MemoryNode
ImpactParticle
ImpactCluster
PersonalityCoordinate
PersonalityDrift with Momentum
PsychologicalBoundary
BiologicalNature prototype
TraceReplayArtifact
TraceReplaySummary
TraceReplaySummaryIndex
Continuous Tick V0
Action Noise V0
Procedural Memory V0
Social Mask V0
Reward Dopamine V0
Homeostasis V0
Meaning System V0
Time Perception V0
World Model V0
Boredom Inspiration V0
Belief Evolution V0
```

Infrastructure hardening (V3.8-V3.12):

```text
State integrity inspection
Character blueprint foundation
Export package with integrity snapshot + sha256 digest
Import plan with deep validation (coordinate, personality, cluster, memory)
Import apply with transaction steps + mutation outcome + pre-mutation snapshot
Import transition history
Parameter adjustment pipeline (draft → preview → audit → patch → snapshot → apply)
Parameter adjustment governance (cooldown, override, history)
API key protection (CHARACTEROS_API_KEY, mutation routes)
File repository lock with stale owner detection
Test environment isolation (Vitest in-memory repositories)
Tag normalization (English → Chinese canonical, 60+ entries, 8 domains)
Attention diagnostic (per-event evaluation, no personality mutation)
Calibration read-only API (clone + tick + hints + discard)
Continuous tick 17-phase documentation
Import partial failure tracking (mutationOutcome with per-step status)
API route error handling consistency (readJsonBody, routeUtils)
```

Continuous Tick V0 currently covers:

```text
Memory recency decay
Effective memory weight decay
Psychological boundary recovery
Meta state drift
Attention before/after tick
Procedural routine decay
Reward state recovery
Homeostasis regulation
Belief strength evolution
Boredom / inspiration dynamics
Recovery trace
Subjective time perception
Deep thinking threshold recommendation
No LLM call
No direct personality rewrite
```

Not implemented yet:

```text
Relationship update
Autonomous background scheduler
Multi-character society
```

V10 Longitudinal Life systems added since the above mapping:

```text
Life tick scheduler, energy/fatigue, sleep/wake, dream, boredom/inspiration,
random thought, self-action candidate (V10.1-V10.7)
Life tick dry-run runner (V10.8)
Life tick persistence boundary (V10.9)
Differentiated decision pipeline — ActivatedSchema, NeedProfile, DesireProfile,
BehaviorStrategy, ActionSurface (V10.12-V10.16)
Longitudinal single-character simulation harness — 720-step cap, deterministic
seed chain, compact summaries, dry-run default (V10.17-V10.19)
Longitudinal commit closed loop — finalStateForCommit, commit preview,
commit apply, commit rollback, audit trail (V10.20-V10.29)
```

## Long-Term Version Horizon

```text
V0    Single character, memory retrieval, LLM reasoning, decision
V1    Beliefs, needs, desires
V2    Memory clusters, reinforcement, personality galaxy
V3    Memory space, stronger physical model
V5    Continuous tick system
V10   Dynamic personality field
V20   Multi-character relationships
V50   Emergent stories
V100  Emergent societies
```

Ultimate goal:

```text
Characters should continue to exist, change and grow even when nobody is watching.
```
