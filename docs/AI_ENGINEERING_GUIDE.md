# CharacterOS AI Engineering Guide

## Purpose

This guide defines how AI-assisted development is performed in CharacterOS. The objective is not maximum code-generation speed. The objective is to preserve a causal, deterministic, explainable, and maintainable single-character simulation kernel.

## Instruction Surfaces

| Surface | Purpose |
|---|---|
| `AGENTS.md` | Always-on repository boundaries and required checks |
| `.agents/skills/characteros-engineering/` | Codex-discoverable skill entrypoint |
| `.characteros/skills/characteros-engineering/` | Canonical CharacterOS engineering workflow and domain references |
| `docs/latest_development_flow.md` | Current execution order and scope |
| `docs/core_calibration_durability_roadmap.md` | Active core hardening plan |

Invoke the skill explicitly with `$characteros-engineering` for high-risk work or reviews. Codex may also select it implicitly when a task matches its description.

## AI Coding Workflow

1. Understand the requested behavior and non-goals.
2. Scan implementation, callers, contracts, tests, audits, and active docs.
3. Explain the current architecture and why it exists.
4. Classify risk as `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
5. Define migration, compatibility, replay, rollback, and regression needs.
6. Treat an explicit implementation request as authority to proceed; otherwise obtain confirmation before ambiguous high-risk business-code changes.
7. Implement narrowly and preserve existing patterns.
8. Run risk-appropriate checks.
9. Report evidence, warnings, failures, and unverified items separately.

## Architecture Rules

The conceptual causal chain is:

```text
Event -> Parse -> Calibrated Impact -> Memory/Cluster
-> Personality Drift and Belief Assimilation
-> Need/Desire -> Decision Surface -> Behavior
```

The runtime intentionally separates physical mutation from derived read models:

```text
processEvent()          -> accepted physical state transition
deriveCharacterState() -> read-only psychological/decision projection
```

Do not bypass this split. Product surfaces can observe DTOs but cannot directly write physics state.

## MCP Usage

### Context7

Use for current TypeScript, Node.js, React, Next.js, Vitest, Prisma, Zod, and SDK documentation. Prefer an exact library ID and version when known. Do not use documentation snippets as a substitute for inspecting repository contracts.

Configured server:

```text
@upstash/context7-mcp@3.2.3
```

### Filesystem

Use for bounded repository discovery, file reading, and impact analysis. Its allowed root is this CharacterOS checkout. Keep manual writes in the normal patch workflow so diffs remain reviewable.

Configured server:

```text
@modelcontextprotocol/server-filesystem@2026.7.10
root: C:\Users\AL\Documents\CharacterOS
```

### Playwright

Use for Explorer/MindSpace page load, accessibility snapshots, interactions, screenshots, failed requests, and console errors. Run headless and isolated by default. Do not grant unrestricted file access; serve static artifacts over local HTTP.

Configured server:

```text
@playwright/mcp@0.0.78
headless, isolated, Chrome, 1440x900, console level error
```

### GitHub

Use GitHub integration for commit history, issues, PRs, CI failures, and design rationale. The desktop GitHub connector is authenticated for `gyleimu/CharacterOS`.

The official remote GitHub MCP is registered at `https://api.githubcopilot.com/mcp/` with `GITHUB_PERSONAL_ACCESS_TOKEN` as a secret environment reference. The token is intentionally not stored in the repository or Codex config. To enable that CLI transport, set the environment variable before launching Codex and restart the session.

Never paste or commit a PAT. Grant the minimum scopes required for the intended read/write operations.

## Code Review Process

1. Read `.characteros/skills/characteros-engineering/review-checklist.md`.
2. Review behavior and boundaries before style.
3. Present findings first, ordered by severity.
4. Cite exact files and lines.
5. Separate confirmed defects from questions and residual risk.
6. Review the fix again after implementation and rerun the affected gates.

## Testing Policy

Core behavior changes require unit, regression, benchmark/golden trajectory, and audit evidence. Follow `.characteros/skills/characteros-engineering/testing-rules.md`.

Baseline commands:

```powershell
npm run build
npm test
npm run next:build
npm run rc:verify
```

Use focused gates during iteration, but do not describe a focused run as a full-suite result.

## Security And Safety

- Keep secrets in environment variables or credential stores.
- Keep raw character state and memory payloads out of public DTOs and prompts.
- Keep LLM/provider output read-only until validation, grounding, policy, confirmation, and an explicit service write boundary succeed.
- Treat all psychological output as simulation, not diagnosis.
- Report external authentication or provider checks as `NOT VERIFIED` until they actually run.

## Maintaining This Environment

- Pin MCP package versions; update intentionally after reading release notes.
- Run `codex mcp list` after configuration changes.
- Validate the skill with the bundled `skill-creator` validator.
- Restart Codex when a newly added skill or MCP does not appear.
- Keep the canonical skill concise and move detailed rules into its four reference files.
