import { describe, expect, it } from "vitest";
import {
  DURABLE_JSON_CANONICALIZATION,
  DURABLE_JSON_CHECKSUM_ALGORITHM,
  DURABLE_JSON_ENVELOPE_VERSION,
  DURABLE_JSON_FORMAT,
  buildDurableJsonChecksumInput,
  canonicalizeJson,
  computeDurableJsonChecksum,
  createDurableJsonEnvelope,
  createDurableStateIncidentId,
  decodeDurableJsonDocument,
  fingerprintDurableJsonObservation,
  serializeDurableJsonEnvelope,
} from "../../src/db/repositories/durableJsonEnvelope";

const REPOSITORY_KIND = "character-physics" as const;
const SCHEMA_VERSION = 1;

describe("Durable JSON Envelope", () => {
  it("uses exactly the five approved checksum input fields", () => {
    const input = buildDurableJsonChecksumInput({
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      payload: { value: 1 },
    });

    expect(Object.keys(input).sort()).toEqual([
      "envelopeVersion",
      "format",
      "payload",
      "repositoryKind",
      "schemaVersion",
    ]);
    expect(input).toEqual({
      format: DURABLE_JSON_FORMAT,
      envelopeVersion: DURABLE_JSON_ENVELOPE_VERSION,
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      payload: { value: 1 },
    });
    expect(input).not.toHaveProperty("checksum");
  });

  it("serializes semantically identical payloads deterministically", () => {
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };

    expect(canonicalizeJson(a)).toBe(canonicalizeJson(b));

    const inputA = buildDurableJsonChecksumInput({
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      payload: a,
    });
    const inputB = buildDurableJsonChecksumInput({
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      payload: b,
    });
    expect(computeDurableJsonChecksum(inputA)).toEqual(computeDurableJsonChecksum(inputB));
    expect(serializeDurableJsonEnvelope(createDurableJsonEnvelope({
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      payload: a,
    }))).toBe(serializeDurableJsonEnvelope(createDurableJsonEnvelope({
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      payload: b,
    })));
  });

  it("canonicalizes nested object key order while preserving array order", () => {
    const a = { state: { trust: 0.4, fear: 0.6 }, events: ["a", "b"] };
    const b = { events: ["a", "b"], state: { fear: 0.6, trust: 0.4 } };
    const reorderedArray = { state: { fear: 0.6, trust: 0.4 }, events: ["b", "a"] };

    expect(canonicalizeJson(a)).toBe(canonicalizeJson(b));
    expect(canonicalizeJson(a)).not.toBe(canonicalizeJson(reorderedArray));
  });

  it("creates and decodes a checksum-verified envelope", () => {
    const envelope = createDurableJsonEnvelope({
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      payload: { lin_fan: { trust: 0.4 } },
    });

    expect(envelope.checksum.algorithm).toBe(DURABLE_JSON_CHECKSUM_ALGORITHM);
    expect(envelope.checksum.canonicalization).toBe(DURABLE_JSON_CANONICALIZATION);
    expect(decodeDurableJsonDocument({
      value: envelope,
      expectedRepositoryKind: REPOSITORY_KIND,
      expectedSchemaVersion: SCHEMA_VERSION,
    })).toEqual({ status: "valid", envelope });
  });

  it("classifies a checksum mismatch as corrupted", () => {
    const envelope = createDurableJsonEnvelope({
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      payload: { value: 1 },
    });
    const tampered = { ...envelope, payload: { value: 2 } };

    const result = decodeDurableJsonDocument({
      value: tampered,
      expectedRepositoryKind: REPOSITORY_KIND,
      expectedSchemaVersion: SCHEMA_VERSION,
    });
    expect(result.status).toBe("corrupted");
    if (result.status === "corrupted") {
      expect(result.reason).toContain("checksum");
      expect(result.checksum?.expected).toBe(envelope.checksum.value);
      expect(result.checksum?.actual).not.toBe(envelope.checksum.value);
    }
  });

  it("rejects a repository-kind mismatch without legacy downgrade", () => {
    const envelope = createDurableJsonEnvelope({
      repositoryKind: "parameter-adjustment-history",
      schemaVersion: SCHEMA_VERSION,
      payload: { lin_fan: [] },
    });
    const result = decodeDurableJsonDocument({
      value: envelope,
      expectedRepositoryKind: REPOSITORY_KIND,
      expectedSchemaVersion: SCHEMA_VERSION,
    });

    expect(result.status).toBe("corrupted");
  });

  it("requires migration for unsupported envelope, schema, and checksum versions", () => {
    const envelope = createDurableJsonEnvelope({
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: SCHEMA_VERSION,
      payload: { value: 1 },
    });
    const unsupportedEnvelope = { ...envelope, envelopeVersion: 2 };
    const unsupportedSchema = createDurableJsonEnvelope({
      repositoryKind: REPOSITORY_KIND,
      schemaVersion: 2,
      payload: { value: 1 },
    });
    const unsupportedChecksum = {
      ...envelope,
      checksum: { ...envelope.checksum, canonicalization: "future-canonical-json" },
    };

    for (const value of [unsupportedEnvelope, unsupportedSchema, unsupportedChecksum]) {
      expect(decodeDurableJsonDocument({
        value,
        expectedRepositoryKind: REPOSITORY_KIND,
        expectedSchemaVersion: SCHEMA_VERSION,
      }).status).toBe("migration_required");
    }
  });

  it("treats bare objects as legacy-v0 and malformed envelope markers as corrupted", () => {
    expect(decodeDurableJsonDocument({
      value: { lin_fan: { value: 1 } },
      expectedRepositoryKind: REPOSITORY_KIND,
      expectedSchemaVersion: SCHEMA_VERSION,
    }).status).toBe("legacy-v0");

    expect(decodeDurableJsonDocument({
      value: { format: DURABLE_JSON_FORMAT, payload: {} },
      expectedRepositoryKind: REPOSITORY_KIND,
      expectedSchemaVersion: SCHEMA_VERSION,
    }).status).toBe("corrupted");
  });

  it("builds stable incident ids for the same observed fault", () => {
    const params = {
      type: "CORRUPTED" as const,
      repositoryKind: REPOSITORY_KIND,
      filePath: "C:/data/physics_states.json",
      observationFingerprint: fingerprintDurableJsonObservation("{ broken"),
    };

    expect(createDurableStateIncidentId(params)).toBe(createDurableStateIncidentId(params));
    expect(createDurableStateIncidentId(params)).not.toBe(createDurableStateIncidentId({
      ...params,
      observationFingerprint: fingerprintDurableJsonObservation("{ differently broken"),
    }));
  });

  it("rejects non-JSON values instead of silently changing them", () => {
    expect(() => canonicalizeJson({ value: undefined })).toThrow(/does not support/u);
    expect(() => canonicalizeJson({ value: Number.NaN })).toThrow(/finite/u);
  });
});
