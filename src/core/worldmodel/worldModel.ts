import type { BeliefState } from "../belief/beliefState";
import type { PsychologicalBoundary } from "../boundary/psychologicalBoundary";
import type { EmotionState } from "../emotion/emotion";
import type { ExperienceEvent } from "../event/event";
import type { MetaState } from "../meta/metaState";
import { clamp01 } from "../parameters/parameterMath";
import type { PersonalityCoordinate } from "../personality/coordinate";
import type { TimePerceptionTrace } from "../time/timePerception";

export type InterpretationFrame = "threat" | "repair" | "rejection" | "opportunity" | "unknown";

export interface WorldModelInterpretation {
  frame: InterpretationFrame;
  subjectiveReality: string;
  confidence: number;
  distortionLevel: number;
  threatBias: number;
  trustBias: number;
  ambiguity: number;
  evidence: string[];
  alternatives: string[];
}

export function interpretEvent(params: {
  event: ExperienceEvent;
  emotion: EmotionState;
  beliefs: BeliefState[];
  coordinate: PersonalityCoordinate;
  meta: MetaState;
  boundary: PsychologicalBoundary;
  timePerception: TimePerceptionTrace;
}): WorldModelInterpretation {
  const tags = new Set(params.event.tags);
  const beliefPressure = params.beliefs.slice(0, 3).reduce((sum, belief) => {
    return sum + belief.strength * beliefMatchPressure(belief.content);
  }, 0);
  const boundaryPressure = params.boundary.capacity <= 0
    ? 1
    : clamp01(params.boundary.stressLoad / params.boundary.capacity);
  const threatBias = clamp01(
    params.coordinate.values.fear * 0.26 +
    (1 - params.coordinate.values.trust) * 0.22 +
    params.meta.traumaAmplification * 0.18 +
    params.meta.emotionalSensitivity * 0.14 +
    boundaryPressure * 0.12 +
    beliefPressure * 0.08
  );
  const trustBias = clamp01(
    params.coordinate.values.trust * 0.34 +
    params.coordinate.values.agreeableness * 0.16 +
    params.meta.resilience * 0.16 +
    (tags.has("陪伴") || tags.has("解释") ? 0.24 : 0)
  );
  const ambiguity = clamp01(
    params.event.expectationGap * 0.28 +
    params.timePerception.multiplier * 0.12 +
    (params.event.rationale ? 0 : 0.18) +
    (tags.has("失联") || tags.has("等待") ? 0.18 : 0)
  );
  const frame = chooseFrame({
    tags,
    emotion: params.emotion,
    threatBias,
    trustBias,
    ambiguity
  });
  const distortionLevel = clamp01(
    threatBias * 0.42 +
    ambiguity * 0.26 +
    params.timePerception.distressLoad * 0.18 -
    trustBias * 0.16
  );
  const confidence = clamp01(0.42 + Math.abs(threatBias - trustBias) * 0.34 + (1 - ambiguity) * 0.18);

  return {
    frame,
    subjectiveReality: renderSubjectiveReality(frame, params.event.description),
    confidence,
    distortionLevel,
    threatBias,
    trustBias,
    ambiguity,
    evidence: buildEvidence({ tags, threatBias, trustBias, ambiguity, beliefs: params.beliefs, timePerception: params.timePerception }),
    alternatives: buildAlternatives(frame)
  };
}

function chooseFrame(params: {
  tags: Set<string>;
  emotion: EmotionState;
  threatBias: number;
  trustBias: number;
  ambiguity: number;
}): InterpretationFrame {
  if (params.tags.has("陪伴") || params.tags.has("解释")) {
    return params.trustBias >= params.threatBias * 0.75 ? "repair" : "unknown";
  }
  if (params.tags.has("认可") || params.tags.has("成功") || params.emotion.primary === "joy") {
    return "opportunity";
  }
  if (params.tags.has("失联") || params.tags.has("抛弃") || params.tags.has("等待")) {
    return params.threatBias >= 0.48 ? "rejection" : "unknown";
  }
  if (params.threatBias > params.trustBias + 0.18) return "threat";
  if (params.ambiguity >= 0.56) return "unknown";
  return "opportunity";
}

function renderSubjectiveReality(frame: InterpretationFrame, description: string): string {
  if (frame === "rejection") {
    return `主观现实：这件事像是“又一次被放在原地等待”。客观事件是：${description}`;
  }
  if (frame === "threat") {
    return `主观现实：这件事首先被理解为关系风险或自我保护信号。客观事件是：${description}`;
  }
  if (frame === "repair") {
    return `主观现实：这件事可能是关系修复的证据，但仍需要观察是否稳定。客观事件是：${description}`;
  }
  if (frame === "opportunity") {
    return `主观现实：这件事被理解为一种靠近、成长或获得掌控感的机会。客观事件是：${description}`;
  }
  return `主观现实：这件事暂时无法被确定解释，只能保持观察。客观事件是：${description}`;
}

function buildEvidence(params: {
  tags: Set<string>;
  threatBias: number;
  trustBias: number;
  ambiguity: number;
  beliefs: BeliefState[];
  timePerception: TimePerceptionTrace;
}): string[] {
  const evidence: string[] = [];
  if (params.tags.has("失联") || params.tags.has("等待")) evidence.push("事件标签包含失联/等待。");
  if (params.tags.has("陪伴") || params.tags.has("解释")) evidence.push("事件标签包含解释/陪伴。");
  if (params.threatBias >= 0.5) evidence.push("威胁偏置较高。");
  if (params.trustBias >= 0.5) evidence.push("信任偏置较高。");
  if (params.ambiguity >= 0.5) evidence.push("事件存在较高解释歧义。");
  if (params.timePerception.mode === "stretched" || params.timePerception.mode === "frozen") {
    evidence.push("主观时间被拉长，事件心理重量上升。");
  }
  const belief = params.beliefs[0];
  if (belief) evidence.push(`当前主导信念：“${belief.content}”。`);
  if (!evidence.length) evidence.push("没有强解释证据，维持低置信度观察。");
  return evidence;
}

function buildAlternatives(frame: InterpretationFrame): string[] {
  const alternatives: Record<InterpretationFrame, string[]> = {
    rejection: ["对方可能并非故意离开", "失联可能有外部原因", "关系仍可能修复"],
    threat: ["威胁可能被旧记忆放大", "当前证据可能不足以证明危险"],
    repair: ["解释可能只是短期安抚", "修复需要重复稳定证据"],
    opportunity: ["积极解释可能忽略了潜在风险", "成功感可能只是短期奖励"],
    unknown: ["需要更多证据", "需要等待后续行为验证"]
  };
  return alternatives[frame];
}

function beliefMatchPressure(content: string): number {
  if (content.includes("离开") || content.includes("抛下") || content.includes("不可靠")) return 1;
  if (content.includes("靠近") || content.includes("真正")) return 0.45;
  return 0.2;
}
