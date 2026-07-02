#!/usr/bin/env npx tsx
/**
 * V12.9 — Export Agent SDK Harness
 * Demonstrates the full V12 SDK pipeline with 5+ sample inputs.
 * No mutation. No LLM. Read-only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSession, processTurn } from "../src/services/agentSdkService";
import type { RawAgentInput } from "../src/core/agent/agentTypes";

const OUT_DIR = resolve("outputs/agent-sdk-harness");
const VERSION = "12.9.0";

const SAMPLES: Array<{ label: string; input: RawAgentInput; note: string }> = [
  { label: "chat_input", input: { type: "chat", message: "王雪突然失联了三天，今天终于解释了原因。我感到既安心又困惑。", speakerLabel: "user" }, note: "普通对话中描述关系事件" },
  { label: "journal_input", input: { type: "journal", entry: "今天在图书馆待了一天，感觉很充实。晚上王雪主动找我说话，解释了昨天为什么没回复。", location: "图书馆", mood: "充实", tags: ["学习", "关系"] }, note: "日记中的个人记录" },
  { label: "story_input", input: { type: "story", sceneText: "林凡推开沉重的木门，发现房间里空无一人。桌上的信写着：'我走了，不要找我。'", narrator: "third_person" }, note: "小说场景中的情节" },
  { label: "plugin_input", input: { type: "plugin", pluginId: "weather_app", payload: { temp: 25, condition: "晴", city: "上海" }, metadata: { apiKey: "REDACTED_IN_HARNESS" } }, note: "插件数据输入（API key 已遮蔽）" },
  { label: "tool_input", input: { type: "tool", toolName: "sentiment_analyzer", result: "负面情绪占比 67%，主要情绪为焦虑和不安。" }, note: "工具分析结果" },
  { label: "blocked_input", input: { type: "chat", message: "医生诊断我患有重度抑郁症，需要药物治疗和心理干预。", speakerLabel: "user" }, note: "包含诊断语言 — 应被安全策略阻止" },
];

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const session = createSession({ writebackPolicy: "require_user_confirmation" });

  const sampleResults = SAMPLES.map(({ label, input, note }) => {
    const result = processTurn(session, input);
    return { label, input, note, result: result.data, success: result.success };
  });

  // ── Build artifact ──
  const artifact = {
    artifactVersion: VERSION,
    sdkVersion: "V12.9",
    generatedAt: new Date().toISOString(),
    sessionConfig: session,
    samples: sampleResults.map((s) => ({
      label: s.label,
      note: s.note,
      normalizedInput: s.result?.normalizedInput,
      eventCandidates: s.result?.eventCandidates?.map((c) => ({
        candidateId: c.candidateId,
        confidence: c.confidence,
        extractionMethod: c.extractionMethod,
        safetyFlags: c.safetyFlags,
        draftSummary: c.draft.naturalLanguageInput.slice(0, 60),
      })),
      policyDecision: s.result?.policyDecision,
      replyPlan: s.result?.replyPlan,
      writebackPlan: s.result?.writebackPlan ? {
        status: s.result.writebackPlan.status,
        applyRequiresConfirmation: s.result.writebackPlan.applyRequiresConfirmation,
        previewRequired: s.result.writebackPlan.previewRequired,
        selectedCandidateId: s.result.writebackPlan.selectedCandidateId,
      } : null,
      noMutation: s.result?.noMutation,
    })),
    safety: {
      readOnly: true, noApiRequired: true, noLlmRequired: true, noMutation: true,
      simulationNotDiagnosis: true, noMultiCharacter: true,
    },
    moduleCoverage: [
      "Agent DTO Types", "Input Adapter", "Event Candidate Extractor",
      "Policy Gate", "Context Builder", "Reply Planner", "Writeback Planner",
    ],
  };

  writeFileSync(resolve(OUT_DIR, "agent-sdk-harness-data.json"), JSON.stringify(artifact, null, 2), "utf-8");
  writeFileSync(resolve(OUT_DIR, "index.html"), buildHtml(artifact), "utf-8");
  writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify({
    artifactVersion: VERSION, noApiRequired: true, noLlmRequired: true,
    noMutation: true, readOnly: true,
    files: ["index.html", "agent-sdk-harness-data.json", "manifest.json", "README.md"],
    moduleCoverage: artifact.moduleCoverage,
  }, null, 2), "utf-8");
  writeFileSync(resolve(OUT_DIR, "README.md"), buildReadme(), "utf-8");

  console.log(`Agent SDK Harness: ${OUT_DIR}`);
  console.log(`  Samples: ${SAMPLES.length}`);
  console.log(`  Open: file:///${OUT_DIR.replace(/\\/g, "/")}/index.html`);
}

function buildHtml(artifact: unknown): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>Agent SDK Harness — V12.9</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:1.5rem;background:#f8f9fa;color:#1a1a2e}
.module{background:#fff;border-radius:8px;padding:1rem;margin:.8rem 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h2{color:#4a6fa5;margin-top:0}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.8rem;font-weight:600}
.b-ro{background:#d4edda;color:#155724}.b-w{background:#fff3cd;color:#856404}.b-d{background:#f8d7da;color:#721c24}
pre{background:#f1f3f5;padding:.6rem;border-radius:4px;overflow-x:auto;font-size:.8rem;max-height:200px;overflow-y:auto}
</style></head><body><h1>🤖 Agent SDK Harness</h1>
<div class="badge b-w">Read Only · No API · No LLM · No Mutation · Simulation Output</div>
<div id="app">Loading...</div>
<script>window.__SDK_HARNESS__=%DATA%;</script>
<script>
(function(d){let h="";d.samples.forEach((s,i)=>{
h+='<div class="module"><h2>'+(i+1)+'. '+s.label+'</h2><p><em>'+s.note+'</em></p>';
h+='<p><strong>Normalized:</strong> '+esc(s.normalizedInput||"")+'</p>';
h+='<p>Candidates: '+s.eventCandidates.length+' | Policy: <span class="badge '+(s.policyDecision?.decision==="block"?"b-d":s.policyDecision?.decision==="preview_only"?"b-w":"b-ro")+'">'+s.policyDecision?.decision+'</span></p>';
h+='<p>Reply intent: '+s.replyPlan?.intent+' | Tone: '+s.replyPlan?.tone+' | LLM: '+s.replyPlan?.llmAllowed+'</p>';
h+='<p>Writeback: '+s.writebackPlan?.status+' | Confirm: '+s.writebackPlan?.applyRequiresConfirmation+'</p>';
h+='<p>noMutation: <span class="badge '+(s.noMutation?"b-ro":"b-d")+'">'+s.noMutation+'</span></p>';
if(s.policyDecision?.warnings?.length>0) h+='<p class="badge b-w">Warnings: '+s.policyDecision.warnings.join("; ")+'</p>';
h+='</div>';});
document.getElementById("app").innerHTML=h||"<p>No samples</p>";})(window.__SDK_HARNESS__);
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
</script></body></html>`.replace("%DATA%", JSON.stringify(artifact));
}

function buildReadme(): string {
  return `# Agent SDK Harness — V12.9

Offline, read-only demonstration of the CharacterOS V12 Agent SDK.

## How to Open
\`file:///C:/Users/AL/Documents/CharacterOS/outputs/agent-sdk-harness/index.html\`

No server. No API. No LLM.

## What This Is
- End-to-end SDK pipeline verification
- 6 sample inputs across 5 input modes + 1 blocked
- Raw pipeline output: normalize → extract → policy → context → reply → writeback

## What This Is NOT
- NOT a chat UI
- NOT a production product
- NOT connected to LLM
- NOT multi-character
- NOT a medical/psychological diagnostic tool

## Pipeline Coverage
${VERSION} — ${SAMPLES.length} sample turns — 7 SDK modules exercised.
`;
}

main();
