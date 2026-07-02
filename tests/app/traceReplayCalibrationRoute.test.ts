import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/trace/replay/calibration/route";
import type { GetTraceReplayCalibrationResponse } from "../../src/appContracts/characterPhysics";

describe("Trace replay calibration API", () => {
  it("returns a passing calibration suite", async () => {
    const response = await GET();
    const body = (await response.json()) as GetTraceReplayCalibrationResponse;

    expect(response.status).toBe(200);
    expect(body.calibration.passed).toBe(true);
    expect(body.calibration.results.length).toBeGreaterThan(0);
    expect(body.calibration.results.every((result) => result.checks.length >= 4)).toBe(true);
  });

  it("accepts calibration parameters from query string", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/trace/replay/calibration?daysPerStep=30&maxDriftMagnitude=0.2&minObservableDrift=0.01&maxVelocity=0.05"
      )
    );
    const body = (await response.json()) as GetTraceReplayCalibrationResponse;

    expect(response.status).toBe(200);
    expect(body.calibration.parameters.daysPerStep).toBe(30);
    expect(body.calibration.parameters.maxDriftMagnitude).toBe(0.2);
    expect(body.calibration.parameters.minObservableDrift).toBe(0.01);
    expect(body.calibration.parameters.maxVelocity).toBe(0.05);
  });

  it("accepts learning rate from query string", async () => {
    const response = await GET(
      new Request("http://localhost/api/trace/replay/calibration?learningRate=0.06")
    );
    const body = (await response.json()) as GetTraceReplayCalibrationResponse;

    expect(response.status).toBe(200);
    expect(body.calibration.parameters.learningRate).toBe(0.06);
  });
});
