import { describe, expect, it } from "vitest";
import { createCharacterStateFromBlueprint, createLinFanBlueprint } from "../../src/core/character/characterBlueprint";
import { inspectCharacterStateIntegrity } from "../../src/core/state/stateIntegrity";

describe("character state integrity", () => {
  it("accepts a seeded Lin Fan state", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true
    });

    const report = inspectCharacterStateIntegrity(state);

    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
    expect(report.summary.memoryCount).toBe(3);
    expect(report.summary.clusterCount).toBe(2);
  });

  it("detects broken memory, cluster and belief references", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint(), {
      seedInitialExperiences: true
    });
    state.memories[0] = {
      ...state.memories[0]!,
      clusterId: "cluster_missing"
    };
    state.clusters.get("abandonment")?.particleIds.push("particle_missing");
    state.beliefStates[0] = {
      ...state.beliefStates[0]!,
      sourceMemoryIds: [...state.beliefStates[0]!.sourceMemoryIds, "memory_missing"]
    };

    const report = inspectCharacterStateIntegrity(state);

    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.message)).toContain("memory references missing cluster: cluster_missing");
    expect(report.issues.map((issue) => issue.message)).toContain("cluster references missing particle: particle_missing");
    expect(report.issues.map((issue) => issue.message)).toContain("belief references missing memory: memory_missing");
  });

  it("detects invalid scalar and identity values", () => {
    const state = createCharacterStateFromBlueprint(createLinFanBlueprint());
    state.identity = { ...state.identity, name: "" };
    state.learningRate = 2;
    state.proceduralRoutines[0] = {
      ...state.proceduralRoutines[0]!,
      cueTags: [],
      strength: 1.4
    };

    const report = inspectCharacterStateIntegrity(state);

    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.path)).toContain("identity.name");
    expect(report.issues.map((issue) => issue.path)).toContain("learningRate");
    expect(report.issues.map((issue) => issue.path)).toContain("proceduralRoutines[0].strength");
    expect(report.issues.find((issue) => issue.path === "proceduralRoutines[0].cueTags")?.severity).toBe("warning");
  });
});
