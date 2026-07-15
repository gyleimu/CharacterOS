# CharacterOS Review Checklist

Use findings-first review. Order findings by severity and attach each one to a concrete file/line and behavioral consequence.

## Architecture

- [ ] Dependency direction still points toward `src/core/`.
- [ ] No UI, framework, provider, route, or persistence dependency entered the core.
- [ ] The change uses the intended service/write boundary.
- [ ] No hidden coupling or duplicate source of truth was introduced.
- [ ] Generated artifacts are changed through their generator.
- [ ] Backward compatibility, migration, replay, and rollback are explicit.

## Domain

- [ ] Event effects travel through parse, calibrated impact, accumulation, and bounded propagation.
- [ ] Personality continuity is preserved; no one-step trait flip or state teleport occurs.
- [ ] Transient state is not misclassified as long-term trait change.
- [ ] Memory behavior covers time, decay, retrieval, reinforcement, and contamination risk.
- [ ] Belief, need, desire, boundary, emotion, and decision directions are plausible and scenario-relevant.
- [ ] Decision changes are grounded in structured deltas rather than explanation text.
- [ ] Recovery and positive repair are not accidental mirror images of damage.

## Determinism And Time

- [ ] IDs are content/logical-time derived where replay identity matters.
- [ ] No new `Date.now()`, `new Date()`, `Math.random()`, or unordered iteration leaks into deterministic builders.
- [ ] Event time, elapsed time, density saturation, and out-of-order events are handled.
- [ ] Same input and engine semantics version produce the same output.
- [ ] Seeded noise is bounded and does not dominate personality.

## Mutation And Persistence

- [ ] Inputs remain unchanged unless mutation is explicitly requested and tested.
- [ ] Writes require policy/confirmation where required.
- [ ] Idempotency and expected-version conflicts are tested.
- [ ] State, event, snapshot, trace, and audit commit atomically or fail closed.
- [ ] Partial failure cannot leave an apparently successful state.

## Safety And Security

- [ ] Raw state, coordinates, memory payloads, secrets, and tokens remain hidden.
- [ ] LLM/provider output has no mutation or writeback authority.
- [ ] Diagnosis and unsupported certainty are blocked.
- [ ] External input is bounded, sanitized, and policy checked.
- [ ] High/critical dependency findings fail the security gate.

## Tests And Evidence

- [ ] Unit tests cover local contracts and edge cases.
- [ ] Regression tests reproduce the original failure.
- [ ] Benchmark/golden trajectory checks validate behavioral direction.
- [ ] Audit tests validate grounding, responsiveness, determinism, or temporal semantics.
- [ ] Full gates required by the risk level were run.
- [ ] The report distinguishes PASS, WARN, FAIL, and NOT VERIFIED honestly.

## Severity

- `CRITICAL`: corruption, unauthorized mutation, secret exposure, unsafe diagnosis, or release-gate bypass.
- `HIGH`: wrong causal propagation, replay divergence, persistent-state loss, or major boundary violation.
- `MEDIUM`: behavior gap, incomplete guard, misleading output, or maintainability risk with realistic impact.
- `LOW`: local clarity, cleanup, or test-strengthening issue without current behavioral failure.
