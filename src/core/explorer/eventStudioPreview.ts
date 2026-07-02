/**
 * V11.2 — Event Studio Preview Core
 *
 * Read-only preview pipeline: parse → impact preview → full preview.
 * Never mutates baseline CharacterPhysicsState.
 * Reuses V10 parse, physics, reality audit, and V11.1 DTOs.
 */
import type { CharacterPhysicsState } from "../physics/physicsEngine";
import { CharacterPhysicsEngine } from "../physics/physicsEngine";
import { deserializeCharacterPhysicsState, serializeCharacterPhysicsState } from "../physics/serialization";
import { parseExperienceEvent } from "../event/eventParser";
import { runRealityAudit } from "../audit/realityAudit";
import { calculateImpactScore } from "../benchmark/impact";
import type { EnvironmentSeed } from "../differentiation/characterDifferentiation";
import type {
  EventStudioDraft,
  EventStudioPreview,
  ParsedEventSummary,
  ImpactPreview,
  MemoryPreview,
  BeliefPreview as BeliefPreviewType,
  NeedPreview as NeedPreviewType,
  PersonalityDeltaPreview,
  DecisionPreview,
} from "./explorerTypes";
import { buildEventStudioPreview as buildDto, buildCharacterStateSurfaceFromState } from "./explorerDtoBuilders";

export type PreviewMode = "parse_only" | "impact_preview" | "full_preview";

export interface EventStudioPreviewInput {
  draft: EventStudioDraft;
  baselineState: CharacterPhysicsState;
  followUpScenario?: EnvironmentSeed;
  previewMode?: PreviewMode;
}

export function buildEventStudioPreview(
  input: EventStudioPreviewInput,
): EventStudioPreview {
  const mode = input.previewMode ?? "full_preview";
  const warnings: string[] = [];
  const draft = input.draft;

  // ── Input validation warnings ──
  if (!draft.naturalLanguageInput.trim()) {
    warnings.push("事件描述为空，无法解析");
  }
  if (draft.intensity > 0.85) {
    warnings.push("事件强度很高，可能产生较大心理影响");
  }
  if (draft.repetitionCount > 1) {
    warnings.push(`重复事件预览：此事件将模拟应用 ${draft.repetitionCount} 次`);
  }
  if (mode === "full_preview" && !input.followUpScenario) {
    warnings.push("完整预览模式下未提供后续决策场景，decision preview 可能不准确");
  }

  // ── Parse ──
  const parseInput: Parameters<typeof parseExperienceEvent>[0] = {
    description: draft.naturalLanguageInput,
    categoryHint: "auto",
  };
  if (draft.tags.length > 0) parseInput.tags = draft.tags;
  const parsed = parseExperienceEvent(parseInput);

  const parsedSummary: ParsedEventSummary = {
    category: parsed.category ?? "general",
    emotion: parsed.emotion ?? "uncertainty",
    intensity: parsed.intensity,
    importance: parsed.importance,
    parserConfidence: parsed.parser?.confidence ?? 0.5,
  };

  if (parsedSummary.parserConfidence < 0.3) {
    warnings.push("事件解析置信度低，结果可能不准确");
  }

  // ── Impact preview (requires impact score) ──
  const impactScore = calculateImpactScore({
    intensity: parsed.intensity,
    importance: parsed.importance,
    relationshipWeight: parsed.relationshipWeight,
    expectationGap: parsed.expectationGap,
    personalitySensitivity: parsed.personalitySensitivity,
  });

  const impactPreview = buildImpactPreview(parsed, impactScore.value);

  // ── Memory preview ──
  const memoryPreview = buildMemoryPreview(parsed, input.baselineState);

  // ── Parse-only mode: stop here ──
  if (mode === "parse_only") {
    return buildDto({
      draftId: draft.sourceId || `draft_${Date.now()}`,
      parsed: parsedSummary,
      impact: impactPreview,
      memory: memoryPreview,
      belief: { likelyNewBelief: null, likelyStrengthenedBeliefs: [], likelyWeakenedBeliefs: [] },
      need: { likelyActivatedNeeds: [], likelyDeactivatedNeeds: [] },
      personality: { direction: "未计算", affectedDimensions: [], estimatedMagnitude: "minimal" },
      decision: { likelyStrategyShift: "未计算", likelyActionChange: "未计算" },
      auditWarnings: warnings,
      requiresConfirmation: false,
    });
  }

  // ── Impact-only mode: include belief/need preview stubs ──
  if (mode === "impact_preview") {
    const beliefPreview = buildBeliefStub(parsed);
    const needPreview = buildNeedStub(parsed);
    const personalityPreview = buildPersonalityStub(parsed);

    return buildDto({
      draftId: draft.sourceId || `draft_${Date.now()}`,
      parsed: parsedSummary,
      impact: impactPreview,
      memory: memoryPreview,
      belief: beliefPreview,
      need: needPreview,
      personality: personalityPreview,
      decision: { likelyStrategyShift: "未计算（需要完整模拟）", likelyActionChange: "未计算" },
      auditWarnings: warnings,
      requiresConfirmation: false,
    });
  }

  // ── Full preview: clone state, simulate, audit ──
  const cloned = cloneState(input.baselineState);
  const engine = new CharacterPhysicsEngine();

  // Apply repeated events on clone
  for (let i = 0; i < draft.repetitionCount; i++) {
    engine.processEvent(cloned, parsed);
  }

  // Run reality audit on clone
  let auditWarnings: string[] = [...warnings];
  if (input.followUpScenario) {
    try {
      const audit = runRealityAudit({
        id: `preview_${draft.sourceId || Date.now()}`,
        label: `Preview: ${draft.naturalLanguageInput.slice(0, 40)}`,
        baselineState: input.baselineState,
        eventInput: {
          description: draft.naturalLanguageInput,
          tags: draft.tags,
          categoryHint: (parsed.category || "general") as "abandonment" | "support" | "betrayal" | "success" | "failure" | "rejection" | "conflict" | "fatigue" | "uncertainty" | "general" | "auto",
        },
        followUpDecisionScenario: input.followUpScenario,
      });

      if (audit.auditVerdict.level === "WARN" || audit.auditVerdict.level === "FAIL") {
        auditWarnings.push(`Reality Audit: ${audit.auditVerdict.level} — ${audit.auditVerdict.warnings.slice(0, 3).join("; ")}`);
      }
      if (!audit.decisionResponsiveness.candidateScoreChanged) {
        auditWarnings.push("决策表面未响应事件影响");
      }
    } catch {
      auditWarnings.push("Reality Audit 预览未能完成");
    }
  }

  // Compute state deltas
  const stateSurface = buildCharacterStateSurfaceFromState(cloned);
  const baselineSurface = buildCharacterStateSurfaceFromState(input.baselineState);

  const personalityDelta = buildPersonalityDeltaFromComparison(input.baselineState, cloned, parsed);

  const decisionPreview: DecisionPreview = {
    likelyStrategyShift: stateSurface.behaviorTendencies.strategyLabel !== baselineSurface.behaviorTendencies.strategyLabel
      ? `${baselineSurface.behaviorTendencies.strategyLabel} → ${stateSurface.behaviorTendencies.strategyLabel}`
      : "策略未显著变化",
    likelyActionChange: stateSurface.behaviorTendencies.likelyAction !== baselineSurface.behaviorTendencies.likelyAction
      ? `${baselineSurface.behaviorTendencies.likelyAction} → ${stateSurface.behaviorTendencies.likelyAction}`
      : "行为倾向未显著变化",
  };

  return buildDto({
    draftId: draft.sourceId || `draft_${Date.now()}`,
    parsed: parsedSummary,
    impact: impactPreview,
    memory: buildMemoryPreviewFromSimulation(cloned, input.baselineState, parsed),
    belief: buildBeliefFromSimulation(cloned, input.baselineState),
    need: { likelyActivatedNeeds: [], likelyDeactivatedNeeds: [] }, // Needs require DerivedState
    personality: personalityDelta,
    decision: decisionPreview,
    auditWarnings,
    requiresConfirmation: true,
  });
}

// ── Impact preview builder ──

function buildImpactPreview(
  parsed: ReturnType<typeof parseExperienceEvent>,
  impactValue: number,
): ImpactPreview {
  const band = (v: number): "low" | "moderate" | "high" =>
    v > 0.6 ? "high" : v > 0.3 ? "moderate" : "low";

  const isPositive = parsed.category === "support" || parsed.category === "success";
  const isNegative = parsed.category === "abandonment" || parsed.category === "betrayal";

  return {
    expectedMemoryImpact: band(parsed.importance),
    expectedBoundaryImpact: isNegative ? "high" : isPositive ? "low" : band(impactValue * 0.8),
    expectedBeliefImpact: isNegative ? "high" : band(parsed.importance * 0.7),
    expectedPersonalityImpact: impactValue > 0.5 ? "subtle" : "minimal",
  };
}

// ── Memory preview builders ──

function buildMemoryPreview(
  _parsed: ReturnType<typeof parseExperienceEvent>,
  baseline: CharacterPhysicsState,
): MemoryPreview {
  return {
    willCreateMemory: true,
    estimatedSalience: "moderate",
    relatedExistingMemories: baseline.memories.length,
  };
}

function buildMemoryPreviewFromSimulation(
  after: CharacterPhysicsState,
  before: CharacterPhysicsState,
  _parsed: ReturnType<typeof parseExperienceEvent>,
): MemoryPreview {
  const newMemories = after.memories.length - before.memories.length;
  return {
    willCreateMemory: newMemories > 0,
    estimatedSalience: newMemories > 0 ? "moderate" : "low",
    relatedExistingMemories: before.memories.length,
  };
}

// ── Belief / Need / Personality stubs ──

function buildBeliefStub(parsed: ReturnType<typeof parseExperienceEvent>): BeliefPreviewType {
  const category = parsed.category ?? "general";
  if (category === "abandonment" || category === "betrayal") {
    return {
      likelyNewBelief: parsed.beliefEffect ?? null,
      likelyStrengthenedBeliefs: ["亲密关系不可靠"],
      likelyWeakenedBeliefs: [],
    };
  }
  if (category === "support") {
    return {
      likelyNewBelief: null,
      likelyStrengthenedBeliefs: ["靠近不一定意味着离开"],
      likelyWeakenedBeliefs: ["重要的人会突然离开"],
    };
  }
  return { likelyNewBelief: null, likelyStrengthenedBeliefs: [], likelyWeakenedBeliefs: [] };
}

function buildNeedStub(parsed: ReturnType<typeof parseExperienceEvent>): NeedPreviewType {
  const category = parsed.category ?? "general";
  if (category === "abandonment" || category === "betrayal") {
    return { likelyActivatedNeeds: ["安全感", "被需要"], likelyDeactivatedNeeds: [] };
  }
  if (category === "support") {
    return { likelyActivatedNeeds: [], likelyDeactivatedNeeds: ["安全感"] };
  }
  return { likelyActivatedNeeds: [], likelyDeactivatedNeeds: [] };
}

function buildPersonalityStub(parsed: ReturnType<typeof parseExperienceEvent>): PersonalityDeltaPreview {
  const category = parsed.category ?? "general";
  if (category === "abandonment" || category === "betrayal") {
    return { direction: "防御性漂移（信任↓ 恐惧↑）", affectedDimensions: ["trust", "fear"], estimatedMagnitude: "subtle" };
  }
  if (category === "support") {
    return { direction: "修复性漂移（信任↑ 恐惧↓）", affectedDimensions: ["trust", "fear", "openness"], estimatedMagnitude: "minimal" };
  }
  return { direction: "无显著方向性变化", affectedDimensions: [], estimatedMagnitude: "minimal" };
}

// ── Full preview personality delta from simulated comparison ──

function buildPersonalityDeltaFromComparison(
  before: CharacterPhysicsState,
  after: CharacterPhysicsState,
  _parsed: ReturnType<typeof parseExperienceEvent>,
): PersonalityDeltaPreview {
  const keys: Array<keyof typeof before.coordinate.values> = ["trust", "fear", "openness", "neuroticism", "attachment"];
  const affected: string[] = [];
  let maxDelta = 0;

  for (const key of keys) {
    const d = Math.abs(after.coordinate.values[key] - before.coordinate.values[key]);
    if (d > 0.001) {
      affected.push(key);
      if (d > maxDelta) maxDelta = d;
    }
  }

  const trustDelta = after.coordinate.values.trust - before.coordinate.values.trust;
  const fearDelta = after.coordinate.values.fear - before.coordinate.values.fear;

  let direction = "无显著方向性变化";
  if (trustDelta < -0.001 && fearDelta > 0.001) direction = "防御性漂移（信任↓ 恐惧↑）";
  else if (trustDelta > 0.001 && fearDelta < -0.001) direction = "修复性漂移（信任↑ 恐惧↓）";
  else if (trustDelta > 0.001) direction = "信任小幅上升";
  else if (trustDelta < -0.001) direction = "信任小幅下降";

  const estimatedMagnitude: PersonalityDeltaPreview["estimatedMagnitude"] =
    maxDelta > 0.01 ? "visible" : maxDelta > 0.003 ? "subtle" : "minimal";

  return { direction, affectedDimensions: affected, estimatedMagnitude };
}

// ── Belief preview from simulated state ──

function buildBeliefFromSimulation(
  after: CharacterPhysicsState,
  before: CharacterPhysicsState,
): BeliefPreviewType {
  const newBeliefs = after.beliefStates.filter(
    (b) => !before.beliefStates.some((pb) => pb.id === b.id),
  );
  const strengthened = after.beliefStates.filter((b) => {
    const prev = before.beliefStates.find((pb) => pb.id === b.id);
    return prev && b.strength > prev.strength + 0.01;
  });
  const weakened = after.beliefStates.filter((b) => {
    const prev = before.beliefStates.find((pb) => pb.id === b.id);
    return prev && b.strength < prev.strength - 0.01;
  });

  return {
    likelyNewBelief: newBeliefs[0]?.content ?? null,
    likelyStrengthenedBeliefs: strengthened.slice(0, 3).map((b) => b.content),
    likelyWeakenedBeliefs: weakened.slice(0, 3).map((b) => b.content),
  };
}

// ── Helpers ──

function cloneState(state: CharacterPhysicsState): CharacterPhysicsState {
  return deserializeCharacterPhysicsState(structuredClone(serializeCharacterPhysicsState(state)));
}
