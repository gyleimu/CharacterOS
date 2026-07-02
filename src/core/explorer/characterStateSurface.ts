/**
 * V11.4 — Character State Surface Core
 *
 * Converts raw CharacterPhysicsState into human-readable "Today" surface.
 * Deterministic, pure, read-only. No UI, no LLM, no raw state exposure.
 */
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { deriveNeedDeficiencies } from "../need/needDeficiency";
import { deriveDesires } from "../desire/desireState";
import type {
  CharacterStateSurface,
  EmotionalStateSummary,
  StressStateSummary,
  NeedSummary,
  BeliefSummary,
  GoalSummary,
  BehaviorTendencySummary,
  PersonalitySummary,
} from "./explorerTypes";

export interface CharacterStateSurfaceInput {
  state: CharacterPhysicsState;
  /** Recent events for direction context (optional). */
  recentEvents?: Array<{ description: string; category?: string; daysAgo: number }>;
  /** Recent audit verdict (optional, for context). */
  recentAuditVerdict?: string;
  /** Time window label (optional). */
  timeWindow?: string;
}

export function buildCharacterStateSurface(
  input: CharacterStateSurfaceInput,
): CharacterStateSurface {
  const { state } = input;

  // Derived needs and desires
  const needs = deriveNeedDeficiencies({
    coordinate: state.coordinate,
    beliefs: state.beliefStates,
    clusters: [...state.clusters.values()],
  });
  const desires = deriveDesires(needs);

  const headline = buildHeadline(state, input.recentEvents, input.recentAuditVerdict);
  const emotional = buildEmotional(state, input.recentEvents);
  const stress = buildStress(state);
  const needSummaries = buildNeeds(needs, desires);
  const beliefSummaries = buildBeliefs(state);
  const goals = buildGoals(desires);
  const behavior = buildBehavior(state, needs);
  const personality = buildPersonality(state);

  return {
    headline,
    characterId: state.identity.id,
    characterName: state.identity.name,
    emotionalState: emotional,
    stressState: stress,
    dominantNeeds: needSummaries,
    dominantBeliefs: beliefSummaries,
    activeGoals: goals,
    behaviorTendencies: behavior,
    personalitySummary: personality,
    safetyNote: "模拟输出，非医学/心理诊断。所有状态为模型计算结果，不代表真实人格或临床状况。",
    sourceSnapshotId: computeFingerprint(state),
  };
}

// ── Headline ──

function buildHeadline(
  state: CharacterPhysicsState,
  recentEvents?: CharacterStateSurfaceInput["recentEvents"],
  auditVerdict?: string,
): string {
  const c = state.coordinate.values;
  const b = state.boundary;

  if (b.phase === "overflow") return "心理压力超载，急需恢复";
  if (b.phase === "strained" && c.fear > 0.6) return "关系压力升高，正在寻求确认";
  if (b.phase === "strained") return "压力偏高，但仍在管理范围内";
  if (c.fear < 0.35 && c.trust > 0.6) return "情绪稳定，信任感较高";
  if (c.neuroticism > 0.7) return "情绪波动较大，易受环境影响";
  if (c.openness < 0.3 && c.fear > 0.5) return "防御性封闭，谨慎对待新事物";
  if (auditVerdict === "WARN") return "注意：上次审计有警告";
  if (recentEvents && recentEvents.length > 0) {
    const last = recentEvents[0]!;
    if (last.category === "support") return "正向支持事件后，缓慢恢复中";
    if (last.category === "abandonment" || last.category === "betrayal") return "近期负面事件影响仍在持续";
  }

  return c.trust > 0.5 ? "当前状态相对稳定" : "当前处于谨慎观望状态";
}

// ── Emotional State ──

function buildEmotional(
  state: CharacterPhysicsState,
  recentEvents?: CharacterStateSurfaceInput["recentEvents"],
): EmotionalStateSummary {
  const c = state.coordinate.values;

  let primary = "uncertainty";
  let valence: EmotionalStateSummary["valence"] = "neutral";
  let label = "情绪中性";

  if (c.fear > 0.7) { primary = "fear"; valence = "negative"; label = "恐惧主导，高度警觉"; }
  else if (c.fear > 0.5) { primary = "anxiety"; valence = "negative"; label = "焦虑偏向，持续担忧"; }
  else if (c.trust > 0.65 && c.fear < 0.35) { primary = "calm"; valence = "positive"; label = "平静放松，信任较高"; }
  else if (c.neuroticism > 0.75) { primary = "anxiety"; valence = "negative"; label = "情绪不稳定，易焦虑"; }
  else if (c.openness > 0.6 && c.trust > 0.5) { primary = "hope"; valence = "positive"; label = "开放乐观，愿意尝试"; }

  if (recentEvents && recentEvents.length > 0) {
    const last = recentEvents[0]!;
    if (last.category === "support" && last.daysAgo <= 3) {
      label += "，最近获得支持";
    }
  }

  const arousal: EmotionalStateSummary["arousal"] =
    c.fear > 0.6 || c.neuroticism > 0.7 ? "high" :
    c.trust > 0.6 && c.fear < 0.3 ? "low" : "moderate";

  return { primary, valence, arousal, label };
}

// ── Stress State ──

function buildStress(state: CharacterPhysicsState): StressStateSummary {
  const b = state.boundary;
  const ratio = b.capacity > 0 ? b.stressLoad / b.capacity : 1;

  return {
    level: ratio > 1 ? "overload" : ratio > 0.7 ? "high" : ratio > 0.3 ? "moderate" : "low",
    phase: b.phase,
    label: b.phase === "overflow" ? "心理压力超载 — 边界已破裂，急需恢复"
      : b.phase === "strained" ? "压力偏高，心理防线承压，但仍在承受范围内"
      : "心理状态稳定，压力水平可管理",
  };
}

// ── Needs ──

function buildNeeds(
  needs: ReturnType<typeof deriveNeedDeficiencies>,
  _desires: ReturnType<typeof deriveDesires>,
): NeedSummary[] {
  return needs.slice(0, 3).map((n) => ({
    name: n.name,
    intensity: n.intensity > 0.6 ? "high" : n.intensity > 0.3 ? "moderate" : "low",
    label: `${n.name}需求${n.intensity > 0.5 ? "强烈" : "存在"}`,
  }));
}

// ── Beliefs ──

function buildBeliefs(state: CharacterPhysicsState): BeliefSummary[] {
  return state.beliefStates
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map((b) => ({
      content: b.content,
      strength: b.strength > 0.7 ? "strong" : b.strength > 0.3 ? "moderate" : "weak",
    }));
}

// ── Goals / Desires ──

function buildGoals(desires: ReturnType<typeof deriveDesires>): GoalSummary[] {
  return desires.slice(0, 3).map((d) => ({
    content: d.content,
    urgency: d.intensity > 0.6 ? "high" : d.intensity > 0.3 ? "moderate" : "low",
  }));
}

// ── Behavior Tendencies ──

function buildBehavior(
  state: CharacterPhysicsState,
  needs: ReturnType<typeof deriveNeedDeficiencies>,
): BehaviorTendencySummary {
  const c = state.coordinate.values;
  const safetyNeed = needs.find((n) => n.name.includes("安全"));
  const belongingNeed = needs.find((n) => n.name.includes("归属"));

  const cautionLevel = (c.fear > 0.6 || (safetyNeed && safetyNeed.intensity > 0.5))
    ? "high" : c.fear > 0.35 ? "moderate" : "low";
  const opennessLevel = (c.openness > 0.6 && c.trust > 0.4)
    ? "high" : c.openness > 0.35 ? "moderate" : "low";

  let likelyAction: string;
  let strategyLabel: string;

  if (c.fear > 0.65 && safetyNeed) {
    likelyAction = "回避社交接触，寻求安全环境";
    strategyLabel = "emotional_withdrawal";
  } else if (c.trust < 0.3 && belongingNeed) {
    likelyAction = "谨慎测试他人意图，不完全信任";
    strategyLabel = "test_intentions";
  } else if (c.openness > 0.5 && c.trust > 0.5) {
    likelyAction = "适度开放，选择性接触";
    strategyLabel = "cautious_openness";
  } else {
    likelyAction = "观察环境，等待明确信号后再行动";
    strategyLabel = "wait_and_observe";
  }

  return {
    likelyAction: `最可能：${likelyAction}`,
    strategyLabel,
    cautionLevel,
    opennessLevel,
  };
}

// ── Personality Summary ──

function buildPersonality(state: CharacterPhysicsState): PersonalitySummary {
  const c = state.coordinate.values;
  return {
    trust: { value: band3(c.trust), label: describeTrust(c.trust) },
    fear: { value: band3(c.fear), label: describeFear(c.fear) },
    openness: { value: band3(c.openness), label: describeOpenness(c.openness) },
    attachment: { value: band3(c.attachment), label: describeAttachment(c.attachment) },
    neuroticism: { value: band3(c.neuroticism), label: describeNeuroticism(c.neuroticism) },
  };
}

// ── Banding ──

function band3(v: number): "low" | "moderate" | "high" {
  if (v > 0.6) return "high"; if (v > 0.3) return "moderate"; return "low";
}

function describeTrust(v: number): string {
  if (v < 0.25) return "极低信任 — 对他人持深度怀疑";
  if (v < 0.4) return "信任偏低 — 谨慎对待他人意图";
  if (v < 0.6) return "信任中等 — 在证据支持下愿意相信";
  return "信任较高 — 倾向于相信他人善意";
}
function describeFear(v: number): string {
  if (v > 0.75) return "高度恐惧 — 常处于警觉状态";
  if (v > 0.5) return "恐惧偏高 — 对威胁敏感";
  if (v > 0.3) return "恐惧适中 — 适度的自我保护";
  return "恐惧较低 — 情绪相对安定";
}
function describeOpenness(v: number): string {
  if (v < 0.3) return "开放性低 — 抗拒新体验";
  if (v < 0.5) return "开放性适中 — 对新事物持谨慎态度";
  return "开放性较高 — 愿意探索和尝试";
}
function describeAttachment(v: number): string {
  if (v > 0.7) return "高依恋 — 强烈需要亲密关系确认";
  if (v > 0.45) return "依恋中等 — 重视关系但不过度依赖";
  return "依恋较低 — 相对独立，不强烈依赖他人";
}
function describeNeuroticism(v: number): string {
  if (v > 0.7) return "情绪不稳定 — 容易焦虑和波动";
  if (v > 0.45) return "情绪稳定性中等 — 有波动但可控";
  return "情绪较稳定 — 不易受小事影响";
}

// ── Fingerprint ──

function computeFingerprint(state: CharacterPhysicsState): string {
  const c = state.coordinate.values;
  const parts = [
    state.identity.id, state.memories.length, state.beliefStates.length,
    c.trust.toFixed(4), c.fear.toFixed(4), c.openness.toFixed(4),
    state.boundary.phase,
  ];
  let hash = 0;
  for (let i = 0; i < parts.join("|").length; i++) {
    hash = ((hash << 5) - hash + parts.join("|").charCodeAt(i)) | 0;
  }
  return `snap_${Math.abs(hash).toString(16)}`;
}
