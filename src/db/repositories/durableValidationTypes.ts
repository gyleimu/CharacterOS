import type { DurableRepositoryKind } from "./durableJsonEnvelope";

export type DurableValidationSeverity = "CRITICAL" | "ERROR" | "WARNING";

export interface DurableValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly severity: DurableValidationSeverity;
  readonly message: string;
}

export interface DurableValidationResult {
  readonly valid: boolean;
  readonly issues: readonly DurableValidationIssue[];
}

export interface RepositoryValidationSpec {
  readonly repositoryKind: DurableRepositoryKind;
  readonly schemaVersion: number;
  readonly validatePayload: (value: unknown) => DurableValidationResult;
  readonly inspectDomainIntegrity: (value: unknown) => DurableValidationResult;
}

export interface RepositoryValidationPolicy {
  readonly mode: "read" | "write";
  readonly blockingSeverities: readonly DurableValidationSeverity[];
  readonly allowWarnings: true;
}

const BLOCKING_VALIDATION_SEVERITIES = Object.freeze([
  "CRITICAL",
  "ERROR",
] as const satisfies readonly DurableValidationSeverity[]);

export const REPOSITORY_READ_VALIDATION_POLICY: RepositoryValidationPolicy = Object.freeze({
  mode: "read",
  blockingSeverities: BLOCKING_VALIDATION_SEVERITIES,
  allowWarnings: true,
});

export const REPOSITORY_WRITE_VALIDATION_POLICY: RepositoryValidationPolicy = Object.freeze({
  mode: "write",
  blockingSeverities: BLOCKING_VALIDATION_SEVERITIES,
  allowWarnings: true,
});

const SEVERITY_ORDER: Readonly<Record<DurableValidationSeverity, number>> = {
  CRITICAL: 0,
  ERROR: 1,
  WARNING: 2,
};

export function buildDurableValidationResult(
  issues: readonly DurableValidationIssue[],
): DurableValidationResult {
  const sortedIssues = issues
    .map((issue) => ({ ...issue }))
    .sort(compareDurableValidationIssues);
  return {
    valid: sortedIssues.every((issue) => issue.severity === "WARNING"),
    issues: sortedIssues,
  };
}

export function compareDurableValidationIssues(
  left: DurableValidationIssue,
  right: DurableValidationIssue,
): number {
  return compareText(left.path, right.path)
    || SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || compareText(left.code, right.code)
    || compareText(left.message, right.message);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
