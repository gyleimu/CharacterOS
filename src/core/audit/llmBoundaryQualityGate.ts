import {
  buildAgentGroundingBundle,
} from "../agent/agentContextBuilder";
import {
  buildAgentPolicyDecision,
  buildAgentSessionConfig,
} from "../agent/agentDtoBuilders";
import { buildAgentReplyPlan } from "../agent/replyPlanner";
import type { AgentReplyPlan } from "../agent/agentTypes";
import {
  createCharacterStateFromBlueprint,
  createLinFanBlueprint,
} from "../character/characterBlueprint";
import { DETERMINISTIC_TIMESTAMP } from "../deterministicHelpers";
import { buildCharacterStateSurface } from "../explorer/characterStateSurface";
import {
  buildLlmBoundaryPreview,
  type LlmBoundaryPreview,
} from "../llmBoundary/agentReplyPlanToLlmBoundary";
import { buildLlmProviderResponse } from "../llmBoundary/llmBoundaryBuilders";
import {
  executeLlmBoundary,
  type LlmBoundaryExecutionResult,
} from "../llmBoundary/llmBoundaryService";
import type { LlmFallbackReason } from "../llmBoundary/llmFallbackReplyGenerator";
import {
  MockLlmProvider,
  type LlmProviderAdapter,
} from "../llmBoundary/mockLlmProvider";

export type LlmBoundaryGateVerdict = "PASS" | "FAIL";

export type LlmBoundaryRiskCategory =
  | "success"
  | "availability"
  | "validation"
  | "grounding"
  | "identity"
  | "policy"
  | "security";

export interface LlmBoundaryGateCaseResult {
  readonly id: string;
  readonly category: LlmBoundaryRiskCategory;
  readonly description: string;
  readonly expectedVerdict: "llm_reply" | "fallback_reply";
  readonly actualVerdict: "llm_reply" | "fallback_reply" | "execution_error";
  readonly expectedFallbackReason: LlmFallbackReason | null;
  readonly actualFallbackReason: LlmFallbackReason | null;
  readonly providerCalled: boolean;
  readonly providerValidationVerdict: string | null;
  readonly providerValidationRules: string[];
  readonly providerGroundingVerdict: string | null;
  readonly deliveredValidationVerdict: string | null;
  readonly deliveredGroundingVerdict: string | null;
  readonly deterministicReplay: boolean;
  readonly inputUnchanged: boolean;
  readonly deliveredSafe: boolean;
  readonly noMutation: boolean;
  readonly noWritebackAuthority: boolean;
  readonly noNetwork: boolean;
  readonly executionId: string | null;
  readonly responseId: string | null;
  readonly passed: boolean;
  readonly failures: string[];
}

export interface LlmBoundaryQualityGateResult {
  readonly version: "13.9.0";
  readonly generatedAt: string;
  readonly cases: LlmBoundaryGateCaseResult[];
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly unsafeDeliveries: number;
    readonly replayFailures: number;
    readonly mutationFailures: number;
    readonly networkViolations: number;
    readonly uniqueExecutionIds: boolean;
    readonly riskCategoriesCovered: number;
  };
  readonly failures: string[];
  readonly riskCoverage: string[];
  readonly knownLimitations: string[];
  readonly gateVerdict: {
    readonly level: LlmBoundaryGateVerdict;
    readonly passed: boolean;
    readonly reasons: string[];
  };
  readonly releaseReady: boolean;
  readonly mockOnly: true;
  readonly realProviderDeferred: true;
}

interface GateCaseSpec {
  readonly id: string;
  readonly category: LlmBoundaryRiskCategory;
  readonly description: string;
  readonly previewFactory: () => LlmBoundaryPreview;
  readonly providerFactory?: (preview: LlmBoundaryPreview) => LlmProviderAdapter;
  readonly expectedVerdict: "llm_reply" | "fallback_reply";
  readonly expectedFallbackReason: LlmFallbackReason | null;
  readonly expectedProviderCalled: boolean;
  readonly expectedValidationRule?: string;
  readonly expectedGroundingVerdict?: "grounded" | "partially_grounded" | "ungrounded";
}

interface CaseExecution {
  readonly result: LlmBoundaryExecutionResult | null;
  readonly serializedResult: string;
  readonly inputUnchanged: boolean;
  readonly errorCode: string | null;
}

const UNSAFE_DELIVERY_FRAGMENTS = [
  "角色已被诊断为焦虑症",
  "角色状态已修改",
  "事件已经写入",
  "永久离开所有关系",
  "这就是客观事实",
  "sk-proj-super-secret",
  "rawState",
] as const;

export async function runLlmBoundaryQualityGate(): Promise<LlmBoundaryQualityGateResult> {
  const cases: LlmBoundaryGateCaseResult[] = [];

  for (const spec of buildGateCases()) {
    const first = await executeGateCase(spec);
    const second = await executeGateCase(spec);
    const deterministicReplay = first.serializedResult === second.serializedResult;
    const result = first.result;
    const failures: string[] = [];

    if (!result) {
      failures.push(`execution failed: ${first.errorCode ?? "unknown_error"}`);
    } else {
      if (result.verdict !== spec.expectedVerdict) {
        failures.push(`expected verdict ${spec.expectedVerdict}, got ${result.verdict}`);
      }
      if (result.fallbackReason !== spec.expectedFallbackReason) {
        failures.push(
          `expected fallback ${spec.expectedFallbackReason ?? "none"}, got ${result.fallbackReason ?? "none"}`,
        );
      }
      if (result.providerCalled !== spec.expectedProviderCalled) {
        failures.push(`expected providerCalled=${spec.expectedProviderCalled}`);
      }
      if (
        spec.expectedValidationRule &&
        !result.providerValidation?.violations.some(
          (violation) => violation.ruleId === spec.expectedValidationRule,
        )
      ) {
        failures.push(`missing validation rule ${spec.expectedValidationRule}`);
      }
      if (
        spec.expectedGroundingVerdict &&
        result.providerGrounding?.verdict !== spec.expectedGroundingVerdict
      ) {
        failures.push(
          `expected grounding ${spec.expectedGroundingVerdict}, got ${result.providerGrounding?.verdict ?? "not_run"}`,
        );
      }
    }

    const deliveredSafe = Boolean(
      result &&
      result.deliveredValidation.finalVerdict === "pass" &&
      result.deliveredGrounding.verdict === "grounded" &&
      !UNSAFE_DELIVERY_FRAGMENTS.some((fragment) => result.reply.text.includes(fragment)),
    );
    const noMutation = Boolean(
      result && first.inputUnchanged && result.noMutation && result.reply.noMutation,
    );
    const noWritebackAuthority = Boolean(
      result && result.noWritebackAuthority && !result.reply.writebackPerformed,
    );
    const noNetwork = Boolean(result && !result.networkUsed);

    if (!deterministicReplay) failures.push("deterministic replay mismatch");
    if (!first.inputUnchanged) failures.push("preview input mutated");
    if (!deliveredSafe) failures.push("unsafe or ungrounded final delivery");
    if (!noMutation) failures.push("mutation invariant failed");
    if (!noWritebackAuthority) failures.push("writeback authority invariant failed");
    if (!noNetwork) failures.push("network invariant failed");
    if (
      result &&
      JSON.stringify(result).includes("sk-proj-super-secret")
    ) {
      failures.push("provider error leaked a secret");
    }

    cases.push({
      id: spec.id,
      category: spec.category,
      description: spec.description,
      expectedVerdict: spec.expectedVerdict,
      actualVerdict: result?.verdict ?? "execution_error",
      expectedFallbackReason: spec.expectedFallbackReason,
      actualFallbackReason: result?.fallbackReason ?? null,
      providerCalled: result?.providerCalled ?? false,
      providerValidationVerdict: result?.providerValidation?.finalVerdict ?? null,
      providerValidationRules:
        result?.providerValidation?.violations.map((violation) => violation.ruleId) ?? [],
      providerGroundingVerdict: result?.providerGrounding?.verdict ?? null,
      deliveredValidationVerdict: result?.deliveredValidation.finalVerdict ?? null,
      deliveredGroundingVerdict: result?.deliveredGrounding.verdict ?? null,
      deterministicReplay,
      inputUnchanged: first.inputUnchanged,
      deliveredSafe,
      noMutation,
      noWritebackAuthority,
      noNetwork,
      executionId: result?.executionId ?? null,
      responseId: result?.providerResponse?.responseId ?? null,
      passed: failures.length === 0,
      failures,
    });
  }

  const executionIds = cases
    .map((item) => item.executionId)
    .filter((value): value is string => Boolean(value));
  const uniqueExecutionIds = new Set(executionIds).size === executionIds.length;
  const failures = cases.flatMap((item) =>
    item.failures.map((failure) => `${item.id}: ${failure}`),
  );
  if (!uniqueExecutionIds) failures.push("execution IDs are not unique across quality-gate cases");

  const summary = {
    total: cases.length,
    passed: cases.filter((item) => item.passed).length,
    failed: cases.filter((item) => !item.passed).length + (uniqueExecutionIds ? 0 : 1),
    unsafeDeliveries: cases.filter((item) => !item.deliveredSafe).length,
    replayFailures: cases.filter((item) => !item.deterministicReplay).length,
    mutationFailures: cases.filter(
      (item) => !item.inputUnchanged || !item.noMutation || !item.noWritebackAuthority,
    ).length,
    networkViolations: cases.filter((item) => !item.noNetwork).length,
    uniqueExecutionIds,
    riskCategoriesCovered: new Set(cases.map((item) => item.category)).size,
  };
  const passed = failures.length === 0;

  return {
    version: "13.9.0",
    generatedAt: DETERMINISTIC_TIMESTAMP,
    cases,
    summary,
    failures,
    riskCoverage: [
      "default-off LLM policy",
      "provider timeout and provider error",
      "empty and truncated output",
      "diagnosis and mutation claims",
      "missing safety notices",
      "ungrounded and mixed claims",
      "label spoofing",
      "provider request identity mismatch",
      "secret-bearing provider exception",
      "unsafe source preflight",
      "non-mock provider rejection",
      "network-enabled config rejection",
      "over-certainty rejection",
      "deterministic replay and immutable input",
    ],
    knownLimitations: [
      "Grounding remains conservative lexical/rule matching, not semantic entailment.",
      "Only the deterministic mock provider is release-enabled.",
      "Streaming, token budgets, telemetry, and real provider credentials remain out of scope.",
    ],
    gateVerdict: {
      level: passed ? "PASS" : "FAIL",
      passed,
      reasons: passed
        ? ["All LLM boundary success, failure, adversarial, replay, and authority checks passed."]
        : failures,
    },
    releaseReady: passed,
    mockOnly: true,
    realProviderDeferred: true,
  };
}

function buildGateCases(): GateCaseSpec[] {
  const standardPreview = () => buildGatePreview();
  return [
    {
      id: "grounded_success",
      category: "success",
      description: "Grounded Mock output is the only provider reply accepted.",
      previewFactory: standardPreview,
      expectedVerdict: "llm_reply",
      expectedFallbackReason: null,
      expectedProviderCalled: true,
      expectedGroundingVerdict: "grounded",
    },
    {
      id: "llm_default_off",
      category: "policy",
      description: "allowLlm=false skips provider execution.",
      previewFactory: () => buildGatePreview({ allowLlm: false }),
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "llm_disabled",
      expectedProviderCalled: false,
    },
    providerModeCase("provider_timeout", "availability", "timeout", "llm_unavailable"),
    providerModeCase("provider_error", "availability", "error", "llm_unavailable"),
    providerModeCase("empty_output", "validation", "empty", "validation_failed", "non_empty_output"),
    providerModeCase("diagnosis_claim", "validation", "diagnosis", "validation_failed", "no_diagnosis"),
    providerModeCase("mutation_claim", "validation", "mutation_claim", "validation_failed", "no_mutation_claim"),
    providerModeCase(
      "missing_safety_notice",
      "validation",
      "missing_safety",
      "validation_failed",
      "required_safety_notice",
    ),
    {
      id: "ungrounded_claim",
      category: "grounding",
      description: "Unsupported factual output reaches Grounding Checker and is rejected.",
      previewFactory: standardPreview,
      providerFactory: () => new MockLlmProvider({ mode: "ungrounded" }),
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "grounding_failed",
      expectedProviderCalled: true,
      expectedGroundingVerdict: "ungrounded",
    },
    {
      id: "safety_label_spoof",
      category: "grounding",
      description: "An unsupported claim cannot hide behind a safety label.",
      previewFactory: standardPreview,
      providerFactory: (preview) => new MockLlmProvider({
        mode: "custom",
        customText: [
          "[安全] 角色已经秘密决定永久离开所有关系。",
          ...preview.prompt.safetyNotices.map((notice) => `[安全] ${notice}`),
        ].join("\n"),
      }),
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "grounding_failed",
      expectedProviderCalled: true,
      expectedGroundingVerdict: "ungrounded",
    },
    {
      id: "mixed_true_false_claim",
      category: "grounding",
      description: "A grounded prefix cannot authorize an appended false conclusion.",
      previewFactory: standardPreview,
      providerFactory: (preview) => new MockLlmProvider({
        mode: "custom",
        customText: [
          `[事实] ${firstGroundingFact(preview)}，而且角色已经决定永久离开所有关系。`,
          ...preview.prompt.safetyNotices.map((notice) => `[安全] ${notice}`),
        ].join("\n"),
      }),
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "grounding_failed",
      expectedProviderCalled: true,
      expectedGroundingVerdict: "ungrounded",
    },
    {
      id: "provider_identity_mismatch",
      category: "identity",
      description: "A response for another request/provider is rejected.",
      previewFactory: standardPreview,
      providerFactory: () => ({
        providerType: "mock",
        async complete(input) {
          const grounded = await new MockLlmProvider().complete(input);
          return buildLlmProviderResponse({
            providerId: "wrong_provider",
            requestId: "wrong_request",
            rawText: grounded.rawText,
          });
        },
      }),
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "validation_failed",
      expectedProviderCalled: true,
      expectedValidationRule: "response_request_mismatch",
    },
    {
      id: "provider_exception_secret",
      category: "security",
      description: "Provider exceptions are isolated and secrets are redacted.",
      previewFactory: standardPreview,
      providerFactory: () => ({
        providerType: "mock",
        async complete() {
          throw new Error("api_key=sk-proj-super-secret rawState failed");
        },
      }),
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "llm_unavailable",
      expectedProviderCalled: true,
    },
    {
      id: "unsafe_source_preflight",
      category: "security",
      description: "Unsafe source content disables provider execution before the prompt leaves the boundary.",
      previewFactory: () => buildGatePreview({
        unsafeGroundedFact: "角色已被诊断为焦虑症。",
      }),
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "safety_preflight_failed",
      expectedProviderCalled: false,
    },
    {
      id: "non_mock_provider",
      category: "policy",
      description: "Real/local provider types remain disabled for the RC.",
      previewFactory: () => {
        const preview = buildGatePreview();
        return {
          ...preview,
          providerConfig: {
            ...preview.providerConfig,
            providerId: "llmprov_local_rc_blocked",
            providerType: "local",
          },
        };
      },
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "provider_not_allowed",
      expectedProviderCalled: false,
    },
    {
      id: "network_enabled_config",
      category: "policy",
      description: "Any network-enabled config remains blocked.",
      previewFactory: () => {
        const preview = buildGatePreview();
        return {
          ...preview,
          providerConfig: { ...preview.providerConfig, networkAllowed: true },
        };
      },
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "provider_not_allowed",
      expectedProviderCalled: false,
    },
    {
      id: "truncated_output",
      category: "validation",
      description: "finishReason=length is not delivered even when the visible prefix is grounded.",
      previewFactory: standardPreview,
      providerFactory: () => ({
        providerType: "mock",
        async complete(input) {
          const grounded = await new MockLlmProvider().complete(input);
          return buildLlmProviderResponse({
            providerId: input.providerConfig.providerId,
            requestId: input.request.requestId,
            rawText: grounded.rawText,
            finishReason: "length",
          });
        },
      }),
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "validation_failed",
      expectedProviderCalled: true,
      expectedValidationRule: "complete_output",
    },
    {
      id: "over_certainty",
      category: "validation",
      description: "An otherwise grounded answer cannot declare itself objective fact.",
      previewFactory: standardPreview,
      providerFactory: (preview) => new MockLlmProvider({
        mode: "custom",
        customText: [
          `[事实] ${firstGroundingFact(preview)}`,
          "[事实] 这就是客观事实。",
          ...preview.prompt.safetyNotices.map((notice) => `[安全] ${notice}`),
        ].join("\n"),
      }),
      expectedVerdict: "fallback_reply",
      expectedFallbackReason: "validation_failed",
      expectedProviderCalled: true,
      expectedValidationRule: "preserve_uncertainty",
    },
  ];
}

function providerModeCase(
  id: string,
  category: LlmBoundaryRiskCategory,
  mode: "timeout" | "error" | "empty" | "diagnosis" | "mutation_claim" | "missing_safety",
  fallbackReason: LlmFallbackReason,
  validationRule?: string,
): GateCaseSpec {
  const result: GateCaseSpec = {
    id,
    category,
    description: `Mock provider mode ${mode} must produce a safe deterministic fallback.`,
    previewFactory: () => buildGatePreview(),
    providerFactory: () => new MockLlmProvider({ mode }),
    expectedVerdict: "fallback_reply",
    expectedFallbackReason: fallbackReason,
    expectedProviderCalled: true,
  };
  return validationRule ? { ...result, expectedValidationRule: validationRule } : result;
}

async function executeGateCase(spec: GateCaseSpec): Promise<CaseExecution> {
  const preview = spec.previewFactory();
  const before = JSON.stringify(preview);
  try {
    const provider = spec.providerFactory?.(preview);
    const result = await executeLlmBoundary({
      preview,
      ...(provider ? { provider } : {}),
    });
    return {
      result,
      serializedResult: JSON.stringify(result),
      inputUnchanged: JSON.stringify(preview) === before,
      errorCode: null,
    };
  } catch (error: unknown) {
    const errorCode = error instanceof Error ? error.name : "unknown_error";
    return {
      result: null,
      serializedResult: `error:${errorCode}`,
      inputUnchanged: JSON.stringify(preview) === before,
      errorCode,
    };
  }
}

function buildGatePreview(
  options: { allowLlm?: boolean; unsafeGroundedFact?: string } = {},
): LlmBoundaryPreview {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true,
  });
  const session = buildAgentSessionConfig({
    sessionId: "v13_9_llm_boundary_gate_session",
    characterId: "lin_fan",
    llmMode: "planned_boundary_only",
    safetyMode: "strict",
    writebackPolicy: "preview_only",
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
  const replyPlan = buildAgentReplyPlan({
    session,
    policy,
    bundle: groundingBundle,
    hasCandidates: false,
    hasEvidence: true,
  });
  const plan: AgentReplyPlan = options.unsafeGroundedFact
    ? { ...replyPlan, groundedFacts: [options.unsafeGroundedFact] }
    : replyPlan;

  return buildLlmBoundaryPreview({
    replyPlan: plan,
    groundingBundle,
    session,
    policy,
    turnId: "v13_9_llm_boundary_gate_turn",
    allowLlm: options.allowLlm ?? true,
  });
}

function firstGroundingFact(preview: LlmBoundaryPreview): string {
  return (preview.prompt.groundingFacts[0] ?? "当前可用信息有限")
    .replace(/^\[(?:grounded|evidence:[^\]]+|causal:[^\]]+)\]\s*/i, "")
    .trim();
}
