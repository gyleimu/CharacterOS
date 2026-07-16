import { createHash } from "node:crypto";

export const DURABLE_JSON_FORMAT = "characteros.durable-json" as const;
export const DURABLE_JSON_ENVELOPE_VERSION = 1 as const;
export const DURABLE_JSON_CHECKSUM_ALGORITHM = "sha256" as const;
export const DURABLE_JSON_CANONICALIZATION = "characteros-durable-json-v1" as const;

export const DURABLE_REPOSITORY_KINDS = [
  "character-physics",
  "parameter-adjustment-history",
  "character-import-transition-history",
  "longitudinal-commit-audit",
] as const;

export type DurableRepositoryKind = typeof DURABLE_REPOSITORY_KINDS[number];
export type DurableStateIncidentType =
  | "CORRUPTED"
  | "MIGRATION_REQUIRED"
  | "IO_ERROR"
  | "WRITE_VALIDATION_FAILED";

export interface DurableJsonChecksum {
  readonly algorithm: typeof DURABLE_JSON_CHECKSUM_ALGORITHM;
  readonly canonicalization: typeof DURABLE_JSON_CANONICALIZATION;
  readonly value: string;
}

export interface DurableJsonChecksumInput<T extends Record<string, unknown>> {
  readonly format: typeof DURABLE_JSON_FORMAT;
  readonly envelopeVersion: typeof DURABLE_JSON_ENVELOPE_VERSION;
  readonly repositoryKind: DurableRepositoryKind;
  readonly schemaVersion: number;
  readonly payload: T;
}

export interface DurableJsonEnvelope<T extends Record<string, unknown>>
  extends DurableJsonChecksumInput<T> {
  readonly checksum: DurableJsonChecksum;
}

export type DurableJsonDocumentResult<T extends Record<string, unknown>> =
  | {
      readonly status: "legacy-v0";
      readonly payload: T;
    }
  | {
      readonly status: "valid";
      readonly envelope: DurableJsonEnvelope<T>;
    }
  | {
      readonly status: "corrupted";
      readonly reason: string;
      readonly checksum?: {
        readonly expected: string;
        readonly actual: string;
      };
    }
  | {
      readonly status: "migration_required";
      readonly reason: string;
      readonly checksum?: {
        readonly expected: string;
        readonly actual: string;
      };
    };

const ENVELOPE_KEYS = [
  "format",
  "envelopeVersion",
  "repositoryKind",
  "schemaVersion",
  "checksum",
  "payload",
] as const;

const CHECKSUM_KEYS = ["algorithm", "canonicalization", "value"] as const;

export function buildDurableJsonChecksumInput<T extends Record<string, unknown>>(params: {
  repositoryKind: DurableRepositoryKind;
  schemaVersion: number;
  payload: T;
}): DurableJsonChecksumInput<T> {
  assertPositiveInteger(params.schemaVersion, "schemaVersion");
  return {
    format: DURABLE_JSON_FORMAT,
    envelopeVersion: DURABLE_JSON_ENVELOPE_VERSION,
    repositoryKind: params.repositoryKind,
    schemaVersion: params.schemaVersion,
    payload: params.payload,
  };
}

export function computeDurableJsonChecksum<T extends Record<string, unknown>>(
  input: DurableJsonChecksumInput<T>,
): DurableJsonChecksum {
  return {
    algorithm: DURABLE_JSON_CHECKSUM_ALGORITHM,
    canonicalization: DURABLE_JSON_CANONICALIZATION,
    value: sha256Hex(canonicalizeJson(input)),
  };
}

export function createDurableJsonEnvelope<T extends Record<string, unknown>>(params: {
  repositoryKind: DurableRepositoryKind;
  schemaVersion: number;
  payload: T;
}): DurableJsonEnvelope<T> {
  const input = buildDurableJsonChecksumInput(params);
  return {
    ...input,
    checksum: computeDurableJsonChecksum(input),
  };
}

export function serializeDurableJsonEnvelope<T extends Record<string, unknown>>(
  envelope: DurableJsonEnvelope<T>,
): string {
  return canonicalizeJson(envelope);
}

export function decodeDurableJsonDocument<T extends Record<string, unknown>>(params: {
  value: unknown;
  expectedRepositoryKind: DurableRepositoryKind;
  expectedSchemaVersion: number;
}): DurableJsonDocumentResult<T> {
  if (!isRecord(params.value)) {
    return { status: "corrupted", reason: "JSON root must be an object" };
  }

  if (!hasEnvelopeMarker(params.value)) {
    return { status: "legacy-v0", payload: params.value as T };
  }

  const unexpectedEnvelopeKeys = unexpectedKeys(params.value, ENVELOPE_KEYS);
  if (unexpectedEnvelopeKeys.length > 0) {
    return {
      status: "corrupted",
      reason: `envelope contains unsupported fields: ${unexpectedEnvelopeKeys.join(", ")}`,
    };
  }
  if (!hasExactKeys(params.value, ENVELOPE_KEYS)) {
    return { status: "corrupted", reason: "envelope is missing required fields" };
  }
  if (params.value.format !== DURABLE_JSON_FORMAT) {
    return { status: "corrupted", reason: `format must be ${DURABLE_JSON_FORMAT}` };
  }
  if (!Number.isInteger(params.value.envelopeVersion) || Number(params.value.envelopeVersion) < 1) {
    return { status: "corrupted", reason: "envelopeVersion must be a positive integer" };
  }
  if (params.value.envelopeVersion !== DURABLE_JSON_ENVELOPE_VERSION) {
    return {
      status: "migration_required",
      reason: `envelopeVersion ${String(params.value.envelopeVersion)} is not supported`,
    };
  }
  if (params.value.repositoryKind !== params.expectedRepositoryKind) {
    return {
      status: "corrupted",
      reason: `repositoryKind must be ${params.expectedRepositoryKind}`,
    };
  }
  if (!Number.isInteger(params.value.schemaVersion) || Number(params.value.schemaVersion) < 1) {
    return { status: "corrupted", reason: "schemaVersion must be a positive integer" };
  }
  if (params.value.schemaVersion !== params.expectedSchemaVersion) {
    return {
      status: "migration_required",
      reason: `schemaVersion ${String(params.value.schemaVersion)} is not supported for ${params.expectedRepositoryKind}`,
    };
  }
  if (!isRecord(params.value.payload)) {
    return { status: "corrupted", reason: "payload must be an object" };
  }
  if (!isRecord(params.value.checksum)) {
    return { status: "corrupted", reason: "checksum must be an object" };
  }

  const unexpectedChecksumKeys = unexpectedKeys(params.value.checksum, CHECKSUM_KEYS);
  if (unexpectedChecksumKeys.length > 0 || !hasExactKeys(params.value.checksum, CHECKSUM_KEYS)) {
    return { status: "corrupted", reason: "checksum fields are invalid" };
  }
  if (params.value.checksum.algorithm !== DURABLE_JSON_CHECKSUM_ALGORITHM) {
    return {
      status: "migration_required",
      reason: `checksum algorithm ${String(params.value.checksum.algorithm)} is not supported`,
    };
  }
  if (params.value.checksum.canonicalization !== DURABLE_JSON_CANONICALIZATION) {
    return {
      status: "migration_required",
      reason: `checksum canonicalization ${String(params.value.checksum.canonicalization)} is not supported`,
    };
  }
  if (typeof params.value.checksum.value !== "string" || !/^[a-f0-9]{64}$/u.test(params.value.checksum.value)) {
    return { status: "corrupted", reason: "checksum value must be a lowercase SHA-256 hex digest" };
  }

  const payload = params.value.payload as T;
  const input = buildDurableJsonChecksumInput({
    repositoryKind: params.expectedRepositoryKind,
    schemaVersion: params.expectedSchemaVersion,
    payload,
  });
  const actualChecksum = computeDurableJsonChecksum(input);
  if (params.value.checksum.value !== actualChecksum.value) {
    return {
      status: "corrupted",
      reason: "checksum does not match durable JSON content",
      checksum: {
        expected: params.value.checksum.value,
        actual: actualChecksum.value,
      },
    };
  }

  return {
    status: "valid",
    envelope: {
      ...input,
      checksum: actualChecksum,
    },
  };
}

export function canonicalizeJson(value: unknown): string {
  return canonicalize(value, new WeakSet<object>());
}

export function fingerprintDurableJsonObservation(value: string): string {
  return sha256Hex(value);
}

export function createDurableStateIncidentId(params: {
  type: DurableStateIncidentType;
  repositoryKind: DurableRepositoryKind;
  filePath: string;
  observationFingerprint: string;
}): string {
  const signature = canonicalizeJson({
    namespace: "characteros-durable-state-incident-v1",
    type: params.type,
    repositoryKind: params.repositoryKind,
    storageIdentity: sha256Hex(params.filePath),
    observationFingerprint: params.observationFingerprint,
  });
  return `dstate-${params.repositoryKind}-${sha256Hex(signature).slice(0, 16)}`;
}

function canonicalize(value: unknown, ancestors: WeakSet<object>): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON numbers must be finite");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`canonical JSON does not support ${typeof value}`);
  }
  if (ancestors.has(value)) throw new TypeError("canonical JSON does not support circular references");

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalize(item, ancestors)).join(",")}]`;
    }
    if (!isPlainRecord(value)) {
      throw new TypeError("canonical JSON only supports plain objects and arrays");
    }
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], ancestors)}`);
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hasEnvelopeMarker(value: Record<string, unknown>): boolean {
  return ENVELOPE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function unexpectedKeys(value: Record<string, unknown>, expected: readonly string[]): string[] {
  const expectedSet = new Set(expected);
  return Object.keys(value).filter((key) => !expectedSet.has(key));
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}
