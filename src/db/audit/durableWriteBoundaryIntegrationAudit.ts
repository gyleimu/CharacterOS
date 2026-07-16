import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import type {
  DurableRepositoryKind,
} from "../repositories/durableJsonEnvelope";
import type {
  RepositoryPersistenceIntent,
} from "../repositories/jsonFileStore";

export interface DurableWriteBoundaryAuditCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly evidence: string;
}

export interface DurableWriteEntrypointAudit {
  readonly repositoryKind: DurableRepositoryKind;
  readonly method: string;
  readonly expectedIntent: RepositoryPersistenceIntent;
  readonly lockOwned: boolean;
  readonly intentMarked: boolean;
  readonly boundaryRouted: boolean;
  readonly passed: boolean;
}

export interface DurableWriteBypassFinding {
  readonly filePath: string;
  readonly line: number;
  readonly callName: string;
}

export interface DurableWriteBypassScanResult {
  readonly bypassFindings: readonly DurableWriteBypassFinding[];
  readonly approvedFilesystemSites: number;
}

export interface DurableWriteBoundaryIntegrationAuditResult {
  readonly auditVersion: "p4.1.5-b2-2c";
  readonly passed: boolean;
  readonly checks: readonly DurableWriteBoundaryAuditCheck[];
  readonly repositoryEntrypoints: readonly DurableWriteEntrypointAudit[];
  readonly bypassFindings: readonly DurableWriteBypassFinding[];
  readonly approvedFilesystemMutationSites: number;
  readonly requiredForRelease: true;
}

interface RepositoryAuditDefinition {
  readonly repositoryKind: DurableRepositoryKind;
  readonly filePath: string;
  readonly className: string;
  readonly entrypoints: readonly {
    readonly method: string;
    readonly intent: RepositoryPersistenceIntent;
  }[];
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const REPOSITORIES: readonly RepositoryAuditDefinition[] = [
  {
    repositoryKind: "character-physics",
    filePath: "src/db/repositories/characterPhysicsRepository.ts",
    className: "FileCharacterPhysicsRepository",
    entrypoints: [
      { method: "set", intent: "validated-write" },
      { method: "update", intent: "validated-write" },
      { method: "delete", intent: "destructive-delete" },
      { method: "clear", intent: "destructive-clear" },
    ],
  },
  {
    repositoryKind: "parameter-adjustment-history",
    filePath: "src/db/repositories/parameterAdjustmentHistoryRepository.ts",
    className: "FileParameterAdjustmentHistoryRepository",
    entrypoints: [
      { method: "append", intent: "validated-write" },
      { method: "replace", intent: "validated-write" },
      { method: "clear", intent: "destructive-clear" },
    ],
  },
  {
    repositoryKind: "character-import-transition-history",
    filePath: "src/db/repositories/characterImportTransitionHistoryRepository.ts",
    className: "FileCharacterImportTransitionHistoryRepository",
    entrypoints: [
      { method: "append", intent: "validated-write" },
      { method: "clear", intent: "destructive-clear" },
    ],
  },
  {
    repositoryKind: "longitudinal-commit-audit",
    filePath: "src/db/repositories/longitudinalCommitAuditRepository.ts",
    className: "FileLongitudinalCommitAuditRepository",
    entrypoints: [
      { method: "append", intent: "validated-write" },
      { method: "update", intent: "validated-write" },
      { method: "clear", intent: "destructive-clear" },
    ],
  },
] as const;

const FILESYSTEM_MUTATION_CALLS = new Set([
  "appendFile",
  "appendFileSync",
  "copyFile",
  "copyFileSync",
  "cp",
  "cpSync",
  "createWriteStream",
  "mkdir",
  "mkdirSync",
  "rename",
  "renameSync",
  "rm",
  "rmSync",
  "rmdir",
  "rmdirSync",
  "truncate",
  "truncateSync",
  "unlink",
  "unlinkSync",
  "writeFile",
  "writeFileSync",
  "writeSync",
]);

const APPROVED_FILESYSTEM_MUTATION_FILES = new Set([
  "src/db/repositories/jsonFileStore.ts",
  "src/db/repositories/fileLock.ts",
  "src/core/demo/traceReplayDemo.ts",
]);

const DURABLE_ADAPTER_CALLS = new Set([
  "removeJsonObjectFileAndBackup",
  "writeJsonObjectFileAtomically",
]);

const APPROVED_DURABLE_ADAPTER_CALL_FILES = new Set(
  REPOSITORIES.map((repository) => repository.filePath),
);

const WRITER_SEQUENCE = [
  "assertRepositoryWritePayloadValid",
  "createDurableJsonEnvelope",
  "writeSyncedFile(tempPath",
  "assertValidJsonObjectFile(tempPath",
  "writeSyncedFile(backupTempPath",
  "assertValidJsonObjectFile(backupTempPath",
  "replaceFile(backupTempPath",
  "assertValidJsonObjectFile(backupPath",
  "replaceFile(tempPath",
  "assertValidJsonObjectFile(params.filePath",
] as const;

export function runDurableWriteBoundaryIntegrationAudit(
  projectRoot = PROJECT_ROOT,
): DurableWriteBoundaryIntegrationAuditResult {
  const repositoryEntrypoints = REPOSITORIES.flatMap((repository) => {
    const sourceFile = readTypeScriptSource(projectRoot, repository.filePath);
    return repository.entrypoints.map((entrypoint) => {
      const methodSource = findClassMethodSource(
        sourceFile,
        repository.className,
        entrypoint.method,
      );
      const lockOwned = methodSource.includes("this.withFileLock");
      const intentMarked = methodSource.includes(`"${entrypoint.intent}"`);
      const boundaryRouted = methodSource.includes("this.writeStore")
        || methodSource.includes("removeJsonObjectFileAndBackup");
      return {
        repositoryKind: repository.repositoryKind,
        method: entrypoint.method,
        expectedIntent: entrypoint.intent,
        lockOwned,
        intentMarked,
        boundaryRouted,
        passed: lockOwned && intentMarked && boundaryRouted,
      };
    });
  });

  const repositorySources = REPOSITORIES.map((repository) => ({
    definition: repository,
    source: readFileSync(resolve(projectRoot, repository.filePath), "utf8"),
  }));
  const writerSource = readFileSync(
    resolve(projectRoot, "src/db/repositories/jsonFileStore.ts"),
    "utf8",
  );
  const writerFunctionSource = findFunctionSource(
    readTypeScriptSource(projectRoot, "src/db/repositories/jsonFileStore.ts"),
    "writeJsonObjectFileAtomically",
  );
  const productionWriteScan = scanDurableWriteBoundaryBypasses(projectRoot);
  const serviceSource = readFileSync(
    resolve(projectRoot, "src/services/characterPhysicsService.ts"),
    "utf8",
  );

  const repositoryWiringPassed = repositorySources.every(({ source }) =>
    source.includes("writeJsonObjectFileAtomically")
    && source.includes("repositorySpec: REPOSITORY_SPEC")
    && source.includes("persistenceIntent")
    && source.includes("withRepositoryFileLock")
  );
  const writerSequencePassed = appearsInOrder(writerFunctionSource, WRITER_SEQUENCE);
  const destructiveEntries = repositoryEntrypoints.filter((entrypoint) =>
    entrypoint.expectedIntent !== "validated-write"
  );
  const serviceBoundaryPassed = !serviceSource.includes("jsonFileStore")
    && !serviceSource.includes("node:fs")
    && serviceSource.includes("this.repository.set")
    && serviceSource.includes("this.repository.update");
  const checks: DurableWriteBoundaryAuditCheck[] = [
    {
      id: "repository_writer_wiring",
      passed: repositoryWiringPassed,
      evidence: `${repositorySources.filter(({ source }) =>
        source.includes("repositorySpec: REPOSITORY_SPEC")
        && source.includes("persistenceIntent")
      ).length}/${REPOSITORIES.length} repositories explicitly pass spec and persistence intent`,
    },
    {
      id: "repository_entrypoint_coverage",
      passed: repositoryEntrypoints.every((entrypoint) => entrypoint.passed),
      evidence: `${repositoryEntrypoints.filter((entrypoint) => entrypoint.passed).length}/${repositoryEntrypoints.length} write entrypoints own the lock and expected intent`,
    },
    {
      id: "destructive_boundary_marked",
      passed: destructiveEntries.every((entrypoint) => entrypoint.intentMarked),
      evidence: `${destructiveEntries.filter((entrypoint) => entrypoint.intentMarked).length}/${destructiveEntries.length} delete/clear entrypoints are explicitly destructive`,
    },
    {
      id: "full_atomic_writer_sequence",
      passed: writerSequencePassed && writerSource.includes("repositorySpec: params.repositorySpec"),
      evidence: "validation, envelope, temp, backup, atomic replace, and final full-spec verification are ordered in the shared writer",
    },
    {
      id: "no_production_write_bypass",
      passed: productionWriteScan.bypassFindings.length === 0,
      evidence: `${productionWriteScan.approvedFilesystemSites} approved filesystem mutation sites; ${productionWriteScan.bypassFindings.length} unapproved sites`,
    },
    {
      id: "service_repository_boundary",
      passed: serviceBoundaryPassed,
      evidence: "CharacterPhysicsService writes through repository interfaces and does not import the file store or node:fs",
    },
  ];

  return {
    auditVersion: "p4.1.5-b2-2c",
    passed: checks.every((check) => check.passed),
    checks,
    repositoryEntrypoints,
    bypassFindings: productionWriteScan.bypassFindings,
    approvedFilesystemMutationSites: productionWriteScan.approvedFilesystemSites,
    requiredForRelease: true,
  };
}

export function scanDurableWriteBoundaryBypasses(
  projectRoot: string,
): DurableWriteBypassScanResult {
  const findings: DurableWriteBypassFinding[] = [];
  let approvedFilesystemSites = 0;
  for (const absolutePath of collectTypeScriptFiles(resolve(projectRoot, "src"))) {
    const relativePath = normalizePath(relative(projectRoot, absolutePath));
    const sourceFile = ts.createSourceFile(
      relativePath,
      readFileSync(absolutePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const filesystemCallNames = collectImportedAliases(sourceFile, FILESYSTEM_MUTATION_CALLS);
    const durableAdapterCallNames = collectImportedAliases(sourceFile, DURABLE_ADAPTER_CALLS);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callName = getCallName(node.expression);
        if (callName && filesystemCallNames.has(callName)) {
          if (APPROVED_FILESYSTEM_MUTATION_FILES.has(relativePath)) {
            approvedFilesystemSites += 1;
          } else {
            const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            findings.push({
              filePath: relativePath,
              line: position.line + 1,
              callName,
            });
          }
        } else if (
          callName
          && durableAdapterCallNames.has(callName)
          && !APPROVED_DURABLE_ADAPTER_CALL_FILES.has(relativePath)
        ) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          findings.push({
            filePath: relativePath,
            line: position.line + 1,
            callName,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  findings.sort((left, right) =>
    compareText(left.filePath, right.filePath)
    || left.line - right.line
    || compareText(left.callName, right.callName)
  );
  return { bypassFindings: findings, approvedFilesystemSites };
}

function collectImportedAliases(
  sourceFile: ts.SourceFile,
  protectedNames: ReadonlySet<string>,
): Set<string> {
  const names = new Set(protectedNames);
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (protectedNames.has(importedName)) names.add(element.name.text);
    }
  }
  return names;
}

function readTypeScriptSource(projectRoot: string, relativePath: string): ts.SourceFile {
  return ts.createSourceFile(
    relativePath,
    readFileSync(resolve(projectRoot, relativePath), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
}

function findClassMethodSource(
  sourceFile: ts.SourceFile,
  className: string,
  methodName: string,
): string {
  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement) || statement.name?.text !== className) continue;
    for (const member of statement.members) {
      if (ts.isMethodDeclaration(member) && getPropertyName(member.name) === methodName) {
        return member.getText(sourceFile);
      }
    }
  }
  return "";
}

function findFunctionSource(sourceFile: ts.SourceFile, functionName: string): string {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === functionName) {
      return statement.getText(sourceFile);
    }
  }
  return "";
}

function appearsInOrder(source: string, tokens: readonly string[]): boolean {
  let cursor = 0;
  for (const token of tokens) {
    const position = source.indexOf(token, cursor);
    if (position < 0) return false;
    cursor = position + token.length;
  }
  return true;
}

function collectTypeScriptFiles(directoryPath: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directoryPath)) {
    const absolutePath = resolve(directoryPath, entry);
    if (statSync(absolutePath).isDirectory()) {
      files.push(...collectTypeScriptFiles(absolutePath));
    } else if (/\.tsx?$/u.test(entry)) {
      files.push(absolutePath);
    }
  }
  return files.sort();
}

function getCallName(expression: ts.LeftHandSideExpression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression)
    && expression.argumentExpression
    && ts.isStringLiteral(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text;
  }
  return undefined;
}

function getPropertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/gu, "/");
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
