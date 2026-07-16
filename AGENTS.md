# CharacterOS Repository Instructions

Use the project skills by responsibility:

- `$characteros-engineering`: implementation, refactoring, debugging, calibration, persistence, simulation, Explorer/MindSpace, Agent SDK, LLM boundary, and release changes.
- `$characteros-review`: code review, architecture or boundary audit, regression analysis, release readiness, and post-fix verification. Default to read-only.
- `$characteros-research`: paper review, evidence synthesis, scientific-model design, parameter hypotheses, and benchmark research. Default to read-only.

For evidence-driven core work, use the sequence `research -> engineering -> review`. Do not let research findings or review output bypass the engineering write boundary.

Read these active guides before core changes:

- `docs/latest_development_flow.md`
- `docs/core_calibration_durability_roadmap.md`
- `docs/AI_ENGINEERING_GUIDE.md`
- `docs/personality_dynamics_scientific_model_design.md` for personality dynamics

Preserve these rules:

1. Keep `src/core/` headless and deterministic-first. UI, Next.js, Three.js, provider clients, and route handlers stay outside it.
2. Route event effects through parse, calibrated impact, memory/cluster accumulation, bounded drift/belief assimilation, and derived needs/desires/decisions. Never directly rewrite personality.
3. Preserve logical event time, deterministic replay, density saturation, out-of-order protection, clone-by-default behavior, and audited write boundaries.
4. Treat LLMs as replaceable language adapters with no mutation, diagnosis, or writeback authority.
5. Do not start multi-character or relationship-engine work unless the active roadmap explicitly authorizes it.
6. Change generated artifacts through their generator.
7. Add risk-appropriate unit, regression, benchmark/golden trajectory, and audit coverage for core behavioral changes.
8. Run the focused tests first, then the required gates. Never claim checks that were not run.

Do not revert unrelated user changes. Keep edits scoped and report residual risk honestly.
