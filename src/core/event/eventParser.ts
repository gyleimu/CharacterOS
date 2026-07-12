import {
  eventCategoryPhysics,
  type EventCategory,
  type EventCategoryPhysicsTemplate
} from "./categoryPhysics";
import { classifyEventCategory } from "./eventCategoryClassifier";
import type { ExperienceEvent } from "./event";
import { normalizeTags } from "./tagNormalization";

export interface ParseExperienceEventInput {
  description: string;
  tags?: string[];
  categoryHint?: EventCategory | "auto";
}

export interface ParsedExperienceEvent extends ExperienceEvent {
  parser: {
    source: "rule" | "llm" | "rule_fallback";
    matchedKeywords: string[];
    confidence: number;
  };
}

export function parseExperienceEvent(input: ParseExperienceEventInput): ParsedExperienceEvent {
  const tags = normalizeTags(input.tags ?? []);
  const text = `${input.description} ${tags.join(" ")}`;
  const inferred = classifyEventCategory(text, input.categoryHint);
  const template = eventCategoryPhysics[inferred.category];
  const impact = inferImpact(text, tags, inferred.category);

  return {
    id: createEventId(input.description),
    description: input.description,
    tags,
    category: template.category,
    emotion: template.emotion,
    coordinateDelta: template.coordinateDelta,
    beliefEffect: template.beliefEffect,
    rationale: template.rationale,
    intensity: impact.intensity,
    importance: impact.importance,
    relationshipWeight: impact.relationshipWeight,
    expectationGap: impact.expectationGap,
    personalitySensitivity: impact.personalitySensitivity,
    parser: {
      source: "rule",
      matchedKeywords: inferred.matchedKeywords,
      confidence: inferred.confidence
    }
  };
}

function inferImpact(text: string, tags: string[], category: EventCategory) {
  const hasRelationship = hasAny(text, tags, ["王雪", "母亲", "初恋", "亲密关系", "朋友", "家人"]);
  const hasTimeStress = hasAny(text, tags, ["三天", "深夜", "雨夜", "整晚", "突然", "连续"]);
  const hasHighThreat = hasAny(text, tags, ["失联", "抛弃", "背叛", "欺骗", "死亡", "离开"]);

  // A rule-fallback event has no evidence of psychological salience. Treat it
  // as a minor observation instead of assigning the old near-major defaults.
  // Callers can still provide an explicit category for meaningful events.
  if (category === "general") {
    return {
      intensity: hasTimeStress ? 0.16 : 0.08,
      importance: hasRelationship ? 0.2 : 0.1,
      relationshipWeight: hasRelationship ? 0.3 : 0.08,
      expectationGap: hasTimeStress ? 0.14 : 0.05,
      personalitySensitivity: 0.15,
    };
  }

  const templateWeight = categoryTemplateWeight(eventCategoryPhysics[category]);
  const intensity = clamp01(0.45 + templateWeight + (hasHighThreat ? 0.18 : 0) + (hasTimeStress ? 0.08 : 0));
  const importance = clamp01(0.5 + templateWeight + (hasRelationship ? 0.18 : 0));
  const relationshipWeight = hasRelationship ? 0.9 : 0.45;
  const expectationGap = clamp01(0.45 + (hasHighThreat ? 0.22 : 0) + (hasTimeStress ? 0.12 : 0));
  const personalitySensitivity =
    category === "abandonment" || category === "betrayal" ? 0.9 :
    category === "failure" || category === "rejection" || category === "conflict" ? 0.75 :
    category === "fatigue" || category === "uncertainty" ? 0.5 :
    0.7;

  return {
    intensity,
    importance,
    relationshipWeight,
    expectationGap,
    personalitySensitivity
  };
}

function categoryTemplateWeight(template: EventCategoryPhysicsTemplate): number {
  if (template.category === "abandonment" || template.category === "betrayal") return 0.18;
  if (template.category === "support" || template.category === "success") return 0.1;
  // V10.73: moderate-weight categories
  if (template.category === "failure" || template.category === "rejection" || template.category === "conflict") return 0.12;
  // V10.73: light-weight categories
  if (template.category === "fatigue" || template.category === "uncertainty") return 0.04;
  return 0;
}

function hasAny(text: string, tags: string[], keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword) || tags.includes(keyword));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function createEventId(description: string): string {
  let hash = 0;
  for (let index = 0; index < description.length; index += 1) {
    hash = (hash * 31 + description.charCodeAt(index)) >>> 0;
  }
  return `parsed_${hash.toString(16)}`;
}
