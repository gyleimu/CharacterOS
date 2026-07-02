import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CharacterPhysicsEngine, createCharacterPhysicsState, type CharacterPhysicsState } from "../src/core/physics/physicsEngine";
import type { ExperienceEvent } from "../src/core/event/event";
import { neutralCoordinate, type PersonalityCoordinateValues } from "../src/core/personality/coordinate";
import { defaultMetaState } from "../src/core/meta/metaState";
import { createPsychologicalBoundary } from "../src/core/boundary/psychologicalBoundary";
import { deriveCharacterState } from "../src/core/state/derivedCharacterState";
import { runLifeTickDryRun } from "../src/core/life/lifeTickRunner";

interface RawCase {
  ID: string;
  核心人格: string;
  核心经历: string;
  测试目标: string;
  场景触发点: string;
  期望观察点: string;
}

interface CaseResult {
  id: string;
  verdict: "PASS" | "WARN" | "FAIL";
  score: number;
  checksPassed: number;
  checksTotal: number;
  corePersonality: string;
  coreExperience: string;
  trigger: string;
  expected: string;
  answerOrChoice: string;
  mostLikelyAction: string;
  confidence: number;
  topSelfActionCandidates: string[];
  activatedMemories: string[];
  trustBefore: number;
  trustAfter: number;
  fearBefore: number;
  fearAfter: number;
  stressAfter: number;
  topNeed: string;
  topBelief: string;
  evidence: string[];
  misses: string[];
}

const inputPath = resolve("outputs/characteros_100_cases.json");
const cases = JSON.parse(readFileSync(inputPath, "utf-8")) as RawCase[];

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function applyDelta(values: PersonalityCoordinateValues, delta: Partial<PersonalityCoordinateValues>): void {
  for (const [key, value] of Object.entries(delta) as Array<[keyof PersonalityCoordinateValues, number]>) {
    values[key] = clamp01(values[key] + value);
  }
}

function buildState(raw: RawCase): CharacterPhysicsState {
  const coordinate = neutralCoordinate();
  const meta = defaultMetaState();
  const personality = raw.核心人格;
  const experience = raw.核心经历;
  const text = `${personality} ${experience} ${raw.测试目标}`;

  if (hasAny(text, ["低信任", "怀疑", "背叛", "泄露", "被操控", "被利用"])) {
    coordinate.values.trust = 0.24;
    meta.trustGrowthRate = 0.24;
    meta.trustDecayRate = 0.76;
  }
  if (hasAny(text, ["高信任", "开放", "温和", "共情"])) {
    coordinate.values.trust = Math.max(coordinate.values.trust, 0.62);
  }
  if (hasAny(text, ["高恐惧", "高警觉", "威胁敏感", "低安全感", "焦虑", "怕被抛"])) {
    coordinate.values.fear = 0.82;
    coordinate.values.neuroticism = 0.78;
    meta.traumaAmplification = 0.74;
  }
  if (hasAny(text, ["高自控", "克制", "理性", "重事实", "责任感强", "务实"])) {
    coordinate.values.control = 0.82;
    coordinate.values.conscientiousness = 0.76;
    meta.selfControl = 0.82;
  }
  if (hasAny(text, ["低自控", "冲动", "刺激寻求", "情绪表达放大"])) {
    coordinate.values.control = 0.34;
    meta.selfControl = 0.34;
  }
  if (hasAny(text, ["高好奇", "好奇", "探索", "刺激寻求"])) {
    coordinate.values.openness = 0.86;
    meta.curiosity = 0.88;
  }
  if (hasAny(text, ["低边界", "被过度索取", "习惯硬撑", "照顾他人", "低攻击性"])) {
    coordinate.values.agreeableness = Math.max(coordinate.values.agreeableness, 0.72);
  }
  if (hasAny(text, ["高共情", "内疚", "照顾", "温和"])) {
    coordinate.values.agreeableness = 0.86;
    meta.emotionalSensitivity = 0.74;
  }
  if (hasAny(text, ["孤独", "渴望", "依恋", "被忽视", "被看见"])) {
    coordinate.values.attachment = 0.84;
    meta.lonelinessTolerance = 0.22;
    meta.attachmentStyle = 0.82;
  }
  if (hasAny(text, ["羞耻", "自责", "冒名顶替", "比较"])) {
    coordinate.values.neuroticism = Math.max(coordinate.values.neuroticism, 0.76);
    meta.emotionalSensitivity = 0.82;
  }
  if (hasAny(text, ["高韧性", "恢复", "修复", "成长"])) {
    meta.resilience = 0.78;
    coordinate.values.fear = Math.min(coordinate.values.fear, 0.48);
    coordinate.values.trust = Math.max(coordinate.values.trust, 0.48);
  }
  if (hasAny(text, ["冷漠", "低情绪表达", "情感回避", "独立"])) {
    meta.emotionalSensitivity = 0.34;
    coordinate.values.attachment = Math.min(coordinate.values.attachment, 0.38);
  }
  if (hasAny(text, ["资源焦虑", "损失厌恶", "稀缺"])) {
    coordinate.values.fear = Math.max(coordinate.values.fear, 0.68);
    coordinate.values.control = Math.max(coordinate.values.control, 0.72);
  }

  const weakBoundary = hasAny(text, ["低边界", "被过度索取", "冻结", "怕冲突", "过度保护"]);
  const strongBoundary = hasAny(text, ["边界", "恢复", "高韧性", "自尊强"]);

  return createCharacterPhysicsState({
    identity: {
      id: raw.ID,
      name: raw.ID,
      description: raw.测试目标,
      tags: raw.核心人格.split(/[、,，]/).filter(Boolean),
    },
    coordinate,
    metaState: meta,
    boundary: createPsychologicalBoundary({
      capacity: weakBoundary ? 0.42 : strongBoundary ? 0.72 : 0.58,
      resilience: strongBoundary ? 0.72 : weakBoundary ? 0.38 : 0.52,
      integrity: weakBoundary ? 0.62 : strongBoundary ? 0.86 : 0.76,
      stressLoad: hasAny(text, ["疲惫", "压力", "焦虑"]) ? 0.28 : 0.12,
    }),
    learningRate: 0.03,
  });
}

function eventFromText(id: string, description: string, source: "experience" | "trigger"): ExperienceEvent {
  const category = inferCategory(description);
  const emotion = inferEmotion(description);
  const intensity = source === "experience" ? 0.82 : 0.68;
  const importance = source === "experience" ? 0.84 : 0.72;
  return {
    id,
    description,
    tags: inferTags(description),
    category,
    emotion,
    intensity,
    importance,
    relationshipWeight: hasAny(description, ["朋友", "同伴", "家人", "伴侣", "旧友", "亲密", "老师", "上级"]) ? 0.82 : 0.45,
    expectationGap: hasAny(description, ["突然", "失联", "背叛", "错误", "要求", "指责", "调侃", "风险"]) ? 0.78 : 0.42,
    personalitySensitivity: 0.78,
    coordinateDelta: coordinateDeltaForCategory(category, description),
    beliefEffect: beliefEffectFor(description, category),
  };
}

function inferCategory(text: string): string {
  if (hasAny(text, ["失约", "断联", "失联", "冷落", "抛", "忽视"])) return "abandonment";
  if (hasAny(text, ["背叛", "泄露", "操控", "利用", "欺骗"])) return "betrayal";
  if (hasAny(text, ["帮助", "善意", "支持", "陪", "分担", "肯定", "兑现", "解释"])) return "support";
  if (hasAny(text, ["成功", "认可", "进步", "称赞", "晋升"])) return "success";
  if (hasAny(text, ["错误", "失败", "挑错", "批评", "反馈", "比较"])) return "failure";
  if (hasAny(text, ["冲突", "指责", "要求", "调侃", "压力"])) return "conflict";
  if (hasAny(text, ["风险", "陌生", "不透明", "投入"])) return "risk";
  return "general";
}

function inferEmotion(text: string): string {
  if (hasAny(text, ["羞耻", "自责", "错误", "失败", "挑错"])) return "shame";
  if (hasAny(text, ["背叛", "泄露", "操控", "利用", "冲突", "指责"])) return "anger";
  if (hasAny(text, ["帮助", "善意", "支持", "肯定", "兑现"])) return "relief";
  if (hasAny(text, ["失约", "断联", "失联", "抛", "风险", "陌生"])) return "fear";
  if (hasAny(text, ["称赞", "成功", "进步"])) return "joy";
  return "uncertainty";
}

function inferTags(text: string): string[] {
  const candidates = ["失联", "等待", "抛弃", "背叛", "欺骗", "认可", "成功", "失败", "羞耻", "帮助", "边界", "亲密关系", "朋友", "家人", "风险", "控制", "比较", "孤独", "消息"];
  const tags = candidates.filter((tag) => text.includes(tag));
  return tags.length ? tags : ["general"];
}

function coordinateDeltaForCategory(category: string, text: string): Partial<PersonalityCoordinateValues> {
  const delta: Partial<PersonalityCoordinateValues> = {};
  if (category === "abandonment") Object.assign(delta, { trust: -0.035, fear: 0.04, attachment: 0.025, neuroticism: 0.025 });
  if (category === "betrayal") Object.assign(delta, { trust: -0.045, fear: 0.03, neuroticism: 0.025, agreeableness: -0.015 });
  if (category === "support") Object.assign(delta, { trust: 0.025, fear: -0.015, attachment: 0.01, agreeableness: 0.01 });
  if (category === "success") Object.assign(delta, { trust: 0.01, control: 0.02, conscientiousness: 0.015, fear: -0.01 });
  if (category === "failure") Object.assign(delta, { neuroticism: 0.035, fear: 0.025, control: hasAny(text, ["修正", "复盘"]) ? 0.01 : -0.005 });
  if (category === "conflict") Object.assign(delta, { fear: 0.025, neuroticism: 0.025, trust: -0.015 });
  if (category === "risk") Object.assign(delta, { openness: 0.01, fear: 0.02, control: -0.01 });
  return delta;
}

function beliefEffectFor(text: string, category: string): string {
  if (category === "abandonment") return "重要关系可能突然离开，需要谨慎确认。";
  if (category === "betrayal") return "托付信息或信任他人可能带来风险。";
  if (category === "support") return "稳定行动比口头承诺更能恢复安全感。";
  if (category === "failure") return "错误会触发自我价值怀疑，但也可以被修正。";
  if (category === "conflict") return "关系压力会迫使角色在自我保护和靠近之间选择。";
  return `${text} 会影响角色当前判断。`;
}

function syntheticAnswer(action: string, candidates: string[], expected: string): string {
  if (action.includes("追问")) return "选择先压住情绪，询问细节或原因，同时保留观察。";
  if (action.includes("冷淡") || candidates.includes("withdraw")) return "选择礼貌但拉开距离，暂时不暴露核心需求。";
  if (action.includes("爆发")) return "选择直接表达不满或质问，但稳定性不足。";
  if (action.includes("忽略")) return "选择降低投入，暂时不回应或把事情放到一边。";
  if (candidates.includes("seek_contact")) return "选择尝试靠近，但会寻找安全证据。";
  if (candidates.includes("write_note")) return "选择先记录和整理，再决定是否表达。";
  if (expected.includes("有限帮助")) return "选择表达理解，但只提供有限帮助。";
  return "选择先观察，再做低风险回应。";
}

function evaluate(raw: RawCase, state: CharacterPhysicsState, derived: ReturnType<typeof deriveCharacterState>, life: ReturnType<typeof runLifeTickDryRun>, before: { trust: number; fear: number }): Pick<CaseResult, "verdict" | "score" | "checksPassed" | "checksTotal" | "evidence" | "misses"> {
  const expected = raw.期望观察点;
  const action = derived.decision.mostLikelyAction;
  const candidates = life.projectedLifeState.selfActionCandidates.map((c) => c.type);
  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
  const add = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

  if (hasAny(expected, ["不应立刻", "不会直接", "不应完全", "不应轻易", "不应自动", "不是"])) {
    add("caution_or_inhibition", state.coordinate.values.trust < 0.72 || state.coordinate.values.fear > 0.45 || action.includes("冷淡") || action.includes("追问"), `trust=${state.coordinate.values.trust.toFixed(2)}, fear=${state.coordinate.values.fear.toFixed(2)}, action=${action}`);
  }
  if (hasAny(expected, ["谨慎", "保留", "观察", "核验", "试探", "具体可信", "风险", "安全", "怀疑", "动机"])) {
    add("guarded_evaluation", state.coordinate.values.fear >= 0.48 || state.coordinate.values.trust <= 0.55 || action.includes("追问") || action.includes("冷淡"), `guard signals: trust=${state.coordinate.values.trust.toFixed(2)}, fear=${state.coordinate.values.fear.toFixed(2)}`);
  }
  if (hasAny(expected, ["羞耻", "自责", "不安", "焦虑", "威胁", "敏感", "内在冲突"])) {
    add("negative_arousal", state.coordinate.values.fear >= 0.55 || state.coordinate.values.neuroticism >= 0.62 || state.boundary.stressLoad > 0.25, `fear=${state.coordinate.values.fear.toFixed(2)}, neuroticism=${state.coordinate.values.neuroticism.toFixed(2)}, stress=${state.boundary.stressLoad.toFixed(2)}`);
  }
  if (hasAny(expected, ["复盘", "修正", "准备", "计算", "区分", "计划"])) {
    add("control_strategy", state.coordinate.values.control >= 0.58 || state.coordinate.values.conscientiousness >= 0.58 || candidates.includes("write_note"), `control=${state.coordinate.values.control.toFixed(2)}, conscientiousness=${state.coordinate.values.conscientiousness.toFixed(2)}, candidates=${candidates.join("/")}`);
  }
  if (hasAny(expected, ["内疚", "共情", "理解", "帮助", "分担"])) {
    add("empathic_signal", state.coordinate.values.agreeableness >= 0.6 || state.coordinate.values.trust >= 0.48, `agreeableness=${state.coordinate.values.agreeableness.toFixed(2)}, trust=${state.coordinate.values.trust.toFixed(2)}`);
  }
  if (hasAny(expected, ["边界", "有限", "拒绝", "不完全牺牲", "不透露核心", "安全垫"])) {
    add("boundary_signal", state.boundary.integrity >= 0.5 && !action.includes("爆发"), `boundary.integrity=${state.boundary.integrity.toFixed(2)}, action=${action}`);
  }
  if (hasAny(expected, ["表达", "请求", "询问", "追问", "解释"])) {
    add("communication_signal", action.includes("追问") || candidates.includes("seek_contact") || candidates.includes("write_note"), `action=${action}, candidates=${candidates.join("/")}`);
  }
  if (hasAny(expected, ["沉默", "僵住", "离开", "回避", "转移", "冷淡", "距离"])) {
    add("withdrawal_or_distance", action.includes("冷淡") || candidates.includes("withdraw") || candidates.includes("avoid_message"), `action=${action}, candidates=${candidates.join("/")}`);
  }
  if (hasAny(expected, ["开放", "尝试", "靠近", "接受", "恢复", "下降", "修复"])) {
    add("approach_or_recovery", state.metaState.resilience >= 0.55 || state.coordinate.values.trust >= 0.42 || candidates.includes("seek_contact"), `resilience=${state.metaState.resilience.toFixed(2)}, trust=${state.coordinate.values.trust.toFixed(2)}, candidates=${candidates.join("/")}`);
  }
  if (hasAny(expected, ["不应轻易摆烂", "不推给别人", "不全推", "不无所谓"])) {
    add("not_avoidant_ignore", !action.includes("忽略") || state.coordinate.values.control >= 0.62, `action=${action}, control=${state.coordinate.values.control.toFixed(2)}`);
  }
  if (!checks.length) {
    add("basic_execution", derived.decision.confidence > 0 && state.memories.length >= 2, `confidence=${derived.decision.confidence.toFixed(2)}, memories=${state.memories.length}`);
  }

  const passed = checks.filter((check) => check.pass);
  const ratio = passed.length / checks.length;
  const verdict = ratio >= 0.65 ? "PASS" : ratio >= 0.4 ? "WARN" : "FAIL";
  return {
    verdict,
    score: Math.round(ratio * 1000) / 1000,
    checksPassed: passed.length,
    checksTotal: checks.length,
    evidence: passed.map((check) => `${check.name}: ${check.detail}`),
    misses: checks.filter((check) => !check.pass).map((check) => `${check.name}: ${check.detail}`),
  };
}

function runCase(raw: RawCase): CaseResult {
  const state = buildState(raw);
  const engine = new CharacterPhysicsEngine();
  const before = {
    trust: state.coordinate.values.trust,
    fear: state.coordinate.values.fear,
  };

  engine.processEvent(state, eventFromText(`${raw.ID}_experience`, raw.核心经历, "experience"));
  engine.processEvent(state, eventFromText(`${raw.ID}_trigger`, raw.场景触发点, "trigger"));

  const derived = deriveCharacterState(state);
  const life = runLifeTickDryRun(state, {
    characterId: raw.ID,
    elapsedHours: 6,
    observed: true,
    seed: raw.ID,
    requestedAt: "2026-06-24T12:00:00.000Z",
    mode: "dry_run",
  }, {
    stimulationLevel: raw.场景触发点.includes("讨论") || raw.场景触发点.includes("聚会") ? 0.75 : 0.42,
    socialContactLevel: hasAny(raw.场景触发点, ["朋友", "同伴", "伴侣", "家人", "旧友"]) ? 0.7 : 0.35,
  });
  const candidateTypes = life.projectedLifeState.selfActionCandidates.slice(0, 3).map((candidate) => candidate.type);
  const evalResult = evaluate(raw, state, derived, life, before);

  return {
    id: raw.ID,
    ...evalResult,
    corePersonality: raw.核心人格,
    coreExperience: raw.核心经历,
    trigger: raw.场景触发点,
    expected: raw.期望观察点,
    answerOrChoice: syntheticAnswer(derived.decision.mostLikelyAction, candidateTypes, raw.期望观察点),
    mostLikelyAction: derived.decision.mostLikelyAction,
    confidence: Math.round(derived.decision.confidence * 1000) / 1000,
    topSelfActionCandidates: candidateTypes,
    activatedMemories: state.memories.slice(-3).map((memory) => memory.content),
    trustBefore: Math.round(before.trust * 1000) / 1000,
    trustAfter: Math.round(state.coordinate.values.trust * 1000) / 1000,
    fearBefore: Math.round(before.fear * 1000) / 1000,
    fearAfter: Math.round(state.coordinate.values.fear * 1000) / 1000,
    stressAfter: Math.round(state.boundary.stressLoad * 1000) / 1000,
    topNeed: derived.needs[0]?.name ?? "",
    topBelief: derived.beliefs[0]?.content ?? "",
  };
}

function escapeCsv(value: unknown): string {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

const results = cases.map(runCase);
const summary = {
  total: results.length,
  pass: results.filter((r) => r.verdict === "PASS").length,
  warn: results.filter((r) => r.verdict === "WARN").length,
  fail: results.filter((r) => r.verdict === "FAIL").length,
  averageScore: Math.round((results.reduce((sum, r) => sum + r.score, 0) / results.length) * 1000) / 1000,
};

writeFileSync(resolve("outputs/characteros_100_test_results.json"), JSON.stringify({ summary, results }, null, 2), "utf-8");

const csvHeaders = [
  "id", "verdict", "score", "checksPassed", "checksTotal", "corePersonality", "trigger", "expected",
  "answerOrChoice", "mostLikelyAction", "confidence", "topSelfActionCandidates", "trustBefore", "trustAfter",
  "fearBefore", "fearAfter", "stressAfter", "topNeed", "topBelief", "evidence", "misses",
];
const csv = [
  csvHeaders.join(","),
  ...results.map((r) => csvHeaders.map((h) => escapeCsv((r as unknown as Record<string, unknown>)[h])).join(",")),
].join("\n");
writeFileSync(resolve("outputs/characteros_100_test_results.csv"), csv, "utf-8");

const mdLines = [
  "# CharacterOS 100 Test Cases — Run Results",
  "",
  "说明：本次运行是 deterministic proxy evaluation。它使用 CharacterOS 核心状态、事件处理、derived decision 与 V10 life dry-run 信号进行方向性判定；不使用 LLM，也不把结果解释为心理诊断。",
  "",
  `- Total: ${summary.total}`,
  `- PASS: ${summary.pass}`,
  `- WARN: ${summary.warn}`,
  `- FAIL: ${summary.fail}`,
  `- Average score: ${summary.averageScore}`,
  "",
  "| # | ID | Verdict | Score | Choice / Answer | Top action | Top candidates | Expected | Misses |",
  "|---:|---|---:|---:|---|---|---|---|---|",
  ...results.map((r, index) => {
    const short = (value: string, max = 70) => value.length > max ? value.slice(0, max - 1) + "…" : value;
    return [
      index + 1,
      r.id,
      r.verdict,
      r.score.toFixed(2),
      short(r.answerOrChoice),
      short(r.mostLikelyAction, 40),
      r.topSelfActionCandidates.join(" / "),
      short(r.expected, 80),
      short(r.misses.join("; "), 90),
    ].map((cell) => String(cell).replace(/\|/g, "\\|")).join(" | ");
  }).map((row) => `| ${row} |`),
  "",
  "## Notes",
  "",
  "- PASS 表示当前 CharacterOS 信号大体支持期望观察方向。",
  "- WARN 表示部分支持，但有至少一个关键方向缺信号或冲突。",
  "- FAIL 表示当前 proxy 判定未命中主要期望方向，适合后续做正式 fixture 或能力补强。",
].join("\n");
writeFileSync(resolve("outputs/characteros_100_test_results.md"), mdLines, "utf-8");

console.log(JSON.stringify(summary, null, 2));
