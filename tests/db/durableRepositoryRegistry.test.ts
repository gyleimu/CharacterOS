import { describe, expect, it } from "vitest";
import { DURABLE_REPOSITORY_KINDS } from "../../src/db/repositories/durableJsonEnvelope";
import {
  getDurableRepositorySpec,
  listDurableRepositorySpecs,
} from "../../src/db/repositories/durableRepositoryRegistry";

describe("Durable repository specification registry", () => {
  it("provides exactly one immutable spec for each durable repository kind", () => {
    const specs = listDurableRepositorySpecs();

    expect(specs.map((spec) => spec.repositoryKind)).toEqual(DURABLE_REPOSITORY_KINDS);
    expect(specs).toHaveLength(4);
    for (const spec of specs) {
      expect(Object.isFrozen(spec)).toBe(true);
      expect(spec.schemaVersion).toBe(1);
      expect(spec.legacySchemaVersions).toEqual([0]);
      expect(Object.isFrozen(spec.legacySchemaVersions)).toBe(true);
      expect(typeof spec.validatePayload).toBe("function");
      expect(typeof spec.inspectDomainIntegrity).toBe("function");
    }
  });

  it("returns stable spec identities without executing validation", () => {
    for (const repositoryKind of DURABLE_REPOSITORY_KINDS) {
      expect(getDurableRepositorySpec(repositoryKind)).toBe(getDurableRepositorySpec(repositoryKind));
    }
  });

  it("binds every spec to the correct validator and domain inspector", () => {
    for (const spec of listDurableRepositorySpecs()) {
      expect(spec.validatePayload({})).toEqual({ valid: true, issues: [] });
      expect(spec.inspectDomainIntegrity({})).toEqual({ valid: true, issues: [] });
    }
  });

  it("does not expose write, apply, recovery, or migration authority", () => {
    for (const spec of listDurableRepositorySpecs()) {
      expect(Object.keys(spec).sort()).toEqual([
        "inspectDomainIntegrity",
        "legacySchemaVersions",
        "repositoryKind",
        "schemaVersion",
        "validatePayload",
      ]);
      expect(spec).not.toHaveProperty("write");
      expect(spec).not.toHaveProperty("apply");
      expect(spec).not.toHaveProperty("recover");
      expect(spec).not.toHaveProperty("migrate");
    }
  });
});
