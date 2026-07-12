# Temporal Semantics Audit

**Version:** 14.0.0
**Verdict:** PASS

| Case | Verdict | Assertions |
|------|---------|------------|
| repeat_saturation | PASS | 4/4 |
| spaced_recovery | PASS | 3/3 |
| concentrated_vs_spaced | PASS | 3/3 |
| passive_recovery | PASS | 5/5 |
| neutral_stability | PASS | 2/2 |
| out_of_order_protection | PASS | 3/3 |
| deterministic_replay | PASS | 1/1 |

## Known Limitations

- The 24-hour density window and 14-day velocity half-life are engineering priors pending empirical calibration.
- Out-of-order events are audited and prevented from rewinding the clock, but are not automatically replayed in causal order.
- Legacy untimed calls preserve pre-V14 behavior and cannot model elapsed-time recovery until a clock is established.
