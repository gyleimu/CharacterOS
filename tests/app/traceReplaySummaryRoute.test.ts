import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/trace/replay/summary/route";
import type { GetTraceReplaySummaryResponse } from "../../src/appContracts/characterPhysics";

describe("Trace replay summary API", () => {
  it("returns a validated summary index", async () => {
    const response = await GET();
    const body = (await response.json()) as GetTraceReplaySummaryResponse;

    expect(response.status).toBe(200);
    expect(body.index.scenarioCount).toBeGreaterThan(0);
    expect(body.index.summaries).toHaveLength(body.index.scenarioCount);
    expect(body.index.directionCounts.defensive_drift).toBeGreaterThan(0);
    expect(body.index.directionCounts.recovery_drift).toBeGreaterThan(0);
  });

  it("filters and sorts replay summaries with query parameters", async () => {
    const response = await GET(
      new Request("http://localhost/api/trace/replay/summary?direction=recovery_drift&sort=trustDrift")
    );
    const body = (await response.json()) as GetTraceReplaySummaryResponse;

    expect(response.status).toBe(200);
    expect(body.index.summaries.length).toBeGreaterThan(0);
    expect(body.index.summaries.every((summary) => summary.dominantDirection === "recovery_drift")).toBe(true);
    expect(body.index.directionCounts.defensive_drift ?? 0).toBe(0);
    expect(body.index.directionCounts.recovery_drift).toBe(body.index.summaries.length);
    expect(Math.abs(body.index.summaries[0]?.coordinateDelta.trust ?? 0)).toBeGreaterThanOrEqual(
      Math.abs(body.index.summaries.at(-1)?.coordinateDelta.trust ?? 0)
    );
  });
});
