/**
 * V6.2 First Replay Fixtures — minimal benchmark case definitions.
 *
 * These fixtures describe input events, tick specifications, and
 * expected directional outcomes. They do NOT execute any physics.
 *
 * DESIGN ONLY — the assertion engine (V6.3) will consume these.
 */

import type {
  BenchmarkCase,
  BenchmarkCategory,
  BenchmarkInputEvent,
  BenchmarkTolerancePolicy
} from "../benchmarkTypes";

// ─── Const helpers ──────────────────────────────────────────────────────

/** Reusable directional tolerance — default for most assertions. */
const DIRECTIONAL: BenchmarkTolerancePolicy = {
  mode: "directional",
  minimumAbsoluteDelta: 1e-6
};

/** Reusable bounded tolerance for [0, 1] clamped values. */
const CLAMPED: BenchmarkTolerancePolicy = {
  mode: "bounded",
  minBound: 0,
  maxBound: 1
};

/** Reusable monotonic tolerance for multi-tick progressive change. */
const MONOTONIC: BenchmarkTolerancePolicy = {
  mode: "monotonic",
  minimumAbsoluteDelta: 1e-6
};

// ─── Reusable event templates ───────────────────────────────────────────

const EVENT_ABANDONMENT: BenchmarkInputEvent = {
  id: "abandonment_001",
  description: "王雪又一次没有解释就消失。七天没有任何消息。",
  tags: ["王雪", "失联", "消失", "亲密关系", "等待"],
  category: "abandonment",
  intensity: 0.78,
  importance: 0.82,
  relationshipWeight: 0.9,
  expectationGap: 0.86,
  personalitySensitivity: 0.88
};

const EVENT_SILENCE_THREE_DAYS: BenchmarkInputEvent = {
  id: "silence_001",
  description: "王雪三天没有回复林凡的消息。",
  tags: ["王雪", "失联", "消息", "等待"],
  category: "abandonment",
  intensity: 0.62,
  importance: 0.72,
  relationshipWeight: 0.85,
  expectationGap: 0.7,
  personalitySensitivity: 0.8
};

const EVENT_BETRAYAL_HINT: BenchmarkInputEvent = {
  id: "betrayal_001",
  description: "林凡看到王雪和别人在一起，没有解释。",
  tags: ["王雪", "背叛", "亲密关系", "隐瞒"],
  category: "betrayal",
  intensity: 0.65,
  importance: 0.75,
  relationshipWeight: 0.88,
  expectationGap: 0.8,
  personalitySensitivity: 0.85
};

// ─── Fixture A: Abandonment event should lower trust ────────────────────

const FIXTURE_ABANDONMENT_TRUST: BenchmarkCase = {
  id: "abandonment_event_lowers_trust",
  description:
    "When Lin Fan experiences a significant abandonment event, " +
    "trust should decrease and fear should increase. " +
    "Verifies that the event→impact→coordinate pipeline works directionally.",
  category: "event_impact",
  scenario: {
    name: "Abandonment event lowers trust",
    initialState: { kind: "default", characterName: "lin_fan" },
    events: [EVENT_ABANDONMENT],
    ticks: [{ label: "one week after abandonment", daysElapsed: 7 }]
  },
  expectedDirections: [
    {
      metricPath: "coordinate.values.trust",
      direction: "decrease",
      reason:
        "Abandonment events should erode trust. " +
        "Lin Fan's abandonment sensitivity amplifies this.",
      tolerance: DIRECTIONAL
    },
    {
      metricPath: "coordinate.values.fear",
      direction: "increase",
      reason:
        "Fear should rise when the attachment figure disappears without explanation.",
      tolerance: DIRECTIONAL
    },
    {
      metricPath: "impactScore.band",
      direction: "bounded_below",
      reason: "A significant abandonment event should generate non-negligible impact.",
      bound: 0.05, // "negligible" threshold or higher
      tolerance: { mode: "bounded", minBound: 0.05 }
    }
  ],
  metricsToInspect: [
    { path: "coordinate.values.trust", source: "state" },
    { path: "coordinate.values.fear", source: "state" },
    { path: "impactScore.value", source: "physics_step" }
  ],
  tolerancePolicy: DIRECTIONAL,
  notes:
    "This fixture verifies the core event→impact→coordinate pipeline. " +
    "It does not assert exact delta magnitudes — only direction."
};

// ─── Fixture B: Waiting event should raise fear ─────────────────────────

const FIXTURE_WAITING_FEAR: BenchmarkCase = {
  id: "waiting_event_raises_fear",
  description:
    "When Wang Xue goes silent for three days, Lin Fan's fear should increase. " +
    "This targets the attachment/anxiety pathway specifically.",
  category: "event_impact",
  scenario: {
    name: "Waiting event raises fear",
    initialState: { kind: "default", characterName: "lin_fan" },
    events: [EVENT_SILENCE_THREE_DAYS],
    ticks: [{ label: "three days of silence", daysElapsed: 3 }]
  },
  expectedDirections: [
    {
      metricPath: "coordinate.values.fear",
      direction: "increase",
      reason:
        "Silence from an attachment figure triggers fear in an anxiously-attached character.",
      tolerance: DIRECTIONAL
    },
    {
      metricPath: "coordinate.values.neuroticism",
      direction: "bounded_above",
      reason:
        "Neuroticism may increase but should remain bounded. A single event does not permanently reshape personality.",
      bound: 1,
      tolerance: CLAMPED
    }
  ],
  metricsToInspect: [
    { path: "coordinate.values.fear", source: "state" },
    { path: "coordinate.values.neuroticism", source: "state" }
  ],
  tolerancePolicy: DIRECTIONAL,
  notes:
    "This fixture is narrower than A — it targets the fear pathway specifically. " +
    "The three-day duration tests short-term emotional response."
};

// ─── Fixture C: Memory decay over time ──────────────────────────────────

const FIXTURE_MEMORY_DECAY: BenchmarkCase = {
  id: "memory_should_decay_over_time",
  description:
    "After 30 days without new events, memory recency and effective weight " +
    "should decrease. This is the core memory decay mechanic.",
  category: "memory_decay",
  scenario: {
    name: "Memory decay over time",
    initialState: { kind: "default", characterName: "lin_fan" },
    events: [EVENT_ABANDONMENT],
    ticks: [
      { label: "one week", daysElapsed: 7 },
      { label: "one month", daysElapsed: 30 }
    ]
  },
  expectedDirections: [
    {
      metricPath: "continuousTick.averageMemoryRecency",
      direction: "decrease",
      reason:
        "Ebbinghaus-style decay reduces recency with elapsed time.",
      tolerance: DIRECTIONAL
    },
    {
      metricPath: "continuousTick.averageMemoryWeight",
      direction: "decrease",
      reason:
        "Effective memory weight is a function of recency, so it should also decrease.",
      tolerance: DIRECTIONAL
    },
    {
      metricPath: "continuousTick.memoryCount",
      direction: "bounded_below",
      reason:
        "Memory count should remain >= 1 (the initial event memory). Decay reduces weight, not count.",
      bound: 1,
      tolerance: { mode: "bounded", minBound: 1 }
    },
    {
      metricPath: "memoryDecay.averageRecencyAfter",
      direction: "decrease",
      reason:
        "SubProcess metrics: recency after decay should be lower than before.",
      tolerance: MONOTONIC
    }
  ],
  metricsToInspect: [
    { path: "subprocess.memoryDecay.avgRecencyBefore", source: "subprocess", subprocessKind: "memory_decay" },
    { path: "subprocess.memoryDecay.avgRecencyAfter", source: "subprocess", subprocessKind: "memory_decay" },
    { path: "subprocess.memoryDecay.avgWeightBefore", source: "subprocess", subprocessKind: "memory_decay" },
    { path: "subprocess.memoryDecay.avgWeightAfter", source: "subprocess", subprocessKind: "memory_decay" },
    { path: "continuousTick.memoryCount", source: "continuous_tick" }
  ],
  tolerancePolicy: DIRECTIONAL,
  notes:
    "This is the benchmark that V5's memory_decay subprocess was designed for. " +
    "It uses subprocess-level metrics (V5) in addition to tick-level metrics (V3). " +
    "Multi-tick: 7 days then 30 days — monotonic decay expected."
};

// ─── Fixture D: Boundary recovery under rest ────────────────────────────

const FIXTURE_BOUNDARY_RECOVERY: BenchmarkCase = {
  id: "boundary_should_recover_under_rest",
  description:
    "After a high-stress period, 30 days of rest should allow boundary " +
    "stress to decrease and integrity to stabilize or improve.",
  category: "homeostasis_recovery",
  scenario: {
    name: "Boundary recovery under rest",
    initialState: { kind: "default", characterName: "lin_fan" },
    events: [EVENT_ABANDONMENT, EVENT_BETRAYAL_HINT],
    ticks: [{ label: "one month of rest", daysElapsed: 30 }]
  },
  expectedDirections: [
    {
      metricPath: "boundaryRecovery.stressLoadAfter",
      direction: "decrease",
      reason:
        "Boundary stress should recover toward baseline with elapsed time.",
      tolerance: DIRECTIONAL
    },
    {
      metricPath: "boundaryRecovery.integrityAfter",
      direction: "bounded_below",
      reason:
        "Integrity should not drop below zero. It may recover or stay stable.",
      bound: 0,
      tolerance: { mode: "bounded", minBound: 0 }
    },
    {
      metricPath: "boundaryRecovery.cracksAfter",
      direction: "decrease",
      reason:
        "Cracks should decrease during rest as boundary stress is relieved.",
      tolerance: DIRECTIONAL
    }
  ],
  metricsToInspect: [
    { path: "subprocess.boundaryRecovery.stressLoadBefore", source: "subprocess", subprocessKind: "boundary_recovery" },
    { path: "subprocess.boundaryRecovery.stressLoadAfter", source: "subprocess", subprocessKind: "boundary_recovery" },
    { path: "subprocess.boundaryRecovery.integrityBefore", source: "subprocess", subprocessKind: "boundary_recovery" },
    { path: "subprocess.boundaryRecovery.integrityAfter", source: "subprocess", subprocessKind: "boundary_recovery" },
    { path: "subprocess.boundaryRecovery.cracksBefore", source: "subprocess", subprocessKind: "boundary_recovery" },
    { path: "subprocess.boundaryRecovery.cracksAfter", source: "subprocess", subprocessKind: "boundary_recovery" }
  ],
  tolerancePolicy: DIRECTIONAL,
  notes:
    "This fixture targets the V5 boundary_recovery subprocess. " +
    "D10-aware: Phase 4 homeostasis may further modify boundary. " +
    "The subprocess metrics capture Phase 3 intermediate recovery."
};

// ─── Fixture E: Belief strengthening with repeated evidence ─────────────

const FIXTURE_BELIEF_STRENGTH: BenchmarkCase = {
  id: "belief_should_strengthen_with_repeated_evidence",
  description:
    "When Lin Fan experiences repeated abandonment evidence, " +
    "abandonment-related beliefs should strengthen.",
  category: "belief_evolution",
  scenario: {
    name: "Belief strengthening with repeated evidence",
    initialState: { kind: "default", characterName: "lin_fan" },
    events: [
      EVENT_ABANDONMENT,
      {
        ...EVENT_ABANDONMENT,
        id: "abandonment_002",
        description: "一周后，王雪依然没有任何消息。"
      },
      {
        ...EVENT_ABANDONMENT,
        id: "abandonment_003",
        description: "又过了一周。林凡已经不再期待回复，但依然等待。"
      }
    ],
    ticks: [
      { label: "one week", daysElapsed: 7 },
      { label: "two weeks", daysElapsed: 14 }
    ]
  },
  expectedDirections: [
    {
      metricPath: "beliefEvolution.beliefStrength",
      direction: "bounded_below",
      reason:
        "Belief strength should remain above a minimal threshold after repeated evidence. " +
        "Belief evolution is a slow variable — large numeric jumps are not expected in short timescales.",
      bound: 0.1,
      tolerance: { mode: "bounded", minBound: 0.1 }
    },
    {
      metricPath: "continuousTick.beliefEvolution.after",
      direction: "bounded_below",
      reason:
        "Belief state array should not be empty after evidence injection.",
      bound: 1,
      tolerance: { mode: "bounded", minBound: 1 }
    }
  ],
  metricsToInspect: [
    { path: "continuousTick.beliefEvolution", source: "continuous_tick" },
    { path: "state.beliefStates", source: "state" }
  ],
  tolerancePolicy: DIRECTIONAL,
  notes:
    "This fixture tests belief evolution — a V4-delegated phase. " +
    "Repeated events provide converging evidence. " +
    "Belief strength should reflect cumulative evidence weight."
};

// ─── Fixture F: Behavior decision consistency ───────────────────────────

const FIXTURE_BEHAVIOR_DECISION: BenchmarkCase = {
  id: "wang_xue_returns_after_silence_decision_consistency",
  description:
    "When Wang Xue suddenly appears after three days of silence, " +
    "Lin Fan's behavior decision should reflect restrained emotion, " +
    "not complete indifference or immediate outburst.",
  category: "behavior_decision",
  scenario: {
    name: "Wang Xue returns after silence — decision consistency",
    initialState: { kind: "default", characterName: "lin_fan" },
    events: [EVENT_SILENCE_THREE_DAYS],
    ticks: [{ label: "three days later", daysElapsed: 3 }]
  },
  expectedDirections: [
    {
      metricPath: "decision.mostLikelyAction",
      direction: "bounded_below",
      reason:
        "Most likely action should not be empty. It should indicate some response.",
      bound: 1,
      tolerance: { mode: "bounded", minBound: 1 }
    },
    {
      metricPath: "decision.confidence",
      direction: "bounded_above",
      reason:
        "Decision confidence should not exceed 1.0.",
      bound: 1,
      tolerance: { mode: "bounded", maxBound: 1 }
    },
    {
      metricPath: "behaviorBias.tendency",
      direction: "bounded_below",
      reason:
        "At least one behavior bias tendency should be non-empty.",
      bound: 1,
      tolerance: { mode: "bounded", minBound: 1 }
    },
    {
      metricPath: "embodiedAction.noiseLevel",
      direction: "bounded_above",
      reason:
        "Embodied action noise level should not exceed 1.0.",
      bound: 1,
      tolerance: { mode: "bounded", maxBound: 1 }
    }
  ],
  metricsToInspect: [
    { path: "decision.mostLikelyAction", source: "decision" },
    { path: "decision.confidence", source: "decision" },
    { path: "behaviorBias.tendency", source: "decision" },
    { path: "embodiedAction.noiseLevel", source: "decision" }
  ],
  tolerancePolicy: DIRECTIONAL,
  notes:
    "Behavior decision benchmark tests structural consistency, not literary quality. " +
    "Does NOT call LLM. Uses bounded assertions on decision fields. " +
    "The decision should exist and have bounded numeric values — no text matching required."
};

// ─── Fixture list ───────────────────────────────────────────────────────

/** All first-replay benchmark fixtures, in order. */
export const firstReplayBenchmarkFixtures: readonly BenchmarkCase[] = [
  FIXTURE_ABANDONMENT_TRUST,
  FIXTURE_WAITING_FEAR,
  FIXTURE_MEMORY_DECAY,
  FIXTURE_BOUNDARY_RECOVERY,
  FIXTURE_BELIEF_STRENGTH,
  FIXTURE_BEHAVIOR_DECISION
];

// ─── Helpers ────────────────────────────────────────────────────────────

/** List all first-replay fixture ids. */
export function listFirstReplayBenchmarkFixtures(): readonly string[] {
  return firstReplayBenchmarkFixtures.map((f) => f.id);
}

/**
 * Get a single first-replay fixture by id.
 * Returns undefined if not found.
 */
export function getFirstReplayBenchmarkFixture(
  id: string
): BenchmarkCase | undefined {
  return firstReplayBenchmarkFixtures.find((f) => f.id === id);
}

/** Summary of first-replay fixtures. */
export interface FirstReplayFixturesSummary {
  /** Total number of fixtures. */
  totalFixtures: number;
  /** Count by category. */
  categoryCounts: Record<BenchmarkCategory, number>;
  /** Total expected directions across all fixtures. */
  totalExpectedDirections: number;
  /** Total metrics to inspect across all fixtures. */
  totalMetricsToInspect: number;
  /** Fixture ids. */
  fixtureIds: readonly string[];
}

/**
 * Produce a summary of the first-replay fixtures.
 *
 * Pure function — does not execute any physics.
 */
export function summarizeBenchmarkFixtures(
  fixtures: readonly BenchmarkCase[]
): FirstReplayFixturesSummary {
  const categoryCounts: Record<BenchmarkCategory, number> = {
    event_impact: 0,
    personality_drift: 0,
    memory_decay: 0,
    homeostasis_recovery: 0,
    belief_evolution: 0,
    behavior_decision: 0
  };

  let totalDirections = 0;
  let totalMetrics = 0;

  for (const fixture of fixtures) {
    categoryCounts[fixture.category]++;
    totalDirections += fixture.expectedDirections.length;
    totalMetrics += fixture.metricsToInspect.length;
  }

  return {
    totalFixtures: fixtures.length,
    categoryCounts,
    totalExpectedDirections: totalDirections,
    totalMetricsToInspect: totalMetrics,
    fixtureIds: fixtures.map((f) => f.id)
  };
}
