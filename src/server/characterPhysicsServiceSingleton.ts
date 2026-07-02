import { FileCharacterPhysicsRepository } from "../db/repositories/characterPhysicsRepository";
import { FileCharacterImportTransitionHistoryRepository } from "../db/repositories/characterImportTransitionHistoryRepository";
import { FileLongitudinalCommitAuditRepository } from "../db/repositories/longitudinalCommitAuditRepository";
import { FileParameterAdjustmentHistoryRepository } from "../db/repositories/parameterAdjustmentHistoryRepository";
import { InMemoryCharacterPhysicsService } from "../services/characterPhysicsService";

export const characterPhysicsService = createCharacterPhysicsService();

function createCharacterPhysicsService(): InMemoryCharacterPhysicsService {
  if (process.env.VITEST === "true") {
    return new InMemoryCharacterPhysicsService();
  }
  return new InMemoryCharacterPhysicsService(
    new FileCharacterPhysicsRepository(),
    new FileParameterAdjustmentHistoryRepository(),
    new FileCharacterImportTransitionHistoryRepository(),
    new FileLongitudinalCommitAuditRepository()
  );
}
