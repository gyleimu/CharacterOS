// =========================================================================
// V10.13 Differentiated Decision Explanation
//
// Explains the full differentiation chain deterministically from structured
// inputs — no LLM, no narrative prose, no state mutation.
// Every reason cites facts from the DifferentiatedDecision and the state
// that produced it. Output is an ExplanationTrace compatible with the
// existing V9.6 explainability framework.
// =========================================================================

import type { DifferentiatedDecision } from "../differentiation/characterDifferentiation";
import type { BehaviorDecision } from "../decision/behaviorDecision";
import type { DerivedCharacterState } from "../state/derivedCharacterState";
import type { LifeDecisionContext } from "../differentiation/lifeDecisionContext";
import {
  type ExplanationTrace,
  type ExplanationFact,
  type ExplanationReason,
  type ExplanationConfidence,
  type ExplanationSeverity,
} from "./explanationTypes";

// ── Input ─────────────────────────────────────────────────────────────────

export interface DifferentiatedDecisionExplanationInput {
  /** The legacy behavior decision for comparison. */
  legacyDecision: BehaviorDecision;
  /** The full differentiated decision from V10.12. */
  differentiatedDecision: DifferentiatedDecision;
  /** Optional: top-level derived state context. */
  derived?: DerivedCharacterState;
  /** Optional: deterministic seed for ID generation (avoids Date.now). */
  seed?: string;
  /** Optional: persona name for contextualized reasons. */
  personaName?: string;
  /** Optional: environment name for contextualized reasons. */
  environmentName?: string;
  /** V10.15: Optional life context for explaining life signal influence. */
  lifeContext?: LifeDecisionContext;
}

// ── Output ────────────────────────────────────────────────────────────────

export interface DifferentiatedDecisionExplanationResult {
  trace: ExplanationTrace;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function stableHash(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function makeId(seed: string, suffix: string): string {
  return `dd-expl_${stableHash(seed + suffix).toString(16)}`;
}

function makeFact(
  seed: string,
  suffix: string,
  label: string,
  value: unknown,
  source: ExplanationFact["source"] = "derived"
): ExplanationFact {
  return {
    id: makeId(seed, `fact_${suffix}`),
    label,
    value,
    source,
  };
}

function makeReason(
  seed: string,
  suffix: string,
  message: string,
  confidence: ExplanationConfidence,
  severity: ExplanationSeverity,
  facts: ExplanationFact[]
): ExplanationReason {
  return {
    id: makeId(seed, `reason_${suffix}`),
    message,
    scope: "differentiated_decision",
    severity,
    confidence,
    supportingFacts: facts,
  };
}

function confidenceFromIntensity(intensity: number): ExplanationConfidence {
  if (intensity >= 0.65) return "high";
  if (intensity >= 0.35) return "medium";
  return "low";
}

// ── Main Function ─────────────────────────────────────────────────────────

/**
 * Explain a DifferentiatedDecision against its legacy BehaviorDecision.
 *
 * Produces a structured ExplanationTrace covering:
 *   1. Schema activation
 *   2. Need formation
 *   3. Desire formation
 *   4. Strategy selection
 *   5. Action surface
 *   6. Legacy comparison
 *
 * Pure, deterministic, no LLM, no state mutation.
 */
export function explainDifferentiatedDecision(
  input: DifferentiatedDecisionExplanationInput
): DifferentiatedDecisionExplanationResult {
  const seed = input.seed ?? "v10.13-default";
  const dd = input.differentiatedDecision;
  const legacy = input.legacyDecision;
  const facts: ExplanationFact[] = [];
  const reasons: ExplanationReason[] = [];
  const warnings: string[] = [];
  const persona = input.personaName ?? "角色";
  const env = input.environmentName ?? "当前环境";

  // ── 1. Schema Activation ──────────────────────────────────────────────
  const schemaFacts = buildSchemaFacts(dd);
  facts.push(...schemaFacts);

  const topSchema = dd.schemas[0];
  const schemaReasonText = topSchema
    ? `${topSchema.label}（强度 ${topSchema.intensity.toFixed(2)}）被激活为核心图式，来源：${topSchema.source}。${topSchema.coreInterpretation}`
    : "无图式被显著激活。";

  reasons.push(
    makeReason(seed, "schema", schemaReasonText, confidenceFromIntensity(topSchema?.intensity ?? 0), "info", schemaFacts)
  );

  if (dd.schemas.length > 1) {
    const secondary = dd.schemas.slice(1).map((s) => `${s.label}(${s.intensity.toFixed(2)})`).join("、");
    reasons.push(
      makeReason(seed, "schema_secondary", `次要激活图式：${secondary}。`, "medium", "info", schemaFacts.slice(0, 3))
    );
  }

  // ── 2. Need Formation ────────────────────────────────────────────────
  const needFacts = buildNeedFacts(dd);
  facts.push(...needFacts);

  const topNeed = dd.needs[0];
  const needReasonText = topNeed
    ? `${topNeed.label}（强度 ${topNeed.intensity.toFixed(2)}）是最强需求，由 ${topNeed.basedOnSchemas.map(shortSchemaLabel).join("、")} 图式驱动。${topNeed.reason}`
    : "需求信号不足。";

  reasons.push(
    makeReason(seed, "need", needReasonText, confidenceFromIntensity(topNeed?.intensity ?? 0), "info", needFacts)
  );

  // ── 3. Desire Formation ──────────────────────────────────────────────
  const desireFacts = buildDesireFacts(dd);
  facts.push(...desireFacts);

  const topDesire = dd.desires[0];
  const desireReasonText = topDesire
    ? `${topDesire.label}（强度 ${topDesire.intensity.toFixed(2)}）是最强欲望，基于需求 ${topDesire.basedOnNeeds.slice(0, 2).join("、")}。${topDesire.intent}`
    : "欲望信号不足。";

  reasons.push(
    makeReason(seed, "desire", desireReasonText, confidenceFromIntensity(topDesire?.intensity ?? 0), "info", desireFacts)
  );

  // ── 4. Strategy Selection ────────────────────────────────────────────
  const strategyFacts = buildStrategyFacts(dd);
  facts.push(...strategyFacts);

  const selected = dd.selectedStrategy;
  const strategyReasonText = selected
    ? `${selected.label}（强度 ${selected.intensity.toFixed(2)}）被选为最优策略。核心原因：${selected.coreReason} 行动意图：${selected.actionIntent}`
    : "无策略被选出。";

  reasons.push(
    makeReason(seed, "strategy", strategyReasonText, confidenceFromIntensity(selected?.intensity ?? 0), "info", strategyFacts)
  );

  if (dd.strategies.length > 1) {
    const runnerUp = dd.strategies[1];
    if (runnerUp) {
      reasons.push(
        makeReason(seed, "strategy_runner_up",
          `次优策略：${runnerUp.label}（强度 ${runnerUp.intensity.toFixed(2)}），差距 ${(selected.intensity - runnerUp.intensity).toFixed(2)}。`,
          "medium", "info", strategyFacts.slice(0, 2))
      );
    }
  }

  // ── 5. Action Surface ────────────────────────────────────────────────
  const actionFacts = buildActionFacts(dd);
  facts.push(...actionFacts);

  const action = dd.actionSurface;
  const actionReasonText = `${action.action}`;

  reasons.push(
    makeReason(seed, "action", `具体行动：${actionReasonText}。方向：${action.direction}。${action.reason}`, "high", "info", actionFacts)
  );

  if (action.templatePenalty > 0.3) {
    warnings.push(`行动模板惩罚较高（${action.templatePenalty.toFixed(2)}），行动文本可能偏通用。`);
    reasons.push(
      makeReason(seed, "template_warning",
        `Template penalty=${action.templatePenalty.toFixed(2)} — 建议补充 persona/environment 特异性。`,
        "medium", "warning",
        [makeFact(seed, "templatePenalty", "模板惩罚", action.templatePenalty, "derived")]
      )
    );
  }

  if (!action.referencesEnvironment) {
    warnings.push("行动未引用环境信息 — 可能偏通用。");
  }
  if (!action.referencesPersona) {
    warnings.push("行动未引用 persona 信息 — 可能偏通用。");
  }

  // ── 6. Legacy Comparison ─────────────────────────────────────────────
  const legacyAction = legacy.mostLikelyAction;
  const diffAction = dd.actionSurface.action;
  const actionsMatch = legacyAction === diffAction;

  const comparisonFacts: ExplanationFact[] = [
    makeFact(seed, "legacy_action", "Legacy 决策行动", legacyAction, "derived"),
    makeFact(seed, "diff_action", "Differentiated 决策行动", diffAction, "derived"),
    makeFact(seed, "actions_match", "行动一致", actionsMatch, "derived"),
    makeFact(seed, "legacy_confidence", "Legacy 置信度", legacy.confidence, "derived"),
    makeFact(seed, "diff_score", "Differentiated 策略强度", dd.selectedStrategy.intensity, "derived"),
  ];
  facts.push(...comparisonFacts);

  if (actionsMatch) {
    reasons.push(
      makeReason(seed, "legacy_match",
        `Legacy 与 Differentiated 决策行动一致：均为"${legacyAction.slice(0, 60)}…"。Differentiated 附加了策略理由和 schema/need/desire 链路。`,
        "high", "info", comparisonFacts)
    );
  } else {
    reasons.push(
      makeReason(seed, "legacy_diff",
        `Legacy 决策："${legacyAction.slice(0, 80)}"；Differentiated 决策："${diffAction.slice(0, 80)}"。Differentiated 基于 ${dd.schemas.length} 个激活 schema 和 ${dd.needs.length} 个需求生成更具体的行动。`,
        "high", "info", comparisonFacts)
    );
  }

  // ── 7. Life Context (V10.15) ──────────────────────────────────────────
  const lc = input.lifeContext;
  if (lc) {
    const lifeFacts: ExplanationFact[] = [
      makeFact(seed, "life_fatigue", "疲劳", lc.fatigue, "derived"),
      makeFact(seed, "life_energy", "能量", lc.energy, "derived"),
      makeFact(seed, "life_sleepPressure", "睡眠压力", lc.sleepPressure, "derived"),
      makeFact(seed, "life_sleepPhase", "睡眠阶段", lc.sleepPhase, "derived"),
      makeFact(seed, "life_boredom", "无聊水平", lc.boredom, "derived"),
      makeFact(seed, "life_restlessness", "不安水平", lc.restlessness, "derived"),
    ];
    facts.push(...lifeFacts);

    if (lc.strongestRandomThoughtKind) {
      facts.push(makeFact(seed, "life_thought", "最强随机念头", { kind: lc.strongestRandomThoughtKind, phrase: lc.strongestRandomThoughtPhrase }, "derived"));
    }
    if (lc.strongestInspirationType) {
      facts.push(makeFact(seed, "life_inspiration", "最强灵感", { type: lc.strongestInspirationType, strength: lc.strongestInspirationStrength }, "derived"));
    }
    if (lc.topSelfActionCandidateType) {
      facts.push(makeFact(seed, "life_candidate", "最强自我行动候选", { type: lc.topSelfActionCandidateType, score: lc.topSelfActionCandidateScore }, "derived"));
    }

    reasons.push(
      makeReason(seed, "life_influence",
        `生命信号影响：fatigue=${lc.fatigue.toFixed(2)}, sleepPressure=${lc.sleepPressure.toFixed(2)}, boredom=${lc.boredom.toFixed(2)}。决策策略权重已调幅。`,
        "medium", "info", lifeFacts.slice(0, 4))
    );

    if (dd.lifeInfluences.length > 0) {
      reasons.push(
        makeReason(seed, "life_influence_detail",
          `具体影响：${dd.lifeInfluences.slice(0, 3).join("；")}`,
          "medium", "info", lifeFacts)
      );
    }
  }

  // ── Assemble trace ────────────────────────────────────────────────────
  const trace: ExplanationTrace = {
    id: makeId(seed, "trace"),
    scope: "differentiated_decision",
    title: `${persona}在${env}中的分化决策解释`,
    summary: `${persona}被${topSchema?.label ?? "安全寻求图式"}牵动（强度 ${topSchema?.intensity.toFixed(2) ?? "0.00"}），最强需求：${topNeed?.label ?? "安全感"}，最强欲望：${topDesire?.label ?? "保留退路"}，选择策略：${selected.label}，具体行动：${diffAction.slice(0, 80)}。`,
    reasons,
    facts,
    warnings,
    createdAt: new Date(2026, 5, 24, 12, 0, 0).toISOString(), // deterministic anchor
  };

  return { trace };
}

// ── Fact Builders ─────────────────────────────────────────────────────────

function buildSchemaFacts(dd: DifferentiatedDecision): ExplanationFact[] {
  return dd.schemas.map((s, i) => ({
    id: `fact_schema_${i}`,
    label: `激活图式 #${i + 1}`,
    value: {
      id: s.id,
      label: s.label,
      intensity: s.intensity,
      source: s.source,
      matchedPersonaKeys: s.matchedPersonaKeys,
      matchedEnvironmentKeys: s.matchedEnvironmentKeys,
      coreInterpretation: s.coreInterpretation,
    },
    source: "derived" as const,
  }));
}

function buildNeedFacts(dd: DifferentiatedDecision): ExplanationFact[] {
  return dd.needs.map((n, i) => ({
    id: `fact_need_${i}`,
    label: `需求 #${i + 1}`,
    value: {
      id: n.id,
      label: n.label,
      intensity: n.intensity,
      basedOnSchemas: n.basedOnSchemas,
      reason: n.reason,
    },
    source: "derived" as const,
  }));
}

function buildDesireFacts(dd: DifferentiatedDecision): ExplanationFact[] {
  return dd.desires.map((d, i) => ({
    id: `fact_desire_${i}`,
    label: `欲望 #${i + 1}`,
    value: {
      id: d.id,
      label: d.label,
      intensity: d.intensity,
      basedOnSchemas: d.basedOnSchemas,
      basedOnNeeds: d.basedOnNeeds,
      intent: d.intent,
    },
    source: "derived" as const,
  }));
}

function buildStrategyFacts(dd: DifferentiatedDecision): ExplanationFact[] {
  return dd.strategies.slice(0, 5).map((s, i) => ({
    id: `fact_strategy_${i}`,
    label: `策略 #${i + 1}${i === 0 ? "（已选）" : ""}`,
    value: {
      id: s.id,
      label: s.label,
      intensity: s.intensity,
      direction: s.direction,
      basedOnSchemas: s.basedOnSchemas,
      basedOnNeeds: s.basedOnNeeds,
      basedOnDesires: s.basedOnDesires,
      coreReason: s.coreReason,
      actionIntent: s.actionIntent,
    },
    source: "derived" as const,
  }));
}

function buildActionFacts(dd: DifferentiatedDecision): ExplanationFact[] {
  const a = dd.actionSurface;
  return [
    {
      id: "fact_action",
      label: "最终行动",
      value: {
        action: a.action,
        direction: a.direction,
        strategyId: a.strategyId,
        reason: a.reason,
        templatePenalty: a.templatePenalty,
        referencesEnvironment: a.referencesEnvironment,
        referencesPersona: a.referencesPersona,
        referencesNeedOrDesire: a.referencesNeedOrDesire,
      },
      source: "derived" as const,
    },
  ];
}

function shortSchemaLabel(id: string): string {
  const map: Record<string, string> = {
    betrayal_schema: "背叛图式",
    abandonment_schema: "遗弃图式",
    scarcity_schema: "匮乏图式",
    shame_schema: "羞耻图式",
    failure_identity_schema: "失败身份图式",
    control_loss_schema: "失控图式",
    authority_threat_schema: "权威威胁图式",
    moral_conflict_schema: "道德冲突图式",
    attachment_threat_schema: "依恋威胁图式",
    exploitation_schema: "被利用图式",
    responsibility_overload_schema: "责任过载图式",
    freedom_constraint_schema: "自由受限图式",
    recognition_hunger_schema: "认可饥饿图式",
    competition_schema: "竞争图式",
    idealism_schema: "理想主义图式",
    opportunistic_gain_schema: "机会收益图式",
    recovery_growth_schema: "成长修复图式",
    emotional_suppression_schema: "情绪压抑图式",
    revenge_correction_schema: "纠偏复仇图式",
    safety_seeking_schema: "安全寻求图式",
  };
  return map[id] ?? id;
}
