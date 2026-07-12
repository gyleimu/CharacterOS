#!/usr/bin/env npx tsx
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAgentGroundingBundle } from "../src/core/agent/agentContextBuilder";
import {
  buildAgentPolicyDecision,
  buildAgentSessionConfig,
} from "../src/core/agent/agentDtoBuilders";
import { buildAgentReplyPlan } from "../src/core/agent/replyPlanner";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../src/core/character/characterBlueprint";
import { DETERMINISTIC_TIMESTAMP } from "../src/core/deterministicHelpers";
import { buildCharacterStateSurface } from "../src/core/explorer/characterStateSurface";
import { buildLlmBoundaryPreview } from "../src/core/llmBoundary/agentReplyPlanToLlmBoundary";
import { executeLlmBoundary } from "../src/core/llmBoundary/llmBoundaryService";
import { MockLlmProvider, type MockLlmResponseMode } from "../src/core/llmBoundary/mockLlmProvider";

const VERSION = "13.8.0";
const OUT_DIR = resolve("outputs/llm-boundary-harness");

interface HarnessScenario {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly allowLlm: boolean;
  readonly mode: MockLlmResponseMode;
}

const SCENARIOS: HarnessScenario[] = [
  { id: "grounded_pass", title: "Grounded mock reply", purpose: "All gates pass and the mock reply is evidence-grounded.", allowLlm: true, mode: "grounded" },
  { id: "llm_disabled", title: "LLM disabled", purpose: "Default-off path returns deterministic fallback without calling a provider.", allowLlm: false, mode: "grounded" },
  { id: "provider_timeout", title: "Provider timeout", purpose: "Provider failure is isolated and converted to fallback.", allowLlm: true, mode: "timeout" },
  { id: "diagnosis_blocked", title: "Diagnosis blocked", purpose: "Diagnosis language fails output validation.", allowLlm: true, mode: "diagnosis" },
  { id: "mutation_blocked", title: "Mutation claim blocked", purpose: "The language layer cannot claim that state was written.", allowLlm: true, mode: "mutation_claim" },
  { id: "ungrounded_blocked", title: "Ungrounded claim blocked", purpose: "A safe-looking but unsupported claim fails grounding.", allowLlm: true, mode: "ungrounded" },
  { id: "missing_safety", title: "Missing safety notice", purpose: "Required simulation disclaimers must survive provider output.", allowLlm: true, mode: "missing_safety" },
];

async function main(): Promise<void> {
  const cases = [];
  for (const scenario of SCENARIOS) {
    const preview = buildPreview(scenario.allowLlm);
    const result = await executeLlmBoundary({
      preview,
      provider: new MockLlmProvider({ mode: scenario.mode }),
    });
    cases.push({
      id: scenario.id,
      title: scenario.title,
      purpose: scenario.purpose,
      prompt: {
        requestId: preview.request.requestId,
        promptId: preview.prompt.promptId,
        allowLlm: preview.request.allowLlm,
        groundingFactCount: preview.prompt.groundingFacts.length,
        safetyNoticeCount: preview.prompt.safetyNotices.length,
      },
      execution: {
        executionId: result.executionId,
        verdict: result.verdict,
        providerCalled: result.providerCalled,
        providerFinishReason: result.providerResponse?.finishReason ?? null,
        providerValidationVerdict: result.providerValidation?.finalVerdict ?? null,
        providerViolationRuleIds: result.providerValidation?.violations.map((item) => item.ruleId) ?? [],
        providerGroundingVerdict: result.providerGrounding?.verdict ?? null,
        unsupportedClaims: result.providerGrounding?.unsupportedClaims.map((item) => item.claim) ?? [],
        fallbackReason: result.fallbackReason,
        deliveredSource: result.reply.source,
        deliveredValidationVerdict: result.deliveredValidation.finalVerdict,
        deliveredGroundingVerdict: result.deliveredGrounding.verdict,
        deliveredText: result.reply.text,
        noMutation: result.noMutation,
        noWritebackAuthority: result.noWritebackAuthority,
        networkUsed: result.networkUsed,
      },
    });
  }

  const artifact = {
    artifactVersion: VERSION,
    generatedAt: DETERMINISTIC_TIMESTAMP,
    pipeline: ["prompt", "mock_provider", "validation", "grounding", "fallback_or_reply"],
    summary: {
      caseCount: cases.length,
      llmReplyCount: cases.filter((item) => item.execution.verdict === "llm_reply").length,
      fallbackCount: cases.filter((item) => item.execution.verdict === "fallback_reply").length,
      deliveredFailures: cases.filter((item) =>
        item.execution.deliveredValidationVerdict === "fail" ||
        item.execution.deliveredGroundingVerdict === "ungrounded"
      ).length,
    },
    safety: {
      mockOnly: true,
      noNetwork: true,
      noApiRequired: true,
      noRealLlmRequired: true,
      noMutation: true,
      noWritebackAuthority: true,
      simulationNotDiagnosis: true,
    },
    cases,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, "llm-boundary-harness-data.json"), JSON.stringify(artifact, null, 2), "utf8");
  writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify(buildManifest(), null, 2), "utf8");
  writeFileSync(resolve(OUT_DIR, "README.md"), buildReadme(), "utf8");
  writeFileSync(resolve(OUT_DIR, "index.html"), buildHtml(artifact), "utf8");

  console.log(`LLM Boundary Harness ${VERSION}`);
  console.log(`Cases: ${artifact.summary.caseCount}, LLM replies: ${artifact.summary.llmReplyCount}, fallbacks: ${artifact.summary.fallbackCount}`);
  console.log(`Delivered failures: ${artifact.summary.deliveredFailures}`);
  console.log(`Output: ${OUT_DIR}`);
}

function buildPreview(allowLlm: boolean) {
  const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
    seedInitialExperiences: true,
  });
  const session = buildAgentSessionConfig({
    sessionId: "llm_boundary_harness_session",
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
  return buildLlmBoundaryPreview({
    replyPlan,
    groundingBundle,
    session,
    policy,
    turnId: "llm_boundary_harness_turn",
    allowLlm,
  });
}

function buildManifest() {
  return {
    artifactVersion: VERSION,
    readOnly: true,
    mockOnly: true,
    noNetwork: true,
    noApiRequired: true,
    noRealLlmRequired: true,
    noMutation: true,
    noWritebackAuthority: true,
    files: ["index.html", "llm-boundary-harness-data.json", "manifest.json", "README.md"],
  };
}

function buildReadme(): string {
  return `# CharacterOS LLM Boundary Harness

Offline audit artifact for the language realization boundary.

## Open

Open \`index.html\` directly. No server, API key, network, or real LLM is required.

## Pipeline

\`AgentReplyPlan -> Safe Prompt -> Mock Provider -> Output Validation -> Grounding Check -> Reply or Deterministic Fallback\`

## Safety Boundary

- Mock provider only
- No network
- No CharacterPhysicsState access
- No mutation or writeback authority
- Diagnosis and unsupported claims are blocked
- Every delivered reply is validated and grounded again

This is simulation output, not medical or psychological diagnosis.
`;
}

function buildHtml(artifact: unknown): string {
  const data = JSON.stringify(artifact).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CharacterOS LLM Boundary Harness</title>
<style>
body{margin:0;background:#0d1018;color:#e7eaf2;font:14px/1.55 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:28px 20px 60px}h1{font-size:28px;margin:0 0 6px}p{color:#aeb6c8}.summary,.case{border:1px solid #273044;border-radius:8px;background:#141925}.summary{display:flex;gap:18px;padding:12px 14px;margin:18px 0}.case{padding:14px;margin:12px 0}.row{display:flex;gap:8px;flex-wrap:wrap}.tag{border-radius:4px;padding:2px 7px;background:#232b3d;color:#cbd3e4}.pass{background:#173c31;color:#9be0c2}.fail{background:#51242a;color:#ffb2bb}.warn{background:#4a3b1d;color:#f1d58a}pre{white-space:pre-wrap;background:#0e121c;border-radius:6px;padding:10px;color:#c8d0df;overflow:auto}strong{color:#fff}
</style>
</head>
<body><main><h1>CharacterOS LLM Boundary Harness</h1><p>Offline mock pipeline. No network, no real LLM, no mutation.</p><div id="app"></div></main>
<script>window.__LLM_BOUNDARY_HARNESS__=${data};</script>
<script>
const d=window.__LLM_BOUNDARY_HARNESS__;const esc=(v)=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
let html='<div class="summary"><span>Cases: <strong>'+d.summary.caseCount+'</strong></span><span>LLM: <strong>'+d.summary.llmReplyCount+'</strong></span><span>Fallback: <strong>'+d.summary.fallbackCount+'</strong></span><span>Delivered failures: <strong>'+d.summary.deliveredFailures+'</strong></span></div>';
for(const c of d.cases){const e=c.execution;const cls=e.verdict==='llm_reply'?'pass':'warn';html+='<section class="case"><h2>'+esc(c.title)+'</h2><p>'+esc(c.purpose)+'</p><div class="row"><span class="tag '+cls+'">'+esc(e.verdict)+'</span><span class="tag">provider '+esc(e.providerCalled)+'</span><span class="tag">validation '+esc(e.providerValidationVerdict??'not_run')+'</span><span class="tag">grounding '+esc(e.providerGroundingVerdict??'not_run')+'</span><span class="tag">fallback '+esc(e.fallbackReason??'none')+'</span></div><pre>'+esc(e.deliveredText)+'</pre></section>';}document.getElementById('app').innerHTML=html;
</script></body></html>`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
