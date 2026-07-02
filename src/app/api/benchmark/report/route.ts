/**
 * V6.7 Benchmark Report API
 *
 * GET /api/benchmark/report
 *
 * Read-only. No API key required. No LLM. No mutation.
 * Returns the result of running all first-replay benchmark fixtures.
 */

import { NextResponse } from "next/server";
import type { GetBenchmarkReportResponse } from "@/appContracts/characterPhysics";
import { runBenchmarkCases } from "@/core/benchmark/benchmarkRunner";
import { firstReplayBenchmarkFixtures } from "@/core/benchmark/fixtures/firstReplayFixtures";
import { normalizeBenchmarkCase } from "@/core/benchmark/benchmarkTypes";
import { toBenchmarkReportResponse } from "@/services/benchmarkDto";

/** Categories currently supported by the benchmark runner. */
const SUPPORTED_CATEGORIES = [
  "memory_decay",
  "homeostasis_recovery",
  "belief_evolution",
  "event_impact",
  "behavior_decision"
] as const;

export async function GET(): Promise<NextResponse<GetBenchmarkReportResponse>> {
  // Normalize all fixtures
  const cases = firstReplayBenchmarkFixtures.map((f) => normalizeBenchmarkCase(f));

  // Run all benchmarks
  const runResult = runBenchmarkCases({ cases });

  // Build response
  const response = toBenchmarkReportResponse({
    runResult,
    fixtures: firstReplayBenchmarkFixtures,
    supportedCategories: [...SUPPORTED_CATEGORIES]
  });

  return NextResponse.json(response);
}
