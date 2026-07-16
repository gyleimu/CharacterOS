---
name: characteros-review
description: Perform independent, findings-first CharacterOS code, architecture, domain-model, determinism, mutation, safety, test, and release reviews. Use for code review, architecture audit, boundary audit, regression analysis, release readiness, or post-fix verification in this repository.
---

# CharacterOS Review

Act as an independent reviewer of a deterministic, single-character psychological simulation. Optimize for finding behavioral defects and boundary violations, not for producing a reassuring summary.

## Default To Read-Only

Do not modify files when the user asks only for review, audit, inspection, or analysis. If fixes are explicitly requested:

1. Record the baseline findings before editing.
2. Apply `$characteros-engineering` for the remediation.
3. Run a fresh review against the resulting diff.
4. Report fixed, remaining, and newly introduced findings separately.

## Load Review Context

1. Read `docs/latest_development_flow.md` and `docs/AI_ENGINEERING_GUIDE.md`.
2. Read `architecture-review.md` for dependency and ownership checks.
3. Read `review-rules.md` for severity and reporting rules.
4. Read `evidence-rules.md` before accepting tests, reports, or release claims.
5. Load `../characteros-engineering/domain-model.md` when reviewing physics, memory, personality, belief, need, desire, boundary, emotion, or decision behavior.
6. Load `../characteros-engineering/testing-rules.md` when checking verification sufficiency.

## Review Workflow

1. **Establish scope**: identify the requested review target, changed files, non-goals, and whether the worktree is dirty.
2. **Trace behavior**: follow inputs through contracts, implementation, callers, persistence, outputs, and tests. Do not infer behavior from filenames or reports.
3. **Check boundaries**: verify dependencies, mutation authority, deterministic identity, logical time, LLM authority, generated artifacts, and single-character scope.
4. **Check domain propagation**: confirm event effects travel through calibrated impact, memory or cluster accumulation, bounded personality and belief change, derived motivation, and grounded decision influence.
5. **Challenge tests**: look for assertions that only mirror implementation, hard-coded fixture paths, absent negative cases, missing replay checks, or gates that can pass without exercising the claimed path.
6. **Reproduce when practical**: run the smallest command that proves or disproves each suspected defect, then run the risk-appropriate gate only when needed.
7. **Report findings first**: order confirmed issues by severity and cite exact files and lines.
8. **State residual risk**: distinguish `PASS`, `WARN`, `FAIL`, and `NOT VERIFIED` without converting missing evidence into success.

## Non-Negotiable Review Rules

- Prefer executable code and contracts over generated reports or documentation when they disagree.
- Treat explanation prose as output, never as proof that a state transition occurred.
- Reject direct personality rewrites, hidden mutation, replay divergence, ungrounded decisions, and unauthorized writeback.
- Inspect a generated artifact through its generator and source data; do not recommend hand-editing generated output.
- Do not prioritize formatting, naming, or cleanup above behavioral defects and missing guards.
- Do not claim a full suite or release gate passed unless that exact command completed in the current review.
- Do not soften a finding because existing tests are green.

## Output Shape

Use this order:

1. Findings, highest severity first.
2. Open questions and assumptions.
3. Verification performed and exact outcomes.
4. Brief architecture or change summary.
5. Residual risks and missing tests.

If no findings remain, say so explicitly and still identify untested or externally unverified surfaces.
