import { NextResponse } from "next/server";
import { runContinuousTick } from "@/core/time/continuousTick";
import { buildBaselineDriftCalibrationHints } from "@/core/parameters/baselineDriftCalibration";
import { buildHomeostasisCalibrationHints } from "@/core/homeostasis/homeostasisCalibration";
import { buildParameterNetworkCalibrationHints } from "@/core/parameters/parameterNetworkCalibration";
import { buildRecoveryCalibrationHints } from "@/core/recovery/recoveryCalibration";
import { deserializeCharacterPhysicsState, serializeCharacterPhysicsState } from "@/core/physics/serialization";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import {
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";

export interface CharacterCalibrationReport {
  characterId: string;
  generatedAt: string;
  daysSimulated: number;
  /** Calibration hints derived from a read-only tick simulation. */
  hints: {
    baselineDrift: ReturnType<typeof buildBaselineDriftCalibrationHints>;
    homeostasis: ReturnType<typeof buildHomeostasisCalibrationHints>;
    parameterNetwork: ReturnType<typeof buildParameterNetworkCalibrationHints>;
    recovery: ReturnType<typeof buildRecoveryCalibrationHints>;
  };
}

/**
 * GET /api/characters/[characterId]/physics/calibration
 *
 * Read-only calibration report. Deep-clones the character state, runs a
 * 1-day continuous tick on the clone to produce fresh traces, extracts
 * calibration hints, and discards the clone. The character's real state
 * is never mutated.
 */
export async function GET(_request: Request, context: CharacterRouteContext) {
  const { characterId } = await resolveCharacterRouteParams(context);

  // Deep-clone the character state so the tick runs on a copy.
  const realState = characterPhysicsService.getState(characterId);
  const clone = deserializeCharacterPhysicsState(serializeCharacterPhysicsState(realState));

  const trace = runContinuousTick(clone, { daysElapsed: 1 });

  const report: CharacterCalibrationReport = {
    characterId,
    generatedAt: new Date().toISOString(),
    daysSimulated: trace.daysElapsed,
    hints: {
      baselineDrift: buildBaselineDriftCalibrationHints(trace.baselineDrift),
      homeostasis: buildHomeostasisCalibrationHints(trace.homeostasis),
      parameterNetwork: buildParameterNetworkCalibrationHints(trace.parameterNetwork),
      recovery: buildRecoveryCalibrationHints(trace.recovery)
    }
  };

  return NextResponse.json(report);
}
