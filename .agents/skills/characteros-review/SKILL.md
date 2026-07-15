---
name: characteros-review
description: Perform independent, findings-first CharacterOS code, architecture, domain-model, determinism, mutation, safety, test, and release reviews. Use for code review, architecture audit, boundary audit, regression analysis, release readiness, or post-fix verification in this repository.
---

# CharacterOS Review Loader

Read and follow the canonical skill at `../../../.characteros/skills/characteros-review/SKILL.md`.

Load only the review references needed for the task:

- Architecture and ownership: `../../../.characteros/skills/characteros-review/architecture-review.md`
- Severity, findings, and re-review: `../../../.characteros/skills/characteros-review/review-rules.md`
- Tests, reports, and acceptance evidence: `../../../.characteros/skills/characteros-review/evidence-rules.md`

Treat the canonical `.characteros` directory as the single source of truth. Default to read-only unless the user explicitly requests fixes.
