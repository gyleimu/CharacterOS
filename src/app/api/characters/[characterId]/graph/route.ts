/**
 * V7.7/V8.3 Graph Snapshot API
 *
 * GET /api/characters/[characterId]/graph
 *
 * Read-only. No API key required. No LLM. No mutation.
 *
 * Query params:
 *   ?format=json (default) — returns MindGraphSnapshot JSON
 *   ?format=svg            — returns rendered SVG string
 *   ?includeBenchmark=true — run V6 benchmarks, include benchmark_signal nodes
 *   ?includeISF=true       — include internal state variable nodes
 *   ?width=1000&height=1000 — SVG viewport size
 *   ?bg=%230D0D1A          — SVG background color (URL-encoded hex)
 *   ?showLabels=true        — show/hide node labels
 *   ?showLegend=true        — show/hide legend
 */

import { NextResponse } from "next/server";
import { buildMindGraphSnapshot } from "@/core/graph/mindGraphBuilder";
import { buildInternalStateFieldSnapshot } from "@/core/temporal/internalStateField";
import { buildGraphLayoutSnapshot } from "@/core/graph/mindGraphLayout";
import { exportGraphToSvg } from "@/core/graph/mindGraphSvgExporter";
import { characterPhysicsService } from "@/server/characterPhysicsServiceSingleton";
import {
  resolveCharacterRouteParams,
  type CharacterRouteContext
} from "@/app/api/_shared/routeUtils";
import { runBenchmarkCases } from "@/core/benchmark/benchmarkRunner";
import { firstReplayBenchmarkFixtures } from "@/core/benchmark/fixtures/firstReplayFixtures";
import { normalizeBenchmarkCase } from "@/core/benchmark/benchmarkTypes";
import type { BenchmarkResult } from "@/core/benchmark/benchmarkTypes";

export async function GET(
  _request: Request,
  context: CharacterRouteContext
) {
  const { characterId } = await resolveCharacterRouteParams(context);

  const state = characterPhysicsService.getState(characterId);
  if (!state) {
    return NextResponse.json(
      { error: `Character "${characterId}" not found` },
      { status: 404 }
    );
  }

  const url = new URL(_request.url);
  const format = url.searchParams.get("format") ?? "json";
  if (!["json", "svg", "bundle"].includes(format)) {
    return NextResponse.json(
      { error: `Invalid format "${format}". Expected json, svg, or bundle.` },
      { status: 400 }
    );
  }

  const includeBenchmarkResult = parseBooleanQuery(url, "includeBenchmark", false);
  if (!includeBenchmarkResult.ok) return includeBenchmarkResult.response;
  const includeISFResult = parseBooleanQuery(url, "includeISF", false);
  if (!includeISFResult.ok) return includeISFResult.response;
  const widthResult = parseIntegerQuery(url, "width", 1000, 200, 4000);
  if (!widthResult.ok) return widthResult.response;
  const heightResult = parseIntegerQuery(url, "height", 1000, 200, 4000);
  if (!heightResult.ok) return heightResult.response;
  const showLabelsResult = parseBooleanQuery(url, "showLabels", true);
  if (!showLabelsResult.ok) return showLabelsResult.response;
  const showLegendResult = parseBooleanQuery(url, "showLegend", true);
  if (!showLegendResult.ok) return showLegendResult.response;
  const bgResult = parseBackgroundQuery(url);
  if (!bgResult.ok) return bgResult.response;

  const includeBenchmark = includeBenchmarkResult.value;
  const includeISF = includeISFResult.value;

  const options: Parameters<typeof buildMindGraphSnapshot>[1] = {};

  if (includeISF) {
    options.internalStateField = buildInternalStateFieldSnapshot({ state });
  }

  if (includeBenchmark) {
    const runResult = runBenchmarkCases({
      cases: firstReplayBenchmarkFixtures.map((f) => normalizeBenchmarkCase(f))
    });
    options.benchmarkResults = runResult.results.filter((r) => r.verdict !== "error") as BenchmarkResult[];
  }

  const snapshot = buildMindGraphSnapshot(state, options);

  const layout = buildGraphLayoutSnapshot(snapshot, {
    viewportWidth: widthResult.value,
    viewportHeight: heightResult.value
  });

  // SVG output
  if (format === "svg") {
    const svg = exportGraphToSvg(layout, {
      background: bgResult.value,
      showLabels: showLabelsResult.value,
      showLegend: showLegendResult.value
    });
    return new NextResponse(svg, {
      headers: { "Content-Type": "image/svg+xml" }
    });
  }

  // Bundle: graph + layout + SVG
  if (format === "bundle") {
    const svg = exportGraphToSvg(layout);
    return NextResponse.json({
      graph: snapshot,
      layout,
      svg
    });
  }

  return NextResponse.json({ snapshot });
}

type QueryResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: NextResponse };

function parseBooleanQuery(url: URL, key: string, defaultValue: boolean): QueryResult<boolean> {
  const raw = url.searchParams.get(key);
  if (raw === null) return { ok: true, value: defaultValue };
  if (raw === "true") return { ok: true, value: true };
  if (raw === "false") return { ok: true, value: false };
  return {
    ok: false,
    response: NextResponse.json(
      { error: `Invalid ${key}. Expected true or false.` },
      { status: 400 }
    )
  };
}

function parseIntegerQuery(
  url: URL,
  key: string,
  defaultValue: number,
  min: number,
  max: number
): QueryResult<number> {
  const raw = url.searchParams.get(key);
  if (raw === null) return { ok: true, value: defaultValue };
  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Invalid ${key}. Expected an integer between ${min} and ${max}.` },
        { status: 400 }
      )
    };
  }
  const value = Number(raw);
  if (value < min || value > max) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Invalid ${key}. Expected an integer between ${min} and ${max}.` },
        { status: 400 }
      )
    };
  }
  return { ok: true, value };
}

function parseBackgroundQuery(url: URL): QueryResult<string> {
  const value = url.searchParams.get("bg") ?? "#0D0D1A";
  if (/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(value)) {
    return { ok: true, value };
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: "Invalid bg. Expected a hex color such as #0D0D1A." },
      { status: 400 }
    )
  };
}
