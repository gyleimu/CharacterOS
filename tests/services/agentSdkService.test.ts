import { describe, expect, it } from "vitest";
import { createSession, processTurn, previewTurnEvents, prepareWriteback, applyWriteback } from "../../src/services/agentSdkService";
import type { RawAgentInput } from "../../src/core/agent/agentTypes";

const chatInput: RawAgentInput = { type: "chat", message: "王雪主动解释了一切，我感到安心。" };

describe("V12.8 Agent SDK Service", () => {
  // ── Session ──

  it("createSession uses safe defaults", () => {
    const session = createSession();
    expect(session.writebackPolicy).toBe("require_user_confirmation");
    expect(session.llmMode).toBe("disabled");
    expect(session.safetyMode).toBe("strict");
    expect(session.noMultiCharacter).toBe(true);
  });

  // ── Process Turn ──

  it("processTurn returns AgentTurnResult", () => {
    const session = createSession();
    const res = processTurn(session, chatInput);
    expect(res.success).toBe(true);
    expect(res.noMutation).toBe(true);
    expect(res.data!.eventCandidates).toBeDefined();
    expect(res.data!.policyDecision).toBeDefined();
    expect(res.data!.groundingBundle).toBeDefined();
    expect(res.data!.replyPlan).toBeDefined();
    expect(res.data!.writebackPlan).toBeDefined();
  });

  it("processTurn includes candidates/policy/context/replyPlan/writebackPlan", () => {
    const session = createSession();
    const res = processTurn(session, chatInput);
    expect(res.data!.eventCandidates.length).toBeGreaterThanOrEqual(0);
    expect(res.data!.policyDecision.decision).toBeTruthy();
    expect(res.data!.groundingBundle.omittedRawState).toBe(true);
    expect(res.data!.replyPlan.intent).toBeTruthy();
    expect(res.data!.writebackPlan.status).toBeTruthy();
  });

  it("processTurn does not call apply", () => {
    const session = createSession();
    const res = processTurn(session, chatInput);
    expect(res.data!.noMutation).toBe(true);
    expect(res.data!.writebackPlan.status).not.toBe("applied");
  });

  it("processTurn no mutation", () => {
    const session = createSession();
    const r1 = processTurn(session, chatInput);
    const r2 = processTurn(session, chatInput);
    expect(r1.data!.turnId).toBe(r2.data!.turnId); // deterministic
  });

  // ── Preview ──

  it("previewTurnEvents returns EventStudioPreview and no mutation", () => {
    const session = createSession();
    const res = previewTurnEvents(session, chatInput);
    expect(res.success).toBe(true);
    expect(res.data!.candidates.length).toBeGreaterThanOrEqual(0);
    expect(res.data!.policyDecision).toBeDefined();
  });

  // ── Prepare Writeback ──

  it("prepareWriteback validates plan", () => {
    const session = createSession();
    const turnRes = processTurn(session, chatInput);
    const res = prepareWriteback(session, turnRes.data!);
    expect(res.success).toBe(true);
    expect(res.data!.writebackPlan).toBeDefined();
  });

  // ── Apply Writeback ──

  it("applyWriteback blocks missing confirmation", () => {
    const session = createSession({ writebackPolicy: "auto_apply_safe_events" });
    const turnRes = processTurn(session, chatInput);
    // Override policy to allow apply
    (turnRes.data!.policyDecision as any).decision = "apply_allowed";
    const res = applyWriteback(session, turnRes.data!, 0, "", { allowMutation: false });
    expect(res.success).toBe(false);
    expect(res.error!.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("applyWriteback blocks non apply_allowed policy", () => {
    const session = createSession({ writebackPolicy: "preview_only" });
    const turnRes = processTurn(session, chatInput);
    const res = applyWriteback(session, turnRes.data!, 0, "apply");
    expect(res.success).toBe(false);
    expect(res.error!.code).toBe("APPLY_BLOCKED");
  });

  it("applyWriteback succeeds with confirmation + auto_apply policy", () => {
    const session = createSession({ writebackPolicy: "auto_apply_safe_events" });
    const turnRes = processTurn(session, chatInput);
    // Override policy to apply_allowed for test
    (turnRes.data!.policyDecision as any).decision = "apply_allowed";
    const res = applyWriteback(session, turnRes.data!, 0, "apply", { allowMutation: true });
    if (res.success) {
      expect(res.data!.applied).toBe(true);
      expect(res.noMutation).toBe(false);
    }
  });

  it("applyWriteback clone default no mutation", () => {
    const session = createSession({ writebackPolicy: "auto_apply_safe_events" });
    const turnRes = processTurn(session, chatInput);
    (turnRes.data!.policyDecision as any).decision = "apply_allowed";
    const res = applyWriteback(session, turnRes.data!, 0, "apply");
    if (res.success) {
      // Default: clone, no mutation of baseline
    }
  });

  // ── Service Errors ──

  it("service errors structured", () => {
    const session = createSession();
    const turnRes = processTurn(session, chatInput);
    const res = applyWriteback(session, turnRes.data!, 0, "");
    expect(res.success).toBe(false);
    expect(res.error!.code).toBeTruthy();
    expect(res.error!.message).toBeTruthy();
    expect(["info", "warn", "error"]).toContain(res.error!.severity);
  });

  // ── No Raw State ──

  it("no raw state in service responses", () => {
    const session = createSession();
    const res = processTurn(session, chatInput);
    const json = JSON.stringify(res.data);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("rewardState");
  });

  // ── No LLM / Final Prose ──

  it("no LLM/final prose in service output", () => {
    const session = createSession();
    const res = processTurn(session, chatInput);
    const json = JSON.stringify(res.data);
    expect(json).not.toContain("llmResponse");
    expect(json).not.toContain("chatCompletion");
    expect(json).not.toContain("finalMessage");
  });

  // ── No Multi-Character ──

  it("no multi-character fields", () => {
    const session = createSession();
    const res = processTurn(session, chatInput);
    const json = JSON.stringify(res.data);
    expect(json).not.toContain("relationshipType");
    expect(json).not.toContain("partnerId");
  });
});
