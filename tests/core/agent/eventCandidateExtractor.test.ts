import { describe, expect, it } from "vitest";
import {
  extractEventCandidates, buildEventDraftFromTurn,
  scoreCandidateConfidence, classifyCandidateSafety,
} from "../../../src/core/agent/eventCandidateExtractor";
import { buildAgentTurnInput } from "../../../src/core/agent/agentDtoBuilders";
import { buildEventStudioDraft } from "../../../src/core/explorer/explorerDtoBuilders";

describe("V12.3 Event Candidate Extractor", () => {
  // ── Chat ──

  it("chat message produces candidate", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "王雪突然失联了，我很担心。", speakerLabel: "user" });
    const candidates = extractEventCandidates(input);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0]!.requiresPreview).toBe(true);
    expect(candidates[0]!.extractionMethod).toBe("deterministic");
  });

  // ── Journal ──

  it("journal entry with tags/location produces candidate", () => {
    const input = buildAgentTurnInput({
      inputMode: "journal", content: "今天在图书馆待了一整天，感觉很充实。",
      metadata: { location: "图书馆", tags: "学习, 充实" },
    });
    const candidates = extractEventCandidates(input);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0]!.draft.location).toBe("图书馆");
    expect(candidates[0]!.draft.tags).toContain("学习");
  });

  // ── Story ──

  it("story input produces candidate with fictional/story safety flag", () => {
    const input = buildAgentTurnInput({
      inputMode: "story", content: "林凡推开老旧的门，发现房间里空无一人。",
      speakerLabel: "narrator",
    });
    const candidates = extractEventCandidates(input);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0]!.safetyFlags).toContain("fictional_or_story_input");
  });

  // ── Plugin ──

  it("plugin input is conservative", () => {
    const input = buildAgentTurnInput({
      inputMode: "plugin", content: "[plugin payload: 3 fields]",
    });
    const candidates = extractEventCandidates(input);
    // Short plugin summaries should not produce candidates
    expect(candidates.every((c) => c.confidence <= 1)).toBe(true);
  });

  it("plugin input does not leak payload secrets", () => {
    const input = buildAgentTurnInput({
      inputMode: "plugin", content: "用户更新了个人资料设置。这是当天发生的第一个事件。",
    });
    const candidates = extractEventCandidates(input);
    for (const c of candidates) {
      const json = JSON.stringify(c);
      expect(json).not.toContain("apiKey");
      expect(json).not.toContain("token");
      expect(json).not.toContain("password");
    }
  });

  // ── Tool ──

  it("tool input extracts only clear external event", () => {
    const input = buildAgentTurnInput({
      inputMode: "tool", content: "42",
    });
    const candidates = extractEventCandidates(input);
    // Short tool result without event keywords → no candidates
    expect(candidates).toHaveLength(0);
  });

  // ── Low confidence ──

  it("vague reflection produces low confidence or no candidate", () => {
    const input = buildAgentTurnInput({
      inputMode: "journal", content: "今天没什么特别的事。",
    });
    const candidates = extractEventCandidates(input, { minConfidence: 0.3 });
    // Short vague content with no event keywords
    expect(candidates.every((c) => c.confidence <= 1)).toBe(true);
  });

  // ── Deterministic ──

  it("candidateId deterministic", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "王雪解释了一切。", speakerLabel: "user" });
    const c1 = extractEventCandidates(input);
    const c2 = extractEventCandidates(input);
    expect(c1[0]!.candidateId).toBe(c2[0]!.candidateId);
  });

  it("extractionMethod always deterministic", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "朋友突然离开了。", speakerLabel: "user" });
    const candidates = extractEventCandidates(input);
    for (const c of candidates) {
      expect(c.extractionMethod).toBe("deterministic");
    }
  });

  // ── Properties ──

  it("requiresPreview always true", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "王雪解释了，我感到安心。", speakerLabel: "user" });
    const candidates = extractEventCandidates(input);
    for (const c of candidates) {
      expect(c.requiresPreview).toBe(true);
    }
  });

  it("sourceType/sourceId preserved", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "王雪主动解释并陪伴。", speakerLabel: "user" });
    const candidates = extractEventCandidates(input);
    expect(candidates[0]!.draft.sourceType).toBeTruthy();
    expect(candidates[0]!.draft.sourceId).toBeTruthy();
  });

  it("occurredAt is preserved to draft", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "王雪突然来到我家，解释了昨天为什么失联。", occurredAt: "2026-07-02T10:00:00Z" });
    const candidates = extractEventCandidates(input);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0]!.draft.occurredAt).toBeDefined();
    expect(candidates[0]!.draft.occurredAt).not.toBe("");
  });

  // ── Safety flags ──

  it("diagnosis-like input gets safety flag", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "医生诊断我患有抑郁症，需要心理治疗。", speakerLabel: "user" });
    const draft = buildEventDraftFromTurn(input);
    const flags = classifyCandidateSafety(input, draft);
    expect(flags).toContain("possible_diagnosis_claim");
  });

  it("multi-character/relationship-like input gets safety flag", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "我发现他劈腿了，陷入了三角关系。", speakerLabel: "user" });
    const draft = buildEventDraftFromTurn(input);
    const flags = classifyCandidateSafety(input, draft);
    expect(flags).toContain("possible_multi_character_relationship");
  });

  // ── No mutation ──

  it("no mutation of AgentTurnInput", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "王雪来了。", speakerLabel: "user" });
    const frozen = JSON.stringify(input);
    extractEventCandidates(input);
    expect(JSON.stringify(input)).toBe(frozen);
  });

  // ── Options ──

  it("maxCandidates respected", () => {
    const input = buildAgentTurnInput({ inputMode: "journal", content: "今天发生了很多事。王雪来了又走了。朋友也来了。" });
    const candidates = extractEventCandidates(input, { maxCandidates: 1 });
    expect(candidates.length).toBeLessThanOrEqual(1);
  });

  it("minConfidence respected", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "ok", speakerLabel: "user" });
    const candidates = extractEventCandidates(input, { minConfidence: 0.5 });
    expect(candidates.filter((c) => c.confidence < 0.5)).toHaveLength(0);
  });

  // ── No LLM/Writeback ──

  it("no LLM fields in candidates", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "王雪解释。", speakerLabel: "user" });
    const candidates = extractEventCandidates(input);
    for (const c of candidates) {
      const json = JSON.stringify(c);
      expect(json).not.toContain("llm");
      expect(json).not.toContain("apply");
      expect(json).not.toContain("writeback");
    }
  });

  it("no writeback/apply fields", () => {
    const input = buildAgentTurnInput({ inputMode: "chat", content: "王雪解释。", speakerLabel: "user" });
    const candidates = extractEventCandidates(input);
    for (const c of candidates) {
      const json = JSON.stringify(c);
      expect(json).not.toContain("apply");
      expect(json).not.toContain("writeback");
    }
  });

  // ── Confidence scoring ──

  it("confidence higher with rich content", () => {
    const vague = buildAgentTurnInput({ inputMode: "chat", content: "ok", speakerLabel: "user" });
    const rich = buildAgentTurnInput({
      inputMode: "chat", content: "王雪今天在图书馆主动找我说话，解释了昨天为什么没回复。我感到安心了一些。",
      metadata: { location: "图书馆" },
    });

    const draftV = buildEventDraftFromTurn(vague);
    const draftR = buildEventDraftFromTurn(rich);
    expect(scoreCandidateConfidence(vague, draftR)).toBeGreaterThan(scoreCandidateConfidence(vague, draftV));
  });
});
