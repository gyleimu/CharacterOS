import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DETERMINISTIC_TIMESTAMP } from "../deterministicHelpers";

export interface DurableStateCorruptionAuditCheck {
  readonly id: string;
  readonly description: string;
  readonly passed: boolean;
  readonly evidence: string;
}

export interface DurableStateCorruptionAuditResult {
  readonly auditVersion: "p4.1.0";
  readonly generatedAt: string;
  readonly passed: boolean;
  readonly checks: DurableStateCorruptionAuditCheck[];
  readonly failures: string[];
  readonly requiredForRelease: true;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const REPOSITORY_FILES = [
  "src/db/repositories/characterPhysicsRepository.ts",
  "src/db/repositories/parameterAdjustmentHistoryRepository.ts",
  "src/db/repositories/characterImportTransitionHistoryRepository.ts",
  "src/db/repositories/longitudinalCommitAuditRepository.ts",
] as const;

export function runDurableStateCorruptionAudit(): DurableStateCorruptionAuditResult {
  const repositorySources = REPOSITORY_FILES.map((file) => ({ file, source: readSource(file) }));
  const helperSource = readSource("src/db/repositories/jsonFileStore.ts");
  const serviceSource = readSource("src/services/characterPhysicsService.ts");
  const ensureStateSource = serviceSource.slice(
    serviceSource.indexOf("private ensureState"),
    serviceSource.indexOf("private recordImportTransition"),
  );

  const checks: DurableStateCorruptionAuditCheck[] = [
    check(
      "strict_reader_adopted",
      "Every JSON repository uses the shared strict reader.",
      repositorySources.every(({ source }) => source.includes("readJsonObjectFile")),
      `${repositorySources.filter(({ source }) => source.includes("readJsonObjectFile")).length}/${REPOSITORY_FILES.length} repositories`,
    ),
    check(
      "atomic_writer_adopted",
      "Every JSON repository uses the shared atomic writer.",
      repositorySources.every(({ source }) => source.includes("writeJsonObjectFileAtomically")),
      `${repositorySources.filter(({ source }) => source.includes("writeJsonObjectFileAtomically")).length}/${REPOSITORY_FILES.length} repositories`,
    ),
    check(
      "no_direct_parse_fallback",
      "Repositories do not parse JSON directly or catch corruption as an empty store.",
      repositorySources.every(({ source }) =>
        !source.includes("JSON.parse") && !/catch\s*(?:\([^)]*\))?\s*\{[\s\S]{0,160}?return\s+\{\}/u.test(source)
      ),
      "No direct JSON.parse or catch-return-empty pattern found.",
    ),
    check(
      "no_direct_canonical_write",
      "Repositories cannot fall back to direct canonical-file writes.",
      repositorySources.every(({ source }) =>
        !source.includes("writeFileSync") && !source.includes("renameSync") && !source.includes("unlinkSync")
      ),
      "Canonical file operations are isolated in jsonFileStore.ts.",
    ),
    check(
      "error_semantics",
      "The file layer distinguishes NOT_FOUND from CORRUPTED.",
      helperSource.includes('code: "NOT_FOUND"') && helperSource.includes('code: "CORRUPTED"'),
      "Typed read result and RepositoryFileError codes are present.",
    ),
    check(
      "synced_atomic_replace",
      "The file layer syncs temporary content and replaces by rename.",
      helperSource.includes("fsyncSync")
        && helperSource.includes("renameSync")
        && !helperSource.includes("writeFileSync(params.filePath"),
      "fsyncSync + renameSync found in shared writer.",
    ),
    check(
      "last_valid_backup",
      "The previous validated JSON document is retained as a backup snapshot.",
      helperSource.includes("getRepositoryBackupPath") && helperSource.includes("current.raw"),
      "Backup path and previous validated raw document are used.",
    ),
    check(
      "service_fail_closed",
      "Service initialization does not catch repository corruption and reset state.",
      ensureStateSource.includes("this.repository.get") && !ensureStateSource.includes("catch"),
      "ensureState only handles the repository's normal missing-record result.",
    ),
  ];
  const failures = checks
    .filter((item) => !item.passed)
    .map((item) => `${item.id}: ${item.description}`);

  return {
    auditVersion: "p4.1.0",
    generatedAt: DETERMINISTIC_TIMESTAMP,
    passed: failures.length === 0,
    checks,
    failures,
    requiredForRelease: true,
  };
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), "utf8");
}

function check(
  id: string,
  description: string,
  passed: boolean,
  evidence: string,
): DurableStateCorruptionAuditCheck {
  return { id, description, passed, evidence };
}
