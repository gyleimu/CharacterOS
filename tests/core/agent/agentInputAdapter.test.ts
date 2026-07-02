import { describe, expect, it } from "vitest";
import {
  normalizeAgentInput, detectAgentInputMode, sanitizeAgentInputContent,
  buildAgentInputSourceRef, validateAgentTurnInput,
} from "../../../src/core/agent/agentInputAdapter";
import { buildAgentSessionConfig, buildAgentTurnInput } from "../../../src/core/agent/agentDtoBuilders";
import type { RawAgentInput } from "../../../src/core/agent/agentTypes";

const session = buildAgentSessionConfig({ sessionId: "test_session" });

// ── Input mode detection ──

it("detects chat input", () => {
  expect(detectAgentInputMode({ type: "chat", message: "你好" })).toBe("chat");
});
it("detects journal input", () => {
  expect(detectAgentInputMode({ type: "journal", entry: "今天..." })).toBe("journal");
});
it("detects story input", () => {
  expect(detectAgentInputMode({ type: "story", sceneText: "他推开门..." })).toBe("story");
});
it("detects plugin input", () => {
  expect(detectAgentInputMode({ type: "plugin", pluginId: "p1", payload: {} })).toBe("plugin");
});
it("detects tool input", () => {
  expect(detectAgentInputMode({ type: "tool", toolName: "calc", result: "42" })).toBe("tool");
});

// ── Normalization ──

describe("V12.2 Agent Input Adapter", () => {
  it("normalizes chat input to AgentTurnInput", () => {
    const result = normalizeAgentInput(session, { type: "chat", message: "你好，最近怎么样？" });
    expect(result.turnId).toMatch(/^turn_/);
    expect(result.content).toBe("你好，最近怎么样？");
    expect(result.inputMode).toBe("chat");
    expect(result.speakerLabel).toBe("unknown");
    expect(result.consentForWriteback).toBe(false);
  });

  it("normalizes journal input to AgentTurnInput", () => {
    const result = normalizeAgentInput(session, {
      type: "journal", entry: "今天心情不太好。", occurredAt: "2026-07-01", mood: "低落",
    });
    expect(result.content).toBe("今天心情不太好。");
    expect(result.inputMode).toBe("chat"); // session default
    expect(result.metadata.mood).toBe("低落");
  });

  it("normalizes story input to AgentTurnInput", () => {
    const result = normalizeAgentInput(session, {
      type: "story", sceneText: "林凡推开门，看到王雪站在雨中。", chapterId: "ch3",
    });
    expect(result.content).toContain("林凡");
    expect(result.speakerLabel).toBe("narrator");
  });

  it("normalizes plugin input to AgentTurnInput", () => {
    const result = normalizeAgentInput(session, {
      type: "plugin", pluginId: "weather", payload: { temp: 25, desc: "晴" },
    });
    expect(result.content).toContain("[plugin payload");
    expect(result.speakerLabel).toBe("plugin:weather");
  });

  it("normalizes tool input to AgentTurnInput", () => {
    const result = normalizeAgentInput(session, {
      type: "tool", toolName: "calculator", result: "42",
    });
    expect(result.content).toBe("42");
    expect(result.speakerLabel).toBe("tool:calculator");
  });

  // ── Deterministic turnId ──

  it("deterministic turnId", () => {
    const r1 = normalizeAgentInput(session, { type: "chat", message: "你好" });
    const r2 = normalizeAgentInput(session, { type: "chat", message: "你好" });
    expect(r1.turnId).toBe(r2.turnId);
  });

  it("different input different turnId", () => {
    const r1 = normalizeAgentInput(session, { type: "chat", message: "你好" });
    const r2 = normalizeAgentInput(session, { type: "chat", message: "再见" });
    expect(r1.turnId).not.toBe(r2.turnId);
  });

  // ── Sanitization ──

  it("trims whitespace", () => {
    const result = sanitizeAgentInputContent("  你好  \n  ");
    expect(result).toBe("你好");
  });

  it("removes control chars", () => {
    const result = sanitizeAgentInputContent("你好\x00\x01世界");
    expect(result).toBe("你好世界");
  });

  it("preserves Chinese content", () => {
    const result = sanitizeAgentInputContent("你好，今天天气真好！我在思考人生的意义。");
    expect(result).toContain("你好");
    expect(result).toContain("人生");
    expect(result).toContain("！");
  });

  it("caps long content and warns", () => {
    const long = "测".repeat(9000);
    const result = sanitizeAgentInputContent(long);
    expect(result.length).toBeLessThanOrEqual(8100);
  });

  // ── Metadata ──

  it("unsafe metadata redacted", () => {
    const result = normalizeAgentInput(session, {
      type: "chat", message: "测试",
      metadata: { apiKey: "secret123", source: "web" },
    });
    expect(result.metadata.apiKey).toBe("[REDACTED]");
    expect(result.metadata.source).toBe("web");
  });

  it("plugin object payload does not leak secrets", () => {
    const result = normalizeAgentInput(session, {
      type: "plugin", pluginId: "auth", payload: { token: "abc", user: "test" },
    });
    // Payload is summarized, not leaked
    expect(result.content).not.toContain("abc");
    expect(result.content).toContain("[plugin payload");
  });

  // ── Validation ──

  it("validation catches empty content", () => {
    const input = buildAgentTurnInput({ content: "" });
    const validation = validateAgentTurnInput(input);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("为空"))).toBe(true);
  });

  it("validation warns on truncated content", () => {
    const input = buildAgentTurnInput({ content: "x".repeat(8000) });
    const validation = validateAgentTurnInput(input);
    expect(validation.valid).toBe(true);
    expect(validation.warnings.some((w) => w.includes("截断"))).toBe(true);
  });

  // ── Safety ──

  it("default consentForWriteback=false", () => {
    const result = normalizeAgentInput(session, { type: "chat", message: "测试" });
    expect(result.consentForWriteback).toBe(false);
  });

  it("no LLM/chat-agent mutation fields", () => {
    const result = normalizeAgentInput(session, { type: "chat", message: "测试" });
    const json = JSON.stringify(result);
    expect(json).not.toContain("llmResponse");
    expect(json).not.toContain("chatCompletion");
    expect(json).not.toContain("agentMutation");
  });

  it("no multi-character relationship fields", () => {
    const result = normalizeAgentInput(session, { type: "chat", message: "测试" });
    const json = JSON.stringify(result);
    expect(json).not.toContain("relationshipType");
    expect(json).not.toContain("partnerId");
  });

  // ── Source ref ──

  it("sourceRef deterministic from content", () => {
    const ref1 = buildAgentInputSourceRef({ type: "chat", message: "测试" });
    const ref2 = buildAgentInputSourceRef({ type: "chat", message: "测试" });
    expect(ref1).toBe(ref2);
  });

  it("does not mutate raw input", () => {
    const raw: RawAgentInput = { type: "chat", message: "你好" };
    const frozen = JSON.stringify(raw);
    normalizeAgentInput(session, raw);
    expect(JSON.stringify(raw)).toBe(frozen);
  });
});
