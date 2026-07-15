# CharacterOS Claude Instructions

Read and follow `AGENTS.md` as the always-on repository policy.

Use the project skills by responsibility:

- `$characteros-engineering` for implementation, refactoring, debugging, calibration, persistence, simulation, and release changes.
- `$characteros-review` for code review, architecture or boundary audits, regression analysis, and post-fix verification. Default to read-only.
- `$characteros-research` for paper review, evidence synthesis, scientific-model design, and calibration hypotheses. Default to read-only.

The canonical rules live under `.characteros/skills/`. Files under `.claude/skills/` are discovery loaders only. For evidence-driven core work, preserve the sequence `research -> engineering -> review` and never let research or review bypass the explicit engineering write boundary.
