# CharacterOS V7 Graph Data Model Design Charter

## 版本

```text
CharacterOS V7.0 — Graph Data Model Design Charter
Date: 2026-06-23
Based on: V3→V4→V5→V6 (589 tests, 17 API routes)
Status: DESIGN ONLY, NO CODE
```

## 验证

```text
npm run build        ✓ passed
npm test             ✓ 84 files, 589 tests, zero failures
npm run next:build   ✓ 17 API routes, zero errors
```

---

## 1. V7 核心目标

### V7 是什么

```text
V7 = Graph Data Model

V7 的任务是定义 CharacterOS 的 Mind Graph 数据模型：
  - Graph 节点：来自 CharacterPhysicsState 的结构化投影
  - Graph 边：来自 V3 physics pipeline、V4 temporal traces、V5 subprocess traces 的因果/时间关系
  - Graph snapshot：可序列化、可测试、可通过 API 暴露的 JSON 结构

V7 不是 Viewer。
V7 不是前端。
V7 不是 3D 可视化。
V7 不是 Obsidian clone。
V7 不是多角色社交关系图。
V7 不是世界模拟。
```

### V7 不是什么

```text
V7 不是 Graph Viewer。                → V8
V7 不是前端。                          → 永久排除
V7 不是 3D 可视化。                    → 永久排除
V7 不是 force layout 引擎。            → V8
V7 不是图数据库（Neo4j/ArangoDB）。     → 永久排除
V7 不是多角色社交关系网。               → V20+
V7 不是世界图（world graph）。          → V50+
V7 不是 Obsidian 插件。                 → 永久排除
```

---

## 2. Graph 的哲学

```text
Graph 是角色内部心理结构的可解释投影。

1. 节点和边必须来自真实 CharacterOS 状态或 trace。
   不能凭空画。不能为了好看伪造边。

2. Graph 是 CharacterPhysicsState 的另一种观察方式。
   它不会比 state 更 "正确"。它是 state 的 structured summary。

3. 每个节点有 stable id，每个边有 evidence source。
   用户可以追溯每条边来自哪个 state field 或 trace entry。

4. Graph 的目的是可解释性。
   "这个角色为什么信任这么低？"
   → 看 graph：abandonment cluster(mass=0.8) → belief("亲密关系不可靠",strength=0.6) → desire("离开",intensity=0.7) → behavior("回避")
   → 每一步都有 state/trace 证据

5. Graph 不是 decorative。
   如果一颗图很漂亮但无法解释 state，
   那它就是不正确的 Graph。
```

---

## 3. Graph 与星系想法的对应

```text
CharacterOS 的设计隐喻是 mental galaxy。

Graph Data Model 应该尊重这个隐喻，但不被它绑架：

  PersonalityCore     → 中心星（central star / personality coordinate）
  MemoryNode          → 记忆节点（star points around clusters）
  ImpactCluster       → 星团 / nebula（category-grouped impact particles）
  ImpactParticle      → 冲击粒子（single event impact）
  BeliefState         → 轨道规则 / 解释场（orbital interpretation rule）
  NeedDeficiency      → 引力空缺 / 黑洞（gravity well / black hole）
  DesireState         → 推进向量（propulsion vector toward need satisfaction）
  BehaviorBias        → 轨迹倾向（trajectory bias toward action）
  Homeostasis         → 稳定化场（stabilizing field pulling toward baseline）
  Boundary            → 防护罩 / 壳（protective shell with cracks）
  RewardState         → 能量/多巴胺场（energy/dopamine field）
  TemporalProcess     → 时间箭头（time arrow through phases）
  BenchmarkResult     → 置信/验证信号（confidence / validation signal）
```

---

## 4. Graph Node Types

### 4.1 personality_core

```text
source:      CharacterPhysicsState.coordinate
stable id:   "personality_core"
label:       character.identity.name
properties:
  - trust, fear, attachment, neuroticism, control
  - bigFive (O, C, E, A, N)
  - velocity (coordinate momentum)
mass:        coordinate norm (sqrt of sum of squared values)
persisted:   yes (part of CharacterPhysicsState)
```

### 4.2 memory

```text
source:      CharacterPhysicsState.memories[i]
stable id:   memory.id
label:       memory.content (truncated)
properties:
  - recency, importance, emotion, repetitionCount
  - effectiveWeight (computed)
  - clusterId (if clustered)
mass:        effectiveWeight
persisted:   yes
```

### 4.3 impact_particle

```text
source:      CharacterPhysicsState.particles[i]
stable id:   particle.id
label:       particle.description
properties:
  - impactScore, emotion, category
mass:        impactScore
persisted:   yes
```

### 4.4 impact_cluster

```text
source:      CharacterPhysicsState.clusters[category]
stable id:   cluster.id (e.g. "cluster_abandonment")
label:       cluster.category
properties:
  - mass, density, stability, age
  - particle count
mass:        mass
persisted:   yes
```

### 4.5 belief

```text
source:      CharacterPhysicsState.beliefStates[i]
stable id:   belief.id
label:       belief.content
properties:
  - strength, evidenceCount
mass:        strength
persisted:   yes
```

### 4.6 need

```text
source:      DerivedCharacterState.needs[i] (needDeficiency)
stable id:   need.id (e.g. "need_security")
label:       need.name
properties:
  - intensity, reason
mass:        intensity
persisted:   no (derived per tick)
```

### 4.7 desire

```text
source:      DerivedCharacterState.desires[i]
stable id:   desire.id
label:       desire.content
properties:
  - intensity
  - sourceNeedId
mass:        intensity
persisted:   no (derived per tick)
```

### 4.8 behavior_bias

```text
source:      DerivedCharacterState.behaviorBiases[i]
stable id:   bias.id
label:       bias.tendency
properties:
  - likelihood, rationale
mass:        likelihood
persisted:   no (derived per tick)
```

### 4.9 temporal_process

```text
source:      ContinuousTickTrace.phases[i]
stable id:   phase.name (e.g. "decay_and_recovery")
label:       phase name + phase number
properties:
  - changedStates
  - adapter status (delegated / observed_only / metadata_only)
mass:        changedStates.length (proxy for impact scope)
persisted:   no (per-tick trace)
```

### 4.10 internal_state_variable

```text
source:      InternalStateFieldSnapshot.variables[i]
stable id:   variable.id (e.g. "boundary.stressLoad")
label:       variable.label
properties:
  - currentValue, baseline, deviation, pressure, risk
mass:        homeostaticPressure
persisted:   no (per-tick snapshot)
```

### 4.11 benchmark_signal

```text
source:      BenchmarkResult
stable id:   benchmark caseId
label:       fixture description
properties:
  - verdict, passedAssertions/totalAssertions
  - durationMs
mass:        passedAssertions / totalAssertions (confidence ratio)
persisted:   no (per-benchmark-run)
```

---

## 5. Graph Edge Types

| # | Edge Type | Source Node | Target Node | Weight Source | Direction | Evidence |
|---|-----------|-------------|-------------|---------------|-----------|----------|
| 1 | `belongs_to_cluster` | impact_particle | impact_cluster | 1.0 (structural) | → | cluster.particleIds |
| 2 | `clusters_around` | memory | impact_cluster | cluster.mass × memory.weight | → | memory.clusterId |
| 3 | `impacts_personality` | impact_particle | personality_core | particle.impactScore | → | coordinate drift |
| 4 | `pulls_personality` | impact_cluster | personality_core | cluster.mass × cluster.density | → | galaxy step |
| 5 | `activates_belief` | memory | belief | effectiveWeight × emotion salience | → | belief.sourceMemoryIds |
| 6 | `reinforces_belief` | impact_particle | belief | impactScore | → | belief.sourceMemoryIds |
| 7 | `creates_need` | impact_cluster + belief | need | cluster.mass + belief.strength | → | need derivation |
| 8 | `drives_desire` | need | desire | need.intensity | → | desire.sourceNeedId |
| 9 | `biases_behavior` | desire | behavior_bias | desire.intensity | → | behavior bias derivation |
| 10 | `regulates_by_homeostasis` | personality_core | temporal_process | homeostaticPressure | → | Phase 4 regulatedBoundary |
| 11 | `stabilizes` | homeostasis | internal_state_variable | regulationRate | ↔ | Phase 4 trace |
| 12 | `observed_by_benchmark` | temporal_process | benchmark_signal | benchmark confidence | ← | V6 benchmark result |
| 13 | `temporal_transition` | temporal_process(n) | temporal_process(n+1) | 1.0 (structural) | → | phase order |
| 14 | `decays_to` | memory(before) | memory(after) | recency delta | → | Phase 3 subprocess |
| 15 | `derived_from` | derived node | source state variable | 1.0 (structural) | ← | derivation trace |

### Edge Weight Philosophy

```text
Edge weight 不追求精确。
Edge weight 表示连接强度或置信度，不是精确因果强度。

来源优先级：
  1. 结构性连接（belongs_to, derived_from）→ weight = 1.0
  2. 物理量（impactScore, cluster.mass, belief.strength）→ weight = state value
  3. 派生强度（need.intensity, desire.intensity, bias.likelihood）→ weight = derived value
  4. 调节压力（homeostaticPressure）→ weight = pressure value
  5. 验证信号（benchmark confidence）→ weight = passedRatio（不是 edge weight override）

Edge weight 解释：
  >= 0.8 : 强连接（结构性的，或高强度 evidence）
  0.5-0.8: 中连接（有实质影响）
  0.2-0.5: 弱连接（存在但影响有限）
  < 0.2 : 微弱连接（噪声级别）
  
  这些阈值不是硬规则。它们是 readability thresholds，不是 logic gates。
```

---

## 6. Graph Snapshot

```typescript
interface MindGraphSnapshot {
  /** Format version. */
  version: "7.0.0";
  /** Character identity. */
  characterId: string;
  /** ISO timestamp when this snapshot was generated. */
  generatedAt: string;
  /** All graph nodes. */
  nodes: GraphNode[];
  /** All graph edges. */
  edges: GraphEdge[];
  /** Summary statistics. */
  summary: GraphSummary;
  /** Non-fatal warnings (missing data, zero-weight edges, etc.). */
  warnings: string[];
  /** Human-readable reasons for this snapshot. */
  reasons: string[];
}

interface GraphNode {
  /** Stable id within the graph snapshot. */
  id: string;
  /** Node type discriminator. */
  type: GraphNodeType;
  /** Human-readable label (truncated for memory/particle). */
  label: string;
  /** Node mass/probability/risk value [0, 1]. */
  weight: number;
  /** Whether this node comes from persisted state or is derived per-tick. */
  persistence: "persisted" | "derived";
  /** Source of this node (which state field or trace entry). */
  source: string;
  /** Additional type-specific properties. */
  properties: Record<string, unknown>;
}

type GraphNodeType =
  | "personality_core"
  | "memory"
  | "impact_particle"
  | "impact_cluster"
  | "belief"
  | "need"
  | "desire"
  | "behavior_bias"
  | "temporal_process"
  | "internal_state_variable"
  | "benchmark_signal";

interface GraphEdge {
  /** Stable id: "{sourceId}->{targetId}" or "{sourceId}<->{targetId}". */
  id: string;
  /** Edge type discriminator. */
  type: GraphEdgeType;
  /** Source node id. */
  sourceId: string;
  /** Target node id. */
  targetId: string;
  /** Edge weight [0, 1]. */
  weight: number;
  /** Directionality. */
  direction: "forward" | "backward" | "bidirectional";
  /** Evidence source for this edge. */
  evidence: string;
}

interface GraphSummary {
  /** Total node count. */
  nodeCount: number;
  /** Node count by type. */
  nodeCountsByType: Record<GraphNodeType, number>;
  /** Total edge count. */
  edgeCount: number;
  /** Edge count by type. */
  edgeCountsByType: Record<string, number>;
  /** Average edge weight. */
  averageEdgeWeight: number;
  /** High-weight edge count (>= 0.8). */
  strongEdgeCount: number;
  /** Number of persistent nodes. */
  persistedNodeCount: number;
  /** Number of derived nodes. */
  derivedNodeCount: number;
}
```

---

## 7. Benchmark 与 Graph 的关系

```text
Benchmark 不直接决定 graph。
Benchmark 只提供 confidence / validation signal。

Graph edge 不应该因为一个 benchmark pass 就变成 "真理"。

正确关系：
  V5 subprocess → produces trace → V6 benchmark measures it
  V6 benchmark result → "direction was consistent" → confidence signal
  V7 graph edge → has a benchmark_signal node connected, not overridden

错误关系：
  benchmark passes → edge weight = 1.0 ❌
  benchmark fails → remove the edge ❌
  benchmark confidence → override physical edge weight ❌

Benchmark signal 是 graph 的附加信息层，不是 graph 的 authority。
```

---

## 8. V7 不做什么

```text
1. 不做 viewer
   Graph 是 JSON 数据结构，不是渲染图。
   Viewer 进入 V8。

2. 不做 force layout
   节点位置（x, y, z）不在 V7 scope 内。
   位置分配给 V8 的 layout engine。

3. 不做 graph database
   不引入 Neo4j / ArangoDB / graphviz。
   Graph 是 in-memory structure + JSON serialization。

4. 不做 multi-character social graph
   V7 只建模单个角色的内部心理 graph。
   角色间关系图进入 V20+。

5. 不做 world graph
   不做 "世界状态图"、"地点图"、"事件时间线图"。

6. 不做 real-time animation
   不做 d3-force / sigma.js / canvas animation。

7. 不做 3D
   三个维度是 V50+ 的 scope。
```

---

## 9. V7 分阶段路线

```text
V7.0  Graph Design Charter           (本阶段)  — 设计文档
V7.1  Graph Types                    (代码)    — GraphNode/Edge/Snapshot 类型定义
V7.2  Mind Graph Builder             (代码)    — 从 CharacterPhysicsState 构建 graph
V7.3  Memory Galaxy Graph            (代码)    — memory→cluster→personality edges
V7.4  Need Black Hole Nodes          (代码)    — need/desire/belief nodes + edges
V7.5  Belief/Desire/Behavior Edges   (代码)    — 完整 decision pipeline edges
V7.6  Benchmark Signal Edges         (代码)    — benchmark_signal nodes + observed_by edges
V7.7  Graph Snapshot API             (代码)    — GET /api/graph/snapshot
V7.8  Graph Consistency Report       (文档)    — 汇总 graph 完整性和一致性
```

### 每阶段约束

```text
V7.1-V7.7:
  - 不改 V3/V4/V5/V6 核心行为
  - 不改 runContinuousTick
  - 不改 CharacterPhysicsState
  - 不改 benchmark runner
  - 只增加 graph 类型的定义和 builder 代码
```

---

## 10. V8 预告

```text
V8 Graph Viewer 可以考虑以下 visual metaphors：

  - personality_core = 中心星（center, large, radiating）
  - impact_clusters = nebula clouds around the core
  - memories = star points orbiting within or near clusters
  - beliefs = orbital rings/bands around the core
  - needs = black holes / gravity wells (dark, pulling)
  - desires = propulsion vectors / arrows (directional)
  - behavior_biases = trajectory lines
  - temporal_processes = time arrows around the system
  - benchmark_signals = confidence halos / glow

V8 的 graph viewer 不是 "漂亮的可视化"。
它是 "Mind Graph 的可视分析工具"。
必须保持与 V7 Graph Data Model 的 1:1 映射。
```

---

## 11. 成功标准

### 必须达成

| 标准 | 描述 |
|------|------|
| S1 | Graph derived from state/trace only — no fake nodes |
| S2 | No visual-only nodes — every node maps to a state field or trace entry |
| S3 | Stable ids — same state produces same node ids |
| S4 | Deterministic builder — same input produces identical graph |
| S5 | Graph snapshot can be tested — snapshot JSON can be validated in tests |
| S6 | API can expose graph JSON before viewer — `GET /api/graph/snapshot` returns valid MindGraphSnapshot |
| S7 | V3/V4/V5/V6 tests remain passing — 589 tests, zero regressions |

### 可选达成

| 标准 | 描述 |
|------|------|
| S8 | Graph diff across ticks — compare snapshots at t0 vs t1 |
| S9 | Graph summary meaningful — edge counts and weights reflect system state |
| S10 | Benchmark signal nodes connected — each benchmark_signal has observed_by edges |

---

## 12. 风险

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | 过早可视化 | high | V7 不做 viewer。Graph 先作为 JSON 存在。V8 才加可视化。 |
| R2 | 图太漂亮但无意义 | high | 每个 node/edge 必须有 state/trace evidence。总结中包含 "orphan nodes" warning。 |
| R3 | edge weight 伪精确 | medium | weight 是 [0,1] 浮点，不是精确因果强度。文档明确：weight = connection strength signal，不是 effect size。 |
| R4 | graph 误导用户 | medium | 每个 node/edge 包含 source 字段，用户可以追溯 origin。 |
| R5 | benchmark confidence 被过度解释 | medium | benchmark_signal 是附加信号，不 override physical edge weight。 |
| R6 | graph 数据过大 | low | 一个 state 的 graph 约 50-200 nodes。Mitigation: 可选的 node limit / weight filter。 |
| R7 | multi-character scope creep | medium | V7 只支持单角色。Multi-character graph 在 V20+。Documented explicitly。 |

---

## 13. 最终声明

```text
CharacterOS V7 starts as Graph Data Model, not Graph Viewer.

V7 是 V3→V4→V5→V6 积累的结构化数据的上层建模层：
  - V3: stable physics core → nodes (memories, clusters, personality)
  - V4: temporal observability → process nodes, internal state nodes
  - V5: subprocess decomposition → decay/recovery edges
  - V6: benchmark system → signal nodes

V7 把已经存在的关系明确化为 graph edges。
不是创造新关系，是命名和测量已有关系。

Graph = state → projection → structured visibility.

V7 不做可视化。
V7 不做图数据库。
V7 不画图。

但 V7 做完后，V8 可以画。
而且 V8 画的每一笔都有 state evidence。
```

## 验证

```text
npm run build        ✓
npm test             ✓ 84 files, 589 tests, zero failures
npm run next:build   ✓ 17 API routes, zero errors
```

已通过所有测试。
已完成
