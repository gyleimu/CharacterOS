# CharacterOS Review Rules

## Severity

- `CRITICAL`: state corruption, unauthorized mutation, secret exposure, unsafe diagnosis, release-gate bypass, or irreversible data loss.
- `HIGH`: wrong causal propagation, replay divergence, persistent history loss, deterministic identity break, or major architecture violation.
- `MEDIUM`: realistic behavior gap, incomplete guard, misleading contract, ungrounded explanation, or missing regression protection.
- `LOW`: localized maintainability, clarity, cleanup, or test-strengthening issue without a current behavioral failure.

Do not inflate severity for style preferences. Do not lower severity because a defect is difficult to trigger.

## Finding Standard

Every finding must contain:

1. severity and concise title;
2. exact file and tight line reference;
3. the violated contract or invariant;
4. concrete runtime consequence;
5. reproduction or code-path evidence;
6. smallest credible repair direction;
7. missing regression test, when applicable.

Separate confirmed defects from hypotheses. Label a plausible but unproven risk as a question or `NOT VERIFIED`, not as a bug.

## Review Order

Review in this order:

1. data loss, mutation, security, and safety;
2. causal correctness and personality continuity;
3. temporal semantics, determinism, replay, and idempotency;
4. persistence and service ownership;
5. decision grounding and explanation trace;
6. tests, audits, and release claims;
7. maintainability and local code quality;
8. style only when it affects correctness or comprehension.

## Diff Review

- Inspect surrounding code, callers, contracts, and tests, not only changed lines.
- Check deleted behavior and changed defaults as carefully as added behavior.
- Detect unrelated refactors and generated-file churn.
- Confirm compatibility and migration behavior when a DTO, event, snapshot, or persisted shape changes.
- Check whether tests fail for the intended reason before accepting a fix.

## Post-Fix Review

After remediation:

1. re-read the actual diff from the baseline;
2. rerun the focused reproduction;
3. check that the new test would fail on the old behavior;
4. inspect adjacent paths for equivalent defects;
5. run the risk-appropriate gates;
6. classify each original finding as fixed, partially fixed, accepted, or unresolved;
7. look for regressions introduced by the repair.
