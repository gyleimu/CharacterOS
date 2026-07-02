import { describe, expect, it } from "vitest";
import {
  buildAgentReplyPlan, selectReplyIntent, selectReplyTone,
  buildGroundedFacts, buildUncertaintyNotes, buildReplySafetyNotices,
  buildSuggestedResponseOutline, buildLLMBoundaryInstructions,
} from "../../../src/core/agent/replyPlanner";
import { buildAgentSessionConfig, buildAgentPolicyDecision } from "../../../src/core/agent/agentDtoBuilders";
import { buildAgentGroundingBundle } from "../../../src/core/agent/agentContextBuilder";
import { buildCharacterStateSurface } from "../../../src/core/explorer/characterStateSurface";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import type { AgentPolicyDecision, AgentGroundingBundle } from "../../../src/core/agent/agentTypes";

const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
const surface = buildCharacterStateSurface({ state });

function makeBundle(policyDecision: AgentPolicyDecision): AgentGroundingBundle {
  return buildAgentGroundingBundle({
    session: buildAgentSessionConfig(),
    policyDecision,
    stateSurface: surface,
  });
}

describe("V12.6 Reply Planner", () => {
  // ── Intent Selection ──

  it("block decision produces refuse_unsafe intent", () => {
    const policy: AgentPolicyDecision = { decision: "block", reasons: ["安全标记"], warnings: [], writebackAllowed: false, safetyLevel: "unsafe", auditRequired: true };
    const intent = selectReplyIntent({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy), hasCandidates: true, hasEvidence: false });
    expect(intent).toBe("refuse_unsafe");
  });

  it("confirmation_required produces ask_confirmation", () => {
    const policy: AgentPolicyDecision = { decision: "confirmation_required", reasons: [], warnings: [], writebackAllowed: true, safetyLevel: "safe", auditRequired: true, requiredConfirmation: "apply" };
    const intent = selectReplyIntent({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy), hasCandidates: true, hasEvidence: true });
    expect(intent).toBe("ask_confirmation");
  });

  it("preview_only with candidate produces preview_event", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const intent = selectReplyIntent({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy), hasCandidates: true, hasEvidence: true });
    expect(intent).toBe("preview_event");
  });

  it("preview_only with evidence but no candidate produces explain_state", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const intent = selectReplyIntent({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy), hasCandidates: false, hasEvidence: true });
    expect(intent).toBe("explain_state");
  });

  it("no evidence produces clarify_input", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const intent = selectReplyIntent({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy), hasCandidates: false, hasEvidence: false });
    expect(intent).toBe("clarify_input");
  });

  // ── Tone Selection ──

  it("unsafe policy produces safety_first tone", () => {
    const policy: AgentPolicyDecision = { decision: "block", reasons: [], warnings: [], writebackAllowed: false, safetyLevel: "unsafe", auditRequired: true };
    const tone = selectReplyTone({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy) });
    expect(tone).toBe("safety_first");
  });

  it("strict safety mode produces cautious tone", () => {
    const session = buildAgentSessionConfig({ safetyMode: "strict" });
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const tone = selectReplyTone({ session, policy, bundle: makeBundle(policy) });
    expect(tone).toBe("cautious");
  });

  // ── Grounded Facts ──

  it("groundedFacts cite evidence refs", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const bundle = makeBundle(policy);
    const facts = buildGroundedFacts(bundle);
    expect(facts.length).toBeGreaterThan(2);
    expect(facts.some((f) => f.includes("状态"))).toBe(true);
    expect(facts.some((f) => f.includes("情绪"))).toBe(true);
  });

  // ── Uncertainty ──

  it("uncertaintyNotes present when evidence weak", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const bundle = makeBundle(policy);
    const notes = buildUncertaintyNotes(bundle, policy);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.some((n) => n.includes("证据不足") || n.includes("证据有限"))).toBe(true);
  });

  // ── Safety Notices ──

  it("safety notices always include simulation-not-diagnosis", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const notices = buildReplySafetyNotices({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy) });
    expect(notices.some((n) => n.includes("模拟"))).toBe(true);
    expect(notices.some((n) => n.includes("诊断"))).toBe(true);
  });

  it("writeback blocked message when policy prevents write", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "never", consentForWriteback: false });
    const notices = buildReplySafetyNotices({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy) });
    expect(notices.some((n) => n.includes("不会写入"))).toBe(true);
  });

  // ── No Final Prose ──

  it("no final prose / no roleplay first-person output", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const plan = buildAgentReplyPlan({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy) });
    const json = JSON.stringify(plan);
    expect(json).not.toContain("I feel");
    expect(json).not.toContain("我觉得");
    expect(json).not.toContain("finalMessage");
    expect(json).not.toContain("chatResponse");
  });

  // ── LLM boundary ──

  it("llmAllowed false by default", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const plan = buildAgentReplyPlan({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy) });
    expect(plan.llmAllowed).toBe(false);
  });

  it("llmAllowed true only with planned_boundary_only", () => {
    const session = buildAgentSessionConfig({ llmMode: "planned_boundary_only" });
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const bundle = makeBundle(policy);
    const plan = buildAgentReplyPlan({ session, policy, bundle });
    expect(plan.llmAllowed).toBe(true);
    expect(plan.llmBoundaryInstructions).toBeDefined();
  });

  it("llmBoundaryInstructions prohibit mutation/invention", () => {
    const instructions = buildLLMBoundaryInstructions();
    expect(instructions).toContain("Do NOT mutate");
    expect(instructions).toContain("Do NOT invent");
    expect(instructions).toContain("Do NOT produce medical");
  });

  // ── Determinism ──

  it("deterministic same input same output", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const bundle = makeBundle(policy);
    const p1 = buildAgentReplyPlan({ session: buildAgentSessionConfig(), policy, bundle });
    const p2 = buildAgentReplyPlan({ session: buildAgentSessionConfig(), policy, bundle });
    expect(p1.intent).toBe(p2.intent);
    expect(p1.tone).toBe(p2.tone);
    expect(p1.groundedFacts.length).toBe(p2.groundedFacts.length);
  });

  // ── No Mutation ──

  it("does not mutate inputs", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const bundle = makeBundle(policy);
    const frozen = JSON.stringify(bundle);
    buildAgentReplyPlan({ session: buildAgentSessionConfig(), policy, bundle });
    expect(JSON.stringify(bundle)).toBe(frozen);
  });

  // ── Suggested Outline ──

  it("outline contains safety section", () => {
    const outline = buildSuggestedResponseOutline("explain_state", {
      session: buildAgentSessionConfig(),
      policy: buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false }),
      bundle: makeBundle(buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false })),
    });
    expect(outline.some((l) => l.includes("Safety"))).toBe(true);
  });

  // ── No raw state / no multi ──

  it("no raw state exposure", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const plan = buildAgentReplyPlan({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy) });
    const json = JSON.stringify(plan);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("biologicalNature");
  });

  it("no multi-character relationship behavior", () => {
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const plan = buildAgentReplyPlan({ session: buildAgentSessionConfig(), policy, bundle: makeBundle(policy) });
    const json = JSON.stringify(plan);
    expect(json).not.toContain("relationshipType");
    expect(json).not.toContain("partnerId");
  });
});
