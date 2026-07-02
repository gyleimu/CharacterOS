// =========================================================================
// V10.12 Differentiation Adapter — Bridge from CharacterPhysicsState into
// the DifferentiatedDecision pipeline. Constructs PersonaSeed and
// EnvironmentSeed from real character state (identity, memories, beliefs,
// coordinate) so the differentiation engine can run without benchmark
// fixtures. Pure functions. Deterministic. No LLM. No state mutation.
// =========================================================================

import type { CharacterPhysicsState } from "../physics/physicsEngine";
import {
  buildDifferentiatedDecision,
  type PersonaSeed,
  type EnvironmentSeed,
  type DifferentiatedDecision,
} from "./characterDifferentiation";
import type { LifeDecisionContext } from "./lifeDecisionContext";

// ── Persona Seed from State ───────────────────────────────────────────────

/**
 * Build a PersonaSeed from CharacterPhysicsState metadata.
 * Falls back to sensible defaults when identity or beliefs are sparse.
 */
export function buildPersonaSeedFromState(
  state: CharacterPhysicsState
): PersonaSeed {
  const identity = state.identity;
  const name = identity?.name ?? "匿名角色";
  const desc = identity?.description ?? "";
  const tags = identity?.tags ?? [];

  // Derive traits from coordinate extremes
  const coord = state.coordinate.values;
  const traits: string[] = [];
  if (coord.trust < 0.35) traits.push("低信任");
  if (coord.fear > 0.65) traits.push("高恐惧");
  if (coord.attachment > 0.65) traits.push("高依恋");
  if (coord.control > 0.65) traits.push("控制");
  if (coord.openness > 0.65) traits.push("开放");
  if (coord.conscientiousness > 0.65) traits.push("尽责");

  // Recent memories as core experience
  const recentMemories = state.memories.slice(-5);
  const memoryContent = recentMemories
    .map((m) => m.content)
    .join("；");
  const coreExperience = memoryContent
    ? `${name}经历过：${memoryContent.slice(0, 160)}`
    : `${name}有${traits.join("、")}特质，但缺少具体经历记录。`;

  // Dominant belief
  const topBelief =
    state.beliefStates.length > 0
      ? state.beliefStates[0]!.content
      : identity
        ? `${name}相信自己的判断。`
        : "相信自己的判断。";

  // Need gap from meta state
  const meta = state.metaState;
  const needGap =
    meta.lonelinessTolerance < 0.4
      ? "归属感、被看见"
      : meta.emotionalSensitivity > 0.6
        ? "安全感、可控感"
        : "未被满足的安全感和自我价值需求";

  // Defense from boundary
  const boundary = state.boundary;
  const defaultDefense =
    boundary.integrity < 0.5
      ? "回避或过度警觉"
      : boundary.phase === "overflow"
        ? "撤退和距离维持"
        : "观察和有限参与";

  // Risk profile
  const risk =
    coord.fear > 0.6
      ? "高不确定性回避"
      : coord.trust < 0.4
        ? "再次被利用/背叛风险"
        : "一般不确定性";

  // Trust profile
  const trust =
    coord.trust < 0.3
      ? "当前信任极低"
      : coord.trust < 0.5
        ? "信任正在恢复"
        : "普遍基本信任";

  // Growth from meta
  const growth =
    meta.resilience > 0.6
      ? "成长"
      : meta.resilience > 0.4
        ? "半修复"
        : "未修复";

  // Group from tags or defaults
  const group =
    tags.includes("创作者") || tags.includes("工程师")
      ? "创造者"
      : tags.includes("照顾者")
        ? "照顾者"
        : "个体";

  const initialTraits =
    traits.length > 0 ? traits.join("、") : `${desc} 经历塑造的复杂特质`;

  return {
    id: `persona_${identity?.id ?? "anonymous"}`,
    name,
    group,
    initialTraits,
    coreExperience,
    dominantBelief: topBelief,
    needGap,
    defaultDefense,
    risk,
    trust,
    growth,
  };
}

// ── Environment Seed from State ───────────────────────────────────────────

/**
 * Build an EnvironmentSeed from the character's current context.
 * When there is no explicit external event, constructs a "quiet daily life"
 * environment from the character's own internal state.
 */
export function buildEnvironmentSeedFromState(
  state: CharacterPhysicsState,
  options?: {
    /** Optional: explicit environment trigger text (e.g., from latest event). */
    triggerContext?: string;
  }
): EnvironmentSeed {
  const boundary = state.boundary;
  const meta = state.metaState;
  const coord = state.coordinate.values;

  // Stressor from boundary
  const stressor =
    boundary.phase === "overflow"
      ? "压力过载 / 边界溢出"
      : boundary.phase === "strained"
        ? "持续压力 / 情感负荷"
        : boundary.stressLoad > 0.5
          ? "中等压力 / 不确定性"
          : "日常平静 / 低强度压力";

  // Trigger from options or derived from state
  const trigger = options?.triggerContext ??
    (state.memories.length > 0
      ? `最近经历：${state.memories.at(-1)!.content.slice(0, 80)}`
      : "安静的日常片段，无明显外部事件");

  // Environment name
  const envName =
    boundary.phase === "overflow"
      ? "高压环境"
      : boundary.stressLoad > 0.5
        ? "有压力的日常环境"
        : "安静日常";

  // Test focus from state signals
  const testFocusParts: string[] = [];
  if (coord.trust < 0.4) testFocusParts.push("信任");
  if (coord.fear > 0.6) testFocusParts.push("恐惧");
  if (meta.emotionalSensitivity > 0.6) testFocusParts.push("情感敏感性");
  if (!testFocusParts.length) testFocusParts.push("内部平衡");

  return {
    id: `env_quiet_daily`,
    name: envName,
    trigger,
    stressor,
    testFocus: testFocusParts.join(" / "),
  };
}

// ── Differentiated Decision for State ─────────────────────────────────────

export interface DeriveOptions {
  /**
   * Optional: explicit persona seed (overrides auto-construction).
   * If omitted, persona is built from CharacterPhysicsState identity/memories/beliefs.
   */
  persona?: PersonaSeed;
  /**
   * Optional: explicit environment seed (overrides auto-construction).
   * If omitted, environment is built from boundary/meta/coordinate.
   */
  environment?: EnvironmentSeed;
  /**
   * V10.15: Optional life context from dry-run. Modifies strategy weights.
   * If omitted, decision is made without life signal influence.
   */
  lifeContext?: LifeDecisionContext;
}

/**
 * Build a full DifferentiatedDecision from a CharacterPhysicsState.
 * Pure function — deterministic, no mutation, no LLM.
 *
 * Uses real state data:
 *   - identity → PersonaSeed name/traits/group
 *   - memories → coreExperience
 *   - beliefs → dominantBelief
 *   - coordinate → traits/trust/fear/growth
 *   - metaState → needGap, resilience
 *   - boundary → stressor, environment phase
 */
export function buildDifferentiatedDecisionForState(
  state: CharacterPhysicsState,
  options?: DeriveOptions
): DifferentiatedDecision {
  const persona = options?.persona ?? buildPersonaSeedFromState(state);
  const environment =
    options?.environment ?? buildEnvironmentSeedFromState(state);

  return buildDifferentiatedDecision({
    persona,
    environment,
    state,
    ...(options?.lifeContext ? { lifeContext: options.lifeContext } : {}),
  });
}
