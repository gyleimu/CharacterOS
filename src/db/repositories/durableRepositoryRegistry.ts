import {
  inspectCharacterImportTransitionHistoryDomainIntegrity,
  inspectCharacterPhysicsDomainIntegrity,
  inspectLongitudinalCommitAuditDomainIntegrity,
  inspectParameterAdjustmentHistoryDomainIntegrity,
} from "./durableDomainIntegrity";
import {
  DURABLE_REPOSITORY_KINDS,
  type DurableRepositoryKind,
} from "./durableJsonEnvelope";
import {
  validateCharacterImportTransitionHistoryPayload,
  validateCharacterPhysicsPayload,
  validateLongitudinalCommitAuditPayload,
  validateParameterAdjustmentHistoryPayload,
} from "./durablePayloadValidators";
import type { RepositoryValidationSpec } from "./durableValidationTypes";

export interface DurableRepositorySpec extends RepositoryValidationSpec {
  readonly legacySchemaVersions: readonly number[];
}

const LEGACY_V0 = Object.freeze([0] as const);

const DURABLE_REPOSITORY_SPEC_MAP: Readonly<Record<DurableRepositoryKind, DurableRepositorySpec>> = Object.freeze({
  "character-physics": Object.freeze({
    repositoryKind: "character-physics",
    schemaVersion: 1,
    legacySchemaVersions: LEGACY_V0,
    validatePayload: validateCharacterPhysicsPayload,
    inspectDomainIntegrity: inspectCharacterPhysicsDomainIntegrity,
  }),
  "parameter-adjustment-history": Object.freeze({
    repositoryKind: "parameter-adjustment-history",
    schemaVersion: 1,
    legacySchemaVersions: LEGACY_V0,
    validatePayload: validateParameterAdjustmentHistoryPayload,
    inspectDomainIntegrity: inspectParameterAdjustmentHistoryDomainIntegrity,
  }),
  "character-import-transition-history": Object.freeze({
    repositoryKind: "character-import-transition-history",
    schemaVersion: 1,
    legacySchemaVersions: LEGACY_V0,
    validatePayload: validateCharacterImportTransitionHistoryPayload,
    inspectDomainIntegrity: inspectCharacterImportTransitionHistoryDomainIntegrity,
  }),
  "longitudinal-commit-audit": Object.freeze({
    repositoryKind: "longitudinal-commit-audit",
    schemaVersion: 1,
    legacySchemaVersions: LEGACY_V0,
    validatePayload: validateLongitudinalCommitAuditPayload,
    inspectDomainIntegrity: inspectLongitudinalCommitAuditDomainIntegrity,
  }),
});

export function getDurableRepositorySpec(repositoryKind: DurableRepositoryKind): DurableRepositorySpec {
  return DURABLE_REPOSITORY_SPEC_MAP[repositoryKind];
}

export function listDurableRepositorySpecs(): readonly DurableRepositorySpec[] {
  return DURABLE_REPOSITORY_KINDS.map((repositoryKind) => DURABLE_REPOSITORY_SPEC_MAP[repositoryKind]);
}
