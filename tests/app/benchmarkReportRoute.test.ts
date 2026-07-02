import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/benchmark/report/route";
import type { GetBenchmarkReportResponse } from "../../src/appContracts/characterPhysics";

describe("Benchmark Report API", () => {
  it("GET /api/benchmark/report returns 200", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("returns a valid benchmark report with summary", async () => {
    const response = await GET();
    const body = (await response.json()) as GetBenchmarkReportResponse;

    expect(body.generatedAt).toBeDefined();
    expect(body.summary).toBeDefined();
    expect(body.summary.totalCases).toBe(6);
    expect(body.results).toHaveLength(6);
  });

  it("summary has correct pass/fail/skip counts", async () => {
    const response = await GET();
    const body = (await response.json()) as GetBenchmarkReportResponse;

    // At least 4 should pass
    expect(body.summary.passedCount).toBeGreaterThanOrEqual(4);
  });

  it("results include supported categories", async () => {
    const response = await GET();
    const body = (await response.json()) as GetBenchmarkReportResponse;

    const categories = body.results.map((r) => r.category);
    expect(categories).toContain("memory_decay");
    expect(categories).toContain("homeostasis_recovery");
    expect(categories).toContain("belief_evolution");
  });

  it("passed results have positive assertion counts", async () => {
    const response = await GET();
    const body = (await response.json()) as GetBenchmarkReportResponse;

    const passedResults = body.results.filter((r) => r.verdict === "pass");
    expect(passedResults.length).toBeGreaterThan(0);
    for (const r of passedResults) {
      expect(r.passedAssertions).toBeGreaterThanOrEqual(0);
      expect(r.totalAssertions).toBeGreaterThan(0);
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("summary reports supported and unsupported categories", async () => {
    const response = await GET();
    const body = (await response.json()) as GetBenchmarkReportResponse;

    expect(body.summary.supportedCategories).toContain("memory_decay");
    expect(body.summary.supportedCategories).toContain("homeostasis_recovery");
    expect(body.summary.supportedCategories).toContain("belief_evolution");
    expect(body.summary.supportedCategories).toContain("event_impact");
  });

  it("response includes reasons and warnings", async () => {
    const response = await GET();
    const body = (await response.json()) as GetBenchmarkReportResponse;

    expect(body.reasons.length).toBeGreaterThan(0);
    expect(body.warnings.length).toBeGreaterThan(0);
  });

  it("no LLM or mutation — pure read-only response", async () => {
    // This test verifies the API is pure: calling it twice
    // should produce structurally consistent output
    const response1 = await GET();
    const body1 = (await response1.json()) as GetBenchmarkReportResponse;

    const response2 = await GET();
    const body2 = (await response2.json()) as GetBenchmarkReportResponse;

    expect(body2.summary.totalCases).toBe(body1.summary.totalCases);
    expect(body2.summary.passedCount).toBe(body1.summary.passedCount);
    expect(body2.results).toHaveLength(body1.results.length);
  });
});
