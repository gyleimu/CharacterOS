# Model Calibration Audit

**Version:** 14.1.0
**Verdict:** PASS
**Parameter set:** model-calibration-v1.0.0
**Parameter fingerprint:** model-parameters_6c3b07f4

## Coverage

- Golden trajectories: 160/160
- Scenario projections: 640
- Relevant scenario response rate: 89.3%
- Category decision coverage: 10/10
- Generated property sequences: 16/16
- Metamorphic checks: 5/5
- Sensitivity checks: 7/7
- Assertions: 914/914

| Event category | Passing trajectories | Relevant response | Max 5-event decision distance |
|----------------|----------------------|-------------------|-------------------------------|
| abandonment | 16/16 | 95.8% | 0.001 |
| support | 16/16 | 95.8% | 0.0005 |
| betrayal | 16/16 | 100.0% | 0.001 |
| success | 16/16 | 100.0% | 0.0005 |
| failure | 16/16 | 100.0% | 1.0387 |
| rejection | 16/16 | 91.7% | 0.0008 |
| conflict | 16/16 | 87.5% | 0.0008 |
| fatigue | 16/16 | 50.0% | 0.0006 |
| uncertainty | 16/16 | 72.2% | 0.0006 |
| general | 16/16 | n/a | 0.0005 |

## Repair Asymmetry

- Damage: 0.0399
- Repair: 0.0191
- Scar retention ratio: 0.5209

## Sensitivity

| Parameter | Lower metric | Baseline | Upper metric | Verdict |
|-----------|--------------|----------|--------------|---------|
| temporal.repeatDensityPressureWeight | 2.9396 | 2.8724 | 2.8114 | PASS |
| temporal.personalityVelocityHalfLifeDays | 0.4629 | 0.5 | 0.5325 | PASS |
| memory.recencyFloor | 1.466 | 1.4748 | 1.4835 | PASS |
| memory.defaultDecayRate | 0.63 | 0.5987 | 0.5689 | PASS |
| boundary.positiveSafetyImpactScale | 0.1365 | 0.1517 | 0.1669 | PASS |
| boundary.negativeStressBase | 0.4584 | 0.4805 | 0.5026 | PASS |
| personality.standardLearningBase | 0.0084 | 0.0089 | 0.0094 | PASS |

## Known Limitations

- Golden ranges establish internal engineering plausibility; they are not clinical or population validity evidence.
- Category coordinate templates are governed by trajectory checks but are not yet independently fitted from observed longitudinal data.
- The audit samples deterministic generated sequences; it cannot exhaust every legal event ordering.
- Out-of-order historical insertion still requires future event-store replay rather than local retroactive recomputation.
- Fatigue is represented by the separate life-simulation energy channel, but CharacterPhysicsState does not yet persist that transient state; fatigue decision response can therefore rely on boundary effects until durable-state schema work lands.
