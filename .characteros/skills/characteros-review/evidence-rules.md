# CharacterOS Review Evidence Rules

## Evidence Hierarchy

Prefer evidence in this order:

1. reproduced runtime behavior or failing test;
2. executable implementation and contracts;
3. committed tests and audit assertions;
4. generated gate output whose generator was inspected;
5. active architecture and roadmap documentation;
6. historical reports and completion summaries.

A report saying `PASS` is not independent evidence if its gate can skip the relevant path.

## Acceptance Labels

- `PASS`: the claimed property was exercised and met its acceptance criteria.
- `WARN`: behavior remains usable, but evidence, calibration, relevance, or guard coverage is incomplete.
- `FAIL`: a required invariant or acceptance criterion is violated.
- `NOT VERIFIED`: the check was not run, could not run, or depends on unavailable external state.

Never replace `NOT VERIFIED` with `PASS` based on prior output, memory, or a user-provided summary.

## Test Quality Checks

Reject tests as sufficient when they:

- assert only that a function returned a value;
- duplicate the implementation formula in the assertion;
- use a fixture-specific branch in production code;
- verify prose but not structured state deltas;
- check only the top decision while ignoring candidate scores and strategy distribution;
- omit neutral, counterfactual, different-baseline, replay, or out-of-order cases where relevant;
- rely on real wall-clock timing or unseeded randomness;
- allow a skipped sub-gate to count as a release pass.

## Core Behavioral Evidence

For personality or event-pipeline changes, require evidence that:

- a relevant event causes bounded, directionally plausible state changes;
- a neutral or irrelevant event does not overreact;
- repeated events accumulate with saturation;
- recovery is visible but does not erase history instantly;
- different baselines produce differentiated responses;
- replay with equal inputs and logical time is identical;
- decision influence cites the actual state delta;
- explanation trace cites structured evidence rather than invented prose.

## Reporting Commands

Record exact commands, exit status, test counts when available, and any skipped sub-gates. A focused Vitest run is focused evidence, not proof that `npm test` or `npm run rc:verify` passed.
