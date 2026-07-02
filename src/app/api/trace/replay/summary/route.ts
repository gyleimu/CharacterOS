import { NextResponse } from "next/server";
import type { GetTraceReplaySummaryResponse } from "@/appContracts/characterPhysics";
import {
  buildTraceReplaySummaryIndex,
  validateTraceReplaySummaryIndex,
  type TraceReplaySummarySortMode
} from "@/core/trace/traceReplaySummary";

const sortModes = new Set<TraceReplaySummarySortMode>([
  "dominantMassDelta",
  "trustDrift",
  "fearDrift",
  "title"
]);

export async function GET(request: Request = new Request("http://localhost/api/trace/replay/summary")) {
  const url = new URL(request.url);
  const direction = url.searchParams.get("direction") ?? undefined;
  const requestedSort = url.searchParams.get("sort");
  const sort = isTraceReplaySummarySortMode(requestedSort) ? requestedSort : undefined;
  const query = {
    ...(direction === undefined ? {} : { direction }),
    ...(sort === undefined ? {} : { sort })
  };
  const index = buildTraceReplaySummaryIndex({
    daysPerStep: 14,
    query
  });
  const validation = validateTraceReplaySummaryIndex(index);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join("; ") }, { status: 500 });
  }

  const response: GetTraceReplaySummaryResponse = { index };
  return NextResponse.json(response);
}

function isTraceReplaySummarySortMode(value: string | null): value is TraceReplaySummarySortMode {
  return value !== null && sortModes.has(value as TraceReplaySummarySortMode);
}
