# CharacterOS V4 Design Charter

## Status

```text
CharacterOS V4.0 Design Charter — DESIGN ONLY, NO CODE.
Date: 2026-06-23
Based on: V3 Stable Candidate (V3.12 Documentation Alignment)
```

## 0. V4 核心目标

### V4 不是什么

```text
V4 不是前端。
V4 不是 Dashboard。
V4 不是 3D 星云。
V4 不是多角色系统。
V4 不是世界模拟器。
V4 不是 AGI。
V4 不是医学诊断工具。
V4 不是完整生理模拟。
V4 不是新理论模块的堆叠。
```

### V4 是什么

```text
V4 = Temporal Homeostasis & Internal State Field
```

V3 已经建立了 14 个子系统。但它们目前是**并列的、独立调用的、缺乏统一时间语义的**。

V4 的核心洞察：

```text
Continuous Tick
Homeostasis
Recovery
Belief Evolution
Reward Adaptation
Memory Decay
Psychological Boundary Recovery
Meta State Drift
Time Perception
Boredom / Inspiration

这些系统的共同本质是：

"一个内部状态变量在时间轴上如何变化，以及什么力量将它拉回平衡。"
```

V3 已经逐个实现了它们。V4 的任务是**抽象出它们的共同结构**，让未来的系统不再需要重新发明 decay、recovery、homeostasis、threshold 和 drift。

---

## 1. V4 要整合的已有系统

### 1.1 Continuous Tick（`runContinuousTick`）

```text
当前状态：17-phase 单函数，约 440 行。
V3 角色：时间推进的主调度器。
V4 视角：TemporalProcess 的编排器（orchestrator），不是单体函数。

关键观察：每个 phase 本质上是一个 TemporalProcess 的实例。
Phase 3 (decay_and_recovery) = DecayProcess + RecoveryProcess 的组合
Phase 4 (homeostasis)        = HomeostaticRegulationProcess
Phase 14 (boredom)           = BoredomPressureProcess
Phase 15 (belief_evolution)  = BeliefDriftProcess
```

### 1.2 Homeostasis（`applyHomeostasis`）

```text
当前状态：V0，调节 metaState、boundary、rewardState。
V3 角色：读取 stabilitySetPoint、changeResistance、recoveryBias、
         moderationBias、scarRetention，输出 regulated 状态。
V4 视角：HomeostaticRegulator 的原型。

Homeostasis 是 V4 的第一公民原则。
所有 TemporalProcess 都应该声明自己的 homeostatic target，
而 HomeostaticRegulator 负责协调多个 process 之间的平衡力。

当前 homeostasis 只作用于 meta/boundary/reward。
V4 应该让它成为所有时间过程的统一调节层。
```

### 1.3 Recovery（`buildRecoveryTrace` / recovery curve）

```text
当前状态：V0，从 before/after delta 构建恢复轨迹。
V3 角色：观察 recovery，但不驱动它。
V4 视角：RecoveryCurve 是 HomeostaticRegulator 的一种具体形式。

Recovery = 朝 baseline 的渐进回归，带 inertia。
每个 StateVariable 都应该有自己的 recovery curve，
而不是只靠全局 homeostasis 一次调节。
```

### 1.4 Belief Evolution（`evolveBeliefsForTick`）

```text
当前状态：V0，基于 memory evidence 和 meta plasticity 缓慢演化。
V3 角色：tick 中更新 beliefStates。
V4 视角：BeliefDriftProcess = TemporalProcess<BeliefState[]>。

信念是 slow variable。它们的演化完美契合 TemporalProcess 框架：
- 当前值 = belief.strength
- target = memorySupportRatio
- rate = meta plasticity * daysElapsed
- homeostatic pull = 朝 0.5（中性）的微弱回归
```

### 1.5 Reward Adaptation（`recoverRewardBaseline` / `processReward`）

```text
当前状态：V0，事件产生 rewardResult，tick 朝 baseline 恢复。
V3 角色：独立处理事件奖励 + tick 恢复。
V4 视角：RewardState 是一个多维度 StateVariable。

dopamineLevel、craving、rewardSensitivity 各自有自己的：
- baseline
- decay rate
- adaptation rate
- homeostatic target
```

### 1.6 Memory Decay（`decayMemory` / `effectiveMemoryWeight`）

```text
当前状态：V2，recency 指数衰减，effective weight 随之下降。
V3 角色：tick Phase 3 中对每个 MemoryNode 独立应用。
V4 视角：MemoryDecayProcess = TemporalProcess<MemoryNode[]>。

每个 memory 是一个 StateVariable。
decay rate 受 metaState.forgettingSpeed 调节。
这已经是 TemporalProcess 的完美示例。
```

### 1.7 Psychological Boundary Recovery（`recoverBoundary`）

```text
当前状态：V0，stressLoad 随时间恢复，cracks 缓慢修复。
V3 角色：tick Phase 3。
V4 视角：BoundaryRecoveryProcess = TemporalProcess<PsychologicalBoundary>。

boundary 的每个维度（stressLoad, integrity, cracks）都是 StateVariable。
recoveryRate 和 elasticity 决定了恢复速度。
```

### 1.8 Meta State Drift（`updateMetaStateForTick`）

```text
当前状态：V0，元参数随压力和边界完整性缓慢漂移。
V3 角色：tick Phase 2。
V4 视角：MetaStateDriftProcess = TemporalProcess<MetaState>。

每个元参数（emotionalSensitivity, resilience, selfControl...）
都是独立的 StateVariable。
它们的 drift 受 stressLoad、boundaryIntegrity 和彼此之间的
parameter network 耦合影响。
```

### 1.9 Time Perception（`perceiveContinuousTime` / `perceiveEventTime`）

```text
当前状态：V0，计算主观时间倍率。
V3 角色：tick Phase 17 + event 处理。
V4 视角：TimePerception 不是 TemporalProcess 本身，
         而是所有 TemporalProcess 的**共享上下文**。

subjectiveTimeMultiplier 应该影响所有 decay/recovery/drift rate。
这是 Time Perception 在 V3 中已经暗示但未完全实现的方向。
```

### 1.10 Boredom / Inspiration（`updateBoredomForTick`）

```text
当前状态：V0，低刺激产生无聊，无聊产生探索压力和灵感概率。
V3 角色：tick Phase 14。
V4 视角：BoredomPressureProcess = TemporalProcess<BoredomState>。

boredom 是 stimulationNeed 不被满足时产生的 homeostatic pressure。
这完美契合 TemporalProcess 框架：
- 当前值 = boredomLevel
- target = 0（无无聊）
- pressure = stimulationNeed - actualStimulation
- 当 pressure 积累到阈值，产生 explorationDrive 或 inspirationSpark
```

---

## 2. V4 统一抽象

### 2.1 核心概念

```text
TemporalProcess
    时间过程的抽象接口。
    每个 TemporalProcess 声明：
    - 它作用于哪些 StateVariable
    - 它的 homeostatic target 是什么
    - 它的 drift rate 受什么影响
    - 它如何与 HomeostaticRegulator 交互

StateVariable
    一个随时间变化的状态量。
    拥有：
    - currentValue
    - baseline
    - homeostaticTarget
    - inertia（变化阻力）
    - recoveryRate（回归速度）
    - min / max bounds

HomeostaticRegulator
    协调多个 TemporalProcess 的平衡力。
    不是一个新的独立系统——
    是把 V3 的 homeostasis、recovery、decay 统一为同一个概念。
    
    职责：
    - 接收所有 TemporalProcess 的当前状态
    - 计算每个 StateVariable 的 homeostatic pressure
    - 按优先级解决冲突（例如：scar retention > recovery pull）
    - 输出下一个 tick 的 regulated state

DriftVector
    一个 StateVariable 在单个 tick 中的变化量。
    由以下因素共同决定：
    - 外部事件冲击（event impact）
    - 内部 drift（meta state, parameter network）
    - homeostatic pull（朝 baseline/target 的回归力）
    - random noise（弱噪声）

RecoveryCurve
    描述一个 StateVariable 如何从偏离状态回到 baseline。
    形状由以下决定：
    - 偏离幅度
    - recoveryRate
    - inertia
    - daysElapsed
    - scarRetention（是否留下永久痕迹）

StabilityPressure
    一个 StateVariable 离它的 homeostatic target 有多远。
    用于：
    - 决定 recovery 的紧迫程度
    - 决定是否需要 Deep Thinking
    - 决定 parameter adjustment 的建议

InternalStateField
    角色在时刻 t 的完整内部状态快照。
    CharacterPhysicsState 的 V4 版本。
    
    不是新的数据结构。
    是对 CharacterPhysicsState 的重新理解：
    不是一组独立字段，而是一个统一的、相互耦合的场。
    
    InternalStateField(t) = {
      coordinate: StateVariable<PersonalityCoordinate>,
      boundary: StateVariable<PsychologicalBoundary>,
      metaState: StateVariable<MetaState>,
      rewardState: StateVariable<RewardState>,
      beliefStates: StateVariable<BeliefState[]>,
      homeostasisState: StateVariable<HomeostasisState>,
      boredomState: StateVariable<BoredomState>,
      memories: StateVariable<MemoryNode[]>,   // 每个 memory 也是 StateVariable
      ...
    }
```

### 2.2 关系图

```text
InternalStateField(t)
        │
        ▼
TemporalProcess[] ──────────────────────┐
        │                               │
        ├── DecayProcess                │
        ├── RecoveryProcess             │
        ├── DriftProcess                │
        ├── AdaptationProcess           │
        ├── EvolutionProcess            │
        ├── PressureProcess             │
        └── ...                         │
        │                               │
        ▼                               │
HomeostaticRegulator ◄──────────────────┘
        │
        │ 协调多个 process 的竞争力
        │ 应用 scar retention
        │ 维持 stability / change 平衡
        │
        ▼
InternalStateField(t+1)
        │
        ▼
DerivedCharacterState  ← 只读，不改状态
```

---

## 3. V4 数据流草案

### 3.1 Tick Pipeline（V4 版本）

```text
// V3: 单体函数
runContinuousTick(state, options) → ContinuousTickTrace

// V4: 编排器 + 注册表
tickScheduler.tick(state, options) → UnifiedTickTrace

其中 tickScheduler 内部：
  1. 快照 InternalStateField(t)
  2. 按优先级排序 TemporalProcess[]
  3. 每个 process 声明它要读/写的 StateVariable
  4. 并行执行无依赖的 process（decay + recovery 可并行）
  5. 串行执行有依赖的 process（homeostasis 在所有 mutation 之后）
  6. HomeostaticRegulator 收集所有 process 的输出
  7. 解决冲突，应用 scar retention
  8. 输出 InternalStateField(t+1)
  9. 构建 UnifiedTickTrace
```

### 3.2 TemporalProcess 接口草案

```typescript
interface TemporalProcess {
  /** 唯一标识 */
  readonly id: string;
  /** 人类可读名称 */
  readonly name: string;
  /** 优先级（低数字 = 先执行） */
  readonly priority: number;
  /** 读取的 StateVariable 键列表 */
  readonly reads: string[];
  /** 写入的 StateVariable 键列表 */
  readonly writes: string[];
  /** 声明 homeostatic target */
  readonly homeostaticTarget: (field: InternalStateField) => Partial<InternalStateField>;

  /** 执行一次 tick 推进 */
  apply(
    field: InternalStateField,
    context: TickContext
  ): ProcessTickResult;
}

interface TickContext {
  daysElapsed: number;
  subjectiveTimeMultiplier: number;
  randomSeed: number;
}

interface ProcessTickResult {
  /** 变更后的 StateVariable 片段 */
  mutations: Partial<InternalStateField>;
  /** 本 process 的 homeostatic pressure */
  pressure: StabilityPressure[];
  /** 人类可读的原因 */
  reasons: string[];
  /** 诊断信息 */
  diagnostics: Record<string, number | string>;
}
```

### 3.3 HomeostaticRegulator 接口草案

```typescript
interface HomeostaticRegulator {
  /** 收集所有 process 的输出，解决冲突 */
  regulate(
    field: InternalStateField,
    processResults: ProcessTickResult[],
    config: HomeostasisConfig
  ): RegulatedStateField;
}

interface HomeostasisConfig {
  /** 全局变化阻力 */
  changeResistance: number;
  /** 是否保留伤痕 */
  scarRetention: number;
  /** 调节偏向（恢复优先 vs 稳定优先） */
  moderationBias: number;
}

interface RegulatedStateField {
  /** 调节后的完整状态 */
  field: InternalStateField;
  /** 每个 StateVariable 的调节记录 */
  regulations: StateVariableRegulation[];
  /** 整体稳定性评估 */
  stabilityAssessment: StabilityAssessment;
}
```

### 3.4 UnifiedTickTrace 草案

```text
V3 的 ContinuousTickTrace 是一个 17-phase 的扁平 trace。
V4 的 UnifiedTickTrace 应该：

1. 按 TemporalProcess 分组（不是按 phase）
2. 每个 process 的 trace 包含：
   - processId
   - 影响的 StateVariable 列表
   - before/after 值（可选的 snapshot）
   - homeostatic pressure before/after
   - drift 幅度
   - reasons

3. 顶层包含：
   - InternalStateField snapshot at t
   - InternalStateField snapshot at t+1
   - 所有 process 的 trace 列表
   - HomeostaticRegulator 的协调记录
   - stability assessment
   - Deep Thinking recommendation
```

---

## 4. V4 不做什么

```text
不做前端。                    ← V3 原则，V4 延续。
不做 3D 星云。                ← V3 原则，V4 延续。
不做 Dashboard。              ← 已移除，不恢复。
不做多角色系统。              ← V20 以后。
不做世界模拟。                ← V50 以后。
不做 AGI。                    ← 永远不在 scope 内。
不做完整生理模拟。            ← 不是 CharacterOS 的方向。
不做真实医学心理学诊断。      ← CharacterOS 是 fiction engine，不是临床工具。
不做自然语言对话界面。        ← V0 遗留，已不再维护。
不做大型 agent runtime。      ← 不引入 DeerFlow、LangChain 等。
不做新数据库。                ← 不在此阶段引入 SQLite/Prisma。
不破坏 V3 stable behavior。  ← V3 所有测试必须在 V4 全部通过。
```

---

## 5. V4 分阶段路线

### V4.0 — Design Charter（本阶段）

```text
输出：本文档。
不做代码改动。
确认 V4 方向和抽象。
```

### V4.1 — TemporalProcess Interface

```text
定义：
- TemporalProcess 接口
- StateVariable 接口
- ProcessTickResult 类型
- TickContext 类型

输出：
- src/core/v4/temporalProcess.ts（接口文件）
- tests/core/v4/temporalProcess.test.ts（接口编译检查）

不做：
- 不修改 runContinuousTick
- 不拆分任何现有 process
```

### V4.2 — Process Registry

```text
将 V3 的 10 个时间系统注册为 TemporalProcess 实现。

每个 process：
- 包装现有函数，不改行为
- 实现 TemporalProcess 接口
- 从现有代码中提取 homeostaticTarget 声明

输出：
- src/core/v4/processes/*.ts（每个 process 一个文件）
- ProcessRegistry（按优先级排序的 process 列表）

原则：
- 每个 process 文件 < 50 行（薄包装）
- 核心逻辑仍留在 V3 文件中
- Process 文件只做声明 + 委托
```

### V4.3 — Unified Tick Trace

```text
将 V3 的 ContinuousTickTrace 映射为 UnifiedTickTrace。

输出：
- src/core/v4/unifiedTickTrace.ts
- 从现有 trace 构建 UnifiedTickTrace 的转换函数
- 测试验证 UnifiedTickTrace 包含所有 V3 trace 信息

不做：
- 不改变 trace 的生成逻辑
- 不改变现有测试
```

### V4.4 — Internal State Field Snapshot

```text
定义 InternalStateField 类型。
提供从 CharacterPhysicsState 构建 InternalStateField 的函数。

输出：
- src/core/v4/internalStateField.ts
- toInternalStateField(state): InternalStateField
- fromInternalStateField(field): CharacterPhysicsState（只读转换）

原则：
- InternalStateField 不是新数据结构
- 它是 CharacterPhysicsState 的 view/投影
- 不改变持久化格式
```

### V4.5 — Homeostasis Consistency Tests

```text
编写跨系统的 homeostatic 一致性测试。

测试：
- 所有 StateVariable 在任何 tick 后都在 [0, 1] 范围内
- recovery 不会超越 baseline（不会过度恢复）
- scar retention 正确保留部分永久偏移
- 多个同时发生的 drift 不会互相矛盾
- homeostasis 在所有 process 之后执行，不提前覆盖

输出：
- tests/core/v4/homeostasisConsistency.test.ts
```

### V4.6 — Migration Report

```text
输出：
- docs/v4_migration_report.md
- V3 → V4 的行为变化（如有）
- 哪些 V3 函数被包装但不变
- 哪些 V3 函数被拆分
- 哪些 V3 函数保持不变
- 性能对比（tick 耗时）
- 测试对比（测试数量变化）
```

---

## 6. V4 风险

### R1: 过度抽象

```text
风险：为了统一而统一，抽象层比实现层更复杂。
缓解：
- 每个 TemporalProcess 必须是薄包装（< 50 行）
- 如果包装比原始函数更复杂，不包装
- 允许某些 process 继续作为独立函数存在
- "不为了统一而统一"是第一原则
```

### R2: 把人变成参数机器

```text
风险：InternalStateField 让人物感觉像一组可调的参数，而不是一个完整的人。
缓解：
- StateVariable 的命名必须使用心理学术语，不用工程术语
- 文档强调：这些是"观察视角"，不是"控制面板"
- HomeostaticRegulator 的职责是"维持平衡"，不是"优化目标函数"
- 保留 V3 的所有人类可读的 reasons / descriptions
```

### R3: Tick 过度复杂

```text
风险：TemporalProcess 注册表让 tick 变得更难理解和调试。
缓解：
- ProcessRegistry 必须按优先级线性排序
- 依赖关系必须显式声明（reads / writes）
- 循环依赖在设计阶段就拒绝
- UnifiedTickTrace 必须比 ContinuousTickTrace 更容易读
```

### R4: 性能问题

```text
风险：每 tick 创建大量中间对象（ProcessTickResult[], StateVariable[]）。
缓解：
- V4.1-V4.4 只做接口和包装，不引入新分配
- 性能测试作为 V4.6 migration report 的一部分
- 如果 tick 耗时增加 > 20%，暂停并简化
```

### R5: 难以解释

```text
风险：统一抽象让人更难理解"这个 tick 到底做了什么"。
缓解：
- UnifiedTickTrace 必须包含人类可读的 per-process reasons
- HomeostaticRegulator 的每个决策必须有 reason
- 保留 V3 的 ContinuousTickTrace 作为兼容输出
- API response 可以同时返回 V3 trace 和 V4 trace
```

### R6: 破坏 V3 Stable Behavior

```text
风险：重构改变行为，V3 测试失败。
缓解：
- V4.1-V4.4 只做包装，不改行为
- V3 的所有 256 个测试必须持续通过
- 任何行为变化必须在 V4.6 migration report 中明确记录
- 如果无法保持行为不变，回退到纯包装方案
```

---

## 7. V4 成功标准

### 必须达成

```text
S1: V3 tests continue passing
     V3 的 256 个测试（65 files）在 V4 全部通过。
     不允许任何 V3 测试因 V4 改动而失败。

S2: runContinuousTick behavior remains explainable
     一次 tick 推进后，每个系统发生了什么，必须能从 trace 中读出。
     UnifiedTickTrace 的可读性 ≥ ContinuousTickTrace。

S3: no direct personality rewrite
     TemporalProcess 不直接修改 PersonalityCoordinate。
     人格变化只能通过 Personality Galaxy 的 momentum drift 实现。
     V4 不改变 V3 的人格演化路径。

S4: time-based changes become easier to inspect
     操作员可以通过 UnifiedTickTrace 看到：
     - 哪些 StateVariable 偏离了 baseline
     - 哪些 HomeostaticRegulator 决策被触发
     - recovery / drift 的幅度和方向
     - 跨系统的 stability assessment

S5: homeostasis becomes a first-class organizing principle
     HomeostaticRegulator 是 V4 的核心抽象。
     不是 V3 的 applyHomeostasis() 函数的简单重命名。
     而是让所有 TemporalProcess 都声明自己的 homeostatic target，
     由统一的 Regulator 协调。
```

### 可选达成

```text
S6: tick 性能不退化超过 20%
S7: 所有 TemporalProcess 都有独立的单元测试
S8: InternalStateField 的序列化与 CharacterPhysicsState 兼容
S9: API response 同时包含 V3 trace 和 V4 trace
```

---

## 8. V4 与 V3 的关系

```text
V3 是 V4 的基础。V4 不替换 V3。

V3 = 已经工作的、经过测试的、稳定的实现。
V4 = 在 V3 之上的抽象层，用于：
      - 理解已有的时间行为
      - 统一未来的新系统
      - 让 homeostasis 成为可观察、可验证的原则

V4 不要求重写 V3。
V4.1-V4.4 的 TemporalProcess 实现是 V3 函数的薄包装。
V3 的 runContinuousTick 继续存在和工作。
V4 的 tickScheduler 是一个新的入口，内部委托给 V3 函数。

当所有 V3 子系统都成功包装为 TemporalProcess 后，
V5 可以考虑将 process 的执行从单体函数迁移到调度器。
但 V4 不做这个迁移。
```

---

## 9. 总结

```text
CharacterOS V4 的方向是：

不堆新系统。
不恢复前端。
不做多角色。
不引入新依赖。

V4 = 把 V3 已经有的时间系统，
     用统一的概念框架重新理解。

TemporalProcess       — 时间过程的统一接口
StateVariable         — 状态量的统一表示
HomeostaticRegulator  — 平衡力的统一协调
InternalStateField    — 角色状态的统一快照

V4 的意义不是"新增功能"。
V4 的意义是"让已有的功能更容易被理解、验证和扩展"。

当 homeostasis 从 V3 的"一个功能模块"
变成 V4 的"所有时间过程的第一公民原则"，
CharacterOS 就从"一堆心理系统的集合"
变成了"一个有统一时间语义的人物物理引擎"。
```

---

## Appendix A: V3 子系统 → V4 TemporalProcess 映射

| V3 子系统 | V3 函数 | V4 TemporalProcess | 优先级 |
|-----------|---------|-------------------|--------|
| Memory Decay | `decayMemory` | `MemoryDecayProcess` | 1 |
| Procedural Decay | `decayProceduralRoutine` | `ProceduralDecayProcess` | 1 |
| Boundary Recovery | `recoverBoundary` | `BoundaryRecoveryProcess` | 2 |
| Reward Recovery | `recoverRewardBaseline` | `RewardRecoveryProcess` | 2 |
| Meta State Drift | `updateMetaStateForTick` | `MetaStateDriftProcess` | 3 |
| Homeostasis | `applyHomeostasis` | `HomeostaticRegulationProcess` | 9 (last mutation) |
| Belief Evolution | `evolveBeliefsForTick` | `BeliefEvolutionProcess` | 4 |
| Boredom | `updateBoredomForTick` | `BoredomPressureProcess` | 5 |
| Parameter Network | `propagateParameterNetwork` | `ParameterNetworkProcess` | 6 |
| Baseline Drift | `evaluateBaselineDrift` | `BaselineDriftProcess` | 7 |
| Time Perception | `perceiveContinuousTime` | `TimePerceptionContext` | context, not process |

## Appendix B: 不进入 V4 的 V3 子系统

这些系统是 V3 的一部分，但不属于 TemporalProcess 框架：

| 子系统 | 原因 |
|--------|------|
| Personality Galaxy / Momentum Drift | 由事件驱动，不是纯时间驱动 |
| Psychological Boundary Impact | 由事件驱动 |
| Social Mask | 由决策推导，不是时间演化 |
| Meaning System | 由决策推导 |
| World Model | 由事件 + 信念推导 |
| Attention System | 由事件 + meta + boundary 推导 |
| Embodiment / Action Noise | 由决策 + 身体推导 |
| Procedural Memory Activation | 由事件 cue 触发 |
| Reward Processing (event) | 由事件触发 |

### 区分原则

```text
TemporalProcess   = 仅由时间流逝驱动的变化（tick-only）
EventProcess      = 由外部事件触发的变化（event-driven）
DerivationProcess = 从状态推导出的只读视图（read-only derivation）

V4 的 TemporalProcess 框架只覆盖第一类。
EventProcess 和 DerivationProcess 是 V5 的整合目标。
```

已通过所有测试。
已完成
