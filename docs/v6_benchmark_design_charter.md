# CharacterOS V6 Benchmark Design Charter

## 版本

```text
CharacterOS V6.0 — Benchmark Design Charter
Date: 2026-06-23
Based on: V5 Temporal Process Decomposition (Complete)
Status: DESIGN ONLY, NO CODE
```

## 当前验证

```text
npm run build        ✓ passed
npm test             ✓ 79 files, 465 tests, zero failures
npm run next:build   ✓ 16 API routes, zero errors
```

---

## 1. V6 核心目标

### V6 是什么

```text
V6 = Benchmark System

V6 的任务是建立一套结构化、可复现、方向性优先的 benchmark 框架。
Benchmark 不追求 "正确性" — CharacterOS 不是物理学引擎。
Benchmark 追求 "可测量性"、"可回归性"、"可比较性"。

V6 回答以下问题：
  - "memory decay 单独贡献了多少 personality drift？"
  - "boundary recovery 能抵抗多大压力？"
  - "同样事件为什么对不同角色产生不同结果？"
  - "homeostasis 多大程度上稳定了系统？"
  - "subprocess 指标之间的比例关系在回归后是否保持不变？"
```

### V6 不是什么

```text
V6 不是前端。                        → 永久排除
V6 不是 graph / 可视化。              → V7 (data model) + V8 (viewer)
V6 不是多角色系统。                    → V20+
V6 不是世界模拟。                      → V50+
V6 不是心理学真理系统。                → 永久排除
V6 不是 LLM 文学质量评判。             → 永久排除
V6 不是 AGI 能力测试。                 → 永久排除
V6 不是 precision calibration tool。   → V6 优先方向，不追求精确数值
```

---

## 2. 为什么现在可以做 Benchmark

```text
V3/V4/V5 为 benchmark 提供了完整的基础设施：

V3 (Stable Candidate):
  - Character Physics Core — 14 subsystems, stable behavior
  - Event → Memory → Personality Drift pipeline
  - Export/import integrity — state is serializable and round-trippable
  - 256 tests establishing baseline behavior

V4 (Temporal Homeostasis Layer):
  - UnifiedTickTrace — per-process trace for 17 phases
  - InternalStateField — 46 state variables with deviation/pressure/risk
  - Homeostasis as first-class principle — D10 overwrite semantics
  - 4/5 mutation phases delegated — observable via adapter traces
  - 151 temporal tests

V5 (Temporal Process Decomposition):
  - 4 subProcess traces inside decay_and_recovery:
    memory_decay, procedural_decay, boundary_recovery, reward_recovery
  - Each subprocess has pre/post metrics suitable for directional assertions
  - D10-aware instrumentation for boundary/reward recovery
  - 58 subprocess tests

没有这些基础设施，benchmark 只能面对 composite black box。
有了它们，benchmark 可以针对每个子操作做 targeted measurement。
```

---

## 3. Benchmark 要测什么

### 3.1 Event Impact Benchmark

```text
目标：测量单个事件对 character state 的影响路径。

测试内容：
  - 事件 → impactScore 计算的稳定性
  - 事件 → boundary stress/cracks 的方向正确性
  - 事件 → memory recency/importance 的合理性
  - 事件 → reward dopamine 的预期变化

metric sources: PhysicsStepResult, impactScore, boundaryBefore/After, rewardBefore/After
```

### 3.2 Personality Drift Benchmark

```text
目标：测量长期连续 tick 对 personality coordinate 的累积影响。

测试内容：
  - trust 在 abandonment events 后的 drift 方向
  - fear 在 threatening events 后的 drift 方向
  - drift magnitude vs daysElapsed 的关系
  - drift 是否 monotonic 或 bounded
  - memory decay 对 drift 的独立贡献（通过 subProcess metrics）

metric sources: PersonalityCoordinate before/after, ContinuousTickTrace.coordinate metrics,
                memory_decay subProcess metrics
```

### 3.3 Memory Decay Benchmark

```text
目标：独立测量 memory decay 的效果。

测试内容：
  - recency decay curve (ebbinghaus) — directional: down
  - effectiveWeight decay — directional: down
  - decay rate vs metaState.memoryStrength 的关系
  - decay rate vs metaState.forgettingSpeed 的关系
  - 空 memories → count=0, no crash
  - 多 memories → avgRecencyBefore > avgRecencyAfter 在 daysElapsed > 0 时

metric sources: ContinuousTickTrace.memoryCount/avgRecency/avgWeight,
                memory_decay subProcess metrics
```

### 3.4 Homeostasis / Recovery Benchmark

```text
目标：测量 homeostasis 和 recovery 的交互效果。

测试内容：
  - boundary stress recovery: stressAfter < stressBefore
  - boundary integrity recovery: integrityAfter >= integrityBefore
  - reward dopamine recovery: dopamine moves toward baseline (0.42)
  - reward craving recovery: craving moves toward baseline (0.18)
  - D10 overwrite: final state equals regulated value, NOT Phase 3 intermediate
  - homeostasis pressure vs system deviation 的关系

metric sources: boundary_recovery subProcess, reward_recovery subProcess,
                homeostasis trace (pressure/resistance/regulationRate),
                InternalStateField homeostaticPressure
```

### 3.5 Belief Evolution Benchmark

```text
目标：测量 belief 强度在 decaying memory evidence 下的演化。

测试内容：
  - belief strength 在 abandonment memories 后是否反映 evidence
  - belief strength 在 conflicting evidence 后的移动方向
  - belief evolution 不直接重写 personality coordinate

metric sources: BeliefEvolutionTrace, beliefStates before/after,
                memory decay 影响 evidence freshness
```

### 3.6 Behavior Decision Consistency Benchmark

```text
目标：测量行为决策在可复现输入下的稳定性。

测试内容：
  - 同一 state + 同一 cue → consistent behavior activation
  - boredom level 对 novelty-seeking 的影响方向
  - attention profile danger/safety/novelty 比率的方向性

metric sources: BehaviorDecisionResult, AttentionProfile, BoredomTickTrace
```

---

## 4. Benchmark 不测什么

```text
明确排除以下内容，防止 scope creep：

1. 不评判文学质量
   Benchmark 不判断 "output is beautiful" 或 "narrative is compelling"。
   这是文学批评的范畴，不是测量系统的范畴。

2. 不评判剧情精彩度
   "这个剧情好吗" 不是 benchmark 问题。
   "trust 在这个剧情后下降了吗" 才是。

3. 不做真人心理诊断
   CharacterOS 模拟的不是真实人类心理。
   Benchmark 不声称可以诊断、预测或治疗心理状况。

4. 不做 AGI 能力测试
   CharacterOS 不是通用人工智能。
   "角色通过图灵测试" 不是 benchmark 目标。

5. 不用 LLM 主观打分作为唯一标准
   如果未来使用 LLM 辅助评估，必须配合数值指标。
   "LLM says 剧情好" 不是 benchmark pass/fail 的依据。
```

---

## 5. Benchmark 数据结构草案

### 5.1 BenchmarkCase

```typescript
/**
 * A single benchmark case — one scenario applied to one character.
 */
interface BenchmarkCase {
  /** Unique id for this case. */
  id: string;
  /** Human-readable description of what this case tests. */
  description: string;
  /** Which category of benchmark this belongs to. */
  category: BenchmarkCategory;
  /** The scenario to execute. */
  scenario: BenchmarkScenario;
  /** Expected behavioral directions. */
  expectedDirections: BenchmarkExpectedDirection[];
  /** Which metrics to collect for this case. */
  metricsToInspect: BenchmarkMetricSpec[];
  /** Tolerance policy for this case. */
  tolerancePolicy: BenchmarkTolerancePolicy;
  /** Optional notes for human readers. */
  notes?: string;
}
```

### 5.2 BenchmarkCategory

```typescript
type BenchmarkCategory =
  | "event_impact"
  | "personality_drift"
  | "memory_decay"
  | "homeostasis_recovery"
  | "belief_evolution"
  | "behavior_decision";
```

### 5.3 BenchmarkScenario

```typescript
/**
 * A scenario defines: initial state, events, and ticks to execute.
 */
interface BenchmarkScenario {
  /** Human-readable scenario name. */
  name: string;
  /** Initial character state (can be a blueprint reference). */
  initialState: CharacterPhysicsState;
  /** Events to inject before ticking. */
  events: BenchmarkInputEvent[];
  /** Continuous ticks to execute after events. */
  ticks: BenchmarkTickSpec[];
  /** Which subprocess traces to collect (if any). */
  collectSubProcesses?: TemporalSubProcessKind[];
}
```

### 5.4 BenchmarkInputEvent

```typescript
/**
 * A benchmark input event — deterministic, no randomness.
 */
interface BenchmarkInputEvent {
  id: string;
  description: string;
  tags: string[];
  category: ExperienceCategory;
  intensity: number;           // [0, 1]
  importance: number;          // [0, 1]
  relationshipWeight: number;  // [0, 1]
  expectationGap: number;      // [0, 1]
  personalitySensitivity: number; // [0, 1]
}
```

### 5.5 BenchmarkTickSpec

```typescript
/**
 * A tick specification for the benchmark.
 */
interface BenchmarkTickSpec {
  /** Label for this tick step (e.g. "7 days of silence"). */
  label: string;
  /** Days elapsed for this tick. */
  daysElapsed: number;
  /** Optional memory decay rate override. */
  memoryDecayRate?: number;
}
```

### 5.6 BenchmarkExpectedDirection

```typescript
/**
 * An expected direction assertion.
 *
 * CharacterOS benchmark prioritizes DIRECTION over precision.
 * "trust should decrease" is measurable.
 * "trust should be exactly 0.347" is fragile.
 */
interface BenchmarkExpectedDirection {
  /** Path to the metric (dot-separated, e.g. "coordinate.values.trust"). */
  metricPath: string;
  /** Expected direction of change. */
  direction: "increase" | "decrease" | "unchanged" | "bounded_above" | "bounded_below";
  /** Optional human-readable reason. */
  reason: string;
  /** Optional bound value for bounded_above/bounded_below. */
  bound?: number;
}
```

### 5.7 BenchmarkMetric

```typescript
/**
 * A collected metric from a benchmark run.
 */
interface BenchmarkMetric {
  /** Path matching BenchmarkExpectedDirection.metricPath. */
  path: string;
  /** Value before the scenario executed. */
  valueBefore: number;
  /** Value after the scenario executed. */
  valueAfter: number;
  /** Absolute delta. */
  delta: number;
  /** Source of this metric (which trace/snapshot). */
  source: MetricSource;
}
```

### 5.8 BenchmarkResult

```typescript
/**
 * Result of running one benchmark case.
 */
interface BenchmarkResult {
  caseId: string;
  verdict: "pass" | "fail" | "inconclusive" | "error";
  /** Direction assertions and whether they held. */
  directionResults: DirectionAssertionResult[];
  /** Collected metrics. */
  metrics: BenchmarkMetric[];
  /** Warnings about tolerance, missing metrics, etc. */
  warnings: string[];
  /** Human-readable explanation of the verdict. */
  explanation: string;
  /** Execution duration in ms. */
  durationMs: number;
}
```

### 5.9 DirectionAssertionResult

```typescript
interface DirectionAssertionResult {
  expectedDirection: BenchmarkExpectedDirection;
  actualDelta: number;
  passed: boolean;
  reason: string;
}
```

### 5.10 BenchmarkTolerance

```typescript
/**
 * Tolerance policy for a benchmark case.
 */
interface BenchmarkTolerancePolicy {
  /** Tolerance mode for numeric comparisons. */
  numericMode: NumericToleranceMode;
  /** Minimum absolute difference to consider a change "real". */
  minimumAbsoluteDelta?: number;
  /** Maximum allowed deviation from expected bound. */
  boundTolerance?: number;
}

type NumericToleranceMode =
  | "exact"        // values must be exactly equal (e.g. coordinate integrity)
  | "approximate"  // values must be within floating-point epsilon
  | "directional"  // only direction matters, not magnitude
  | "monotonic"    // values must move in the same direction across ticks
  | "bounded"      // values must stay within a specified range
  | "invariant";   // value must not change at all
```

---

## 6. Expected Direction，不是精确数值

```text
CharacterOS benchmark 的核心哲学：

  测量方向，不是精确值。

原因：
  1. CharacterOS 是一个 emergent system。
     同一事件对不同角色产生不同数值结果，这是预期行为，不是 bug。

  2. 精确数值断言的脆弱性：
     "trust after 7 days = 0.347" — 任何一个参数的微小调整都会破坏这个断言。
     "trust after 7 days < trust before 7 days" — 这个断言在参数调整下仍然成立。

  3. 方向断言的可迁移性：
     如果角色 A 的 trust 在 abandonment event 后下降，
     角色 B（不同 personality）的 trust 也应该下降。
     Direction 相同，magnitude 可以不同。

  4. 例外：
     结构性不变量可以使用 exact/invariant tolerance：
     - "coordinate.values.trust should not change after a zero-day tick"
     - "final state.boundary should equal homeostasis.regulatedBoundary" (D10)
     - "state.memories.length >= 0 for all ticks"
```

### 方向断言示例

```text
✓ "trust should decrease after abandonment event"
✓ "fear should increase after threatening event"
✓ "memory recency should decrease with daysElapsed > 0"
✓ "boundary stress should recover toward baseline over time"
✓ "reward dopamine should move toward 0.42 baseline"
✓ "belief strength should reflect memory evidence direction"
✓ "homeostasis pressure should be higher when system is far from baseline"

✗ "trust should be exactly 0.347 after 14 days"
✗ "fear should increase by exactly 0.128"
✗ "memory weight should drop by exactly 0.045"
✗ "this event is 'traumatic'" (subjective classification)
```

---

## 7. Replay Fixture Format

```text
Benchmark 的基础是可复现。
Replay fixture 是 benchmark 的最小可执行单元。

Fixture 必须包含：
  - initialState
  - events
  - ticks
  - expectedDirections
  - metricsToInspect
  - tolerancePolicy
  - notes
```

### Fixture 结构草案

```typescript
/**
 * A replay fixture is a self-contained benchmark specification.
 * It can be serialized to JSON and shared across runs.
 */
interface BenchmarkFixture {
  /** Semantic version of the fixture format. */
  formatVersion: "6.0.0";

  /** Unique fixture identifier. */
  fixtureId: string;

  /** Human-readable description. */
  description: string;

  /** Category this fixture belongs to. */
  category: BenchmarkCategory;

  /** Initial character state specification. */
  initialState: BenchmarkInitialStateSpec;

  /** Events to inject (in order). */
  events: BenchmarkInputEvent[];

  /** Continuous ticks to execute (in order). */
  ticks: BenchmarkTickSpec[];

  /** Expected directional outcomes. */
  expectedDirections: BenchmarkExpectedDirection[];

  /** Which metrics to collect. */
  metricsToInspect: BenchmarkMetricSpec[];

  /** Tolerance policy. */
  tolerancePolicy: BenchmarkTolerancePolicy;

  /** Human-readable notes. */
  notes: string;
}

/**
 * How to obtain the initial character state.
 */
type BenchmarkInitialStateSpec =
  | { kind: "blueprint"; blueprintId: string }
  | { kind: "default_lan_fan" }
  | { kind: "inline"; state: CharacterPhysicsState };
```

### 最小 Fixture 示例

```json
{
  "formatVersion": "6.0.0",
  "fixtureId": "memory_decay_basic_001",
  "description": "Single abandonment memory decays over 30 days",
  "category": "memory_decay",
  "initialState": { "kind": "default_lan_fan" },
  "events": [
    {
      "id": "abandonment_001",
      "description": "重要的人消失了七天。",
      "tags": ["失联", "亲密关系", "等待"],
      "category": "abandonment",
      "intensity": 0.75,
      "importance": 0.8,
      "relationshipWeight": 0.9,
      "expectationGap": 0.85,
      "personalitySensitivity": 0.88
    }
  ],
  "ticks": [
    { "label": "one week", "daysElapsed": 7 },
    { "label": "one month", "daysElapsed": 30 }
  ],
  "expectedDirections": [
    {
      "metricPath": "memoryDecay.averageRecency",
      "direction": "decrease",
      "reason": "Recency decays with elapsed time."
    },
    {
      "metricPath": "memoryDecay.averageEffectiveWeight",
      "direction": "decrease",
      "reason": "Effective weight is a function of recency."
    }
  ],
  "metricsToInspect": [
    { "path": "memoryDecay.averageRecency", "source": "subprocess" },
    { "path": "memoryDecay.averageEffectiveWeight", "source": "subprocess" },
    { "path": "coordinate.values.trust", "source": "state" }
  ],
  "tolerancePolicy": { "numericMode": "directional" },
  "notes": "Baseline memory decay test. 验证 recency 和 effectiveWeight 的时间衰减方向。"
}
```

---

## 8. Metric Sources

```text
Benchmark 可以从以下来源读取数据。
这些来源在 V3/V4/V5 已经存在且测试覆盖。

1. CharacterPhysicsState (V3)
   - coordinate.values.* (trust, fear, neuroticism, ...)
   - boundary (stressLoad, integrity, cracks, phase)
   - rewardState (dopamineLevel, craving, ...)
   - metaState (emotionalSensitivity, resilience, ...)
   - memories[].recency, importance, repetitionCount

2. PhysicsStepResult (V3)
   - impactScore.value, impactScore.band
   - memoryNode (created memory)
   - coordinateDelta
   - trace (step transaction)

3. ContinuousTickTrace (V3)
   - phases[].name, changedStates, reasons
   - phases[2].subProcesses[] (V5)
   - memoryCount, avgRecency, avgWeight
   - proceduralRoutineCount, avgStrength
   - homeostasis (pressure, resistance)
   - boundaryBefore/After
   - rewardBefore/After

4. UnifiedTickTrace (V4)
   - processTraces[].adapterStatus, mutationPolicy
   - mutationSummary.actualChangedStateNames
   - coverageSummary

5. InternalStateFieldSnapshot (V4)
   - 46 variables with deviation, pressure, risk
   - per-domain drill-down (boundary, reward, meta, ...)
   - homeostaticPressure per variable

6. SubProcessTrace (V5)
   - memory_decay: count, recencyBefore/After, weightBefore/After
   - procedural_decay: count, strengthBefore/After
   - boundary_recovery: stressBefore/After, integrityBefore/After, cracksBefore/After
   - reward_recovery: dopamineBefore/After, thresholdBefore/After, cravingBefore/After

7. Exported state (V3)
   - State integrity — round-trip export/import preserves coordinate
   - Serialization — JSON stringify/parse is consistent

8. Decision derived state (V3)
   - BehaviorDecisionResult
   - AttentionProfile (danger, safety, novelty, social)
   - BoredomState (boredomLevel, explorationDrive, inspirationChance)
```

---

## 9. Tolerance Policy

```text
不同 benchmark case 需要不同的 tolerance 模式。

tolerance policy 不应该 one-size-fits-all。
每个 fixture 声明自己的 tolerance。
```

### Tolerance 模式

| mode | 含义 | 适用场景 | 失败含义 |
|------|------|----------|---------|
| `exact` | `a === b` (within Number.EPSILON) | 结构性不变量 (D10 overwrite, coordinate integrity) | 系统不变量被破坏 |
| `approximate` | `\|a - b\| < epsilon` (usually 1e-6) | 浮点计算一致性 | 浮点实现改变 |
| `directional` | `sign(delta) === expected_sign` | 行为方向 (trust↓, fear↑) | 行为方向反转 |
| `monotonic` | values move consistently in one direction across multi-tick | 连续衰减/恢复 (recency decay) | 衰减/恢复模式异常 |
| `bounded` | value stays in `[low, high]` | 值范围约束 (clamp01, coordinate) | 值越界 |
| `invariant` | value does not change | 核心约束 (daysElapsed=0 → no change) | 不应变的变了 |

### Tolerance 组合

```text
一个 fixture 可以对不同 metric 使用不同 tolerance。
例如 memory_decay fixture:
  - recency: directional (应该下降)
  - memoryCount: bounded (>= 0)
  - coordinate.values.trust: directional (0-day tick) 或 invariant (tick 不影响 coordinate directly)
```

---

## 10. V6 分阶段路线

```text
V6.0  Benchmark Design Charter         (本阶段)  — 设计文档
V6.1  Benchmark Types                  (代码)    — 类型定义文件
V6.2  First Replay Fixtures            (代码)    — 2-4 个手写 fixture
V6.3  Directional Assertion Engine     (代码)    — 执行 fixture + 收集 metrics + 判断方向
V6.4  Memory Decay Benchmark           (代码)    — memory_decay focused 测试
V6.5  Homeostasis Recovery Benchmark   (代码)    — boundary/reward recovery focused 测试
V6.6  Belief Evolution Benchmark       (代码)    — belief strength focused 测试
V6.7  Benchmark Report API             (代码)    — API route: GET /api/benchmark/report
V6.8  Benchmark Governance Report      (文档)    — 汇总所有 benchmark 结果 + 回归基线
```

### 每阶段约束

```text
V6.1-V6.8:
  - 不改 V3/V4/V5 核心行为
  - 不改 runContinuousTick
  - 不改 CharacterPhysicsState 结构
  - 不改 subProcess builders
  - 只增加 benchmark 代码

Graph 进入 V7 (data model) + V8 (viewer)。
V6 不做 graph，但 benchmark 结果为 graph edge weights 提供数据。
```

---

## 11. 风险

### R1: 过早追求精确数值

```text
风险：把 "trust after 14 days = 0.347" 作为 regression target。
影响：任何参数调整都会破坏断言 → 脆弱的 benchmark → 被忽略的 benchmark。

缓解：
  - V6 优先 directional assertions
  - exact/approximate tolerance 只用于结构性不变量
  - directional 失败才是真正的 regression
```

### R2: 把 benchmark 当成心理学真理

```text
风险：用 benchmark pass/fail 判断 "角色是否真实"。
影响：引入 unrealistic expectations → benchmark 变成文学批评工具。

缓解：
  - 文档明确声明：benchmark 测量系统行为，不评判心理真实性
  - benchmark verdict 解释为什么 pass/fail，不输出 "角色真实度评分"
```

### R3: LLM 输出不稳定

```text
风险：如果未来 benchmark 使用 LLM 辅助评估。
影响：同一输入产生不同输出 → 不可复现的 benchmark。

缓解：
  - V6 benchmark 不依赖 LLM 评判
  - 所有 metric 来自数值路径（state, trace, subprocess）
  - 如果使用 LLM（V7+），必须配合数值指标，不能作为唯一标准
```

### R4: 过拟合测试

```text
风险：benchmark 数量过多 → 开发被 benchmark 绑架 → 不敢改代码。
影响：benchmark 变成 innovation blocker。

缓解：
  - benchmark 是 "canary in coal mine"，不是 "specification by example"
  - benchmark fail → investigate, not automatically revert
  - governance report 区分 "expected change" vs "regression"
```

### R5: Benchmark 反过来扭曲角色真实感

```text
风险：为了通过 benchmark 而调整参数 → 角色行为变 "标准" 但失去个性。
影响：CharacterOS 变成 benchmark-passing machine。

缓解：
  - benchmark 测量的是 emergent properties，不是 tuning targets
  - 不同角色应该有不同的 benchmark baseline
  - 不要求所有角色在相同 benchmark 上产生相同数值结果
```

### R6: 数据集太小

```text
风险：只有 1-2 个角色作为 benchmark target。
影响：benchmark 只对林帆有效 → 过拟合。

缓解：
  - V6 early fixtures 使用林帆 + 默认角色
  - cross-character comparison 是 V6.4+ 目标
  - 每个 fixture 可以指定 different initial states
```

### R7: 事件标签偏语言/文化

```text
风险：benchmark events 使用中文标签（"失联", "亲密关系"）。
影响：非中文使用者可能误解 event semantics。

缓解：
  - event description 同时包含中英文
  - fixture notes 解释 event 的心理含义
  - V6.7+ 可考虑多语言 fixture
```

---

## 12. 成功标准

### 必须达成

| 标准 | 描述 | 验证方式 |
|------|------|---------|
| S1: V3/V4/V5 tests remain passing | benchmark 代码不破坏现有行为 | `npm test` — 465 tests, zero failures |
| S2: benchmark can detect regression | 如果行为意外改变，benchmark 应失败 | 手动引入一个 behavior change → benchmark fail |
| S3: benchmark explains why pass/fail | 每个 verdict 附带 human-readable explanation | 审查 benchmark output |
| S4: benchmark focuses on direction | 优先方向断言，不是精确数值 | 审查 fixture 定义 |
| S5: benchmark can grow gradually | 从 2-4 fixtures 开始，逐步增加 | 每个 V6.x 阶段增加少量 fixtures |

### 可选达成

| 标准 | 描述 |
|------|------|
| S6: cross-character comparison | 同一 fixture 在 2 个不同角色上运行 |
| S7: benchmark report API | `GET /api/benchmark/report` 返回结构化结果 |
| S8: benchmark history | 保存多次 benchmark run 的结果以跟踪趋势 |
| S9: CI integration | `npm run benchmark` 在 CI 中运行 |

---

## 13. Graph 的位置

```text
V6 不做 graph / 可视化。

但 benchmark 结果直接为 future graph 提供 edge weights：

  V5 subProcess metrics → V6 benchmark → V6 benchmark result
                                          ↓
                                    V7 Graph Data Model
                                    - nodes: state variables, subprocesses
                                    - edges: benchmark-measured causal relationships
                                    - weights: directional consistency across benchmarks
                                          ↓
                                    V8 Graph Viewer
                                    - visualize causal network
                                    - highlight regression paths
                                    - compare character profiles

举例：
  memory_decay benchmark 测量: recency ↓ → effectiveWeight ↓ → personality drift
  这些 directional relationships 在 V7 可以建模为 causal graph 的 edges。

  boundary_recovery benchmark 测量: stressLoad ↓ → integrity ↑ → resilience ↑
  但 homeostasis 会覆盖 → D10 edge 记录 overwrite relationship。

V6 专注于产生可靠的 directional measurements。
V7 将这些 measurements 组织成 graph structure。
V8 将 graph 可视化。
```

---

## 14. 最终声明

```text
CharacterOS V6 starts as Benchmark Design, not benchmark implementation.

V3/V4/V5 为 V6 提供了完整的基础设施：
  - stable physics core (256 tests)
  - temporal process observability (151 temporal tests)
  - subprocess decomposition (58 subprocess tests)
  - 46-variable internal state field
  - export/import integrity

V6 不评判 "角色是否真实" 或 "剧情是否精彩"。
V6 只测量系统的可复现行为，优先方向而非精确数值。

V6.0 Design Charter 完成后，V6.1 开始写类型定义。
V6.2 开始制作第一批 replay fixtures。
V6.3 构建 directional assertion engine。

Benchmark 是 garden，不是 wall。
它应该支持系统成长，而不是阻止系统演化。
```

## 验证

```text
npm run build        ✓
npm test             ✓ 79 files, 465 tests
npm run next:build   ✓ 16 API routes
```

本阶段无代码改动。verification 确认 V3/V4/V5 基座仍然完整。

已通过所有测试。
已完成
