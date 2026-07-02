# CharacterOS Recovery System

## Purpose

Recovery defines how characters heal, adapt, and reorganize after disturbance.

Recovery is part of homeostasis, but it deserves its own model because healing is not the same as simple value normalization.

## Core Philosophy

Not all damage is permanent.

Not all wounds disappear.

Recovery should mean:

```text
the system regains function
while retaining history
```

Healing is not undoing experience.

Healing is reorganizing around experience.

## Recovery Is Not Erasure

Avoid:

```text
trauma happened
time passed
state returns to original
```

Prefer:

```text
trauma happened
emotion gradually stabilizes
boundary partially repairs
beliefs may remain changed
trust may recover through evidence
scars may persist
baseline may drift slightly
```

The character can become functional again without becoming who they were before.

## Recovery Targets

Recovery can act on many layers:

```text
emotion
mood
psychological_boundary
reward_state
self_control
fatigue
trust
loneliness
relationship_expectation
meaning_orientation
```

Each layer should have its own recovery speed and resistance.

## Recovery Inputs

Recovery is affected by:

```text
time
safety
sleep
rest
social_support
successful_repair
meaning
low_stress_periods
predictability
repeated_positive_evidence
```

Recovery should accelerate when the character repeatedly experiences safety.

## Recovery Obstacles

Recovery can be slowed by:

```text
repeated_triggers
rumination
loneliness
fatigue
uncertainty
lack_of_explanation
unstable_reward
low_boundary_integrity
high_trauma_amplification
```

The system should not assume that time alone heals everything.

Time helps only when the environment allows stabilization.

## Recovery Curve

Recovery is usually not linear.

A useful first approximation:

```text
early recovery  -> faster relief
late recovery   -> slower repair
scar retention  -> partial remaining shift
```

Possible formula:

```text
next_value = current_value + (baseline - current_value) * recovery_rate * safety_factor
scar = retained_delta * scar_retention
```

This is not exact biology.

It is a practical psychological simulation rule.

## Character-Specific Recovery

Different characters should recover differently.

Recovery depends on:

```text
resilience
self_control
psychological_boundary
attachment_style
support_history
trust_baseline
meaning_system
previous_recovery_success
```

Two characters can experience the same event and recover in very different ways.

## Recovery Can Evolve

Recovery speed is not fixed.

Repeated successful recovery can increase resilience.

Repeated failed recovery can create learned helplessness, numbness, or avoidance.

Examples:

```text
supported after pain
-> safety evidence grows
-> recovery confidence increases

abandoned after pain
-> safety evidence weakens
-> recovery slows
-> loneliness tolerance may distort
```

## Relationship Recovery

Relationship repair should require repeated evidence.

Avoid:

```text
apology -> trust restored
```

Prefer:

```text
apology
-> temporary relief
-> observation period
-> repeated consistency
-> trust slowly recovers
```

Trust recovery should be slower than trust damage for sensitive characters.

## Trauma Recovery

Trauma recovery should include adaptation and scar retention.

The goal is not perfect removal.

Possible outcomes:

```text
functional recovery
defensive adaptation
meaning reconstruction
boundary thickening
emotional numbness
avoidance pattern
new baseline
```

The outcome depends on homeostasis, support, meaning, repetition, and the character's prior structure.

## Future Code Direction

```text
src/core/recovery/
  recoveryCurve.ts
  safetyFactor.ts
  obstacleFactor.ts
  scarRetention.ts
  relationshipRecovery.ts
  recoveryTrace.ts
```

## Dashboard Direction

Future dashboard should show:

```text
current deviation from baseline
recovery speed
safety factor
obstacle factor
scar retention
expected stabilization time
```

This will let human creators tune recovery behavior without manually editing thousands of hidden values.

## Final Principle

Recovery is not the opposite of change.

Recovery is one way change becomes livable.
