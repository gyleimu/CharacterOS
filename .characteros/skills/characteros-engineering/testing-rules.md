# CharacterOS Testing Rules

## Test Selection By Risk

| Risk | Minimum verification |
|---|---|
| `LOW` | Targeted unit test, `npm run build` |
| `MEDIUM` | Targeted unit + affected regression tests, `npm run build`, relevant audit |
| `HIGH` | Unit + regression + benchmark + audit, `npm test`, `npm run rc:verify` |
| `CRITICAL` | HIGH set plus migration/replay/rollback tests, `npm run next:build`, explicit release review |

Every core behavioral change must include all four evidence classes: unit, regression, benchmark/golden trajectory, and audit. A documentation-only change does not require behavioral fixtures but must run link/consistency checks and TypeScript build when it changes active engineering guidance.

## Standard Commands

```powershell
npm run build
npm test
npm run next:build
npm run rc:verify
```

Select focused gates when the scope is narrow:

```powershell
npm run test:reality
npm run test:quality
npm run test:determinism
npm run test:temporal
npm run test:calibration
npm run test:llm-quality
npm run test:security
```

Use `npx vitest run <test-file>` for a focused red/green loop, but do not substitute it for required release gates.

## Required Behavioral Properties

### Event and personality

- Major relevant events produce bounded, directionally correct state effects.
- Neutral or irrelevant events do not overreact.
- Repeated events accumulate with saturation rather than linear explosion.
- A single event cannot instantly rewrite long-term personality.
- Positive repair is visible but does not unrealistically erase history.
- Different baselines produce differentiated responses.

### Decision responsiveness

- Relevant state deltas alter candidate scores or strategy distribution.
- A stable top candidate is acceptable when the underlying decision surface changes in a grounded way.
- Irrelevant state deltas do not perturb unrelated scenarios materially.
- Explanation traces cite the actual influence vector and state diff.

### Time and replay

- Logical timestamps, not processing order alone, determine semantics.
- Out-of-order events fail safely or follow the documented policy.
- Same input, seed, logical time, and engine version replay identically.
- Long idle intervals apply expected recovery/decay.

### Mutation and persistence

- Preview paths do not mutate inputs.
- Apply paths are idempotent and version checked.
- Failed commits leave no partial durable state.
- Snapshot fingerprints and event logs replay to the same state.

## UI And Artifact Tests

For Explorer or MindSpace changes, use Playwright MCP to verify:

1. page load and top-level heading;
2. console errors and failed network requests;
3. critical interaction path;
4. screenshot at 1440x900 and a narrow viewport when responsive behavior changes;
5. read-only and mutation boundaries.

MCP smoke tests complement, but do not replace, committed automated tests.

## Reporting

Record exact commands and outcomes. Do not report a full suite as passing when only a focused test ran. Mark unavailable external/provider checks as `NOT VERIFIED`.
