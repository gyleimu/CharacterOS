# CharacterOS Core Polish Plan

## Purpose

The project has enough V0 systems.

The next phase should slow down and polish existing core parts instead of adding more concepts.

Polish principle:

```text
one subsystem
-> inspect assumptions
-> add edge tests
-> tune parameters
-> improve trace visibility
-> document behavior
-> run full verification
```

## Quality Bar

Every polished subsystem should answer:

```text
What state does it own?
What changes it?
How fast can it change?
What should never change it?
What trace proves it behaved correctly?
What tests protect its edge cases?
```

## Polish Queue

### 1. Belief Evolution

Goal:

```text
Beliefs are slow variables shaped by repeated memory evidence.
```

Polish checklist:

```text
prevent duplicate memory evidence
use diminishing returns for repeated evidence
ensure unsupported beliefs decay slowly
ensure zero time causes no change
make World Model read persistent beliefs
add replay cases for repeated abandonment and repair beliefs
```

Current status:

```text
V3.7.1 started
duplicate evidence guarded
diminishing returns added
zero-time guard tested
World Model now uses persistent beliefStates
```

### 2. Continuous Tick

Goal:

```text
Characters keep living without new events or LLM calls.
```

Polish checklist:

```text
make tick order explicit
separate tick phases into small systems
trace before/after for every changed state
ensure personality coordinate does not drift during pure tick unless explicitly designed
test 1 day / 7 days / 30 days / 180 days behavior
```

Current status:

```text
V3.7.2 started
phase trace added
zero-day stability tested
180-day recovery window tested
Dashboard shows tick phase order
```

### 3. CharacterPhysicsEngine

Goal:

```text
Keep event processing readable and avoid a God Object.
```

Polish checklist:

```text
extract impact particle creation
extract memory and belief update
extract procedural and reward update
extract interpretation step
preserve existing API shape
test processEvent result parity
```

Current status:

```text
V3.7.3 started
processEvent split into internal pipeline helpers
external PhysicsStepResult shape preserved
event pipeline coherence test added
```

### 4. Memory Galaxy

Goal:

```text
Memory particles, clusters and force should behave consistently.
```

Polish checklist:

```text
verify mass formula
verify density and stability edge cases
verify empty cluster behavior
verify force does not explode at tiny distance
verify repeated memories form stronger but bounded attraction
```

Current status:

```text
V3.7.4 swept
cluster force magnitude capped
personality velocity capped
extreme near-core force tested
single-step rewrite protection tested
```

### 5. Psychological Boundary

Goal:

```text
Boundary decides what the character can absorb before overflow.
```

Polish checklist:

```text
test stable / strained / overflow transitions
test recovery over time
test cracks and integrity interaction
test how boundary changes drift multiplier
avoid personality rewrite through boundary
```

Current status:

```text
V3.7.4 swept
phase normalization added
zero-day recovery guard tested
inconsistent phase input tested
```

### 6. Reward And Homeostasis

Goal:

```text
Rewards motivate behavior but adaptation and balance prevent runaway states.
```

Polish checklist:

```text
test repeated reward adaptation
test harmful craving cases
test recovery toward baseline
test homeostasis moderates extremes without erasing scars
```

Current status:

```text
V3.7.4 swept
reward input normalization added
extreme reward input tested
existing homeostasis recovery tests retained
```

### 7. Procedural Memory And Embodiment

Goal:

```text
Intentions, habits and final actions should be allowed to diverge.
```

Polish checklist:

```text
test cue matching
test automaticity under stress
test routine decay
test action noise under low self-control
ensure final action remains explainable in trace
```

Current status:

```text
V3.7.4 swept
cue tag deduplication added
topK=0 explicit no-activation behavior added
existing action noise tests retained
```

### 8. Dashboard

Goal:

```text
The interface should reveal state changes without becoming unreadable.
```

Polish checklist:

```text
group panels by event / continuous tick / internal state
hide low-level metrics behind compact sections
highlight what changed most recently
show trace reasons in readable Chinese
avoid adding visual complexity before the model is stable
```

Current status:

```text
V3.7.4 swept
no large UI expansion
existing tick phase visibility retained
```

## Rule For The Next Phase

Do not add a new psychological system until at least one existing subsystem has:

```text
edge tests
parameter notes
trace visibility
one polish report
full build/test verification
```
