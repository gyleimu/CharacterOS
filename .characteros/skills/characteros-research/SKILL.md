---
name: characteros-research
description: Research CharacterOS psychological dynamics, event impact, memory, belief, personality drift, needs, decisions, calibration, and evaluation using primary evidence. Use for paper review, scientific-model design, evidence synthesis, parameter hypotheses, benchmark design, or falsifiable research planning; remain read-only unless implementation is separately requested.
---

# CharacterOS Research

Act as a research engineer translating external evidence into bounded, testable CharacterOS model proposals. Do not treat literature as permission to insert coefficients directly into production code.

## Default To Read-Only

Research, source review, and model-design tasks do not modify business code by default. Produce an evidence map and experiment plan first. If implementation is separately authorized, hand the proposal to `$characteros-engineering` and require `$characteros-review` after the change.

## Load Research Context

1. Read `docs/personality_dynamics_scientific_model_design.md` for the current scientific direction.
2. Read `docs/core_calibration_durability_roadmap.md` for active sequencing and release boundaries.
3. Read `research-method.md` for the research workflow.
4. Read `evidence-policy.md` for source quality and claim labels.
5. Read `model-mapping.md` before proposing changes to the runtime model.
6. Load `../characteros-engineering/domain-model.md` to map evidence onto current entities and invariants.

## Research Workflow

1. **Frame the question**: define the construct, timescale, context, population, desired behavior, and prohibited interpretation.
2. **Inspect the current model**: identify the existing contract, formula, tests, audit, and known limitation before searching for replacements.
3. **Collect primary evidence**: prefer peer-reviewed papers, original datasets, validated instruments, and official technical documentation.
4. **Separate claim levels**: label each conclusion as established evidence, plausible hypothesis, engineering heuristic, or unsupported.
5. **Assess transferability**: check population, measurement method, timescale, effect size, uncertainty, and whether the evidence concerns traits, states, behavior, or clinical constructs.
6. **Map to CharacterOS**: identify affected entities, state channels, temporal semantics, decision relevance, audit traces, and compatibility risks.
7. **Design falsification**: define counterexamples, neutral controls, different baselines, repeated-event trajectories, recovery, overreaction limits, and replay requirements.
8. **Propose shadow evaluation**: keep new dynamics observational until they outperform current behavior without breaking gates.
9. **Report uncertainty**: list evidence gaps, calibration data needs, and claims the project still cannot make.

## Scientific Boundaries

- Treat CharacterOS as a simulation, not a diagnostic, therapeutic, or psychometric instrument.
- Distinguish transient state expression from long-term trait consolidation.
- Treat current coordinate weights as engineering hypotheses unless empirically calibrated.
- Do not infer causality from cross-sectional correlation.
- Do not convert group-average findings into deterministic individual rules.
- Do not present a paper's qualitative direction as a validated CharacterOS coefficient.
- Do not tune production behavior solely to satisfy existing fixtures.
- Do not use LLM-generated summaries as primary evidence.

## Required Research Output

Provide:

1. research question and scope;
2. source table with evidence type and limitations;
3. synthesis with explicit claim labels;
4. mapping to current CharacterOS contracts;
5. proposed model hypothesis, not production truth;
6. experiment and falsification plan;
7. acceptance, warning, and rejection thresholds;
8. migration and shadow-mode strategy;
9. unresolved scientific and engineering risks.
