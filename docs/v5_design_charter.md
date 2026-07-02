# CharacterOS V5 Design Charter

## Status

```text
CharacterOS V5.0 Design Charter — DESIGN ONLY, NO CODE.
Date: 2026-06-23
Based on: V4.14 Execution Layer Completion
```

## 测试结果

```text
npm run build        ✓ passed
npm test             ✓ 74 test files, 407 tests, zero failures
npm run next:build   ✓ 16 API routes, zero errors
```

---

## 1. V5 核心目标

### V5 是什么

```text
V5 = Temporal Process Decomposition

V5 的任务是把 V4 deferred 的 decay_and_recovery composite phase
分解为可独立观察、可独立测试、可独立 benchmark 的 temporal subprocesses。
```

### V5 不是什么

```text
V5 不是 Benchmark System。    → V6
V5 不是前端。                  → 永久排除
V5 不是多角色系统。            → V20+
V5 不是世界模拟。              → V50+
V5 不是 3D 可视化。            → 永久排除
V5 不是 RunContinuousTick 替换。→ V5 不解构 tick pipeline
```

---

## 2. 为什么 V5 不是 Benchmark

```text
Benchmark System 需要一个稳定的 temporal process 粒度来回答：

  "失恋影响多大？"
  "背叛影响多大？"
  "同样事件为什么对不同角色结果不同？"
  "memory decay 单独贡献了多少 drift？"
  "boundary recovery 单独贡献了多少 resilience？"
  "homeostasis 单独贡献了多少 stabilization？"

当前 decay_and_recovery 是一个黑箱 composite phase。
它同时做 4 件事：memory decay、procedural decay、boundary recovery、reward recovery。
Benchmark 无法判断这 4 件事各自的效果。

如果在 composite phase 上做 benchmark，
benchmark 结果会说 "decay_and_recovery 对 trust 的影响是 X"，
但无法区分 X 中多少来自 memory decay，多少来自 boundary recovery。

V5 把 composite phase 拆开。
V6 在拆分后的 subprocess 上做 benchmark。

顺序：
  V5: decompose → subprocesses become inspectable
  V6: benchmark  → each subprocess becomes measurable
```

---

## 3. Decay and Recovery 当前问题

### Phase 3 代码

```typescript
// 4 个独立操作，inline 顺序执行
state.memories = memoriesBefore.map((m) => decayMemory(m, daysElapsed, memoryDecayRate));
state.proceduralRoutines = proceduralRoutinesBefore.map((r) => decayProceduralRoutine(r, daysElapsed));
state.rewardState = recoverRewardBaseline(state.rewardState, daysElapsed);
state.boundary = recoverBoundary(state.boundary, daysElapsed);
state.metaState = metaDriftResult.trace.after;

// reasons 是硬编码字符串
phases.push({
  name: "decay_and_recovery",
  changedStates: ["memories", "proceduralRoutines", "rewardState", "boundary"],
  reasons: [
    "Memory recency and effective weight decay with elapsed time.",
    "Procedural routines lose strength when unused.",
    "Reward state and psychological boundary recover toward baseline."
  ]
});
```

### 问题清单

| 问题 | 描述 |
|------|------|
| 多函数 | 4 个独立 V3 函数调用，无法通过单一 adapter 委托 |
| 多 state writes | 5 个字段（memories, proceduralRoutines, rewardState, boundary, metaState） |
| Collection map | memories 和 proceduralRoutines 使用 `.map()` 遍历，不是整体替换 |
| Hardcoded reasons | reasons 不来自任何 V3 函数返回值，是手动拼接的字符串 |
| Phase 4 overwrite | boundary/reward/meta 的 recover 结果被 Phase 4 homeostasis 覆盖 |
| V3 trace compatibility | 当前 phases.length = 17，拆分后会变成 20+ |

---

## 4. V5 目标拆分

### 4 个候选 Temporal Subprocess

#### 4.1 memory_decay

```text
V3 函数：decayMemory(memory, daysElapsed, decayRate)
读取：memories[], metaState.forgettingSpeed, memoryDecayRate
写入：memories[].recency, memories[].effectiveWeight
风险：低 — 单一函数，纯元素级操作
trace 兼容：changedStates = ["memories"]
benchmark 价值：高 — 可以测量 memory decay 对 personality drift 的独立贡献
```

#### 4.2 procedural_decay

```text
V3 函数：decayProceduralRoutine(routine, daysElapsed)
读取：proceduralRoutines[]
写入：proceduralRoutines[].strength
风险：低 — 单一函数，纯元素级操作
trace 兼容：changedStates = ["proceduralRoutines"]
benchmark 价值：中 — 可以测量 habit decay 对 automatic behavior 的影响
```

#### 4.3 boundary_recovery

```text
V3 函数：recoverBoundary(boundary, daysElapsed)
读取：boundary (stressLoad, integrity, cracks, recoveryRate)
写入：boundary (stressLoad ↓, integrity ↑, cracks ↓)
风险：中 — 被 Phase 4 homeostasis 覆盖（regulatedBoundary）
trace 兼容：changedStates = ["boundary"]
benchmark 价值：高 — 可以测量 boundary recovery 对 resilience 的独立贡献
D10 关注：Phase 4 overwrite 必须保持等价
```

#### 4.4 reward_recovery

```text
V3 函数：recoverRewardBaseline(rewardState, daysElapsed)
读取：rewardState (dopamineLevel, craving, rewardSensitivity)
写入：rewardState (dopamineLevel → baseline, craving → baseline)
风险：中 — 被 Phase 4 homeostasis 覆盖（regulatedRewardState）
trace 兼容：changedStates = ["rewardState"]
benchmark 价值：高 — 可以测量 reward recovery 对 hedonic adaptation 的独立贡献
D10 关注：Phase 4 overwrite 必须保持等价
```

---

## 5. V5 不做什么

```text
不做前端。
不做 graph / 可视化。
不做多角色系统。
不做世界模拟。
不做 Benchmark System。            → V6
不做真实心理学诊断。
不一次性替换 runContinuousTick。
不做 full tickScheduler。          → V5 不解构 tick pipeline
不做 Phase 3 的激进拆分（方案 C）。 → 保持 V3 trace 兼容
不引入新数据库。
不恢复 Dashboard。
```

---

## 6. V5 迁移策略

### 方案 A：保持 V3 Phase Shape，内部产生 SubProcess Traces（推荐）

```text
Phase 3 (decay_and_recovery) 仍然是一个 phase。
4 个子操作继续在 Phase 3 内部顺序执行。
但每个子操作产生独立的 subProcess trace。

Phase 3 trace 结构变为：
{
  name: "decay_and_recovery",
  changedStates: ["memories", "proceduralRoutines", "rewardState", "boundary"],
  reasons: [...],
  subProcesses: [
    { id: "memory_decay", count: N, avgRecencyBefore: X, avgRecencyAfter: Y },
    { id: "procedural_decay", count: N, avgStrengthBefore: X, avgStrengthAfter: Y },
    { id: "boundary_recovery", stressDelta: X, integrityDelta: Y },
    { id: "reward_recovery", dopamineDelta: X, cravingDelta: Y }
  ]
}

优点：
- V3 17-phase trace 完全兼容
- ChangedStates 不变
- 每个 subprocess 可独立观察
- V6 benchmark 可以针对 subProcess 指标
- 改动小，风险低

缺点：
- 不是 "真正的" process decomposition
- 4 个子操作仍然是 inline 顺序执行的
- Phase 3 仍然是唯一的 "decay_and_recovery" phase
```

### 方案 B：新增 V5 Trace Format，保留 V3 Compatibility Wrapper

```text
V5 新增 V5TickTrace 格式。
V5TickTrace 的 phases 可以不是 17 个。
在 V5TickTrace 中，Phase 3 被拆分为 4 个独立的 process trace。

同时保留一个 V3 兼容包装器：
  v5TickTrace.toV3Compatible() → ContinuousTickTrace (17 phases)

优点：
- V5 有更大的设计自由度
- V3 API consumers 不受影响（通过 wrapper）
- 为 V5 future trace format 铺路

缺点：
- 维护两套 trace format
- wrapper 的聚合逻辑可能丢失信息
- 改动较大
```

### 方案 C：直接拆分 V3 Phase（不推荐）

```text
直接修改 runContinuousTick 的 phases 数组。
Phase 3 拆分为 Phase 3a, 3b, 3c, 3d。
phases.length 从 17 变为 20。

优点：
- 真正的 decomposition

缺点：
- 破坏 V3 17-phase trace 兼容性
- 所有 trace consumer 必须更新
- API response shape 改变
- Dashboard / trace replay 受影响（虽然前端已移除）
- V4.13 已评估为高风险

暂不推荐。V6 或以后可以考虑。
```

### 推荐：方案 A

```text
V5 采用方案 A。

理由：
1. V3 trace 兼容性是最重要的非功能需求
2. 改动最小
3. subProcess traces 足够为 V6 benchmark 提供数据
4. 如果方案 A 的 subProcess traces 不够用，V6 可以升级到方案 B
5. 方案 C 留给 V6+ 的 tick pipeline redesign
```

---

## 7. 推荐路线

```text
V5.0  Design Charter (本阶段)
  - 本文档
  - 确认方案 A

V5.1  SubProcess Trace Types
  - 定义 DecayRecoverySubProcessTrace 类型
  - 为 4 个子操作定义各自的 trace shape
  - 不修改 runContinuousTick

V5.2  Memory Decay Subprocess Instrumentation
  - 在 Phase 3 内部，为 memory decay 产生 subProcess trace
  - 不改行为，只加 trace

V5.3  Procedural Decay Subprocess Instrumentation
  - 为 procedural decay 产生 subProcess trace

V5.4  Boundary Recovery Subprocess Instrumentation
  - 为 boundary recovery 产生 subProcess trace
  - 记录 pre-homeostasis 和 post-homeostasis 的对比
  - 验证 D10 覆盖语义

V5.5  Reward Recovery Subprocess Instrumentation
  - 为 reward recovery 产生 subProcess trace
  - 记录 pre-homeostasis 和 post-homeostasis 的对比

V5.6  Composite Phase Migration Report
  - 汇总 4 个 subprocess 的 instrumentation 结果
  - 验证 V3 trace 兼容性
  - 输出 V5 completion report

V6.0  Benchmark Design Charter
  - 基于 V5 subprocess 指标
  - 定义 benchmark scenarios
```

---

## 8. 成功标准

### 必须达成

```text
S1: V3/V4 tests remain passing
     V3 的 256 tests + V4 的 151 temporal tests 全部通过。
     407 tests, zero failures.

S2: V3 ContinuousTickTrace compatibility preserved
     phases.length = 17.
     phases[2].name = "decay_and_recovery".
     phases[2].changedStates 不变。
     phases[2].reasons 不变。

S3: decay_and_recovery becomes inspectable
     4 个子操作各自有独立的 subProcess trace。
     操作员可以区分 memory decay、procedural decay、
     boundary recovery、reward recovery 各自的效果。

S4: no behavior change during early V5
     V5.1-V5.5 只加 trace，不改执行逻辑。
     4 个子操作的执行顺序和输入输出保持不变。

S5: each subprocess can become benchmark target
     subProcess trace 包含 V6 benchmark 需要的指标：
     - memory decay: count, avgRecencyBefore, avgRecencyAfter, effectiveWeightDelta
     - procedural decay: count, avgStrengthDelta
     - boundary recovery: stressDelta, integrityDelta, cracksDelta
     - reward recovery: dopamineDelta, cravingDelta, sensitivityDelta
```

### 可选达成

```text
S6: subProcess traces 被 UnifiedTickTrace 包含
S7: InternalStateField 可以区分 pre/post recovery 值
S8: homeostasis overwrite delta 可以从 subProcess trace 计算
```

---

## 9. 风险

### R1: Trace Shape Breakage

```text
如果 subProcess trace 被错误地塞入 phases[2]，
可能导致现有 trace consumer 解析失败。

缓解：
- subProcess 数据放在 phases[2] 的新字段中（如 .subProcesses）
- 不改变现有字段（.name, .changedStates, .reasons）
- 现有 consumer 忽略未知字段
```

### R2: Duplicate Mutation

```text
如果 subProcess instrumentation 不小心也执行了 mutation，
会导致 double-decay 或 double-recovery。

缓解：
- V5.1-V5.5 只加 trace 代码，不改 mutation 代码
- 任何 mutation 代码的位置和调用方式不变
- 测试验证 state 与 V4 完全一致
```

### R3: Homeostasis Overwrite Mismatch

```text
如果 subProcess trace 记录的 boundary_recovery 值
与 Phase 4 读取的值不一致（因为中间有其他操作），
subProcess trace 反映的不是真实输入。

缓解：
- subProcess trace 必须在 mutation 发生的同一行代码处记录
- boundary recovery trace 记录 recoverBoundary 的输入/输出
- Phase 4 overlay 从 subProcess trace 中可计算 delta
```

### R4: Collection Mapping Instability

```text
memories 和 proceduralRoutines 是可变长度数组。
subProcess trace 的 avgRecencyBefore/After 依赖数组快照。

缓解：
- 在 decay 前后 snapshot 数组（浅拷贝引用）
- 不深拷贝 MemoryNode（避免性能问题）
- avg 值在 snapshot 上计算
```

### R5: Over-Fragmentation

```text
如果 4 个 subProcess 各自有独立的 trace format，
可能导致 trace 可读性下降（从 17 个 phase 变成 17 phases × subProcesses）。

缓解：
- subProcess trace 是可选的（consumer 可以不读）
- V3 trace 的顶层结构不变
- subProcess 数据是增量信息，不是替代
```

### R6: Benchmark Before Decomposition

```text
如果跳过 V5 直接做 V6 Benchmark，
benchmark 无法区分 composite phase 内部各子操作的独立效果。

V5 → V6 的顺序依赖已经明确。
V5 必须先做 decomposition。
```

---

## 10. V3 → V4 → V5 → V6 路线总览

```text
V3: Character Physics Core
    - Single character physics engine
    - 14 subsystems
    - 17-phase continuous tick
    - Export/import infrastructure
    - 256 tests

V4: Temporal Homeostasis Layer
    - Observability layer (UnifiedTickTrace, InternalStateField)
    - Execution layer (4/5 mutation phases delegated)
    - D1-D10 equivalence checklist
    - 407 tests

V5: Temporal Process Decomposition
    - decay_and_recovery composite phase decomposition
    - 4 subProcess traces (方案 A)
    - V3 trace compatibility preserved
    - ~430 tests (estimated)

V6: Benchmark System
    - Standardized event sequences
    - Per-subprocess impact measurement
    - Cross-character comparison
    - Calibration feedback loop
```

---

## 11. 最终声明

```text
CharacterOS V5 Design Charter is complete.

V5 = Temporal Process Decomposition.
V6 = Benchmark System.

V5 是 V4 → V6 的必经之路。
不分解 composite phase，benchmark 就无法区分各时间系统的独立效果。

V5 采用方案 A（保持 V3 phase shape，内部 subProcess traces）。
这是改动最小、风险最低、兼容性最好的方案。
```

已通过所有测试。
已完成
