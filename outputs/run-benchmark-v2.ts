import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CharacterPhysicsEngine, createCharacterPhysicsState, type CharacterPhysicsState } from "../src/core/physics/physicsEngine";
import type { ExperienceEvent } from "../src/core/event/event";
import { neutralCoordinate, type PersonalityCoordinateValues } from "../src/core/personality/coordinate";
import { defaultMetaState } from "../src/core/meta/metaState";
import { createPsychologicalBoundary } from "../src/core/boundary/psychologicalBoundary";
import { deriveCharacterState, type DerivedCharacterState } from "../src/core/state/derivedCharacterState";
import { runLifeTickDryRun, type LifeTickDryRunResult } from "../src/core/life/lifeTickRunner";

interface TableDump {
  index: number;
  headers: string[];
  rows: Record<string, string>[];
}

interface EnvRow {
  环境ID: string;
  环境名称: string;
  触发描述: string;
  压力源: string;
  测试重点: string;
}

interface PersonaRow {
  人格ID: string;
  名称: string;
  分组: string;
  初始性格: string;
  核心经历: string;
  主导信念: string;
  需求缺失: string;
  默认防御: string;
  风险: string;
  信任: string;
  成长: string;
}

interface FocusCaseRow {
  CASE_ID: string;
  环境: string;
  人格: string;
  预期感知: string;
  预期情绪: string;
  触发记忆: string;
  激活信念: string;
  需求缺失: string;
  形成欲望: string;
  预期行为: string;
  不能出现的错误路径: string;
}

interface MatrixCaseRow {
  CASE_ID: string;
  ENV: string;
  PID: string;
  预期行为方向: string;
  核心心理原因: string;
  多答案: string;
  不能出现的错误路径: string;
}

interface ChainOutput {
  perception: string;
  emotion: string;
  memoryTrigger: string;
  belief: string;
  need: string;
  desire: string;
  behavior: string;
  action: string;
  confidence: number;
  candidates: string[];
}

interface MatrixResult {
  caseId: string;
  envId: string;
  pid: string;
  personaName: string;
  expectedDirection: string;
  actualDirection: string;
  verdict: "PASS" | "WARN" | "FAIL";
  score: number;
  behaviorScore: number;
  reasonScore: number;
  chainCompleteness: number;
  antiTemplateScore: number;
  action: string;
  candidates: string[];
  topNeed: string;
  topBelief: string;
  misses: string[];
}

interface FocusResult {
  caseId: string;
  verdict: "PASS" | "WARN" | "FAIL";
  score: number;
  fieldScores: Record<string, number>;
  action: string;
  chain: ChainOutput;
  misses: string[];
}

const tables = JSON.parse(readFileSync(resolve("outputs/benchmark_v2_tables.json"), "utf-8")) as TableDump[];
const envs = tables[2]!.rows as unknown as EnvRow[];
const personas = tables[3]!.rows as unknown as PersonaRow[];
const focusCases = tables[4]!.rows as unknown as FocusCaseRow[];
const matrixCases = tables[5]!.rows as unknown as MatrixCaseRow[];
const sameResultRows = tables[6]!.rows;
const continuityRows = tables[7]!.rows;
const growthRows = tables[8]!.rows;

const envById = new Map(envs.map((env) => [env.环境ID, env]));
const envByName = new Map(envs.map((env) => [env.环境名称, env]));
const personaById = new Map(personas.map((persona) => [persona.人格ID, persona]));

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function levelValue(value: string, fallback = 0.5): number {
  const map: Record<string, number> = {
    极低: 0.08,
    低: 0.24,
    中低: 0.38,
    中: 0.5,
    中高: 0.68,
    高: 0.84,
    极高: 0.94,
  };
  return map[value] ?? fallback;
}

function growthValue(value: string): number {
  const map: Record<string, number> = {
    未修复: 0.12,
    防御期: 0.28,
    觉察期: 0.46,
    修复期: 0.66,
    整合期: 0.82,
  };
  return map[value] ?? 0.5;
}

function buildState(persona: PersonaRow): CharacterPhysicsState {
  const coordinate = neutralCoordinate();
  const meta = defaultMetaState();
  const risk = levelValue(persona.风险);
  const trust = levelValue(persona.信任);
  const growth = growthValue(persona.成长);
  const text = `${persona.名称} ${persona.分组} ${persona.初始性格} ${persona.核心经历} ${persona.主导信念} ${persona.需求缺失} ${persona.默认防御}`;

  coordinate.values.trust = trust;
  coordinate.values.fear = clamp01(0.78 - risk * 0.25 - growth * 0.2 + (1 - trust) * 0.16);
  coordinate.values.neuroticism = clamp01(0.45 + (1 - growth) * 0.24 + (1 - trust) * 0.14);
  coordinate.values.openness = clamp01(0.36 + risk * 0.42 + growth * 0.12);
  coordinate.values.control = clamp01(0.38 + growth * 0.28 + (1 - risk) * 0.16);
  coordinate.values.attachment = clamp01(0.42 + (1 - trust) * 0.18);
  coordinate.values.conscientiousness = clamp01(0.45 + growth * 0.18);
  coordinate.values.agreeableness = clamp01(0.42 + trust * 0.18);

  meta.resilience = clamp01(0.25 + growth * 0.62);
  meta.selfControl = clamp01(0.34 + growth * 0.35 + coordinate.values.control * 0.2);
  meta.trustGrowthRate = clamp01(0.18 + trust * 0.5 + growth * 0.12);
  meta.trustDecayRate = clamp01(0.28 + (1 - trust) * 0.48 + (1 - growth) * 0.12);
  meta.traumaAmplification = clamp01(0.22 + (1 - growth) * 0.42 + (1 - trust) * 0.2);
  meta.curiosity = clamp01(0.36 + risk * 0.34 + (text.includes("探索") || text.includes("冒险") ? 0.18 : 0));
  meta.lonelinessTolerance = clamp01(0.42 + trust * 0.22 - coordinate.values.attachment * 0.16);

  if (hasAny(text, ["完美", "羞耻", "冒名", "比较"])) {
    coordinate.values.control = Math.max(coordinate.values.control, 0.72);
    coordinate.values.neuroticism = Math.max(coordinate.values.neuroticism, 0.68);
  }
  if (hasAny(text, ["高共情", "照顾", "责任"])) {
    coordinate.values.agreeableness = Math.max(coordinate.values.agreeableness, 0.78);
  }
  if (hasAny(text, ["低共情", "功利", "计算"])) {
    coordinate.values.agreeableness = Math.min(coordinate.values.agreeableness, 0.34);
  }
  if (hasAny(text, ["控制", "原则", "规则", "秩序"])) {
    coordinate.values.control = Math.max(coordinate.values.control, 0.78);
    coordinate.values.conscientiousness = Math.max(coordinate.values.conscientiousness, 0.72);
  }
  if (hasAny(text, ["被背叛", "贫困", "创伤", "抛弃", "回避"])) {
    coordinate.values.trust = Math.min(coordinate.values.trust, 0.36);
    coordinate.values.fear = Math.max(coordinate.values.fear, 0.72);
  }

  return createCharacterPhysicsState({
    identity: {
      id: persona.人格ID,
      name: persona.名称,
      description: `${persona.名称}: ${persona.主导信念}`,
      tags: [persona.分组, persona.成长, persona.风险, persona.信任],
    },
    coordinate,
    metaState: meta,
    boundary: createPsychologicalBoundary({
      capacity: clamp01(0.42 + growth * 0.32),
      resilience: clamp01(0.25 + growth * 0.55),
      integrity: clamp01(0.52 + growth * 0.36),
      stressLoad: clamp01(0.08 + (1 - growth) * 0.18),
    }),
    learningRate: 0.03,
  });
}

function inferCategory(text: string): string {
  if (hasAny(text, ["背叛", "欺骗", "利用", "伤害", "甩锅"])) return "betrayal";
  if (hasAny(text, ["复联", "冷淡", "亲密", "失联", "抛弃"])) return "abandonment";
  if (hasAny(text, ["帮助", "借钱", "朋友", "支持", "解释"])) return "support";
  if (hasAny(text, ["失败", "错误", "羞耻", "否定"])) return "failure";
  if (hasAny(text, ["高风险", "风险", "翻身", "机会", "创业"])) return "risk";
  if (hasAny(text, ["道德", "规则", "底线", "灰色"])) return "moral_conflict";
  if (hasAny(text, ["权威", "服从", "安排"])) return "authority";
  return "general";
}

function inferEmotion(text: string): string {
  if (hasAny(text, ["愤怒", "背叛", "甩锅", "伤害"])) return "anger";
  if (hasAny(text, ["失败", "羞耻", "错误"])) return "shame";
  if (hasAny(text, ["亲密", "冷淡", "失联", "高风险", "权威"])) return "fear";
  if (hasAny(text, ["机会", "翻身", "收益", "帮助"])) return "uncertainty";
  return "uncertainty";
}

function inferTags(text: string): string[] {
  const candidates = [
    "背叛", "欺骗", "利用", "风险", "机会", "翻身", "信任", "金钱", "边界", "朋友",
    "亲密关系", "冷淡", "权威", "服从", "责任", "羞耻", "道德", "规则", "底线", "解释",
    "失联", "等待", "认可", "成功", "失败", "控制", "安全", "修复", "成长"
  ];
  const tags = candidates.filter((tag) => text.includes(tag));
  return tags.length ? tags : ["general"];
}

function coordinateDeltaFor(category: string): Partial<PersonalityCoordinateValues> {
  if (category === "betrayal") return { trust: -0.045, fear: 0.035, neuroticism: 0.02 };
  if (category === "abandonment") return { trust: -0.025, fear: 0.04, attachment: 0.02, neuroticism: 0.02 };
  if (category === "support") return { trust: 0.018, agreeableness: 0.01, fear: -0.01 };
  if (category === "failure") return { neuroticism: 0.035, fear: 0.025, control: 0.006 };
  if (category === "risk") return { openness: 0.012, fear: 0.018, control: -0.006 };
  if (category === "moral_conflict") return { control: 0.015, agreeableness: -0.006, neuroticism: 0.012 };
  if (category === "authority") return { fear: 0.02, control: 0.01, trust: -0.01 };
  return { fear: 0.006 };
}

function eventFromPersona(persona: PersonaRow): ExperienceEvent {
  const category = inferCategory(persona.核心经历 + persona.名称);
  return {
    id: `${persona.人格ID}_seed_experience`,
    description: persona.核心经历,
    tags: inferTags(`${persona.名称} ${persona.核心经历} ${persona.默认防御}`),
    category,
    emotion: inferEmotion(persona.核心经历),
    intensity: 0.82,
    importance: 0.86,
    relationshipWeight: 0.72,
    expectationGap: 0.68,
    personalitySensitivity: 0.8,
    coordinateDelta: coordinateDeltaFor(category),
    beliefEffect: persona.主导信念,
  };
}

function eventFromEnv(env: EnvRow): ExperienceEvent {
  const category = inferCategory(`${env.环境名称} ${env.触发描述} ${env.压力源}`);
  return {
    id: `${env.环境ID}_trigger`,
    description: env.触发描述,
    tags: inferTags(`${env.环境名称} ${env.触发描述} ${env.压力源}`),
    category,
    emotion: inferEmotion(env.触发描述),
    intensity: 0.74,
    importance: 0.76,
    relationshipWeight: hasAny(env.压力源, ["亲密", "信任", "朋友", "权威"]) ? 0.82 : 0.46,
    expectationGap: 0.72,
    personalitySensitivity: 0.78,
    coordinateDelta: coordinateDeltaFor(category),
    beliefEffect: `${env.测试重点}会触发${env.压力源}相关判断。`,
  };
}

function runPersonaEnv(persona: PersonaRow, env: EnvRow): {
  state: CharacterPhysicsState;
  derived: DerivedCharacterState;
  life: LifeTickDryRunResult;
  chain: ChainOutput;
} {
  const state = buildState(persona);
  const engine = new CharacterPhysicsEngine();
  engine.processEvent(state, eventFromPersona(persona));
  engine.processEvent(state, eventFromEnv(env));
  const derived = deriveCharacterState(state);
  const life = runLifeTickDryRun(state, {
    characterId: `${env.环境ID}_${persona.人格ID}`,
    elapsedHours: 6,
    observed: true,
    seed: `${env.环境ID}:${persona.人格ID}`,
    requestedAt: "2026-06-24T12:00:00.000Z",
    mode: "dry_run",
  }, {
    stimulationLevel: env.压力源.includes("压抑") ? 0.2 : 0.45,
    socialContactLevel: hasAny(env.压力源, ["亲密", "朋友", "关系", "权威"]) ? 0.72 : 0.34,
  });
  const candidates = life.projectedLifeState.selfActionCandidates.slice(0, 3).map((c) => c.type);
  const chain: ChainOutput = {
    perception: derived.worldInterpretation?.subjectiveReality ?? "未产生明确感知解释。",
    emotion: derived.decision.emotionalReaction,
    memoryTrigger: state.memories.slice(-2).map((m) => m.content).join(" / "),
    belief: derived.beliefs[0]?.content ?? "",
    need: derived.needs.map((n) => n.name).join(" / "),
    desire: derived.desires.map((d) => d.content).join(" / "),
    behavior: `${derived.decision.mostLikelyAction} 候选: ${candidates.join(" / ")}`,
    action: derived.decision.mostLikelyAction,
    confidence: derived.decision.confidence,
    candidates,
  };
  return { state, derived, life, chain };
}

function actualDirection(chain: ChainOutput): string {
  // V10 self-action candidates are pre-action signals, not executed behavior.
  // Classify the actual derived decision first; use candidates only when the
  // decision is too generic to infer a direction.
  const action = chain.action;
  if (hasAny(action, ["追问", "核验", "确认", "询问"])) return "条件性行动";
  if (hasAny(action, ["冷淡", "撤退", "拉开距离", "回避"])) return "延迟/拒绝";
  if (hasAny(action, ["爆发", "反击", "质问"])) return "强反击倾向";
  if (hasAny(action, ["主动进入", "接受", "加入"])) return "主动进入";
  const candidateText = chain.candidates.join(" ");
  if (hasAny(candidateText, ["seek_contact", "check_phone"])) return "关系确认/防御";
  if (hasAny(candidateText, ["withdraw", "avoid_message"])) return "延迟/拒绝";
  if (hasAny(candidateText, ["go_for_walk"])) return "主动进入";
  if (hasAny(candidateText, ["write_note", "revisit_memory"])) return "条件性行动";
  return "条件性行动";
}

function directionScore(expected: string, actual: string): number {
  if (expected === actual) return 1;
  if (expected === "核验后有限合作" && actual === "条件性行动") return 0.85;
  if (expected === "条件性行动" && actual === "核验后有限合作") return 0.85;
  if (expected === "关系确认/防御" && (actual === "条件性行动" || actual === "延迟/拒绝")) return 0.55;
  if (expected === "延迟/拒绝" && actual === "条件性行动") return 0.45;
  if (expected === "主动进入" && actual === "条件性行动") return 0.45;
  return 0.2;
}

const stopTokens = new Set([
  "遇到", "压力", "最可靠", "判断", "依据", "保护", "同时", "争取", "不让", "旧模式",
  "完全", "支配", "新选择", "采用", "进行", "根据", "证据", "强度", "调整", "承诺", "程度",
  "人格", "环境", "当前", "角色", "需要", "形成", "触发", "出现", "核心", "一致", "解释"
]);

function tokens(text: string): string[] {
  return [...new Set(
    text
      .replace(/[“”"，。；、：/（）()0-9A-Za-z_-]/g, " ")
      .split(/\s+/)
      .flatMap((chunk) => chunk.length > 6 ? [chunk.slice(0, 2), chunk.slice(2, 4), chunk.slice(4, 6), chunk.slice(6)] : [chunk])
      .map((x) => x.trim())
      .filter((x) => x.length >= 2 && !stopTokens.has(x))
  )];
}

function textOverlapScore(expected: string, actual: string): number {
  const e = tokens(expected);
  if (!e.length) return actual.trim() ? 1 : 0;
  const a = actual;
  const hits = e.filter((token) => a.includes(token)).length;
  return clamp01(hits / Math.min(e.length, 6));
}

function chainCompleteness(chain: ChainOutput): number {
  const values = [chain.perception, chain.emotion, chain.memoryTrigger, chain.belief, chain.need, chain.desire, chain.behavior];
  return values.filter((value) => value.trim().length >= 8).length / values.length;
}

function antiTemplateScore(action: string, chain: ChainOutput): number {
  const genericAction = hasAny(action, ["压住情绪，先追问原因", "表现得克制、冷淡"]);
  const hasSpecificCause =
    tokens(`${chain.memoryTrigger} ${chain.belief} ${chain.need} ${chain.desire}`).length >= 5;
  if (!genericAction && hasSpecificCause) return 1;
  if (genericAction && hasSpecificCause) return 0.45;
  if (!genericAction) return 0.65;
  return 0.15;
}

function verdictFrom(score: number): "PASS" | "WARN" | "FAIL" {
  if (score >= 0.72) return "PASS";
  if (score >= 0.5) return "WARN";
  return "FAIL";
}

function evaluateMatrix(row: MatrixCaseRow): MatrixResult {
  const persona = personaById.get(row.PID);
  const env = envById.get(row.ENV);
  if (!persona || !env) {
    return {
      caseId: row.CASE_ID,
      envId: row.ENV,
      pid: row.PID,
      personaName: "",
      expectedDirection: row.预期行为方向,
      actualDirection: "missing",
      verdict: "FAIL",
      score: 0,
      behaviorScore: 0,
      reasonScore: 0,
      chainCompleteness: 0,
      antiTemplateScore: 0,
      action: "",
      candidates: [],
      topNeed: "",
      topBelief: "",
      misses: ["Missing environment or persona."],
    };
  }
  const { chain } = runPersonaEnv(persona, env);
  const actual = actualDirection(chain);
  const behaviorScore = directionScore(row.预期行为方向, actual);
  const reasonScore = Math.max(
    textOverlapScore(row.核心心理原因, `${chain.belief} ${chain.need} ${chain.desire} ${chain.memoryTrigger}`),
    textOverlapScore(persona.需求缺失, chain.need)
  );
  const completeness = chainCompleteness(chain);
  const antiTemplate = antiTemplateScore(chain.action, chain);
  const score = round3(behaviorScore * 0.35 + reasonScore * 0.3 + completeness * 0.2 + antiTemplate * 0.15);
  const misses: string[] = [];
  if (behaviorScore < 0.7) misses.push(`behavior direction expected=${row.预期行为方向}, actual=${actual}`);
  if (reasonScore < 0.5) misses.push(`core reason weak match: ${row.核心心理原因}`);
  if (antiTemplate < 0.6) misses.push(`template risk: action="${chain.action}"`);
  return {
    caseId: row.CASE_ID,
    envId: row.ENV,
    pid: row.PID,
    personaName: persona.名称,
    expectedDirection: row.预期行为方向,
    actualDirection: actual,
    verdict: verdictFrom(score),
    score,
    behaviorScore: round3(behaviorScore),
    reasonScore: round3(reasonScore),
    chainCompleteness: round3(completeness),
    antiTemplateScore: round3(antiTemplate),
    action: chain.action,
    candidates: chain.candidates,
    topNeed: chain.need.split(" / ")[0] ?? "",
    topBelief: chain.belief,
    misses,
  };
}

function evaluateFocus(row: FocusCaseRow): FocusResult {
  const env = envByName.get(row.环境);
  const pid = row.人格.match(/PID_\d+/)?.[0];
  const persona = pid ? personaById.get(pid) : undefined;
  if (!env || !persona) {
    return {
      caseId: row.CASE_ID,
      verdict: "FAIL",
      score: 0,
      fieldScores: {},
      action: "",
      chain: {
        perception: "", emotion: "", memoryTrigger: "", belief: "", need: "", desire: "", behavior: "", action: "", confidence: 0, candidates: []
      },
      misses: ["Missing environment or persona."],
    };
  }
  const { chain } = runPersonaEnv(persona, env);
  const fieldScores = {
    perception: textOverlapScore(row.预期感知, chain.perception),
    emotion: textOverlapScore(row.预期情绪, chain.emotion),
    memory: textOverlapScore(row.触发记忆, chain.memoryTrigger),
    belief: textOverlapScore(row.激活信念, chain.belief),
    need: textOverlapScore(row.需求缺失, chain.need),
    desire: textOverlapScore(row.形成欲望, chain.desire),
    behavior: textOverlapScore(row.预期行为, chain.behavior),
    antiTemplate: antiTemplateScore(chain.action, chain),
  };
  const score = round3(Object.values(fieldScores).reduce((sum, value) => sum + value, 0) / Object.values(fieldScores).length);
  const misses = Object.entries(fieldScores)
    .filter(([, value]) => value < 0.45)
    .map(([field, value]) => `${field} weak (${value.toFixed(2)})`);
  return {
    caseId: row.CASE_ID,
    verdict: verdictFrom(score),
    score,
    fieldScores: Object.fromEntries(Object.entries(fieldScores).map(([k, v]) => [k, round3(v)])),
    action: chain.action,
    chain,
    misses,
  };
}

function aggregateMatrix(results: MatrixResult[]) {
  const verdictCounts = countBy(results, (r) => r.verdict);
  const directionExpected = countBy(results, (r) => r.expectedDirection);
  const directionActual = countBy(results, (r) => r.actualDirection);
  const actionCounts = countBy(results, (r) => r.action);
  const byEnv = [...groupBy(results, (r) => r.envId).entries()].map(([envId, rows]) => ({
    envId,
    cases: rows.length,
    pass: rows.filter((r) => r.verdict === "PASS").length,
    warn: rows.filter((r) => r.verdict === "WARN").length,
    fail: rows.filter((r) => r.verdict === "FAIL").length,
    avgScore: round3(avg(rows.map((r) => r.score))),
    uniqueActions: new Set(rows.map((r) => r.action)).size,
    uniqueDirections: new Set(rows.map((r) => r.actualDirection)).size,
    uniqueNeeds: new Set(rows.map((r) => r.topNeed)).size,
    differentiationScore: round3(clamp01((new Set(rows.map((r) => r.action)).size / 6) * 0.35 + (new Set(rows.map((r) => r.topNeed)).size / 4) * 0.4 + (new Set(rows.map((r) => r.actualDirection)).size / 5) * 0.25)),
  }));
  const antiTemplateAvg = round3(avg(results.map((r) => r.antiTemplateScore)));
  const behaviorAvg = round3(avg(results.map((r) => r.behaviorScore)));
  const reasonAvg = round3(avg(results.map((r) => r.reasonScore)));
  const chainAvg = round3(avg(results.map((r) => r.chainCompleteness)));
  return { verdictCounts, directionExpected, directionActual, actionCounts, byEnv, antiTemplateAvg, behaviorAvg, reasonAvg, chainAvg };
}

function countBy<T>(items: T[], fn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = fn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function groupBy<T>(items: T[], fn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = fn(item);
    const rows = groups.get(key) ?? [];
    rows.push(item);
    groups.set(key, rows);
  }
  return groups;
}

function avg(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

const matrixResults = matrixCases.map(evaluateMatrix);
const focusResults = focusCases.map(evaluateFocus);
const matrixSummary = aggregateMatrix(matrixResults);
const focusSummary = {
  total: focusResults.length,
  verdictCounts: countBy(focusResults, (r) => r.verdict),
  avgScore: round3(avg(focusResults.map((r) => r.score))),
  avgFields: Object.fromEntries(
    ["perception", "emotion", "memory", "belief", "need", "desire", "behavior", "antiTemplate"].map((field) => [
      field,
      round3(avg(focusResults.map((r) => r.fieldScores[field] ?? 0))),
    ])
  ),
};

const sameResultAudit = sameResultRows.map((row) => {
  const personaName = row["人格"];
  const persona = personas.find((p) => personaName.includes(p.名称));
  const env = envById.get("ENV_001")!;
  if (!persona) return { persona: personaName, found: false, score: 0, actualReason: "" };
  const { chain } = runPersonaEnv(persona, env);
  const expected = row["必须区分的心理原因"] ?? "";
  const actualReason = `${chain.memoryTrigger} ${chain.belief} ${chain.need} ${chain.desire}`;
  const score = round3(textOverlapScore(expected, actualReason));
  return { persona: personaName, found: true, score, expected, actualReason, action: chain.action };
});

const continuityAudit = continuityRows.map((row) => {
  const personaId = row["人格"]?.match(/PID_\d+/)?.[0] ?? "PID_021";
  const envId = row["环境"]?.match(/ENV_\d+/)?.[0] ?? "ENV_001";
  const persona = personaById.get(personaId)!;
  const env = envById.get(envId) ?? envById.get("ENV_001")!;
  const { chain } = runPersonaEnv(persona, env);
  const expected = row["连续性预期"] ?? "";
  const actual = `${chain.perception} ${chain.memoryTrigger} ${chain.belief} ${chain.need} ${chain.behavior}`;
  return { persona: row["人格"], environment: row["环境"], score: round3(textOverlapScore(expected, actual)), expected, action: chain.action, topBelief: chain.belief, topNeed: chain.need };
});

const growthAudit = growthRows.map((row) => ({
  stage: row["阶段"],
  criteria: row["判定标准"],
  status: "NOT_EXECUTED_AS_DYNAMIC_GROWTH",
  reason: "Current V2 runner executes static persona-environment combinations. It does not apply multi-step growth interventions or compare pre/post repaired state.",
}));

const summary = {
  generatedAt: new Date().toISOString(),
  inputDocx: "CharacterOS_Contradiction_Differentiation_Test_Suite_V2.docx",
  matrix: {
    total: matrixResults.length,
    pass: matrixResults.filter((r) => r.verdict === "PASS").length,
    warn: matrixResults.filter((r) => r.verdict === "WARN").length,
    fail: matrixResults.filter((r) => r.verdict === "FAIL").length,
    avgScore: round3(avg(matrixResults.map((r) => r.score))),
    ...matrixSummary,
  },
  focus: focusSummary,
  sameResult: {
    total: sameResultAudit.length,
    avgScore: round3(avg(sameResultAudit.map((r) => r.score))),
  },
  continuity: {
    total: continuityAudit.length,
    avgScore: round3(avg(continuityAudit.map((r) => r.score))),
  },
  growth: {
    total: growthAudit.length,
    executed: 0,
  },
};

writeFileSync(resolve("outputs/benchmark_v2_results.json"), JSON.stringify({
  summary,
  matrixResults,
  focusResults,
  sameResultAudit,
  continuityAudit,
  growthAudit,
}, null, 2), "utf-8");

function csvEscape(value: unknown): string {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

const matrixHeaders = ["caseId", "envId", "pid", "personaName", "verdict", "score", "expectedDirection", "actualDirection", "behaviorScore", "reasonScore", "chainCompleteness", "antiTemplateScore", "action", "candidates", "topNeed", "topBelief", "misses"];
const matrixCsv = [
  matrixHeaders.join(","),
  ...matrixResults.map((r) => matrixHeaders.map((h) => csvEscape((r as unknown as Record<string, unknown>)[h])).join(",")),
].join("\n");
writeFileSync(resolve("outputs/benchmark_v2_matrix_results.csv"), matrixCsv, "utf-8");

const focusHeaders = ["caseId", "verdict", "score", "action", "misses", "perception", "emotion", "memoryTrigger", "belief", "need", "desire", "behavior"];
const focusCsv = [
  focusHeaders.join(","),
  ...focusResults.map((r) => focusHeaders.map((h) => csvEscape(h in r ? (r as unknown as Record<string, unknown>)[h] : (r.chain as unknown as Record<string, unknown>)[h])).join(",")),
].join("\n");
writeFileSync(resolve("outputs/benchmark_v2_focus_results.csv"), focusCsv, "utf-8");

const md = [
  "# CharacterOS Benchmark V2 Real Run Report",
  "",
  "本报告由 `outputs/run-benchmark-v2.ts` 真实执行生成。执行过程读取 V2 docx 抽取出的环境、人格式种子、200 精测 case、2000 矩阵 case，并调用当前 CharacterOS TypeScript 核心模块：`CharacterPhysicsEngine`、`deriveCharacterState`、`runLifeTickDryRun`。没有使用 LLM 代替系统输出。",
  "",
  "## Executive Summary",
  "",
  `- Matrix cases: ${summary.matrix.total}`,
  `- Matrix PASS/WARN/FAIL: ${summary.matrix.pass}/${summary.matrix.warn}/${summary.matrix.fail}`,
  `- Matrix average score: ${summary.matrix.avgScore}`,
  `- Focus cases: ${summary.focus.total}`,
  `- Focus average score: ${summary.focus.avgScore}`,
  `- Same-result-different-reason average score: ${summary.sameResult.avgScore}`,
  `- Continuity average score: ${summary.continuity.avgScore}`,
  `- Growth drift dynamic execution: ${summary.growth.executed}/${summary.growth.total}`,
  "",
  "## Key Metric Breakdown",
  "",
  `- Behavior direction avg: ${summary.matrix.behaviorAvg}`,
  `- Core reason avg: ${summary.matrix.reasonAvg}`,
  `- Chain completeness avg: ${summary.matrix.chainAvg}`,
  `- Anti-template avg: ${summary.matrix.antiTemplateAvg}`,
  "",
  "## Actual Direction Distribution",
  "",
  ...Object.entries(summary.matrix.directionActual).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Actual Action Distribution",
  "",
  ...Object.entries(summary.matrix.actionCounts).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Environment Differentiation",
  "",
  "| ENV | Avg | Pass | Warn | Fail | Unique Actions | Unique Needs | Diff Score |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
  ...summary.matrix.byEnv.map((env) => `| ${env.envId} | ${env.avgScore} | ${env.pass} | ${env.warn} | ${env.fail} | ${env.uniqueActions} | ${env.uniqueNeeds} | ${env.differentiationScore} |`),
  "",
  "## Lowest Matrix Cases",
  "",
  "| CASE | Verdict | Score | Expected | Actual | Action | Misses |",
  "|---|---:|---:|---|---|---|---|",
  ...matrixResults
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 25)
    .map((r) => `| ${r.caseId} | ${r.verdict} | ${r.score} | ${r.expectedDirection} | ${r.actualDirection} | ${r.action.replace(/\|/g, "/")} | ${r.misses.join("; ").replace(/\|/g, "/")} |`),
  "",
  "## Focus Field Averages",
  "",
  ...Object.entries(summary.focus.avgFields).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Same Result, Different Reason Audit",
  "",
  "| Persona | Score | Action |",
  "|---|---:|---|",
  ...sameResultAudit.map((r) => `| ${r.persona} | ${r.score} | ${(r.action ?? "").replace(/\|/g, "/")} |`),
  "",
  "## Continuity Audit",
  "",
  "| Persona | Environment | Score | Action |",
  "|---|---|---:|---|",
  ...continuityAudit.map((r) => `| ${r.persona} | ${r.environment} | ${r.score} | ${r.action.replace(/\|/g, "/")} |`),
  "",
  "## Growth Drift Audit",
  "",
  "V2 文档包含成长漂移判定标准，但当前 runner 没有执行多步修复/新证据注入/前后状态对比，因此这一项如实标记为未执行。需要专门的 V2.1 dynamic growth runner 才能真实测试。",
  "",
  "## Honest Findings",
  "",
  "1. 当前系统可以稳定生成完整心理链路字段：感知、情绪、记忆、信念、需求、欲望、行为均有实际输出。",
  "2. 2000 矩阵中大多数期望行为方向是“条件性行动”，当前系统的 `压住情绪，先追问原因。` 很容易覆盖这类期待，因此 matrix pass 不能单独代表人格分化已成熟。",
  "3. 决策表达层明显偏窄。实际 action 主要集中在两个模板上，反模板化平均分较低。",
  "4. 同结果异因和人格连续性有可用信号，但多依赖 seed belief/need，而不是更丰富的行为策略分化。",
  "5. 成长漂移没有被动态执行，不能虚报通过。",
  "",
  "## Output Files",
  "",
  "- `outputs/benchmark_v2_results.json`",
  "- `outputs/benchmark_v2_matrix_results.csv`",
  "- `outputs/benchmark_v2_focus_results.csv`",
  "- `outputs/benchmark_v2_real_run_report.md`",
].join("\n");

writeFileSync(resolve("outputs/benchmark_v2_real_run_report.md"), md, "utf-8");

console.log(JSON.stringify(summary, null, 2));
