import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildTraceReplayArtifact, traceReplayScenarios, validateTraceReplayArtifact, type TraceReplayScenarioId } from "../trace/traceReplay";
import { buildReplayCalibrationSuite } from "../trace/replayCalibration";
import {
  buildTraceReplaySummaryIndex,
  summarizeTraceReplayArtifact,
  validateTraceReplaySummary,
  validateTraceReplaySummaryIndex
} from "../trace/traceReplaySummary";

const scenarios = Object.keys(traceReplayScenarios) as TraceReplayScenarioId[];
const outputDir = join(process.cwd(), "outputs");
mkdirSync(outputDir, { recursive: true });

console.log("CharacterOS V2 Trace Replay Demo");

for (const scenario of scenarios) {
  const artifact = buildTraceReplayArtifact({ scenario, daysPerStep: 14 });
  const validation = validateTraceReplayArtifact(artifact);
  if (!validation.valid) {
    throw new Error(`Invalid trace replay artifact for ${scenario}: ${validation.errors.join("; ")}`);
  }
  const outputPath = join(outputDir, `trace_replay_${scenario}.json`);
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  const summary = summarizeTraceReplayArtifact(artifact);
  const summaryValidation = validateTraceReplaySummary(summary);
  if (!summaryValidation.valid) {
    throw new Error(`Invalid trace replay summary for ${scenario}: ${summaryValidation.errors.join("; ")}`);
  }
  const summaryPath = join(outputDir, `trace_replay_${scenario}_summary.json`);
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${outputPath}`);
  console.log(`Wrote ${summaryPath}`);
  console.log({
    scenario: summary.scenario,
    dominantDirection: summary.dominantDirection,
    coordinateDelta: {
      trust: summary.coordinateDelta.trust,
      fear: summary.coordinateDelta.fear
    },
    lastVelocity: summary.lastVelocity,
    clusterTrends: summary.clusterTrends
  });
  for (const step of artifact.steps) {
    console.log({
      step: step.step,
      category: step.category,
      phase: step.boundary.phase,
      forceTrust: step.force.trust,
      forceFear: step.force.fear,
      clusterForces: step.clusterForces,
      velocityTrust: step.velocity.trust,
      velocityFear: step.velocity.fear,
      trust: step.coordinate.trust,
      fear: step.coordinate.fear
    });
  }
}

const index = buildTraceReplaySummaryIndex({ daysPerStep: 14 });
const indexValidation = validateTraceReplaySummaryIndex(index);
if (!indexValidation.valid) {
  throw new Error(`Invalid trace replay summary index: ${indexValidation.errors.join("; ")}`);
}
const indexPath = join(outputDir, "trace_replay_summary_index.json");
writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`\nWrote ${indexPath}`);
console.log({
  scenarioCount: index.scenarioCount,
  directionCounts: index.directionCounts
});

const calibration = buildReplayCalibrationSuite({ daysPerStep: 14 });
const calibrationPath = join(outputDir, "trace_replay_calibration.json");
writeFileSync(calibrationPath, `${JSON.stringify(calibration, null, 2)}\n`, "utf8");
console.log(`Wrote ${calibrationPath}`);
console.log({
  passed: calibration.passed,
  results: calibration.results.map((result) => ({
    scenario: result.scenario,
    passed: result.passed,
    checks: result.checks.map((check) => `${check.name}:${check.severity}`)
  }))
});
