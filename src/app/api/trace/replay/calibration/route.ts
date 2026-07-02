import { NextResponse } from "next/server";
import type { GetTraceReplayCalibrationResponse } from "@/appContracts/characterPhysics";
import {
  buildReplayCalibrationSuite,
  validateReplayCalibrationSuite
} from "@/core/trace/replayCalibration";

export async function GET(request: Request = new Request("http://localhost/api/trace/replay/calibration")) {
  const url = new URL(request.url);
  const calibration = buildReplayCalibrationSuite(calibrationParamsFromUrl(url));
  const validation = validateReplayCalibrationSuite(calibration);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join("; "), calibration }, { status: 500 });
  }
  const failed = calibration.results.flatMap((result) => (
    result.checks
      .filter((check) => check.severity === "fail")
      .map((check) => `${result.scenario}: ${check.name} - ${check.message}`)
  ));

  if (failed.length) {
    return NextResponse.json({ error: failed.join("; "), calibration }, { status: 500 });
  }

  const response: GetTraceReplayCalibrationResponse = { calibration };
  return NextResponse.json(response);
}

function calibrationParamsFromUrl(url: URL): Parameters<typeof buildReplayCalibrationSuite>[0] {
  const params: Parameters<typeof buildReplayCalibrationSuite>[0] = {};
  const daysPerStep = numberParam(url, "daysPerStep");
  const learningRate = numberParam(url, "learningRate");
  const maxDriftMagnitude = numberParam(url, "maxDriftMagnitude");
  const minObservableDrift = numberParam(url, "minObservableDrift");
  const maxVelocity = numberParam(url, "maxVelocity");
  if (daysPerStep !== undefined) params.daysPerStep = daysPerStep;
  if (learningRate !== undefined) params.learningRate = learningRate;
  if (maxDriftMagnitude !== undefined) params.maxDriftMagnitude = maxDriftMagnitude;
  if (minObservableDrift !== undefined) params.minObservableDrift = minObservableDrift;
  if (maxVelocity !== undefined) params.maxVelocity = maxVelocity;
  return params;
}

function numberParam(url: URL, key: string): number | undefined {
  const value = url.searchParams.get(key);
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
