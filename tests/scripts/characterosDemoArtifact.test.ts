import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEMO_DIR = resolve("outputs/characteros-demo");

function readDemo(file: string): string {
  return readFileSync(resolve(DEMO_DIR, file), "utf-8");
}

function extractEmbeddedData(html: string): unknown {
  const match = html.match(/window\.__CHARACTEROS_DEMO_DATA__\s*=\s*({[\s\S]*?});/);
  if (!match) throw new Error("embedded demo data not found");
  return JSON.parse(match[1]!);
}

describe("CharacterOS Static Demo Artifact", () => {
  it("creates all expected top-level files", () => {
    for (const file of [
      "index.html",
      "characteros-demo.js",
      "characteros-demo.css",
      "characteros-demo-data.json",
      "manifest.json",
      "README.md",
    ]) {
      expect(existsSync(resolve(DEMO_DIR, file))).toBe(true);
    }
  });

  it("includes the Mind Galaxy artifact as a nested viewer", () => {
    expect(existsSync(resolve(DEMO_DIR, "mind-galaxy", "index.html"))).toBe(true);
    expect(existsSync(resolve(DEMO_DIR, "mind-galaxy", "mind-galaxy-preview.js"))).toBe(true);

    const html = readDemo("index.html");
    expect(html).toContain("mind-galaxy/index.html");
  });

  it("embeds demo data before the demo script", () => {
    const html = readDemo("index.html");
    const dataIndex = html.indexOf("window.__CHARACTEROS_DEMO_DATA__");
    const scriptIndex = html.indexOf('<script src="characteros-demo.js"></script>');
    expect(dataIndex).toBeGreaterThanOrEqual(0);
    expect(scriptIndex).toBeGreaterThan(dataIndex);
  });

  it("embedded data and standalone JSON agree", () => {
    const embedded = extractEmbeddedData(readDemo("index.html"));
    const standalone = JSON.parse(readDemo("characteros-demo-data.json"));
    expect(JSON.stringify(embedded)).toBe(JSON.stringify(standalone));
    expect(standalone.version).toBe("10.73.0");
    expect(standalone.character.id).toBe("lin_fan");
    expect(standalone.overview.thesis).toContain("不是聊天回复");
    expect(standalone.scenarios).toHaveLength(5);
    expect(standalone.galaxy.nodeCount).toBe(40);
    expect(standalone.galaxy.edgeCount).toBe(48);
  });

  it("contains the main demo sections", () => {
    const js = readDemo("characteros-demo.js");
    const html = readDemo("index.html");
    const combined = `${html}\n${js}`;
    expect(combined).toContain("Overview 总览");
    expect(combined).toContain("Today");
    expect(combined).toContain("Decision");
    expect(combined).toContain("Scenarios 场景");
    expect(combined).toContain("Life Preview");
    expect(combined).toContain("Mind Galaxy");
    expect(combined).toContain("今日状态");
    expect(combined).toContain("分化决策链");
    expect(combined).toContain("固定场景观察");
    expect(combined).toContain("场景对比摘要");
    expect(combined).toContain("策略依据");
    expect(combined).toContain("自主行动候选");
  });

  it("includes read-only scenario probes", () => {
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    const scenarioTitles = data.scenarios.map((scenario: { title: string }) => scenario.title);
    expect(scenarioTitles).toEqual([
      "王雪三小时未回复",
      "朋友突然邀请合作",
      "高收益但规则灰色",
      "上级突然甩锅",
      "王雪主动解释并给证据",
    ]);
    expect(new Set(data.scenarios.map((scenario: { strategy: string }) => scenario.strategy)).size).toBeGreaterThan(2);
    for (const scenario of data.scenarios as Array<{
      trigger: string;
      strategy: string;
      strategyId: string;
      action: string;
      primarySchema: string;
      primaryNeed: string;
      strategySchemas: string[];
      schemas: string[];
      needs: string[];
    }>) {
      expect(scenario.trigger.length).toBeGreaterThan(8);
      expect(scenario.strategy.length).toBeGreaterThan(0);
      expect(scenario.strategyId.length).toBeGreaterThan(0);
      expect(scenario.action.length).toBeGreaterThan(0);
      expect(scenario.primarySchema.length).toBeGreaterThan(0);
      expect(scenario.primaryNeed.length).toBeGreaterThan(0);
      expect(scenario.strategySchemas.length).toBeGreaterThan(0);
      expect(scenario.schemas.length).toBeGreaterThan(0);
      expect(scenario.needs.length).toBeGreaterThan(0);
    }

    const js = readDemo("characteros-demo.js");
    expect(js).toContain("这些场景只运行分化决策链，不写入角色状态");
  });

  it("presents bounded human-facing state summaries", () => {
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    expect(data.today.boundary).toContain("压力负荷");
    expect(data.today.boundary).not.toContain("3.46");
    expect(data.today.metrics.map((m: { label: string }) => m.label)).toEqual([
      "信任",
      "依恋",
      "恐惧",
      "控制",
      "恢复力",
    ]);
    expect(data.lifePreview.randomThought).not.toContain("wanders");
  });

  it("remains read-only and local", () => {
    const combined = [
      readDemo("index.html"),
      readDemo("characteros-demo.js"),
      readDemo("characteros-demo-data.json"),
      readDemo("manifest.json"),
    ].join("\n");

    expect(combined).not.toContain("/api/");
    expect(combined).not.toContain("method:\"POST\"");
    expect(combined).not.toContain("method: \"POST\"");
    expect(combined).not.toContain("localStorage");
    expect(combined).not.toContain("sessionStorage");
    expect(combined).not.toContain("indexedDB");
    expect(combined).not.toContain("WebSocket");
    expect(combined).not.toContain("EventSource");
  });

  it("V10.57: includes tab step numbers", () => {
    const html = readDemo("index.html");
    expect(html).toContain("①");
    expect(html).toContain("②");
    expect(html).toContain("③");
    expect(html).toContain("④");
    expect(html).toContain("⑤");
    expect(html).toContain("⑥");
  });

  it("V10.57: Overview includes product entry and guide", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("CharacterOS 是什么");
    expect(js).toContain("建议浏览顺序");
    expect(js).toContain("产品入口");
    expect(js).toContain("建立产品认知");
    expect(js).toContain("人格信号轴");
  });

  it("V10.57: Scenarios include strategy and pressure badges", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("strategyBadge");
    expect(js).toContain("pressureBadge");
    expect(js).toContain("badge badge-strategy");
    expect(js).toContain("badge badge-pressure");
    expect(js).toContain("压力类型");
    expect(js).toContain("策略类型");
    expect(js).toContain("scenario-badges");
  });

  it("V10.57: Mind Galaxy includes observation guide", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("观察指南");
    expect(js).toContain("galaxy-instructions");
  });

  it("V10.58: includes scenario strategy matrix", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("策略分化矩阵");
    expect(js).toContain("renderScenarioMatrix");
    expect(js).toContain("matrix-hit");
    expect(js).toContain("matrix-miss");
    expect(js).toContain("matrix-table");
  });

  it("V10.58: Life Preview uses bar charts for candidate actions", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("candidateBar");
    expect(js).toContain("candidate-bar");
    expect(js).toContain("bar-track");
    expect(js).toContain("candidate-score");
    // must also keep the warning that actions are not auto-executed
    expect(js).toContain("候选动作不会自动执行");
  });

  it("V10.58: Today memory cards include deterministic hints", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("memoryHint");
    expect(js).toContain("memory-hint");
    expect(js).toContain("高重要性恐惧记忆");
    expect(js).toContain("高重要性支持性记忆");
    expect(js).toContain("memory-imp");
  });

  it("V10.59: Decision flow diagram is present", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("分化决策流程");
    expect(js).toContain("deterministic pipeline");
    expect(js).toContain("decision-flow");
    expect(js).toContain("flow-node");
    expect(js).toContain("flow-arrow");
    expect(js).toContain("renderDecisionFlow");
  });

  it("V10.59: Today boundary pressure gauge is present", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("boundarySignal");
    expect(js).toContain("boundary-gauge");
    expect(js).toContain("boundaryGauge");
    expect(js).toContain("boundary-bar");
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    expect(data.today.boundarySignal).toBeDefined();
    expect(data.today.boundarySignal.phase).toBeDefined();
    expect(data.today.boundarySignal.phaseLabel).toBeDefined();
    expect(data.today.boundarySignal.stressLoad).toBeLessThanOrEqual(1);
    expect(data.today.boundarySignal.stressLoad).toBeGreaterThanOrEqual(0);
    // boundary text must still contain human-readable values
    expect(data.today.boundary).toContain("压力负荷");
    expect(data.today.boundary).not.toContain("3.46");
    // gauge description mentions bounded
    expect(js).toContain("bounded");
  });

  it("V10.59: Life Preview energy/fatigue bars are present", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("energy-fatigue-dual");
    expect(js).toContain("ef-bar");
    expect(js).toContain("ef-track");
    // must still keep the non-execution warning
    expect(js).toContain("候选动作不会自动执行");
  });

  it("V10.59: boundary signal values are safely bounded", () => {
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    const signal = data.today.boundarySignal;
    expect(signal.stressLoad).toBeLessThanOrEqual(1);
    expect(signal.stressLoad).toBeGreaterThanOrEqual(0);
    // the raw text version should also be safely bounded
    expect(data.today.boundary).not.toMatch(/[2-9]\.\d{2}/);
    expect(data.today.boundary).not.toMatch(/1\.\d[1-9]/);
  });

  it("V10.60: scenario cards include mini flow", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("场景决策小链");
    expect(js).toContain("Schema Basis");
    expect(js).toContain("scenarioMiniFlow");
    expect(js).toContain("mini-flow");
    expect(js).toContain("mf-item");
    expect(js).toContain("mf-arrow");
    // must still contain full schemas/needs
    expect(js).toContain("scenario-detail-mini");
  });

  it("V10.60: mini-flow uses real scenario data fields", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("s.strategySchemas");
    expect(js).toContain("s.primaryNeed");
    expect(js).toContain("s.strategy");
  });

  it("V10.60: Decision flow nodes include intensity values", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("flow-node-intensity");
    expect(js).toContain("topSchemaIntensity");
    expect(js).toContain("topNeedIntensity");
    expect(js).toContain("topDesireIntensity");
    // verify data layer has intensity fields
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    const diff = data.decision.differentiated;
    expect(diff).toBeDefined();
    expect(typeof diff.topSchemaIntensity).toBe("number");
    expect(typeof diff.topNeedIntensity).toBe("number");
    expect(typeof diff.topDesireIntensity).toBe("number");
    expect(diff.topSchemaIntensity).toBeGreaterThanOrEqual(0);
    expect(diff.topSchemaIntensity).toBeLessThanOrEqual(1);
  });

  it("V10.61: tab hash persistence is implemented", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("hashToTab");
    expect(js).toContain("restoreTabFromHash");
    expect(js).toContain("replaceState");
    expect(js).toContain("hashchange");
    expect(js).toContain("KNOWN_TABS");
    // must not use any storage APIs
    expect(js).not.toContain("localStorage");
    expect(js).not.toContain("sessionStorage");
  });

  it("V10.61: Galaxy iframe is lazy-loaded", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("loadGalaxyIframe");
    expect(js).toContain("galaxyLoaded");
    expect(js).toContain("data-src");
    // the initial HTML must NOT have a pre-set iframe src
    const html = readDemo("index.html");
    expect(html).not.toContain("iframe src=");
  });

  it("V10.61: scenario action expand/collapse toggle exists", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("展开完整行动");
    expect(js).toContain("收起");
    expect(js).toContain("action-toggle");
    expect(js).toContain("data-full");
    expect(js).toContain("data-short");
  });

  it("V10.61: print stylesheet is present", () => {
    const css = readDemo("characteros-demo.css");
    expect(css).toContain("@media print");
    expect(css).toContain("background:#fff");
    expect(css).toContain("color:#111");
    expect(css).toContain("display:none"); // tabs hidden in print
    expect(css).toContain(".section");
    expect(css).toContain("page-break-inside:avoid");
  });

  it("V10.62: tab keyboard navigation is implemented", () => {
    const js = readDemo("characteros-demo.js");
    const html = readDemo("index.html");
    expect(js).toContain("handleTabKeydown");
    expect(js).toContain("ArrowRight");
    expect(js).toContain("ArrowLeft");
    expect(js).toContain('"Home"');
    expect(js).toContain('"End"');
    expect(js).toContain("aria-selected");
    expect(js).toContain("tabindex");
    expect(html).toContain('role="tab"');
  });

  it("V10.62: Review Mode toggle is present", () => {
    const js = readDemo("characteros-demo.js");
    const html = readDemo("index.html");
    expect(js).toContain("toggleReviewMode");
    expect(js).toContain("review-mode");
    expect(html).toContain("Review Mode");
    expect(js).toContain("Exit Review Mode");
  });

  it("V10.62: scenario filter controls are present", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("renderScenarioFilters");
    expect(js).toContain("scenario-filter");
    expect(js).toContain("All");
    expect(js).toContain("关系确认");
    expect(js).toContain("机会");
    expect(js).toContain("纠偏");
    expect(js).toContain("控制");
  });

  it("V10.63: scenario filter buttons include dynamic counts", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("data.scenarios.length");
    expect(js).toContain("s.strategyId===f.id");
    // count is computed dynamically in filter render
    expect(js).toContain(".length");
    // filter labels present
    expect(js).toContain("All");
  });

  it("V10.63: screen reader live region is present", () => {
    const html = readDemo("index.html");
    const js = readDemo("characteros-demo.js");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('id="sr-live"');
    expect(js).toContain("announce(");
    expect(js).toContain("当前页面");
  });

  it("V10.63: Review Checklist is present", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("Review Checklist");
    expect(js).toContain("审阅检查项");
    expect(js).toContain("人物状态是否清楚？");
    expect(js).toContain("场景差异是否可信？");
    expect(js).toContain("决策链是否可解释？");
    expect(js).toContain("星云是否帮助理解？");
    expect(js).toContain("本清单仅供审阅参考");
  });

  it("V10.63: Today metrics sort toggle is present", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("metricSortOrder");
    expect(js).toContain("Original Order");
    expect(js).toContain("Sort by Value");
    expect(js).toContain("metric-sort-toggle");
  });

  it("V10.64: manifest has reviewReady flag and version match", () => {
    const manifest = JSON.parse(readDemo("manifest.json"));
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    expect(manifest.reviewReady).toBe(true);
    expect(manifest.demoVersion).toBe(data.version);
    expect(manifest.integrity.readOnly).toBe(true);
    expect(manifest.integrity.apiRequired).toBe(false);
  });

  it("V10.64: artifact contains no external http/https URLs", () => {
    const combined = [
      readDemo("index.html"),
      readDemo("characteros-demo.js"),
      readDemo("characteros-demo.css"),
      readDemo("characteros-demo-data.json"),
      readDemo("manifest.json"),
    ].join("\n");
    expect(combined).not.toMatch(/https?:\/\//);
  });

  it("V10.64: filter and sort buttons have aria-pressed", () => {
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("aria-pressed");
    // filter buttons (in map) + sort toggle each use aria-pressed
    const ariaPressedCount = (js.match(/aria-pressed/g) || []).length;
    expect(ariaPressedCount).toBeGreaterThanOrEqual(2);
  });

  it("V10.64: Review Checklist is not hidden in print CSS", () => {
    const css = readDemo("characteros-demo.css");
    const printSection = css.slice(css.indexOf("@media print"));
    // .checklist must NOT have display:none inside @media print
    expect(printSection).not.toMatch(/\.checklist\s*\{[^}]*display\s*:\s*none/);
  });

  it("V10.64: mind-galaxy subdirectory exists", () => {
    const { existsSync } = require("node:fs");
    const { resolve } = require("node:path");
    expect(existsSync(resolve("outputs/characteros-demo", "mind-galaxy", "index.html"))).toBe(true);
    expect(existsSync(resolve("outputs/characteros-demo", "mind-galaxy", "manifest.json"))).toBe(true);
  });

  it("V10.65: README contains handoff documentation", () => {
    const readme = readDemo("README.md");
    expect(readme).toContain("推荐浏览顺序");
    expect(readme).toContain("Review Mode");
    expect(readme).toContain("Scenarios");
    expect(readme).toContain("Mind Galaxy");
    expect(readme).toContain("只读");
    expect(readme).toContain("无 API");
    expect(readme).toContain("离线");
    expect(readme).toContain("Handoff Package");
    expect(readme).toContain("审阅者应该重点反馈什么");
    expect(readme).toContain("Artifact 文件清单");
  });

  it("V10.65: manifest has handoffReady flag", () => {
    const manifest = JSON.parse(readDemo("manifest.json"));
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    expect(manifest.handoffReady).toBe(true);
    expect(manifest.reviewReady).toBe(true);
    expect(manifest.demoVersion).toBe(data.version);
    expect(manifest.demoVersion).toBe("10.73.0");
  });

  it("V10.66: includes product-console current state data", () => {
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    expect(data.currentState.surfaceState).toContain("安静");
    expect(data.currentState.internalState).toContain("关系风险");
    expect(data.currentState.shortTermTrend).toContain("检查消息");
    expect(data.currentState.repairCondition).toContain("稳定解释");
    expect(data.currentState.stressLoad).toBeLessThanOrEqual(1);
    expect(data.causalChain.map((node: { type: string }) => node.type)).toEqual([
      "experience",
      "memory",
      "belief",
      "schema",
      "need",
      "desire",
      "behavior",
    ]);
  });

  it("V10.66: scenarios include human-facing interpretation fields", () => {
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    for (const scenario of data.scenarios as Array<{
      firstReaction: string;
      perceptionBias: string;
      spokenLine: string;
      hiddenThought: string;
      behaviorRisk: string;
      repairCondition: string;
    }>) {
      expect(scenario.firstReaction.length).toBeGreaterThan(0);
      expect(scenario.perceptionBias.length).toBeGreaterThan(0);
      expect(scenario.spokenLine.length).toBeGreaterThan(0);
      expect(scenario.hiddenThought.length).toBeGreaterThan(0);
      expect(scenario.behaviorRisk.length).toBeGreaterThan(0);
      expect(scenario.repairCondition.length).toBeGreaterThan(0);
    }
    const js = readDemo("characteros-demo.js");
    expect(js).toContain("第一反应");
    expect(js).toContain("感知偏差");
    expect(js).toContain("修复条件");
  });

  it("V10.66: Life Preview explains overflow behavior mode", () => {
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    expect(data.lifePreview.overflowMode).toBe(true);
    expect(data.lifePreview.previewModeExplanation).toContain("只读预览");
    expect(data.lifePreview.nextLikelyBehavior).toContain("撤回独处");
    expect(data.lifePreview.suppressedBehaviors).toContain("冲动追问");
    expect(data.lifePreview.executedBehaviors).toEqual([]);
    expect(data.lifePreview.selfActionCandidates[0].status).toBe("next_likely");
  });

  it("V10.66: Mind Galaxy exposes causal nodes and clickable detail UI", () => {
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    const js = readDemo("characteros-demo.js");
    expect(data.galaxyNodes.length).toBeGreaterThanOrEqual(7);
    expect(data.galaxyNodes.some((node: { active: boolean }) => node.active)).toBe(true);
    expect(data.galaxy.artifactVersion).toBe(data.version);
    expect(data.galaxy.sourceArtifactVersion).toBeDefined();
    expect(js).toContain("心理因果节点");
    expect(js).toContain("节点详情");
    expect(js).toContain("selectGalaxyNode");
    expect(js).toContain("经历 → 记忆 → 信念 → 图式 → 缺失 → 欲望 → 行为倾向");
  });

  it("V10.66: Review Mode has developer warnings and product console flag", () => {
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    const manifest = JSON.parse(readDemo("manifest.json"));
    expect(data.reviewWarnings.length).toBeGreaterThan(0);
    expect(data.reviewWarnings.some((warning: { level: string }) => warning.level === "warn")).toBe(true);
    expect(manifest.productConsoleReady).toBe(true);
  });

  it("V10.69: includes Reality Audit structured responsiveness and calibration results", () => {
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    expect(data.realityAudit.version).toBe("10.73.0");
    expect(data.realityAudit.cases.length).toBeGreaterThanOrEqual(4);
    expect(data.realityAudit.cases[0].memoryDelta).toBeDefined();
    expect(data.realityAudit.cases[0].personalityDelta).toBeDefined();
    expect(data.realityAudit.cases[0].decisionBefore).toBeDefined();
    expect(data.realityAudit.cases[0].decisionAfter).toBeDefined();
    expect(data.realityAudit.cases[0].decisionInfluence.decisionInfluenceVector).toBeDefined();
    expect(data.realityAudit.cases[0].decisionInfluence.strategyWeightDelta).toBeDefined();
    expect(data.realityAudit.cases[0].decisionInfluence.actionCandidateScoreDelta).toBeDefined();
    expect(data.realityAudit.cases[0].decisionResponsiveness.responsivenessScore).toBeGreaterThan(0);
    expect(data.realityAudit.cases[0].impactCalibration.eventSeverityScore).toBeGreaterThan(0);
    expect(data.realityAudit.cases[0].impactCalibration.channelImpactAllocation).toBeDefined();
    expect(data.realityAudit.cases[0].impactCalibration.expectedDeltaRange.length).toBeGreaterThan(0);
    expect(data.realityAudit.cases[0].impactCalibration.actualDeltaByChannel).toBeDefined();
    expect(data.realityAudit.cases[0].impactCalibration.calibrationVerdict.level).toBeDefined();
    expect(data.realityAudit.cases[0].explanationTrace.groundedDeltaPaths).toContain("memoryDelta[0]");
    expect(data.realityAudit.cases[0].explanationTrace.groundedDeltaPaths).toContain("impactCalibration.calibrationVerdict");
    expect(data.realityAudit.summary.fail).toBe(0);
  });

  it("V10.69: Reality Audit page renders decision influence, responsiveness, and calibration fields", () => {
    const html = readDemo("index.html");
    const js = readDemo("characteros-demo.js");
    const manifest = JSON.parse(readDemo("manifest.json"));
    expect(html).toContain("Reality Audit 真实性验收");
    expect(html).toContain("reality-audit");
    expect(js).toContain("renderRealityAudit");
    expect(js).toContain("Decision Influence Vector");
    expect(js).toContain("Strategy Weight Delta");
    expect(js).toContain("Action Candidate Score Before / After");
    expect(js).toContain("Responsiveness Verdict");
    expect(js).toContain("Impact Calibration");
    expect(js).toContain("Calibration Verdict");
    expect(js).toContain("Expected Delta Range");
    expect(js).toContain("Actual Delta By Channel");
    expect(js).toContain("channelImpactAllocation");
    expect(js).toContain("memoryDelta");
    expect(js).toContain("decisionBefore");
    expect(js).toContain("decisionAfter");
    const data = JSON.parse(readDemo("characteros-demo-data.json"));
    expect(
      data.realityAudit.cases.some((item: { auditVerdict: { warnings: string[] } }) => (
        item.auditVerdict.warnings.includes("state changed but decision did not respond")
      )),
    ).toBe(false);
    expect(
      data.realityAudit.cases.some((item: { decisionResponsiveness: { verdict: string } }) => (
        item.decisionResponsiveness.verdict === "PASS_WITH_STABLE_TOP_DECISION"
      )),
    ).toBe(true);
    expect(manifest.realityAuditReady).toBe(true);
  });

  it("does not include raw state structural payloads", () => {
    const forbidden = [
      "finalState",
      "serializedState",
      "rawCluster",
      "rawMemory",
      "rawMemories",
      "memoryPayload",
      "clusterPayload",
      "proceduralRoutines",
    ];
    const dataText = readDemo("characteros-demo-data.json");
    for (const key of forbidden) {
      expect(dataText).not.toContain(`"${key}"`);
    }
  });
});
