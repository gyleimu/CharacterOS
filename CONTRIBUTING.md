# Contributing to CharacterOS

## Before Making Changes

1. Run the full test suite: `npm test`
2. Run all quality gates: `npm run rc:verify`
3. All gates must PASS before starting work

## Development Workflow

```bash
npm run build          # TypeScript check
npm test               # Full test suite (vitest)
npm run next:build     # Next.js production build
```

## Quality Gates

```bash
npm run test:reality   # Core Reality Gate
npm run test:quality   # Unified Quality Gate (benchmark + reality)
npm run test:trend     # Quality Trend Baseline
npm run test:determinism # Determinism Boundary Audit
npm run test:llm-quality # LLM Boundary Quality Gate
npm run test:security  # Dependency Security Gate (high/critical)
npm run rc:verify      # All gates (RC verification)
```

## Gate Requirements

Any core logic change must pass:

- **Core Reality Gate**: PASS, 0 active warnings, 0 failures
- **Unified Quality Gate**: PASS, releaseReady=true
- **Quality Trend**: Not REGRESSED, 0 high-severity regression flags
- **LLM Boundary Quality Gate**: PASS, 0 unsafe deliveries, 0 replay failures
- **Dependency Security Gate**: 0 high/critical; moderate findings must be registered

## Adding New Event Types

1. Add category physics in `src/core/event/categoryPhysics.ts`
2. Add keywords in `src/core/event/eventParser.ts`
3. Add to `EventTypeCoverageAudit` fixtures
4. Run `npm test` to verify

## Adding New Audit Checks

1. Create module in `src/core/audit/`
2. Add to `CoreRealityRegressionGate` aggregation
3. Register known warnings in `knownWarningRegistry.ts`
4. Add tests in `tests/core/audit/`

## Release Checklist

- [ ] `npm test` — 0 failures
- [ ] `npm run rc:verify` — all gates PASS
- [ ] `npm run next:build` — succeeds
- [ ] Active warnings = 0
- [ ] Gate outputs in `outputs/` are current
- [ ] `docs/` has version report
- [ ] `CHANGELOG.md` updated

## Project Boundaries

- **Single-character only** — No multi-character or relationship networks
- **API-only** — No frontend, no dashboard, no visualization
- **No deployment** — Local development only
- **V20 is not started** — Do not begin multi-character work
