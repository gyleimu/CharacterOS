/**
 * Agent SDK -> LLM Boundary integration preview.
 *
 * This module assembles safe boundary DTOs only. It performs no network call,
 * produces no final prose, and has no writeback authority.
 */
import type {
  AgentGroundingBundle,
  AgentPolicyDecision,
  AgentReplyPlan,
  AgentSessionConfig,
  AgentTurnResult,
} from "../agent/agentTypes";
import {
  buildLlmBoundaryRequest,
  buildLlmProviderConfig,
} from "./llmBoundaryBuilders";
import { buildLlmBoundaryPromptFromRequest } from "./llmPromptBuilder";
import type {
  LlmBoundaryPrompt,
  LlmBoundaryRequest,
  LlmProviderConfig,
  LlmProviderType,
} from "./llmBoundaryTypes";

export interface LlmBoundarySafetyCheck {
  readonly passed: boolean;
  readonly rawStateDetected: boolean;
  readonly coordinateDataDetected: boolean;
  readonly memoryPayloadDetected: boolean;
  readonly secretDetected: boolean;
  readonly writebackAuthorityDetected: boolean;
  readonly diagnosisClaimDetected: boolean;
  readonly issues: string[];
}

export interface LlmBoundaryInvariants {
  readonly noMutation: true;
  readonly noWritebackAuthority: true;
  readonly noNetwork: true;
  readonly rawStateOmitted: true;
  readonly deterministic: true;
}

export interface LlmBoundaryPreview {
  readonly request: LlmBoundaryRequest;
  readonly prompt: LlmBoundaryPrompt;
  readonly providerConfig: LlmProviderConfig;
  readonly safetyCheck: LlmBoundarySafetyCheck;
  readonly invariants: LlmBoundaryInvariants;
}

export interface BuildLlmBoundaryPreviewInput {
  replyPlan: AgentReplyPlan;
  groundingBundle: AgentGroundingBundle;
  session: AgentSessionConfig;
  policy: AgentPolicyDecision;
  turnId: string;
  locale?: string;
  allowLlm?: boolean;
  providerType?: LlmProviderType;
  modelName?: string;
}

export function buildLlmBoundaryPreview(
  input: BuildLlmBoundaryPreviewInput,
): LlmBoundaryPreview {
  const safetyCheck = checkLlmBoundarySources(input.replyPlan, input.groundingBundle);
  const safeReplyPlan = sanitizeReplyPlan(input.replyPlan);
  const safeGroundingBundle = sanitizeGroundingBundle(input.groundingBundle);
  const allowLlm = Boolean(
    input.allowLlm &&
    input.session.llmMode === "planned_boundary_only" &&
    safeReplyPlan.llmAllowed &&
    input.policy.decision !== "block" &&
    safetyCheck.passed,
  );

  const request = buildLlmBoundaryRequest({
    replyPlan: safeReplyPlan,
    groundingBundle: safeGroundingBundle,
    session: input.session,
    turnId: input.turnId,
    policyDecisionSummary: `${input.policy.decision}:${input.policy.safetyLevel}`,
    locale: input.locale ?? "zh-CN",
    allowLlm,
  });
  const prompt = buildLlmBoundaryPromptFromRequest(request);
  const providerConfig = buildLlmProviderConfig({
    providerType: input.providerType ?? "mock",
    modelName: input.modelName ?? "mock-model",
    networkAllowed: false,
    safetyMode: input.session.safetyMode,
  });

  return {
    request,
    prompt,
    providerConfig,
    safetyCheck,
    invariants: {
      noMutation: true,
      noWritebackAuthority: true,
      noNetwork: true,
      rawStateOmitted: true,
      deterministic: true,
    },
  };
}

export function buildLlmBoundaryPreviewFromTurnResult(
  turnResult: AgentTurnResult,
  session: AgentSessionConfig,
  options: Omit<BuildLlmBoundaryPreviewInput, "replyPlan" | "groundingBundle" | "session" | "policy" | "turnId"> = {},
): LlmBoundaryPreview {
  return buildLlmBoundaryPreview({
    replyPlan: turnResult.replyPlan,
    groundingBundle: turnResult.groundingBundle,
    session,
    policy: turnResult.policyDecision,
    turnId: turnResult.turnId,
    ...options,
  });
}

export function checkLlmBoundarySources(
  replyPlan: AgentReplyPlan,
  groundingBundle: AgentGroundingBundle,
): LlmBoundarySafetyCheck {
  const source = [
    ...replyPlan.groundedFacts,
    ...replyPlan.uncertaintyNotes,
    ...groundingBundle.evidenceRefs.map((item) => item.excerpt),
    ...collectStringValues(groundingBundle.characterStateSurface),
  ].join("\n");

  const rawStateDetected = /particleIds?|driftMultiplier|biologicalNature|homeostasisState|metaState|rawState|proceduralRoutines/i.test(source);
  const coordinateDataDetected = /personalityCoordinate|coordinateValues|\bcoordinate\s*[:=]|\b(?:trust|fear|attachment|control)\s*[:=]\s*-?\d/i.test(source);
  const memoryPayloadDetected = /memoryPayload|memoryDump|memoryNodes?|fullMemory/i.test(source);
  const secretDetected = /(?:api[_\s]?key|access[_\s]?token|authorization|password)\s*[:=]|\bsk-(?:ant|proj|or)-/i.test(source);
  const writebackAuthorityDetected = /(?:writeback|事件|状态|memory).{0,12}(?:已执行|已写入|已保存|已修改|committed|performed)/i.test(source);
  const diagnosisClaimDetected = /(?:确诊|诊断为|患有|you have|is diagnosed with).{0,30}(?:抑郁|焦虑|人格障碍|depression|anxiety|disorder)?/i.test(source);
  const issues: string[] = [];
  if (rawStateDetected) issues.push("raw_state_detected");
  if (coordinateDataDetected) issues.push("coordinate_data_detected");
  if (memoryPayloadDetected) issues.push("memory_payload_detected");
  if (secretDetected) issues.push("secret_detected");
  if (writebackAuthorityDetected) issues.push("writeback_authority_claim_detected");
  if (diagnosisClaimDetected) issues.push("diagnosis_claim_detected");

  return {
    passed: issues.length === 0,
    rawStateDetected,
    coordinateDataDetected,
    memoryPayloadDetected,
    secretDetected,
    writebackAuthorityDetected,
    diagnosisClaimDetected,
    issues,
  };
}

export function summarizeLlmBoundaryIntegration(): string[] {
  return [
    "AgentReplyPlan + AgentGroundingBundle -> LlmBoundaryRequest -> LlmBoundaryPrompt",
    "Provider config is mock and networkAllowed=false",
    "Unsafe source content disables allowLlm and is redacted from boundary DTOs",
    "No mutation authority and no writeback authority",
    "Same input produces the same requestId and promptId",
  ];
}

function sanitizeReplyPlan(plan: AgentReplyPlan): AgentReplyPlan {
  const result: AgentReplyPlan = {
    ...plan,
    groundedFacts: plan.groundedFacts.map(sanitizeBoundaryText),
    uncertaintyNotes: plan.uncertaintyNotes.map(sanitizeBoundaryText),
    safetyNotices: plan.safetyNotices.map(sanitizeBoundaryText),
    suggestedResponseOutline: plan.suggestedResponseOutline.map(sanitizeBoundaryText),
  };
  if (plan.llmBoundaryInstructions) {
    result.llmBoundaryInstructions = sanitizeBoundaryText(plan.llmBoundaryInstructions);
  }
  return result;
}

function sanitizeGroundingBundle(bundle: AgentGroundingBundle): AgentGroundingBundle {
  const safe = sanitizeObject(bundle) as AgentGroundingBundle;
  return {
    ...safe,
    evidenceRefs: safe.evidenceRefs.map((item) => ({
      source: sanitizeBoundaryText(item.source),
      excerpt: sanitizeBoundaryText(item.excerpt),
    })),
    omittedRawState: true,
  };
}

function sanitizeObject(value: unknown): unknown {
  if (typeof value === "string") return sanitizeBoundaryText(value);
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/particleIds?|driftMultiplier|biologicalNature|homeostasisState|metaState|rawState|coordinateValues|personalityCoordinate/i.test(key)) {
      continue;
    }
    result[key] = sanitizeObject(child);
  }
  return result;
}

function sanitizeBoundaryText(value: string): string {
  return value
    .replace(/\bsk-(?:ant|proj|or)-[A-Za-z0-9_-]+/gi, "[REDACTED_SECRET]")
    .replace(/(?:api[_\s]?key|access[_\s]?token|authorization|password)\s*[:=]\s*\S+/gi, "[REDACTED_SECRET]")
    .replace(/particleIds?|driftMultiplier|biologicalNature|homeostasisState|metaState|rawState|coordinateValues|personalityCoordinate|memoryPayload|memoryDump|memoryNodes?|fullMemory/gi, "[REDACTED_INTERNAL]")
    .replace(/\b(?:trust|fear|attachment|control)\s*[:=]\s*-?\d+(?:\.\d+)?/gi, "[REDACTED_COORDINATE]")
    .replace(/(?:writeback|事件|状态|memory).{0,12}(?:已执行|已写入|已保存|已修改|committed|performed)/gi, "[BLOCKED_CLAIM]")
    .replace(/(?:确诊|诊断为|患有|you have|is diagnosed with).{0,30}(?:抑郁|焦虑|人格障碍|depression|anxiety|disorder)?/gi, "[BLOCKED_CLAIM]");
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringValues);
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectStringValues);
}
