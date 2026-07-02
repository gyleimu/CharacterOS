/**
 * V12.3 — Event Candidate Extractor
 *
 * Converts AgentTurnInput into EventStudioDraft candidates.
 * Deterministic-first. No LLM. No writeback. No policy decision.
 */
import { buildEventStudioDraft } from "../explorer/explorerDtoBuilders";
import { buildAgentEventCandidateFromDraft } from "./agentDtoBuilders";
import type { AgentTurnInput, AgentEventCandidate, ExtractionMethod } from "./agentTypes";

export interface ExtractionOptions {
  maxCandidates?: number;
  minConfidence?: number;
  mode?: "conservative" | "normal" | "broad";
  locale?: string;
}

// ── Main entry ──

export function extractEventCandidates(
  input: AgentTurnInput,
  options: ExtractionOptions = {},
): AgentEventCandidate[] {
  const maxCandidates = options.maxCandidates ?? 3;
  const minConfidence = options.minConfidence ?? 0.3;
  const mode = options.mode ?? "normal";

  const drafts = buildEventDraftsFromTurn(input, mode);

  return drafts
    .map((draft) => {
      const confidence = scoreCandidateConfidence(input, draft);
      const safetyFlags = classifyCandidateSafety(input, draft);

      const candidate = buildAgentEventCandidateFromDraft({
        draft,
        extractionMethod: "deterministic",
        confidence: Math.max(0, Math.min(1, confidence)),
      });

      candidate.safetyFlags.push(...safetyFlags);
      return candidate;
    })
    .filter((c) => c.confidence >= minConfidence)
    .slice(0, maxCandidates);
}

// ── Draft builder ──

function buildEventDraftsFromTurn(
  input: AgentTurnInput,
  _mode: ExtractionOptions["mode"],
): ReturnType<typeof buildEventStudioDraft>[] {
  const drafts: ReturnType<typeof buildEventStudioDraft>[] = [];

  switch (input.inputMode) {
    case "chat": {
      if (hasEventSignal(input.content)) {
        drafts.push(buildEventDraftFromTurn(input, {}));
      }
      break;
    }
    case "journal": {
      drafts.push(buildEventDraftFromTurn(input, { sourceType: "user_input" }));
      break;
    }
    case "story": {
      drafts.push(buildEventDraftFromTurn(input, { sourceType: "import" }));
      break;
    }
    case "plugin":
    case "tool": {
      // Conservative: only extract if content clearly describes event
      if (input.content.length > 20 && hasEventSignal(input.content)) {
        drafts.push(buildEventDraftFromTurn(input, { sourceType: "script" }));
      }
      break;
    }
  }

  return drafts;
}

// ── Single draft from turn ──

export function buildEventDraftFromTurn(
  input: AgentTurnInput,
  hints: { sourceType?: string } = {},
): ReturnType<typeof buildEventStudioDraft> {
  const intensity = estimateIntensity(input.content);
  const tags = extractTags(input);
  const people = input.speakerLabel && input.speakerLabel !== "unknown" && input.speakerLabel !== "self"
    ? [input.speakerLabel]
    : [];

  return buildEventStudioDraft({
    naturalLanguageInput: input.content,
    occurredAt: input.occurredAt,
    location: input.metadata.location ?? "",
    people,
    intensity,
    repetitionCount: 1,
    sourceType: (hints.sourceType as "user_input" | "import" | "script") ?? mapSourceType(input.inputMode),
    sourceId: `${input.turnId}_draft`,
    tags,
    status: "draft",
  });
}

// ── Confidence scoring ──

export function scoreCandidateConfidence(
  _input: AgentTurnInput,
  draft: ReturnType<typeof buildEventStudioDraft>,
): number {
  let score = 0.5;

  // Content length
  if (draft.naturalLanguageInput.length > 50) score += 0.15;
  else if (draft.naturalLanguageInput.length < 10) score -= 0.2;

  // Location present
  if (draft.location) score += 0.1;

  // People present
  if (draft.people && draft.people.length > 0) score += 0.1;

  // Time present
  if (draft.occurredAt && draft.occurredAt !== "unknown") score += 0.05;

  // Emotion keywords
  if (hasEmotionKeywords(draft.naturalLanguageInput)) score += 0.1;

  return Math.max(0, Math.min(1, score));
}

// ── Safety classification ──

export function classifyCandidateSafety(
  input: AgentTurnInput,
  draft: ReturnType<typeof buildEventStudioDraft>,
): string[] {
  const flags: string[] = [];

  // Story/fictional
  if (input.inputMode === "story") {
    flags.push("fictional_or_story_input");
  }

  // Plugin/tool
  if (input.inputMode === "plugin" || input.inputMode === "tool") {
    flags.push("plugin_or_tool_input");
  }

  // Low confidence
  const confidence = scoreCandidateConfidence(input, draft);
  if (confidence < 0.4) {
    flags.push("low_confidence");
  }

  // Diagnosis language
  if (hasDiagnosisPattern(draft.naturalLanguageInput)) {
    flags.push("possible_diagnosis_claim");
  }

  // Multi-character relationship
  if (hasMultiCharPattern(draft.naturalLanguageInput)) {
    flags.push("possible_multi_character_relationship");
  }

  // Sensitive data
  if (hasSensitivePattern(draft.naturalLanguageInput)) {
    flags.push("sensitive_personal_data");
  }

  // Consent absent
  if (!input.consentForWriteback) {
    flags.push("requires_user_confirmation");
  }

  return flags;
}

// ── Helpers ──

const EVENT_KEYWORDS = ["发生", "说", "问", "告诉", "来到", "离开", "回复", "解释", "陪伴", "失联", "等待", "抛弃", "背叛", "成功", "失败", "拒绝", "冲突", "支持", "改变", "发现", "感到", "决定", "终于", "突然", "开始", "结束"];

function hasEventSignal(content: string): boolean {
  return content.length > 5 && EVENT_KEYWORDS.some((kw) => content.includes(kw));
}

const EMOTION_KEYWORDS = ["开心", "难过", "焦虑", "愤怒", "害怕", "紧张", "兴奋", "失望", "感动", "担忧", "烦恼", "生气"];

function hasEmotionKeywords(content: string): boolean {
  return EMOTION_KEYWORDS.some((kw) => content.includes(kw));
}

function estimateIntensity(content: string): number {
  let score = 0.3;
  if (content.length > 80) score += 0.15;
  if (hasEmotionKeywords(content)) score += 0.2;
  // High-intensity words
  const hiWords = ["极度", "崩溃", "吐血", "绝望", "恐惧", "背叛", "抛弃", "死亡"];
  if (hiWords.some((w) => content.includes(w))) score += 0.25;
  return Math.min(1, Math.max(0.1, score));
}

function extractTags(input: AgentTurnInput): string[] {
  const tags: string[] = [];
  if (input.metadata.tags) {
    tags.push(...input.metadata.tags.split(",").map((t) => t.trim()).filter(Boolean));
  }
  if (input.inputMode === "story") tags.push("故事");
  if (input.inputMode === "journal") tags.push("日记");
  return tags.slice(0, 8);
}

function mapSourceType(inputMode: AgentTurnInput["inputMode"]): "user_input" | "import" | "script" {
  switch (inputMode) {
    case "chat": case "journal": return "user_input";
    case "story": return "import";
    case "plugin": case "tool": return "script";
  }
}

const DIAGNOSIS_PATTERNS = ["诊断", "确诊", "症状", "治疗", "药物", "处方", "病历", "医嘱", "精神科", "心理治疗", "临床", "障碍", "抑郁", "焦虑症", "妄想"];
const MULTI_CHAR_PATTERNS = ["三角关系", "出轨", "第三者", "劈腿", "同时交往"];
const SENSITIVE_PATTERNS = ["身份证", "银行卡号", "密码", "家庭住址", "电话号码\\d{7,}"];

function hasDiagnosisPattern(content: string): boolean {
  return DIAGNOSIS_PATTERNS.some((p) => content.includes(p));
}
function hasMultiCharPattern(content: string): boolean {
  return MULTI_CHAR_PATTERNS.some((p) => content.includes(p));
}
function hasSensitivePattern(content: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => new RegExp(p).test(content));
}
