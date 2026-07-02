import { describe, expect, it } from "vitest";
import {
  buildAgentWritebackPlan, selectWritebackCandidate,
  buildWritebackAuditDraft, validateWritebackPlan,
} from "../../../src/core/agent/writebackPlanner";
import { buildAgentSessionConfig, buildAgentTurnInput, buildAgentEventCandidateFromDraft, buildAgentPolicyDecision } from "../../../src/core/agent/agentDtoBuilders";
import { buildEventStudioDraft } from "../../../src/core/explorer/explorerDtoBuilders";
import type { AgentPolicyDecision, AgentEventCandidate } from "../../../src/core/agent/agentTypes";

function makeCandidate(text = "测试事件。", overrides: Partial<AgentEventCandidate> = {}): AgentEventCandidate {
  const draft = buildEventStudioDraft({ naturalLanguageInput: text });
  const c = buildAgentEventCandidateFromDraft({ draft });
  if (overrides.safetyFlags) c.safetyFlags = overrides.safetyFlags;
  if (overrides.confidence !== undefined) c.confidence = overrides.confidence;
  return c;
}

function baseInput(overrides: any = {}) {
  const session = buildAgentSessionConfig();
  const turn = buildAgentTurnInput({ sessionId: session.sessionId, content: "测试" });
  return {
    session, turn,
    candidates: [makeCandidate()],
    policy: buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false }),
    ...overrides,
  };
}

describe("V12.7 Writeback Planner", () => {
  // ── Status Mapping ──

  it("block decision produces blocked writeback plan", () => {
    const policy: AgentPolicyDecision = { decision: "block", reasons: [], warnings: [], writebackAllowed: false, safetyLevel: "unsafe", auditRequired: true };
    const plan = buildAgentWritebackPlan({ ...baseInput(), policy });
    expect(plan.status).toBe("blocked");
  });

  it("preview_only produces preview_pending", () => {
    const plan = buildAgentWritebackPlan(baseInput());
    expect(plan.status).toBe("preview_pending");
  });

  it("confirmation_required produces confirmation_pending", () => {
    const policy: AgentPolicyDecision = { decision: "confirmation_required", reasons: [], warnings: [], writebackAllowed: true, safetyLevel: "safe", auditRequired: true, requiredConfirmation: "apply" };
    const plan = buildAgentWritebackPlan({ ...baseInput(), policy });
    expect(plan.status).toBe("confirmation_pending");
  });

  it("apply_allowed produces ready_for_apply but does not execute", () => {
    const policy: AgentPolicyDecision = { decision: "apply_allowed", reasons: [], warnings: [], writebackAllowed: true, safetyLevel: "safe", auditRequired: true };
    const plan = buildAgentWritebackPlan({ ...baseInput(), policy });
    expect(plan.status).toBe("ready_for_apply");
    // No execution — no audit entry with afterFingerprint
    expect(plan).not.toHaveProperty("afterFingerprint");
  });

  // ── Candidate Selection ──

  it("highest confidence safe candidate selected", () => {
    const c1 = makeCandidate("事件A", { confidence: 0.9 });
    const c2 = makeCandidate("事件B", { confidence: 0.5 });
    const { selectedId } = selectWritebackCandidate(
      [c1, c2],
      { decision: "apply_allowed", reasons: [], warnings: [], writebackAllowed: true, safetyLevel: "safe", auditRequired: true },
    );
    expect(selectedId).toBe(c1.candidateId);
  });

  it("blocking safety flag heavily penalizes selection", () => {
    const c1 = makeCandidate("事件A", { confidence: 0.3, safetyFlags: ["possible_diagnosis_claim"] });
    const { selectedId } = selectWritebackCandidate(
      [c1],
      { decision: "apply_allowed", reasons: [], warnings: [], writebackAllowed: true, safetyLevel: "safe", auditRequired: true },
    );
    // Diagnosis flag + low confidence → score below threshold → not selected
    expect(selectedId).toBeUndefined();
  });

  it("multiple candidates record selection reasons", () => {
    const { reasons } = selectWritebackCandidate(
      [makeCandidate("A", { confidence: 0.8 }), makeCandidate("B", { confidence: 0.6 })],
      { decision: "apply_allowed", reasons: [], warnings: [], writebackAllowed: true, safetyLevel: "safe", auditRequired: true },
    );
    expect(reasons.length).toBeGreaterThan(1);
  });

  it("no candidates produces none/undefined selection", () => {
    const { selectedId } = selectWritebackCandidate(
      [],
      { decision: "apply_allowed", reasons: [], warnings: [], writebackAllowed: true, safetyLevel: "safe", auditRequired: true },
    );
    expect(selectedId).toBeUndefined();
  });

  // ── Audit Draft ──

  it("audit draft includes sessionId/turnId/sourceRef", () => {
    const audit = buildWritebackAuditDraft(baseInput());
    expect(audit.sessionId).toBeTruthy();
    expect(audit.turnId).toBeTruthy();
    expect(audit.writebackId).toContain("writeback_");
  });

  it("audit draft includes policy reasons and safety flags", () => {
    const c = makeCandidate("诊断相关事件", { safetyFlags: ["possible_diagnosis_claim"] });
    const input = baseInput({ candidates: [c] });
    const audit = buildWritebackAuditDraft(input);
    expect(audit.safetyFlags).toContain("possible_diagnosis_claim");
    expect(audit.reasons.length).toBeGreaterThan(0);
  });

  // ── Validation ──

  it("validateWritebackPlan catches missing candidate selection", () => {
    const plan = buildAgentWritebackPlan(baseInput({ candidates: [] }));
    const validation = validateWritebackPlan(plan);
    expect(validation.valid).toBe(true);
    expect(validation.warnings.some((w) => w.includes("没有候选"))).toBe(true);
  });

  // ── Confirmation ──

  it("default applyRequiresConfirmation=true for ready_for_apply", () => {
    const policy: AgentPolicyDecision = { decision: "apply_allowed", reasons: [], warnings: [], writebackAllowed: true, safetyLevel: "safe", auditRequired: true };
    const plan = buildAgentWritebackPlan({ ...baseInput(), policy });
    expect(plan.applyRequiresConfirmation).toBe(true);
  });

  it("auto_apply can disable confirmation only under explicit policy", () => {
    const policy: AgentPolicyDecision = { decision: "apply_allowed", reasons: [], warnings: [], writebackAllowed: true, safetyLevel: "safe", auditRequired: true };
    const plan = buildAgentWritebackPlan({ ...baseInput(), policy, autoApplySkipConfirmation: true });
    expect(plan.applyRequiresConfirmation).toBe(false);
  });

  // ── No Raw State ──

  it("no raw state forbidden keys", () => {
    const plan = buildAgentWritebackPlan(baseInput());
    const json = JSON.stringify(plan);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
  });

  // ── Determinism ──

  it("deterministic same input same output", () => {
    const p1 = buildAgentWritebackPlan(baseInput());
    const p2 = buildAgentWritebackPlan(baseInput());
    expect(p1.status).toBe(p2.status);
    expect(p1.selectedCandidateId).toBe(p2.selectedCandidateId);
  });

  // ── No Mutation ──

  it("does not mutate inputs", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const frozen = JSON.stringify(policy);
    buildAgentWritebackPlan(baseInput({ policy }));
    expect(JSON.stringify(policy)).toBe(frozen);
  });

  // ── No EventStudioApply Execution ──

  it("no EventStudioApply execution", () => {
    const plan = buildAgentWritebackPlan(baseInput());
    const json = JSON.stringify(plan);
    expect(json).not.toContain("applyEventStudioEvent");
    expect(json).not.toContain("processEvent");
    expect(json).not.toContain("afterFingerprint");
    expect(json).not.toContain("appliedMemoryId");
  });
});
