#!/usr/bin/env npx tsx
/**
 * V11.9 — Export CharacterOS Explorer Static Artifact
 *
 * Generates an offline, read-only Explorer package from the V11 service layer.
 * No server. No API. No LLM. No mutation.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getExplorerManifest, getCharacterStateSurface, previewEvent, applyEvent,
  getExplainabilityTimeline, createTimeMachineSnapshot, getTimeMachineTimeline,
  restoreTimeMachineView, getMindGalaxyEmbed,
} from "../src/services/explorerService";

const CHAR_ID = "lin_fan";
const OUT_DIR = resolve("outputs/characteros-explorer");
const VERSION = "11.9.0";

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  // ── Module 1: Explorer Manifest ──
  const manifest = getExplorerManifest(CHAR_ID);

  // ── Module 2: Character State Surface ──
  const stateSurface = getCharacterStateSurface(CHAR_ID);

  // ── Module 3: Event Studio ──
  const supportDraft = { naturalLanguageInput: "王雪主动解释昨晚没回复的原因，并约定下次会提前说明。", tags: ["王雪", "解释", "支持"], intensity: 0.6 };
  const supportPreview = previewEvent(CHAR_ID, supportDraft);
  // Apply a support event to generate history
  applyEvent(CHAR_ID, supportDraft, supportPreview.data!, "apply", "生成探索者 artifacts 历史", "artifact_generator");

  const abandonDraft = { naturalLanguageInput: "王雪突然失联三天，没有解释。", tags: ["王雪", "失联", "等待"], intensity: 0.8 };
  const abandonPreview = previewEvent(CHAR_ID, abandonDraft);
  applyEvent(CHAR_ID, abandonDraft, abandonPreview.data!, "apply", "生成负面事件历史", "artifact_generator");

  const neutralDraft = { naturalLanguageInput: "下午路过便利店看到新海报。", tags: ["日常"], intensity: 0.2 };
  const neutralPreview = previewEvent(CHAR_ID, neutralDraft);

  // ── Module 4: Explainability Timeline ──
  const explain = getExplainabilityTimeline(CHAR_ID, "为什么今天更焦虑？");

  // ── Module 5: Time Machine ──
  const snap1 = createTimeMachineSnapshot(CHAR_ID, "Day 1");
  const snap7 = createTimeMachineSnapshot(CHAR_ID, "Day 7");
  const snapToday = createTimeMachineSnapshot(CHAR_ID, "Today");
  const timeline = getTimeMachineTimeline(CHAR_ID);
  const restoreView = snap1.data
    ? restoreTimeMachineView(CHAR_ID, snap1.data.snapshotId)
    : null;

  // ── Module 6: Mind Galaxy ──
  const galaxy = getMindGalaxyEmbed(CHAR_ID);

  // ── Module 7: Reality Audit (current state) ──
  const currentStateSurface = getCharacterStateSurface(CHAR_ID);

  // ── Build artifact data ──
  const artifactData = {
    artifactVersion: VERSION,
    generatedAt: new Date().toISOString(),
    sourceVersion: "V11.9",
    characterId: CHAR_ID,
    manifest: manifest.data,
    characterState: stateSurface.data,
    eventStudio: {
      support: { draft: supportDraft, preview: supportPreview.data },
      abandon: { draft: abandonDraft, preview: abandonPreview.data },
      neutral: { draft: neutralDraft, preview: neutralPreview.data },
    },
    explainability: explain.data,
    timeMachine: {
      snapshots: timeline.data?.snapshots ?? [],
      timeline: timeline.data,
      restoreView: restoreView?.data ?? null,
    },
    mindGalaxy: galaxy.data,
    realityAudit: {
      surface: currentStateSurface.data,
      disclaimers: [
        "这是模拟系统的内部审计，不是外部验证。",
        "事件影响为模型计算，不应等同于真实心理反应。",
        "CharacterOS Explorer — 模拟系统输出，非医学诊断。",
      ],
    },
    safety: {
      readOnly: true,
      noApiRequired: true,
      noLlmRequired: true,
      noMutation: true,
      simulationNotDiagnosis: true,
    },
    moduleCoverage: {
      eventStudio: "preview_only",
      characterState: "surface",
      explainability: "timeline",
      timeMachine: "snapshot_and_restore",
      mindGalaxy: "embed",
      realityAudit: "panel",
    },
  };

  // ── Write JSON ──
  writeFileSync(resolve(OUT_DIR, "characteros-explorer-data.json"), JSON.stringify(artifactData, null, 2), "utf-8");

  // ── Write HTML ──
  writeFileSync(resolve(OUT_DIR, "index.html"), buildHtml(), "utf-8");

  // ── Write manifest ──
  writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify({
    artifactVersion: VERSION,
    generatedAt: artifactData.generatedAt,
    characterId: CHAR_ID,
    readOnly: true,
    noApiRequired: true,
    noLlmRequired: true,
    noMutation: true,
    files: ["index.html", "characteros-explorer-data.json", "manifest.json", "README.md"],
    moduleCoverage: artifactData.moduleCoverage,
  }, null, 2), "utf-8");

  // ── Write README ──
  writeFileSync(resolve(OUT_DIR, "README.md"), buildReadme(), "utf-8");

  console.log(`CharacterOS Explorer artifact created: ${OUT_DIR}`);
  console.log(`  Version: ${VERSION}`);
  console.log(`  Character: ${CHAR_ID}`);
  console.log(`  Modules: ${Object.keys(artifactData.moduleCoverage).length}`);
  console.log(`  Open: file:///${OUT_DIR.replace(/\\/g, "/")}/index.html`);
}

function buildHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CharacterOS Explorer — V11.9</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 1.5rem; background: #f8f9fa; color: #1a1a2e; }
h1 { border-bottom: 2px solid #4a6fa5; padding-bottom: 0.5rem; }
.module { background: white; border-radius: 8px; padding: 1.2rem; margin: 1rem 0; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.module h2 { margin-top: 0; color: #4a6fa5; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
.badge-ro { background: #d4edda; color: #155724; }
.badge-warn { background: #fff3cd; color: #856404; }
.badge-danger { background: #f8d7da; color: #721c24; }
.badge-info { background: #d1ecf1; color: #0c5460; }
.banner { background: #fff3cd; border: 1px solid #ffc107; padding: 0.8rem; border-radius: 6px; margin: 1rem 0; font-size: 0.9rem; }
.banner strong { color: #856404; }
pre { background: #f1f3f5; padding: 0.8rem; border-radius: 4px; overflow-x: auto; font-size: 0.85rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.8rem; }
</style>
</head>
<body>
<h1>🎭 CharacterOS Explorer</h1>
<div class="banner">
<strong>⚠️ 只读离线 artifacts</strong> — 不需要服务器、不需要 API、不需要 LLM。<br>
这是模拟系统输出，不是医学/心理诊断。不会写回角色状态。
</div>

<div id="app">
<p>加载 Explorer 数据中...</p>
</div>

<script>
// Embedded data
window.__EXPLORER_DATA__ = %DATA_PLACEHOLDER%;

(function render(data) {
  const el = document.getElementById("app");
  let html = "";

  // Character State
  const cs = data.characterState;
  html += '<div class="module"><h2>📊 Character State</h2>';
  html += '<p><strong>Headline:</strong> ' + esc(cs.headline) + '</p>';
  html += '<p><strong>Emotion:</strong> ' + esc(cs.emotionalState.label) + ' (' + cs.emotionalState.valence + ', arousal: ' + cs.emotionalState.arousal + ')</p>';
  html += '<p><strong>Stress:</strong> ' + esc(cs.stressState.label) + ' <span class="badge badge-' + (cs.stressState.level === "high" ? "danger" : cs.stressState.level === "overload" ? "danger" : "ro") + '">' + cs.stressState.phase + '</span></p>';
  html += '<div class="grid">';
  for (const [k, v] of Object.entries(cs.personalitySummary)) {
    html += '<div><strong>' + k + ':</strong> ' + esc(v.label) + ' <span class="badge badge-info">' + v.value + '</span></div>';
  }
  html += '</div>';
  html += '<p><strong>Top Beliefs:</strong> ' + cs.dominantBeliefs.map(b => b.content).join("; ") + '</p>';
  html += '<p><strong>Behavior:</strong> ' + esc(cs.behaviorTendencies.likelyAction) + '</p>';
  html += '<p class="badge badge-ro">safety: ' + esc(cs.safetyNote) + '</p>';
  html += '</div>';

  // Event Studio
  html += '<div class="module"><h2>📝 Event Studio</h2>';
  for (const [key, entry] of Object.entries(data.eventStudio)) {
    const p = entry.preview;
    html += '<h3>' + key + ': ' + esc(entry.draft.naturalLanguageInput.slice(0, 40)) + '...</h3>';
    html += '<p>Parsed: ' + p.parsedEvent.category + ', emotion: ' + p.parsedEvent.emotion + ', impact: memory=' + p.impactPreview.expectedMemoryImpact + ' boundary=' + p.impactPreview.expectedBoundaryImpact + '</p>';
    html += '<p>Personality: ' + p.personalityPreview.direction + ' (' + p.personalityPreview.estimatedMagnitude + ') | Requires confirmation: ' + p.requiresConfirmation + '</p>';
    html += '<p><strong>Reality Audit Preview:</strong> <span class="badge badge-' + (p.realityAuditPreview.expectedVerdict === "PASS" ? "ro" : "danger") + '">' + p.realityAuditPreview.expectedVerdict + '</span></p>';
  }
  html += '</div>';

  // Explainability
  const ex = data.explainability;
  html += '<div class="module"><h2>🔍 Explainability</h2>';
  html += '<p><strong>Question:</strong> ' + esc(ex.question) + '</p>';
  html += '<p>Confidence: <span class="badge badge-' + (ex.confidence === "high" ? "ro" : ex.confidence === "moderate" ? "warn" : "danger") + '">' + ex.confidence + '</span> | Grounding: ' + ex.groundingStatus + '</p>';
  html += '<p>Causal steps: ' + ex.causalSteps.length + ' | Evidence refs: ' + ex.evidenceRefs.length + '</p>';
  for (const s of ex.causalSteps.slice(0, 5)) {
    html += '<p>' + s.type + ': ' + esc(s.summary.slice(0, 80)) + ' <span class="badge badge-info">' + s.direction + '</span></p>';
  }
  html += '</div>';

  // Time Machine
  const tm = data.timeMachine;
  html += '<div class="module"><h2>⏳ Time Machine</h2>';
  html += '<p>Snapshots: ' + tm.snapshots.length + ' | Timeline snapshots: ' + (tm.timeline ? tm.timeline.snapshots.length : 0) + '</p>';
  if (tm.restoreView) {
    const rv = tm.restoreView;
    html += '<div class="banner">';
    for (const b of rv.safetyBanner) html += '<strong>' + esc(b) + '</strong><br>';
    html += '</div>';
    html += '<p>Restore view: ' + rv.label + ' (' + rv.capturedAt + ') | Historical: ' + rv.isHistoricalView + ' | Current: ' + rv.isCurrentSnapshot + '</p>';
    html += '<p>State: ' + esc(rv.stateSummary) + '</p>';
  }
  html += '</div>';

  // Mind Galaxy
  const mg = data.mindGalaxy;
  html += '<div class="module"><h2>🌌 Mind Galaxy</h2>';
  html += '<p>Mode: ' + mg.mode + ' | Nodes: ' + mg.nodeCount + ' | Edges: ' + mg.edgeCount + '</p>';
  html += '<p>Read-only: ' + mg.noMutation + ' | Research view: ' + mg.safetyBoundary.researchViewOnly + '</p>';
  html += '<p class="badge badge-warn">' + esc(mg.safetyBoundary.disclaimer) + '</p>';
  html += '</div>';

  // Reality Audit
  const ra = data.realityAudit;
  html += '<div class="module"><h2>🛡️ Reality Audit</h2>';
  html += '<p><strong>Current State</strong></p>';
  html += '<p>Headline: ' + esc(ra.surface.headline) + '</p>';
  html += '<p>Stress: ' + esc(ra.surface.stressState.label) + '</p>';
  html += '<p>Emotion: ' + esc(ra.surface.emotionalState.label) + '</p>';
  for (const d of ra.disclaimers) {
    html += '<p class="badge badge-warn">' + esc(d) + '</p>';
  }
  html += '</div>';

  // Footer
  html += '<div style="text-align:center;margin-top:2rem;color:#888;font-size:0.85rem">';
  html += '<p>CharacterOS Explorer V11.9 — Static Artifact — Read Only — No Server Required</p>';
  html += '<p>Simulation output. Not a medical/psychological diagnosis.</p>';
  html += '</div>';

  el.innerHTML = html;
})(window.__EXPLORER_DATA__);

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
</script>
</body>
</html>`;
}

function buildReadme(): string {
  return `# CharacterOS Explorer — V11.9 Static Artifact

## How to Open

Open \`index.html\` in any modern browser:

\`\`\`
file:///C:/Users/AL/Documents/CharacterOS/outputs/characteros-explorer/index.html
\`\`\`

No server needed. No API keys. No LLM. No installation.

## What This Artifact Is

- A **read-only offline snapshot** of all six CharacterOS Explorer modules
- A demonstration of what the Explorer service layer produces
- A verification artifact: "Can all six modules coexist in one package?"

## What This Artifact Is NOT

- **Not a chat interface** — no dialogue, no "talk to the character"
- **Not a final product UI** — this is a reference artifact, not a polished app
- **Not multi-character** — single character only (Lin Fan)
- **Not a medical/psychological diagnostic tool** — simulation output only
- **Not writable** — no events are applied to a live server state

## Module Walkthrough

1. **Character State Surface** — Current personality, emotional state, stress, beliefs, behavior
2. **Event Studio** — Three sample events: support, abandonment, neutral. Parse + impact preview.
3. **Explainability Timeline** — "Why am I more anxious?" — causal chain from recent events
4. **Time Machine** — Snapshots at Day 1 / Day 7 / Today. Restore view from Day 1.
5. **Mind Galaxy** — Advanced research view reference (read-only, no mutation)
6. **Reality Audit** — Current state surface with safety disclaimers

## Limitations

- Memory state is ephemeral (in-memory, not persisted)
- Snapshots are generated from the same state (not truly historical)
- No LLM integration (rule-based parser only)
- No multi-character relationship data
- No autonomous scheduling

## Generated

- Version: ${VERSION}
- Character: ${CHAR_ID}
- Source: V11 Explorer Service Layer
`;
}

main();
