# CharacterOS Parameter System

## Purpose

CharacterOS should not become a giant table of manually tuned numbers.

The parameter system exists to describe relative tendencies, baselines and current states.

It should support believable evolution, not exact measurement.

## Core Principle

```text
Parameters are not the person.
Parameters are traces of how the person currently tends to function.
```

The deeper goal is not to define many values.

The deeper goal is to define:

```text
how values move
how values recover
how values resist change
how values influence each other
```

## Relative Values

Avoid excessive precision.

Humans do not contain exact internal numbers.

Recommended representations:

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

Decimal precision should be treated as computational convenience, not psychological truth.

## Parameter Categories

### Baseline Parameters

Baseline parameters describe where a character tends to return.

Examples:

```text
baseline_anxiety
baseline_loneliness
baseline_self_control
baseline_curiosity
baseline_trust
baseline_reward_sensitivity
baseline_boundary_integrity
```

Different characters should have different baselines.

There should not be one universal default mind.

### Current Parameters

Current parameters describe temporary state.

Examples:

```text
current_anxiety
current_loneliness
current_self_control
current_curiosity
current_trust
current_dopamine_level
current_boundary_stress
```

Current values can move quickly.

Baselines should move slowly.

### Evolution Parameters

Evolution parameters describe how quickly values move.

Examples:

```text
inertia_rate
recovery_rate
adaptation_rate
learning_rate
decay_rate
resistance
plasticity
```

These are not merely numbers.

They describe a character's ability to change.

### Sensitivity Parameters

Sensitivity parameters describe what affects a character more strongly.

Examples:

```text
abandonment_sensitivity
betrayal_sensitivity
social_reward_sensitivity
novelty_sensitivity
stress_sensitivity
attachment_sensitivity
```

Sensitivity should be shaped by experience.

### Network Parameters

Some parameters exist mainly because they influence other parameters.

Example:

```text
fatigue
-> self_control decreases
-> psychological_boundary weakens
-> emotion_amplification increases
-> action_noise increases
```

Parameters should form a network, not isolated sliders.

## What Parameters Should Not Do

Parameters should not instantly rewrite the character.

Avoid:

```text
if breakup:
  trust -= 0.4
```

Prefer:

```text
event
-> emotional factor
-> memory
-> belief evidence
-> repeated accumulation
-> parameter pressure
-> slow evolution
```

## Suggested Future Structure

```text
src/core/parameter/
  parameterValue.ts
  baseline.ts
  parameterState.ts
  parameterNetwork.ts
  parameterTrace.ts
```

## Relationship To Other Systems

```text
Parameter System
-> Parameter Evolution
-> Homeostasis
-> Recovery
-> Mind Architecture
-> Behavior
```

The parameter system stores values.

The evolution system moves values.

The homeostasis system balances values.

The recovery system restores values without erasing history.

## Final Principle

Do not worship values.

Values are only shadows.

The real system is how a character changes, resists change and returns to themselves.
