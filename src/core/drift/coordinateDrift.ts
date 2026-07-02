import type { PersonalityCoordinate } from "../personality/coordinate";

/**
 * Result shape produced by coordinate drift computation.
 *
 * This type is used by `physicsEngine.ts` for its inline drift computation
 * (see `applyGalaxyDrift`). The engine computes drift directly using the
 * Personality Galaxy momentum model rather than calling a standalone
 * function.
 *
 * ## Migration note
 *
 * The former `applyCoordinateDrift()` function (removed in V3.11) applied
 * cluster-force-based drift without momentum. It has been superseded by:
 *
 *   `applyMomentumDrift` in `src/core/galaxy/momentumDrift.ts`
 *
 * which adds velocity-based inertia and is called by
 * `personalityGalaxyEngine.ts`. The physics engine's inline computation in
 * `applyGalaxyDrift()` produces the same `CoordinateDriftResult` shape but
 * delegates force computation to the galaxy simulation step.
 */
export interface CoordinateDriftResult {
  before: PersonalityCoordinate;
  after: PersonalityCoordinate;
  totalForce: PersonalityCoordinate;
  learningRate: number;
}
