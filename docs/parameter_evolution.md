# CharacterOS Parameter Evolution

## Purpose

Parameter Evolution defines how character values move over time.

The purpose of CharacterOS is not to hand-tune thousands of parameters.

The purpose is to design how parameters evolve.

## Core Principle

```text
Values are not fixed.
Values are alive.
```

Characters change because experiences create pressure.

But change must pass through:

```text
accumulation
threshold
inertia
homeostasis
recovery
```

## Evolution Route

Events should not directly modify parameters.

Preferred route:

```text
Event
-> Factor
-> Accumulation
-> Threshold
-> Target Value
-> Inertia
-> Current Value
-> Homeostasis
```

This means a single event rarely changes the person.

Repeated experiences matter more.

## Inertia

Parameters should resist instant movement.

Basic formula:

```text
current_value += (target_value - current_value) * inertia_rate
```

Low inertia means fast change.

High inertia means slow change.

But different systems have different time scales:

```text
emotion       fast
mood          medium
belief        slow
personality   very slow
baseline      extremely slow
```

## Accumulation

Events should create accumulated pressure.

Example:

```text
one abandonment event
-> fear spike
-> memory node
-> small abandonment pressure
```

Repeated events:

```text
many abandonment events
-> abandonment cluster mass grows
-> belief support grows
-> trust baseline slowly moves
```

Accumulation prevents isolated events from overfitting the character.

## Threshold

Not every pressure should become change.

Small pressure may fade.

Large repeated pressure may cross a threshold.

Example:

```text
abandonment_pressure < threshold
-> temporary anxiety

abandonment_pressure >= threshold
-> belief evolution
-> trust drift
-> boundary adaptation
```

## Target Values

The system should often move toward target values rather than applying direct deltas.

Avoid:

```text
self_control -= 0.2
```

Prefer:

```text
target_self_control = lower_under_stress
self_control moves toward target through inertia
```

## Baseline Drift

Baselines can change, but very slowly.

Example:

```text
temporary anxiety rises after conflict
baseline_anxiety barely moves

repeated conflict over months
baseline_anxiety slowly rises
```

Baseline drift should require:

```text
time
repetition
importance
emotion
reflection
recovery failure
```

## Resistance

Each parameter can resist change differently.

Examples:

```text
personality resistance
belief resistance
attachment resistance
habit resistance
boundary resistance
```

Resistance explains why people sometimes remain themselves even under pressure.

## Parameter Network Evolution

Parameters evolve in networks.

Example:

```text
poor sleep
-> fatigue rises
-> self_control falls
-> action_noise rises
-> conflict likelihood rises
-> relationship stress rises
```

This network should be traceable.

Every parameter movement should eventually answer:

```text
what pushed it?
what resisted it?
what stabilized it?
```

## Random Noise

Small random noise should exist.

Sources:

```text
weather
sleep quality
hormones
unknown reasons
environmental noise
```

Randomness should:

```text
add slight variation
avoid perfect determinism
never dominate personality
never replace causal structure
```

## Calibration

Evolution should be calibrated by replay and observation.

Observe:

```text
breakdown frequency
recovery speed
adaptation speed
behavior consistency
social repair likelihood
```

Calibration should adjust evolution rules, not merely patch individual values.

## Future Code Direction

```text
src/core/parameter-evolution/
  accumulation.ts
  inertia.ts
  threshold.ts
  targetValue.ts
  baselineDrift.ts
  evolutionTrace.ts
```

## Final Principle

Do not ask:

```text
What should this value be?
```

Ask:

```text
Why is this value moving?
What is it moving toward?
What resists it?
What brings it back?
```
