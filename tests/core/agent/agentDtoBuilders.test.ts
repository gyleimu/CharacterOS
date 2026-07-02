import { describe, expect, it } from "vitest";
import {
  buildAgentSessionConfig, buildAgentTurnInput, buildAgentEventCandidateFromDraft,
  buildAgentPolicyDecision, buildAgentReplyPlan, buildAgentWritebackPlan,
  buildAgentTurnResult, summarizeAgentSdkBoundary,
} from "../../../src/core/agent/agentDtoBuilders";
import { buildEventStudioDraft, buildCharacterStateSurfaceFromState } from "../../../src/core/explorer/explorerDtoBuilders";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";

describe("V12.1 Agent DTO Builders", () => {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });

  // ── Session Config ──

  it("default config has safe defaults", () => {
    const cfg = buildAgentSessionConfig();
    expect(cfg.writebackPolicy).toBe("require_user_confirmation");
    expect(cfg.llmMode).toBe("disabled");
    expect(cfg.safetyMode).toBe("strict");
    expect(cfg.readOnlyDefault).toBe(true);
    expect(cfg.noMultiCharacter).toBe(true);
    expect(cfg.noDiagnosis).toBe(true);
  });

  // ── Turn Input ──

  it("turn input preserves consent flag", () => {
    const input = buildAgentTurnInput({ consentForWriteback: true, content: "你好" });
    expect(input.consentForWriteback).toBe(true);
    expect(input.content).toBe("你好");
  });

  it("turn input defaults consent to false", () => {
    const input = buildAgentTurnInput();
    expect(input.consentForWriteback).toBe(false);
  });

  // ── Event Candidate ──

  it("candidate requires preview", () => {
    const draft = buildEventStudioDraft({ naturalLanguageInput: "王雪解释。" });
    const candidate = buildAgentEventCandidateFromDraft({ draft });
    expect(candidate.requiresPreview).toBe(true);
    expect(candidate.extractionMethod).toBe("deterministic");
  });

  // ── Policy Decision ──

  it("blocks unsafe writeback", () => {
    const decision = buildAgentPolicyDecision({
      writebackPolicy: "require_user_confirmation",
      consentForWriteback: false,
      safetyFlags: ["diagnosis_language"],
    });
    expect(decision.decision).toBe("block");
    expect(decision.writebackAllowed).toBe(false);
    expect(decision.safetyLevel).toBe("unsafe");
  });

  it("blocks when reality audit FAIL", () => {
    const decision = buildAgentPolicyDecision({
      writebackPolicy: "auto_apply_safe_events",
      consentForWriteback: true,
      realityAuditVerdict: "FAIL",
    });
    expect(decision.decision).toBe("block");
  });

  it("warns when reality audit WARN", () => {
    const decision = buildAgentPolicyDecision({
      writebackPolicy: "auto_apply_safe_events",
      consentForWriteback: true,
      realityAuditVerdict: "WARN",
    });
    expect(decision.warnings.length).toBeGreaterThan(0);
    expect(decision.safetyLevel).toBe("caution");
  });

  it("preview_only when writeback never", () => {
    const decision = buildAgentPolicyDecision({
      writebackPolicy: "never",
      consentForWriteback: false,
    });
    expect(decision.decision).toBe("preview_only");
    expect(decision.writebackAllowed).toBe(false);
  });

  it("confirmation_required with consent", () => {
    const decision = buildAgentPolicyDecision({
      writebackPolicy: "require_user_confirmation",
      consentForWriteback: true,
    });
    expect(decision.decision).toBe("confirmation_required");
    expect(decision.requiredConfirmation).toBe("apply");
  });

  // ── Reply Plan ──

  it("reply plan has noStateMutation true", () => {
    const plan = buildAgentReplyPlan({});
    expect(plan.noStateMutation).toBe(true);
    expect(plan.llmAllowed).toBe(false);
    expect(plan.safetyNotices.length).toBeGreaterThan(0);
    expect(plan.safetyNotices.some((n) => n.includes("模拟"))).toBe(true);
  });

  // ── Writeback Plan ──

  it("writeback plan requires confirmation by default", () => {
    const plan = buildAgentWritebackPlan({ policy: "require_user_confirmation" });
    expect(plan.applyRequiresConfirmation).toBe(true);
    expect(plan.previewRequired).toBe(true);
    expect(plan.auditTrailRequired).toBe(true);
  });

  it("writeback never has no preview or audit", () => {
    const plan = buildAgentWritebackPlan({ policy: "never" });
    expect(plan.status).toBe("none");
    expect(plan.previewRequired).toBe(false);
    expect(plan.auditTrailRequired).toBe(false);
  });

  // ── Turn Result ──

  it("turn result noMutation true unless writeback applied", () => {
    const surface = buildCharacterStateSurfaceFromState(state);
    const draft = buildEventStudioDraft({ naturalLanguageInput: "测试" });
    const candidate = buildAgentEventCandidateFromDraft({ draft });
    const policyDecision = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const grounding: Parameters<typeof buildAgentTurnResult>[0]["groundingBundle"] = {
      characterStateSurface: surface, timeMachineRefs: [], evidenceRefs: [], omittedRawState: true,
    };
    const replyPlan = buildAgentReplyPlan({});
    const writebackPlan = buildAgentWritebackPlan({ policy: "preview_only" });

    const result = buildAgentTurnResult({
      turnId: "t1", sessionId: "s1", normalizedInput: "测试",
      eventCandidates: [candidate], policyDecision,
      groundingBundle: grounding, replyPlan, writebackPlan,
    });

    expect(result.noMutation).toBe(true);
  });

  // ── Summarize ──

  it("summarizeAgentSdkBoundary lists all modules", () => {
    const summary = summarizeAgentSdkBoundary();
    expect(summary.length).toBeGreaterThanOrEqual(6);
    expect(summary.some((s) => s.includes("readOnlyDefault"))).toBe(true);
    expect(summary.some((s) => s.includes("llmMode"))).toBe(true);
    expect(summary.some((s) => s.includes("noMultiCharacter"))).toBe(true);
    expect(summary.some((s) => s.includes("noDiagnosis"))).toBe(true);
  });

  // ── Determinism ──

  it("builders deterministic", () => {
    const c1 = buildAgentSessionConfig({ sessionId: "test" });
    const c2 = buildAgentSessionConfig({ sessionId: "test" });
    expect(c1.writebackPolicy).toBe(c2.writebackPolicy);
    expect(c1.llmMode).toBe(c2.llmMode);
    expect(c1.noMultiCharacter).toBe(c2.noMultiCharacter);
  });

  // ── No Raw State ──

  it("no raw state in builder outputs", () => {
    const cfg = buildAgentSessionConfig();
    const json = JSON.stringify(cfg);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("driftMultiplier");
  });

  // ── No Multi-Character ──

  it("DTOs do not include multi-character relationship fields", () => {
    const cfg = buildAgentSessionConfig();
    const json = JSON.stringify(cfg);
    expect(json).not.toContain("relationshipType");
    expect(json).not.toContain("partnerId");
    expect(json).not.toContain("multiCharacter");
  });
});
