import { describe, expect, it } from "vitest";
import {
  buildLlmBoundaryPreview,
  buildLlmBoundaryPreviewFromTurnResult,
  checkLlmBoundarySources,
  summarizeLlmBoundaryIntegration,
} from "../../../src/core/llmBoundary/agentReplyPlanToLlmBoundary";
import {
  buildAgentPolicyDecision,
  buildAgentReplyPlan,
  buildAgentSessionConfig,
  buildAgentTurnResult,
  buildAgentWritebackPlan,
} from "../../../src/core/agent/agentDtoBuilders";
import { buildAgentGroundingBundle } from "../../../src/core/agent/agentContextBuilder";
import { buildCharacterStateSurface } from "../../../src/core/explorer/characterStateSurface";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../../src/core/character/characterBlueprint";

describe("Agent reply plan to LLM boundary", () => {
  it("builds a mock, offline, read-only preview by default", () => {
    const input = fixture();
    const preview = buildLlmBoundaryPreview(input);

    expect(preview.request.allowLlm).toBe(false);
    expect(preview.providerConfig.providerType).toBe("mock");
    expect(preview.providerConfig.networkAllowed).toBe(false);
    expect(preview.invariants).toEqual({
      noMutation: true,
      noWritebackAuthority: true,
      noNetwork: true,
      rawStateOmitted: true,
      deterministic: true,
    });
  });

  it("allows the boundary path only with every explicit gate", () => {
    const input = fixture();
    const preview = buildLlmBoundaryPreview({ ...input, allowLlm: true });
    expect(preview.request.allowLlm).toBe(true);
  });

  it("keeps LLM disabled when the session mode is disabled", () => {
    const input = fixture();
    const session = buildAgentSessionConfig({ ...input.session, llmMode: "disabled" });
    expect(buildLlmBoundaryPreview({ ...input, session, allowLlm: true }).request.allowLlm).toBe(false);
  });

  it("keeps LLM disabled when policy blocks the turn", () => {
    const input = fixture();
    const policy = buildAgentPolicyDecision({
      writebackPolicy: "preview_only",
      consentForWriteback: false,
      safetyFlags: ["diagnosis_claim"],
    });
    expect(buildLlmBoundaryPreview({ ...input, policy, allowLlm: true }).request.allowLlm).toBe(false);
  });

  it("detects and redacts raw state and coordinate values", () => {
    const input = fixture(["particleIds=[p1] coordinate=raw trust=0.42"]);
    const preview = buildLlmBoundaryPreview({ ...input, allowLlm: true });
    const serialized = JSON.stringify({ request: preview.request, prompt: preview.prompt });

    expect(preview.safetyCheck.rawStateDetected).toBe(true);
    expect(preview.safetyCheck.coordinateDataDetected).toBe(true);
    expect(preview.request.allowLlm).toBe(false);
    expect(serialized).not.toContain("particleIds");
    expect(serialized).not.toContain("trust=0.42");
  });

  it("detects and redacts secrets", () => {
    const input = fixture(["api_key=sk-proj-secret-value"]);
    const preview = buildLlmBoundaryPreview({ ...input, allowLlm: true });
    const serialized = JSON.stringify(preview);

    expect(preview.safetyCheck.secretDetected).toBe(true);
    expect(preview.request.allowLlm).toBe(false);
    expect(serialized).not.toContain("sk-proj-secret-value");
  });

  it("blocks writeback authority and diagnosis claims", () => {
    const input = fixture(["状态已修改并写入", "诊断为焦虑症"]);
    const check = checkLlmBoundarySources(input.replyPlan, input.groundingBundle);

    expect(check.writebackAuthorityDetected).toBe(true);
    expect(check.diagnosisClaimDetected).toBe(true);
    expect(check.passed).toBe(false);
  });

  it("is deterministic for identical input", () => {
    const input = fixture();
    const first = buildLlmBoundaryPreview(input);
    const second = buildLlmBoundaryPreview(input);

    expect(first.request.requestId).toBe(second.request.requestId);
    expect(first.prompt.promptId).toBe(second.prompt.promptId);
    expect(first).toEqual(second);
  });

  it("does not mutate reply plan, grounding bundle, session, or policy", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    buildLlmBoundaryPreview(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("builds from an AgentTurnResult", () => {
    const input = fixture();
    const turn = buildAgentTurnResult({
      turnId: input.turnId,
      sessionId: input.session.sessionId,
      normalizedInput: "测试输入",
      eventCandidates: [],
      policyDecision: input.policy,
      groundingBundle: input.groundingBundle,
      replyPlan: input.replyPlan,
      writebackPlan: buildAgentWritebackPlan({ policy: "preview_only" }),
    });

    const preview = buildLlmBoundaryPreviewFromTurnResult(turn, input.session);
    expect(preview.request.turnId).toBe(turn.turnId);
    expect(preview.request.sessionId).toBe(turn.sessionId);
  });

  it("preserves Chinese grounding facts", () => {
    const input = fixture(["角色目前更谨慎，但证据有限。"]);
    const preview = buildLlmBoundaryPreview(input);
    expect(preview.prompt.groundingFacts.join(" ")).toContain("角色目前更谨慎");
  });

  it("publishes a concise integration contract summary", () => {
    const summary = summarizeLlmBoundaryIntegration();
    expect(summary.some((line) => line.includes("no writeback") || line.includes("No writeback"))).toBe(true);
    expect(summary.some((line) => line.includes("networkAllowed=false"))).toBe(true);
  });
});

function fixture(groundedFacts = ["当前状态需要谨慎解释。"]): ReturnType<typeof makeFixture> {
  return makeFixture(groundedFacts);
}

function makeFixture(groundedFacts: string[]) {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true,
  });
  const session = buildAgentSessionConfig({
    sessionId: "llm_integration_session",
    characterId: "lin_fan",
    llmMode: "planned_boundary_only",
    safetyMode: "strict",
  });
  const policy = buildAgentPolicyDecision({
    writebackPolicy: "preview_only",
    consentForWriteback: false,
  });
  const groundingBundle = buildAgentGroundingBundle({
    session,
    policyDecision: policy,
    stateSurface: buildCharacterStateSurface({ state }),
  });
  const replyPlan = buildAgentReplyPlan({ groundedFacts, llmAllowed: true });
  return {
    replyPlan,
    groundingBundle,
    session,
    policy,
    turnId: "llm_integration_turn",
  };
}
