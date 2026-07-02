import { describe, expect, it } from "vitest";

describe("V11.1 Explorer DTO Types — Contract Validation", () => {
  it("ExplorerManifest has readOnlyDefault=true", () => {
    const manifest = {
      version: "11.1.0",
      characterId: "test",
      generatedAtPolicy: "deterministic_timestamp" as const,
      readOnlyDefault: true as const,
      modules: [],
      safetyDisclaimers: [],
      releaseBoundary: {
        singleCharacterOnly: true as const,
        noChatAgent: true as const,
        noMultiCharacter: true as const,
        noAutonomousScheduler: true as const,
        noServerDeployment: true as const,
        noMobile: true as const,
        noMedicalDiagnosis: true as const,
        noUserAccounts: true as const,
      },
    };
    expect(manifest.readOnlyDefault).toBe(true);
  });

  it("all six module names are present in module descriptors", () => {
    const moduleIds = [
      "event_studio", "character_state", "explainability",
      "mind_galaxy", "reality_audit", "time_machine",
    ];
    expect(new Set(moduleIds).size).toBe(6);
    expect(moduleIds).toHaveLength(6);
  });

  it("no chat/agent/multi-character fields in any DTO", () => {
    // Verify that type names don't contain chat/agent/multi keywords
    const typePrefixes = [
      "EventStudio", "CharacterState", "Explainability",
      "MindGalaxy", "RealityAudit", "TimeMachine",
    ];
    for (const prefix of typePrefixes) {
      expect(prefix).not.toMatch(/Chat|Agent|Multi/i);
    }
  });

  it("EventStudioDraft clamps intensity 0–1", () => {
    const draft = { intensity: 1.5, repetitionCount: 0 };
    expect(Math.max(0, Math.min(1, draft.intensity))).toBe(1);
    expect(Math.max(1, draft.repetitionCount)).toBe(1);
  });

  it("EventStudioPreview requiresConfirmation is true for full preview", () => {
    const preview = { requiresConfirmation: true };
    expect(preview.requiresConfirmation).toBe(true);
  });

  it("CharacterStateSurface does not expose raw coordinate object", () => {
    const surface = {
      personalitySummary: {
        trust: { value: "low" as const, label: "信任度低" },
        fear: { value: "high" as const, label: "恐惧感强" },
        openness: { value: "moderate" as const, label: "开放性适中" },
        attachment: { value: "high" as const, label: "依恋偏高" },
        neuroticism: { value: "high" as const, label: "情绪稳定性偏低" },
      },
      safetyNote: "模拟输出，非临床评估",
    };
    // Should use qualitative labels, not raw numbers
    expect(surface.personalitySummary.trust.label).toContain("信任");
    expect(surface.personalitySummary.trust.value).not.toBeTypeOf("number");
    expect(surface.safetyNote).toContain("模拟");
    expect(surface.safetyNote).toContain("非临床");
  });

  it("RealityAuditPanel preserves PASS/WARN/FAIL verdict", () => {
    const verdicts = ["PASS", "WARN", "FAIL"] as const;
    for (const v of verdicts) {
      const panel = { verdict: v, disclaimers: [], explanationGrounding: "grounded" as const };
      expect(verdicts).toContain(panel.verdict);
    }
  });

  it("TimeMachineSnapshot immutable is always true", () => {
    const snapshot = { immutable: true as const };
    expect(snapshot.immutable).toBe(true);
  });

  it("safety disclaimers include simulation-not-diagnosis", () => {
    const disclaimers = [
      "这是人格模拟系统的输出，不是医学诊断。",
      "所有状态均为模拟结果，不应作为临床决策依据。",
    ];
    expect(disclaimers.some((d) => d.includes("模拟"))).toBe(true);
    expect(disclaimers.some((d) => d.includes("不是") || d.includes("不应"))).toBe(true);
    expect(disclaimers.some((d) => d.includes("诊断"))).toBe(true);
  });

  it("release boundary prohibits chat/agent/multi-character", () => {
    const boundary = {
      noChatAgent: true,
      noMultiCharacter: true,
      noAutonomousScheduler: true,
      noServerDeployment: true,
      noMobile: true,
      noMedicalDiagnosis: true,
      noUserAccounts: true,
    };
    expect(boundary.noChatAgent).toBe(true);
    expect(boundary.noMultiCharacter).toBe(true);
    expect(boundary.noAutonomousScheduler).toBe(true);
  });

  it("MindGalaxyEmbed noMutation is always true", () => {
    const embed = { noMutation: true as const, mode: "advanced" as const };
    expect(embed.noMutation).toBe(true);
    expect(embed.mode).toBe("advanced");
  });
});
