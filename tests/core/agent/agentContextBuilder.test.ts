import { describe, expect, it } from "vitest";
import {
  buildAgentGroundingBundle, selectRelevantEvidence,
  buildContextOmissionReport, summarizeGroundingForReply, buildContextSafetyNotices,
} from "../../../src/core/agent/agentContextBuilder";
import { buildAgentSessionConfig, buildAgentPolicyDecision } from "../../../src/core/agent/agentDtoBuilders";
import { buildCharacterStateSurface } from "../../../src/core/explorer/characterStateSurface";
import { buildExplainabilityTimeline } from "../../../src/core/explorer/explainabilityTimeline";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";
import type { CharacterStateSurface, ExplainabilityTimeline } from "../../../src/core/explorer/explorerTypes";

const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), { seedInitialExperiences: true });
const surface: CharacterStateSurface = buildCharacterStateSurface({ state });
const emptyTimeline: ExplainabilityTimeline = {
  question: "", timeRange: { from: "", to: "", label: "" },
  causalSteps: [], stateDiffs: [], evidenceRefs: [],
  confidence: "low", groundingStatus: "ungrounded", warnings: [],
};

function baseInput(overrides: any = {}) {
  return {
    session: buildAgentSessionConfig(),
    policyDecision: buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false }),
    stateSurface: surface,
    ...overrides,
  };
}

describe("V12.5 Agent Context Builder", () => {
  // ── Build Bundle ──

  it("builds grounding bundle from state surface", () => {
    const bundle = buildAgentGroundingBundle(baseInput());
    expect(bundle.omittedRawState).toBe(true);
    expect(bundle.characterStateSurface).toBe(surface);
    expect(bundle.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("omittedRawState=true", () => {
    const bundle = buildAgentGroundingBundle(baseInput());
    expect(bundle.omittedRawState).toBe(true);
  });

  it("forbidden raw state keys absent", () => {
    const bundle = buildAgentGroundingBundle(baseInput());
    const json = JSON.stringify(bundle);
    expect(json).not.toContain("particleIds");
    expect(json).not.toContain("biologicalNature");
    expect(json).not.toContain("driftMultiplier");
    expect(json).not.toContain("rewardState");
  });

  it("evidenceRefs selected from surface", () => {
    const refs = selectRelevantEvidence(baseInput());
    expect(refs.some((r) => r.source.includes("headline"))).toBe(true);
    expect(refs.some((r) => r.source.includes("emotionalState"))).toBe(true);
  });

  it("no evidence returns warning context", () => {
    // Without explainability, evidence still comes from surface
    const refs = selectRelevantEvidence(baseInput());
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });

  // ── Policy-Aware ──

  it("block policy returns minimal context", () => {
    const blockedInput = baseInput({
      policyDecision: buildAgentPolicyDecision({ writebackPolicy: "never", consentForWriteback: false }),
    });
    const bundle = buildAgentGroundingBundle(blockedInput);
    // Blocked policy still includes state surface but omits explainability
    expect(bundle.characterStateSurface).toBeDefined();
    expect(bundle.explainabilityTimeline).toBeUndefined();
  });

  it("preview_only includes state", () => {
    const bundle = buildAgentGroundingBundle(baseInput({
      explainability: emptyTimeline,
    }));
    expect(bundle.characterStateSurface).toBeDefined();
  });

  it("apply_allowed includes reality audit context", () => {
    const applyInput = baseInput({
      policyDecision: buildAgentPolicyDecision({ writebackPolicy: "auto_apply_safe_events", consentForWriteback: true }),
    });
    // Override to simulate apply decision
    const bundle = buildAgentGroundingBundle({
      ...applyInput,
      policyDecision: { ...applyInput.policyDecision, decision: "apply_allowed" as const, auditRequired: true },
      realityAudit: { auditScope: "", verdict: "PASS" as const, stateDiffSummary: "", decisionDiffSummary: "", explanationGrounding: "grounded" as const, warnings: [], disclaimers: [] },
    });
    expect(bundle.realityAuditPanel).toBeDefined();
  });

  // ── Time Machine ──

  it("timeMachineRefs included as refs only", () => {
    const bundle = buildAgentGroundingBundle(baseInput({
      timeMachineRefs: ["snap_abc", "snap_def"],
    }));
    expect(bundle.timeMachineRefs).toHaveLength(2);
    expect(bundle.timeMachineRefs).toContain("snap_abc");
  });

  // ── Omission Report ──

  it("omission report lists hidden fields", () => {
    const report = buildContextOmissionReport();
    expect(report.omittedRawState).toBe(true);
    expect(report.omittedFields.length).toBeGreaterThan(3);
    expect(report.omittedFields.some((f) => f.includes("raw"))).toBe(true);
  });

  // ── Safety Notices ──

  it("safety notices include simulation-not-diagnosis", () => {
    const notices = buildContextSafetyNotices(buildAgentSessionConfig());
    expect(notices.some((n) => n.message.includes("模拟"))).toBe(true);
    expect(notices.some((n) => n.message.includes("诊断"))).toBe(true);
  });

  it("safety notices include writeback policy", () => {
    const notices = buildContextSafetyNotices(buildAgentSessionConfig({ writebackPolicy: "preview_only" }));
    expect(notices.some((n) => n.message.includes("写回"))).toBe(true);
  });

  it("LLM boundary notice when planned_boundary_only", () => {
    const notices = buildContextSafetyNotices(buildAgentSessionConfig({ llmMode: "planned_boundary_only" }));
    expect(notices.some((n) => n.code === "LLM_BOUNDARY_ONLY")).toBe(true);
  });

  // ── Determinism ──

  it("deterministic same input same output", () => {
    const b1 = buildAgentGroundingBundle(baseInput());
    const b2 = buildAgentGroundingBundle(baseInput());
    expect(b1.omittedRawState).toBe(b2.omittedRawState);
    expect(b1.evidenceRefs.length).toBe(b2.evidenceRefs.length);
  });

  // ── No Mutation ──

  it("does not mutate inputs", () => {
    const input = baseInput();
    const frozen = JSON.stringify(input.session);
    buildAgentGroundingBundle(input);
    expect(JSON.stringify(input.session)).toBe(frozen);
  });

  // ── Summary ──

  it("summarizeGroundingForReply returns structured context", () => {
    const bundle = buildAgentGroundingBundle(baseInput());
    const policy = buildAgentPolicyDecision({ writebackPolicy: "preview_only", consentForWriteback: false });
    const summary = summarizeGroundingForReply(bundle, policy);
    expect(summary).toContain("[State]");
    expect(summary).toContain("[Emotion]");
    expect(summary).toContain("[Policy]");
    expect(summary).toContain("preview_only");
  });

  // ── No Chat/Agent/LLM ──

  it("no chat/agent final reply fields", () => {
    const bundle = buildAgentGroundingBundle(baseInput());
    const json = JSON.stringify(bundle);
    expect(json).not.toContain("chatReply");
    expect(json).not.toContain("agentMessage");
    expect(json).not.toContain("llmResponse");
  });

  it("no multi-character relationship fields", () => {
    const bundle = buildAgentGroundingBundle(baseInput());
    const json = JSON.stringify(bundle);
    expect(json).not.toContain("relationshipType");
    expect(json).not.toContain("partnerId");
  });
});
