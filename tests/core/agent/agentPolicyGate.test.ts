import { describe, expect, it } from "vitest";
import { evaluateAgentPolicy, classifyPolicyRisk, deriveRequiredConfirmation, summarizePolicyDecision } from "../../../src/core/agent/agentPolicyGate";
import { buildAgentSessionConfig, buildAgentTurnInput, buildAgentEventCandidateFromDraft } from "../../../src/core/agent/agentDtoBuilders";
import { buildEventStudioDraft } from "../../../src/core/explorer/explorerDtoBuilders";

function makeCandidate(overrides: Partial<ReturnType<typeof buildAgentEventCandidateFromDraft>> = {}) {
  const draft = buildEventStudioDraft({ naturalLanguageInput: "测试事件。" });
  const c = buildAgentEventCandidateFromDraft({ draft, ...overrides });
  if (overrides.safetyFlags) c.safetyFlags = overrides.safetyFlags;
  if (overrides.confidence !== undefined) c.confidence = overrides.confidence;
  return c;
}

function input(session: ReturnType<typeof buildAgentSessionConfig>, overrides: any = {}) {
  return {
    session,
    turn: buildAgentTurnInput({ ...overrides, sessionId: session.sessionId }),
    candidates: [makeCandidate()],
  };
}

describe("V12.4 Agent Policy Gate", () => {
  // ── Never ──

  it("never policy blocks writeback", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "never" });
    const result = evaluateAgentPolicy(input(session));
    expect(result.decision).toBe("preview_only");
    expect(result.writebackAllowed).toBe(false);
  });

  // ── Preview Only ──

  it("preview_only policy never applies", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "preview_only" });
    const result = evaluateAgentPolicy(input(session));
    expect(result.decision).toBe("preview_only");
    expect(result.writebackAllowed).toBe(false);
  });

  // ── Require Confirmation ──

  it("require_user_confirmation without consent requires confirmation", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "require_user_confirmation" });
    const result = evaluateAgentPolicy(input(session, { consentForWriteback: false }));
    expect(result.decision).toBe("preview_only");
    expect(result.writebackAllowed).toBe(false);
  });

  it("require_user_confirmation with consent but no userConfirmation requires confirmation", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "require_user_confirmation" });
    const result = evaluateAgentPolicy(input(session, { consentForWriteback: true }));
    expect(result.decision).toBe("confirmation_required");
    expect(result.requiredConfirmation).toBe("apply");
    expect(result.writebackAllowed).toBe(true);
  });

  it("require_user_confirmation with confirmation + PASS preview allows apply", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "require_user_confirmation" });
    const result = evaluateAgentPolicy({
      ...input(session, { consentForWriteback: true, userConfirmation: "apply" }),
      previewVerdicts: ["PASS"],
    });
    expect(result.decision).toBe("apply_allowed");
    expect(result.writebackAllowed).toBe(true);
  });

  it("FAIL preview blocks apply", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "require_user_confirmation" });
    const result = evaluateAgentPolicy({
      ...input(session, { consentForWriteback: true, userConfirmation: "apply" }),
      previewVerdicts: ["FAIL"],
    });
    expect(result.decision).toBe("block");
    expect(result.safetyLevel).toBe("unsafe");
  });

  it("WARN preview requires confirmation", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "require_user_confirmation" });
    // With consent but WARN preview
    const result = evaluateAgentPolicy({
      ...input(session, { consentForWriteback: true }),
      previewVerdicts: ["WARN"],
    });
    expect(result.warnings.some((w) => w.includes("WARN"))).toBe(true);
  });

  // ── Auto Apply ──

  it("auto_apply_safe_events allows only low-risk PASS preview", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "auto_apply_safe_events" });
    const candidate = makeCandidate({ confidence: 0.8 });
    (candidate.draft as any).intensity = 0.3;

    const result = evaluateAgentPolicy({
      session,
      turn: buildAgentTurnInput({ sessionId: session.sessionId, inputMode: "chat", consentForWriteback: true }),
      candidates: [candidate],
      previewVerdicts: ["PASS"],
    });

    expect(result.decision).toBe("apply_allowed");
  });

  it("auto_apply blocks unsafe events", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "auto_apply_safe_events" });
    const candidate = makeCandidate({ confidence: 0.3, safetyFlags: ["low_confidence"] });

    const result = evaluateAgentPolicy({
      session,
      turn: buildAgentTurnInput({ sessionId: session.sessionId, inputMode: "chat" }),
      candidates: [candidate],
    });

    expect(result.decision).not.toBe("apply_allowed");
  });

  it("auto_apply blocks story/plugin/tool unless trusted", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "auto_apply_safe_events" });
    const candidate = makeCandidate({ confidence: 0.8, safetyFlags: ["fictional_or_story_input"] });

    const result = evaluateAgentPolicy({
      session,
      turn: buildAgentTurnInput({ sessionId: session.sessionId, inputMode: "story", consentForWriteback: true }),
      candidates: [candidate],
      previewVerdicts: ["PASS"],
    });

    expect(result.decision).not.toBe("apply_allowed");
  });

  // ── Safety Flags ──

  it("diagnosis safety flag blocks", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "auto_apply_safe_events" });
    const candidate = makeCandidate({ safetyFlags: ["possible_diagnosis_claim"] });

    const result = evaluateAgentPolicy({
      session,
      turn: buildAgentTurnInput({ sessionId: session.sessionId, consentForWriteback: true }),
      candidates: [candidate],
      previewVerdicts: ["PASS"],
    });

    expect(result.decision).toBe("block");
    expect(result.safetyLevel).toBe("unsafe");
  });

  it("low_confidence requires preview/confirmation", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "auto_apply_safe_events" });
    const candidate = makeCandidate({ safetyFlags: ["low_confidence"], confidence: 0.3 });

    const result = evaluateAgentPolicy({
      session,
      turn: buildAgentTurnInput({ sessionId: session.sessionId }),
      candidates: [candidate],
    });

    expect(result.decision).not.toBe("apply_allowed");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("multi_character_relationship warns but does not enable V20", () => {
    const candidate = makeCandidate({ safetyFlags: ["possible_multi_character_relationship"] });
    const risk = classifyPolicyRisk(candidate);
    expect(risk.riskLevel).toBe("medium");
    // Must not enable multi-character
    expect(candidate.safetyFlags).not.toContain("v20_relationship_enabled");
  });

  // ── Missing Preview ──

  it("missing preview prevents apply with require_user_confirmation", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "require_user_confirmation" });
    const result = evaluateAgentPolicy({
      ...input(session, { consentForWriteback: true, userConfirmation: "apply" }),
      // No previewVerdicts
    });
    expect(result.decision).toBe("confirmation_required");
  });

  // ── Determinism ──

  it("decision deterministic", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "never" });
    const r1 = evaluateAgentPolicy(input(session));
    const r2 = evaluateAgentPolicy(input(session));
    expect(r1.decision).toBe(r2.decision);
    expect(r1.writebackAllowed).toBe(r2.writebackAllowed);
  });

  it("requiredConfirmation deterministic", () => {
    expect(deriveRequiredConfirmation("confirmation_required")).toBe("apply");
    expect(deriveRequiredConfirmation("block")).toBeUndefined();
    expect(deriveRequiredConfirmation("preview_only")).toBeUndefined();
  });

  // ── No Mutation ──

  it("no mutation of inputs", () => {
    const session = buildAgentSessionConfig();
    const frozen = JSON.stringify(session);
    evaluateAgentPolicy(input(session));
    expect(JSON.stringify(session)).toBe(frozen);
  });

  // ── Summary ──

  it("summary structured", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "never" });
    const result = evaluateAgentPolicy(input(session));
    const summary = summarizePolicyDecision(result);
    expect(summary).toContain("Decision");
    expect(summary).toContain("Safety");
    expect(summary).toContain("preview_only");
  });

  // ── No LLM/Writeback ──

  it("no LLM/writeback execution fields", () => {
    const session = buildAgentSessionConfig({ writebackPolicy: "preview_only" });
    const result = evaluateAgentPolicy(input(session));
    const json = JSON.stringify(result);
    expect(json).not.toContain("llm");
    expect(json).not.toContain("apply_event");
    expect(json).not.toContain("writeback_execute");
  });
});
