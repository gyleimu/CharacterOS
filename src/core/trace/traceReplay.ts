import { eventCategoryPhysics, type EventCategory } from "../event/categoryPhysics";
import type { ExperienceEvent } from "../event/event";
import {
  bigFiveFromCoordinate,
  coordinateToRecord,
  linFanInitialCoordinate,
  type PersonalityCoordinateValues
} from "../personality/coordinate";
import { createCharacterPhysicsState } from "../physics/physicsEngine";
import { runEventSequence } from "../simulation/runner";

export type TraceReplayScenarioId =
  | "abandonment_then_repair"
  | "betrayal_spiral"
  | "success_recovery"
  | "repeated_abandonment_accumulation"
  | "support_recovery_accumulation";

export const TRACE_REPLAY_SCHEMA_VERSION = "characteros.trace-replay.v1";

export interface TraceReplayScenarioDefinition {
  id: TraceReplayScenarioId;
  title: string;
  description: string;
  expectedForces: string[];
  buildEvents: () => ExperienceEvent[];
}

export interface TraceReplayArtifact {
  schemaVersion: typeof TRACE_REPLAY_SCHEMA_VERSION;
  title: string;
  scenario: TraceReplayScenarioId;
  scenarioMeta: {
    title: string;
    description: string;
    expectedForces: string[];
  };
  createdBy: string;
  parameters: {
    daysPerStep: number;
    learningRate: number;
  };
  initialCoordinate: PersonalityCoordinateValues;
  steps: TraceReplayStepArtifact[];
  finalCoordinate: PersonalityCoordinateValues;
}

export interface TraceReplayStepArtifact {
  step: number;
  eventId: string;
  category: string;
  impactScore: number;
  boundary: {
    phase: string;
    incomingStress: number;
    overflowAmount: number;
    driftMultiplier: number;
  };
  force: PersonalityCoordinateValues;
  clusterForces: Array<{
    clusterId: string;
    category: string;
    magnitude: number;
    trust: number;
    fear: number;
  }>;
  velocity: PersonalityCoordinateValues;
  coordinate: PersonalityCoordinateValues;
  clusterMetrics: Array<{
    clusterId: string;
    category: string;
    mass: number;
    density: number;
    stability: number;
    variance: number;
  }>;
}

export interface TraceReplayValidationResult {
  valid: boolean;
  errors: string[];
}

export const traceReplayScenarios: Record<TraceReplayScenarioId, TraceReplayScenarioDefinition> = {
  abandonment_then_repair: {
    id: "abandonment_then_repair",
    title: "失联后修复",
    description: "先积累抛弃/失联星团，再引入陪伴与解释，观察修复性经历如何产生反向力。",
    expectedForces: [
      "abandonment: trust < 0, fear > 0",
      "support: trust > 0, fear < 0"
    ],
    buildEvents: () => [
      event("trace_abandonment_1", "王雪三天没有回复林凡。", ["王雪", "失联", "等待"], "abandonment"),
      event("trace_abandonment_2", "林凡发出的解释消息没有得到回应。", ["王雪", "失联", "等待"], "abandonment"),
      event("trace_support_1", "王雪认真解释失联原因，并留下来陪林凡。", ["王雪", "解释", "陪伴"], "support"),
      event("trace_support_2", "王雪之后主动说明自己的安排。", ["王雪", "说明", "陪伴"], "support")
    ]
  },
  betrayal_spiral: {
    id: "betrayal_spiral",
    title: "背叛螺旋",
    description: "连续背叛与隐瞒事件形成背叛星团，观察 trust 下拉和 fear 上升。",
    expectedForces: [
      "betrayal: trust < 0, fear > 0"
    ],
    buildEvents: () => [
      event("trace_betrayal_1", "朋友把林凡私下说的话告诉了别人。", ["背叛", "欺骗", "朋友"], "betrayal"),
      event("trace_betrayal_2", "林凡发现对方又一次隐瞒关键事实。", ["背叛", "隐瞒", "欺骗"], "betrayal"),
      event("trace_betrayal_3", "对方试图解释，但林凡已经开始怀疑所有动机。", ["背叛", "解释", "怀疑"], "betrayal")
    ]
  },
  success_recovery: {
    id: "success_recovery",
    title: "认可恢复",
    description: "连续成功与被看见事件形成成功星团，观察 trust 上升和 fear 下降。",
    expectedForces: [
      "success: trust > 0, fear < 0",
      "support: trust > 0, fear < 0"
    ],
    buildEvents: () => [
      event("trace_success_1", "林凡的表达第一次被认真听见。", ["认可", "被看见"], "success"),
      event("trace_success_2", "林凡完成了一件重要的事，并得到了肯定。", ["成功", "完成", "表扬"], "success"),
      event("trace_support_3", "王雪肯定了林凡的努力，并主动靠近。", ["王雪", "陪伴", "认可"], "support")
    ]
  },
  repeated_abandonment_accumulation: {
    id: "repeated_abandonment_accumulation",
    title: "重复抛弃累积",
    description: "连续同类失联/等待事件形成单一抛弃星团，观察 mass、density、stability 和 velocity 的长期累积。",
    expectedForces: [
      "abandonment mass should increase over time",
      "abandonment: trust < 0, fear > 0",
      "personality velocity should accumulate instead of resetting"
    ],
    buildEvents: () => [
      event("trace_repeat_abandonment_1", "林凡约定好的通话没有等到。", ["失联", "等待", "亲密关系"], "abandonment"),
      event("trace_repeat_abandonment_2", "第二次，他提前发了消息，对方仍然沉默。", ["失联", "等待", "沉默"], "abandonment"),
      event("trace_repeat_abandonment_3", "他看到消息已读，却没有任何解释。", ["失联", "已读", "等待"], "abandonment"),
      event("trace_repeat_abandonment_4", "熟悉的夜里，他又一次把手机放在身边等到天亮。", ["夜晚", "等待", "失联"], "abandonment"),
      event("trace_repeat_abandonment_5", "对方短暂出现后再次消失，没有说明原因。", ["失联", "反复", "亲密关系"], "abandonment"),
      event("trace_repeat_abandonment_6", "林凡开始在每次安静时预设自己会被留下。", ["抛弃", "等待", "预设"], "abandonment")
    ]
  },
  support_recovery_accumulation: {
    id: "support_recovery_accumulation",
    title: "持续支持修复",
    description: "连续稳定陪伴、解释和兑现承诺形成支持星团，观察 trust 正向速度和 fear 负向速度如何缓慢累积。",
    expectedForces: [
      "support mass should increase over time",
      "support: trust > 0, fear < 0",
      "repair force should accumulate slowly through repeated safe experiences"
    ],
    buildEvents: () => [
      event("trace_repeat_support_1", "王雪提前告诉林凡自己今晚会晚回消息。", ["王雪", "说明", "陪伴"], "support"),
      event("trace_repeat_support_2", "她虽然很累，还是补了一句解释，让林凡不用猜。", ["王雪", "解释", "稳定"], "support"),
      event("trace_repeat_support_3", "林凡表达不安后，王雪没有躲开，而是认真听完。", ["王雪", "倾听", "被理解"], "support"),
      event("trace_repeat_support_4", "之后几天，王雪都按约定主动报平安。", ["王雪", "兑现", "稳定"], "support"),
      event("trace_repeat_support_5", "林凡沉默时，王雪没有逼问，只是安静陪着。", ["王雪", "陪伴", "安全"], "support"),
      event("trace_repeat_support_6", "她告诉林凡：如果要离开，会先说清楚。", ["王雪", "承诺", "解释"], "support")
    ]
  }
};

export function buildTraceReplayArtifact(params: {
  scenario: TraceReplayScenarioId;
  daysPerStep?: number;
  learningRate?: number;
}): TraceReplayArtifact {
  const scenario = traceReplayScenarios[params.scenario];
  const daysPerStep = params.daysPerStep ?? 14;
  const learningRate = params.learningRate ?? 0.03;
  const coordinate = linFanInitialCoordinate();
  const state = createCharacterPhysicsState({
    coordinate,
    personality: bigFiveFromCoordinate(coordinate),
    learningRate
  });
  const result = runEventSequence({
    state,
    events: scenario.buildEvents(),
    daysPerStep
  });

  return {
    schemaVersion: TRACE_REPLAY_SCHEMA_VERSION,
    title: "CharacterOS V2 trace replay",
    scenario: params.scenario,
    scenarioMeta: {
      title: scenario.title,
      description: scenario.description,
      expectedForces: scenario.expectedForces
    },
    createdBy: "CharacterOS core trace replay",
    parameters: {
      daysPerStep,
      learningRate
    },
    initialCoordinate: coordinateToRecord(coordinate),
    steps: result.snapshots.map((snapshot) => ({
      step: snapshot.step,
      eventId: snapshot.eventId,
      category: snapshot.category,
      impactScore: snapshot.impactScore,
      boundary: {
        phase: snapshot.boundaryImpact.after.phase,
        incomingStress: snapshot.boundaryImpact.incomingStress,
        overflowAmount: snapshot.boundaryImpact.overflowAmount,
        driftMultiplier: snapshot.boundaryImpact.driftMultiplier
      },
      force: snapshot.force,
      clusterForces: snapshot.galaxyTrace.forces.map((force) => ({
        clusterId: force.clusterId,
        category: force.category,
        magnitude: force.magnitude,
        trust: force.vector.values.trust,
        fear: force.vector.values.fear
      })),
      velocity: snapshot.velocity,
      coordinate: snapshot.coordinate,
      clusterMetrics: snapshot.galaxyTrace.clusterMetrics
    })),
    finalCoordinate: coordinateToRecord(result.finalState.coordinate)
  };
}

export function validateTraceReplayArtifact(value: unknown): TraceReplayValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["artifact must be an object"] };
  }
  if (value.schemaVersion !== TRACE_REPLAY_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${TRACE_REPLAY_SCHEMA_VERSION}`);
  }
  if (!isTraceReplayScenarioId(value.scenario)) {
    errors.push("scenario must be a known trace replay scenario");
  }
  if (!isRecord(value.scenarioMeta)) {
    errors.push("scenarioMeta must be an object");
  } else {
    if (typeof value.scenarioMeta.title !== "string" || !value.scenarioMeta.title) {
      errors.push("scenarioMeta.title must be a non-empty string");
    }
    if (typeof value.scenarioMeta.description !== "string" || !value.scenarioMeta.description) {
      errors.push("scenarioMeta.description must be a non-empty string");
    }
    if (!Array.isArray(value.scenarioMeta.expectedForces) || value.scenarioMeta.expectedForces.length === 0) {
      errors.push("scenarioMeta.expectedForces must be a non-empty array");
    }
  }
  if (!isRecord(value.parameters)) {
    errors.push("parameters must be an object");
  } else {
    if (!isNumber(value.parameters.daysPerStep)) errors.push("parameters.daysPerStep must be a number");
    if (!isNumber(value.parameters.learningRate)) errors.push("parameters.learningRate must be a number");
  }
  if (!isCoordinateRecord(value.initialCoordinate)) errors.push("initialCoordinate must be a coordinate record");
  if (!isCoordinateRecord(value.finalCoordinate)) errors.push("finalCoordinate must be a coordinate record");
  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    errors.push("steps must be a non-empty array");
  } else {
    value.steps.forEach((step, index) => validateStep(step, index, errors));
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function event(
  id: string,
  description: string,
  tags: string[],
  category: EventCategory
): ExperienceEvent {
  const template = eventCategoryPhysics[category];
  const weight = category === "abandonment"
    ? 0.82
    : category === "betrayal"
      ? 0.84
      : category === "support"
        ? 0.72
        : 0.68;
  return {
    id,
    description,
    tags,
    category: template.category,
    emotion: template.emotion,
    coordinateDelta: template.coordinateDelta,
    beliefEffect: template.beliefEffect,
    rationale: template.rationale,
    intensity: weight,
    importance: Math.min(1, weight + 0.08),
    relationshipWeight: tags.includes("王雪") ? 0.95 : 0.72,
    expectationGap: category === "support" || category === "success" ? 0.42 : 0.82,
    personalitySensitivity: category === "abandonment" || category === "betrayal" ? 0.9 : 0.72
  };
}

function validateStep(value: unknown, index: number, errors: string[]): void {
  const prefix = `steps[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (!isNumber(value.step)) errors.push(`${prefix}.step must be a number`);
  if (typeof value.eventId !== "string" || !value.eventId) errors.push(`${prefix}.eventId must be a non-empty string`);
  if (typeof value.category !== "string" || !value.category) errors.push(`${prefix}.category must be a non-empty string`);
  if (!isNumber(value.impactScore)) errors.push(`${prefix}.impactScore must be a number`);
  if (!isRecord(value.boundary)) {
    errors.push(`${prefix}.boundary must be an object`);
  } else {
    if (typeof value.boundary.phase !== "string") errors.push(`${prefix}.boundary.phase must be a string`);
    if (!isNumber(value.boundary.incomingStress)) errors.push(`${prefix}.boundary.incomingStress must be a number`);
    if (!isNumber(value.boundary.overflowAmount)) errors.push(`${prefix}.boundary.overflowAmount must be a number`);
    if (!isNumber(value.boundary.driftMultiplier)) errors.push(`${prefix}.boundary.driftMultiplier must be a number`);
  }
  if (!isCoordinateRecord(value.force)) errors.push(`${prefix}.force must be a coordinate record`);
  if (!isCoordinateRecord(value.velocity)) errors.push(`${prefix}.velocity must be a coordinate record`);
  if (!isCoordinateRecord(value.coordinate)) errors.push(`${prefix}.coordinate must be a coordinate record`);
  if (!Array.isArray(value.clusterForces)) {
    errors.push(`${prefix}.clusterForces must be an array`);
  } else {
    value.clusterForces.forEach((force, forceIndex) => validateClusterForce(force, `${prefix}.clusterForces[${forceIndex}]`, errors));
  }
  if (!Array.isArray(value.clusterMetrics)) {
    errors.push(`${prefix}.clusterMetrics must be an array`);
  } else {
    value.clusterMetrics.forEach((metric, metricIndex) => validateClusterMetric(metric, `${prefix}.clusterMetrics[${metricIndex}]`, errors));
  }
}

function validateClusterForce(value: unknown, prefix: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof value.clusterId !== "string") errors.push(`${prefix}.clusterId must be a string`);
  if (typeof value.category !== "string") errors.push(`${prefix}.category must be a string`);
  if (!isNumber(value.magnitude)) errors.push(`${prefix}.magnitude must be a number`);
  if (!isNumber(value.trust)) errors.push(`${prefix}.trust must be a number`);
  if (!isNumber(value.fear)) errors.push(`${prefix}.fear must be a number`);
}

function validateClusterMetric(value: unknown, prefix: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof value.clusterId !== "string") errors.push(`${prefix}.clusterId must be a string`);
  if (typeof value.category !== "string") errors.push(`${prefix}.category must be a string`);
  if (!isNumber(value.mass)) errors.push(`${prefix}.mass must be a number`);
  if (!isNumber(value.density)) errors.push(`${prefix}.density must be a number`);
  if (!isNumber(value.stability)) errors.push(`${prefix}.stability must be a number`);
  if (!isNumber(value.variance)) errors.push(`${prefix}.variance must be a number`);
}

function isTraceReplayScenarioId(value: unknown): value is TraceReplayScenarioId {
  return typeof value === "string" && value in traceReplayScenarios;
}

function isCoordinateRecord(value: unknown): value is PersonalityCoordinateValues {
  return isRecord(value) &&
    isNumber(value.openness) &&
    isNumber(value.conscientiousness) &&
    isNumber(value.extroversion) &&
    isNumber(value.agreeableness) &&
    isNumber(value.neuroticism) &&
    isNumber(value.trust) &&
    isNumber(value.attachment) &&
    isNumber(value.fear) &&
    isNumber(value.control);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
