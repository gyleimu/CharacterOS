import {
  eventCategoryPhysics,
  getEventCategoryPhysics,
  type EventCategory
} from "./categoryPhysics";
import {
  parseExperienceEvent,
  type ParsedExperienceEvent,
  type ParseExperienceEventInput
} from "./eventParser";
import type { LLMProvider } from "../../llm/llmProvider";
import { normalizeTags } from "./tagNormalization";

interface LLMParsedEventPayload {
  category?: EventCategory;
  emotion?: string;
  intensity?: number;
  importance?: number;
  relationshipWeight?: number;
  expectationGap?: number;
  personalitySensitivity?: number;
  beliefEffect?: string;
  rationale?: string;
  confidence?: number;
  matchedKeywords?: string[];
}

export async function parseExperienceEventWithProvider(
  input: ParseExperienceEventInput,
  provider?: LLMProvider
): Promise<ParsedExperienceEvent> {
  const fallback = parseExperienceEvent(input);
  if (!provider) return fallback;

  try {
    return normalizeLLMParsedEvent(input, fallback, await requestLLMParse(input, provider));
  } catch {
    return {
      ...fallback,
      parser: {
        ...fallback.parser,
        source: "rule_fallback"
      }
    };
  }
}

async function requestLLMParse(
  input: ParseExperienceEventInput,
  provider: LLMProvider
): Promise<LLMParsedEventPayload> {
  const content = await provider.generate(
    [
      {
        role: "system",
        content: [
          "You are the event parser for CharacterOS.",
          "Do not write fiction. Convert an event into structured character-physics fields.",
          "Return only JSON.",
          "Allowed category values: abandonment, support, betrayal, success, general.",
          "All score fields must be numbers in [0,1].",
          "Use psychologically conservative values. Personality is a slow variable."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          description: input.description,
          tags: input.tags ?? [],
          categoryHint: input.categoryHint ?? "auto",
          requiredShape: {
            category: "abandonment | support | betrayal | success | general",
            emotion: "short emotion label",
            intensity: "0..1",
            importance: "0..1",
            relationshipWeight: "0..1",
            expectationGap: "0..1",
            personalitySensitivity: "0..1",
            beliefEffect: "short Chinese belief effect",
            rationale: "short English rationale",
            confidence: "0..1",
            matchedKeywords: ["keyword"]
          }
        })
      }
    ],
    { temperature: 0, responseFormat: "json_object" }
  );

  return JSON.parse(extractJsonObject(content)) as LLMParsedEventPayload;
}

function normalizeLLMParsedEvent(
  input: ParseExperienceEventInput,
  fallback: ParsedExperienceEvent,
  payload: LLMParsedEventPayload
): ParsedExperienceEvent {
  const category = normalizeCategory(payload.category) ?? fallback.category ?? "general";
  const template = getEventCategoryPhysics(category) ?? eventCategoryPhysics.general;

  return {
    id: fallback.id,
    description: input.description,
    tags: normalizeTags(input.tags ?? []),
    category,
    emotion: normalizeEmotion(payload.emotion) ?? template.emotion,
    coordinateDelta: template.coordinateDelta,
    beliefEffect: payload.beliefEffect ?? template.beliefEffect,
    rationale: payload.rationale ?? template.rationale,
    intensity: scoreOrFallback(payload.intensity, fallback.intensity),
    importance: scoreOrFallback(payload.importance, fallback.importance),
    relationshipWeight: scoreOrFallback(payload.relationshipWeight, fallback.relationshipWeight),
    expectationGap: scoreOrFallback(payload.expectationGap, fallback.expectationGap),
    personalitySensitivity: scoreOrFallback(payload.personalitySensitivity, fallback.personalitySensitivity),
    parser: {
      source: "llm",
      matchedKeywords: Array.isArray(payload.matchedKeywords) ? payload.matchedKeywords : fallback.parser.matchedKeywords,
      confidence: scoreOrFallback(payload.confidence, fallback.parser.confidence)
    }
  };
}

function normalizeCategory(category: unknown): EventCategory | undefined {
  if (
    category === "abandonment" ||
    category === "support" ||
    category === "betrayal" ||
    category === "success" ||
    category === "general"
  ) {
    return category;
  }
  return undefined;
}

function normalizeEmotion(emotion: unknown): string | undefined {
  if (typeof emotion !== "string") return undefined;
  const normalized = emotion.trim().toLowerCase();
  if (normalized === "relieved") return "relief";
  if (normalized === "anxious") return "anxiety";
  if (normalized === "afraid") return "fear";
  if (normalized === "angry") return "anger";
  if (normalized === "happy") return "joy";
  return normalized || undefined;
}

function scoreOrFallback(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function extractJsonObject(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain a JSON object.");
  }
  return content.slice(start, end + 1);
}
