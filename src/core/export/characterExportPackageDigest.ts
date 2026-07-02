import { createHash } from "node:crypto";

export interface CharacterExportPackageDigest {
  algorithm: "sha256";
  canonicalization: "characteros-json-v1";
  excludedTopLevelFields: ["packageDigest"];
  value: string;
}

export type CharacterExportPackageDigestComparisonStatus = "missing" | "matched" | "mismatch";

export interface CharacterExportPackageDigestComparison {
  status: CharacterExportPackageDigestComparisonStatus;
  expected?: string;
  actual?: string;
  reasons: string[];
}

export function computeCharacterExportPackageDigest(value: unknown): CharacterExportPackageDigest {
  const canonical = stableStringify(removeTopLevelPackageDigest(value));
  return {
    algorithm: "sha256",
    canonicalization: "characteros-json-v1",
    excludedTopLevelFields: ["packageDigest"],
    value: createHash("sha256").update(canonical).digest("hex")
  };
}

export function compareCharacterExportPackageDigest(value: unknown): CharacterExportPackageDigestComparison {
  if (!isRecord(value) || !isRecord(value.packageDigest)) {
    return {
      status: "missing",
      reasons: ["package has no embedded digest"]
    };
  }
  const embedded = value.packageDigest;
  if (embedded.algorithm !== "sha256" || embedded.canonicalization !== "characteros-json-v1") {
    const expected = typeof embedded.value === "string" ? embedded.value : "";
    return {
      status: "mismatch",
      expected,
      actual: computeCharacterExportPackageDigest(value).value,
      reasons: ["package digest metadata is not supported"]
    };
  }
  const expected = typeof embedded.value === "string" ? embedded.value : "";
  const actual = computeCharacterExportPackageDigest(value).value;
  if (expected !== actual) {
    return {
      status: "mismatch",
      expected,
      actual,
      reasons: ["package digest does not match current package content"]
    };
  }
  return {
    status: "matched",
    expected,
    actual,
    reasons: ["package digest matches current package content"]
  };
}

function removeTopLevelPackageDigest(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const { packageDigest: _packageDigest, ...rest } = value;
  return rest;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
