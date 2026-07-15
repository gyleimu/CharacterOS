# CharacterOS 最新开发流程

## 当前判断

当前项目已从 V1 单角色心理动力闭环、V2 Personality Galaxy、V3 Infrastructure Hardening、V10 Continuous Life，推进到 Core Kernel、Explorer Platform、Agent SDK 和 LLM Boundary Foundation。

V10 RC: 核心物理引擎稳定，12 个审计套件，7 个质量门，0 active warnings。
V11 RC: Explorer 单角色探索平台，6 个模块，static artifact。
V12 RC: Agent SDK，9 个模块，6 个 service methods，static harness。
V13 已将 LLM Boundary foundation 与 Determinism Boundary hardening 收敛到同一集成分支。V13.9 已完成 Mock Provider、Output Validator、Grounding Checker、Deterministic Fallback、18-case Quality Gate、静态 Harness 与 Mock-only RC seal。
Temporal Semantics 已完成：事件时间、24 小时密度饱和、事件间 recovery/decay、人格 velocity 半衰期、乱序保护和确定性回放已经进入 `processEvent()` 核心链路，并由独立质量门守卫。
V12 是 SDK 接口层，不是聊天 UI。V20 Relationship Engine 未开始。

核心风险治理与后续验收标准以 [`core_calibration_durability_roadmap.md`](core_calibration_durability_roadmap.md) 为准。人格动力学升级方案见 [`personality_dynamics_scientific_model_design.md`](personality_dynamics_scientific_model_design.md)。执行顺序固定为：LLM Boundary RC、时间语义、人格校准、可靠持久化、Trait-State shadow model、真实 Provider 评估。

后续开发以这份流程为准：

```text
先物理内核
再 API
再审计 / 回放 / 校准
最后才是 Dashboard 和高级可视化
```

不要为了三维星云 UI 或普通前端牺牲物理内核。MindSpace 3D 是只读高级观察器，必须保持在 Core 边界之外。

## 核心方向

CharacterOS 的目标不是写故事，而是模拟人物。

人物不是静态 Profile，而是一个由以下系统共同构成的动态心理系统：

```text
Biological Nature
Psychological Boundary
Personality Core
Memory Galaxy
Belief System
Need Deficiency
Desire
Behavior Bias
Behavior Decision
Time
```

概念主链路：

```text
Natural Language Event
-> ParsedExperienceEvent
-> ImpactParticle
-> MemoryNode
-> ImpactCluster
-> PersonalityDrift
-> BeliefState
-> NeedDeficiency
-> DesireState
-> BehaviorBias
-> BehaviorDecision
```

当前代码不是把这条链路硬塞进一个巨大函数。

当前运行结构是两阶段：

```text
Phase 1: physics mutation
Natural Language Event
-> ParsedExperienceEvent
-> ImpactParticle
-> MemoryNode
-> ImpactCluster
-> PersonalityDrift
-> BeliefState assimilation
-> persisted CharacterPhysicsState
```

```text
Phase 2: derived decision view
CharacterPhysicsState
-> NeedDeficiency
-> DesireState
-> BehaviorBias
-> BehaviorDecision
-> SocialMask / WorldModel / Meaning / Embodiment
```

`processEvent()` 负责事件进入系统后的物理状态变化。

`deriveCharacterState()` 负责从当前状态读出心理和行为倾向。

simulation replay 当前主要验证物理状态演化，不自动等同于一次完整行为决策。

## 开发总原则

- 不推倒重来。
- 不重写 V1。
- 不为了可视化牺牲物理内核。
- 不急着做多角色、世界模拟和关系网络；3D 仅用于现有单角色只读观察器。
- 不手工堆成千上万个精确参数。
- 优先设计参数如何演化，而不是设计固定参数表。
- 所有新增能力必须有测试。
- 保证 `npm run build`、`npm test`、`npm run next:build` 持续通过。
- Benchmark V2.1 持续通过。

开发顺序：

```text
数据结构
-> 纯逻辑
-> 测试
-> API
-> 审计 / 回放 / 校准
-> Dashboard
-> 高级可视化
```

## V10 Continuous Life 原则

```text
- 纵向模拟是观察，不是自主生命循环
- API 请求是显式的、有边界的
- Self-action candidate 只是信号，永不执行
- Commit persistence 通过 safe boundary（clone-only）
- Dry-run 是默认状态
- 单角色哲学持续保护
```

V10 Commit 生命周期：

```text
simulate (dry-run, 默认)
→ preview (计算 finalStateForCommit, 剥离完整 state, 返回公开 preview)
→ apply (指纹验证, 确认门控, 状态写入, 审计记录)
→ rollback (仅移除生成的记忆种子, 脏写保护)
```

## Parameter Evolution 开发原则

CharacterOS 的目标不是手动调出一套完美数值。

目标是建立参数演化系统。

开发时应优先考虑：

```text
baseline
inertia
homeostasis
accumulation
recovery
parameter network
weak random noise
statistical distribution
auto calibration
```

参数值应保持相对意义。

可以使用：

```text
very_low / low / normal / high / very_high
```

或宽松范围：

```text
0 ~ 100
0 ~ 1
```

不要追求不必要的小数精度。

事件不应该直接改参数。

优先路径是：

```text
Event
-> Factor
-> Accumulation
-> Threshold
-> Parameter Evolution
-> Homeostasis
```

## V10 完成状态

### Continuous Life Foundation (V10.1-V10.10) ✅
Life tick scheduler, energy/fatigue, sleep/wake, dream, boredom/inspiration, random thought, self-action candidate, dry-run runner, persistence boundary

### Differentiated Decision Pipeline (V10.12-V10.16) ✅
ActivatedSchema, NeedProfile, DesireProfile, BehaviorStrategy, ActionSurface, explainability, life decision context

### Longitudinal Simulation + API (V10.17-V10.19) ✅
720-step harness, deterministic seed chain, compact summaries, API route, governance audit

### Longitudinal Commit Closed Loop (V10.20-V10.29) ✅
finalStateForCommit, commit preview, commit apply, commit audit, commit rollback, code review fixes

## 当前立即执行策略

```text
1. 保持现有 Character Physics Core 可运行。
2. V10 Continuous Life 闭环稳定。
3. V13.9 LLM Boundary RC 保持封存，不接真实模型 Provider。
4. Temporal Semantics 保持 7/7 cases、21/21 assertions 全通过。
5. Model Calibration 已完成；下一阶段只做 Durable State / Event Store 可靠性。
6. 保持 Explorer/MindSpace 只读，不继续用视觉包装替代核心真实性工作。
7. 不做多角色、关系系统、世界模拟。
8. 不继续堆无校准目标的 benchmark case。
9. 确保 build、test、next:build 和全部质量门通过。
```

## V13 之后的核心硬化顺序

```text
V13.9 LLM Boundary QA / RC
-> Temporal Semantics (complete)
-> Parameter Registry + Golden Trajectory (complete)
-> Event Store + Transactional Snapshot (next)
-> Real Provider Evaluation
```

Temporal Semantics 与 Model Calibration 已完成：关键参数进入版本化注册表，轨迹、属性、变形关系、敏感性和 repair asymmetry 均进入质量门。下一步必须建立 Event Log、expected version、idempotency 与原子 Snapshot 提交；仍不能声称当前工程系数具有心理学实证效度。

真实 Provider 的进入门槛是：0 unsafe delivery、0 ungrounded delivery、0 mutation/writeback authority、断网时 deterministic fallback 可用。持久化的进入门槛是 Event Log 可重放、写入幂等、expected version 冲突可检测、Snapshot 可验证。

## 重要限制

- 不做多角色。
- 不做世界模拟。
- 不让 3D/前端进入 Core 依赖图或拥有状态写入权。
- 不把 MindSpace 扩张成多角色宇宙或编辑器。
- 不重写项目。
- 不破坏 V1/V2/V3/V10。
- Self-action candidate 永不执行。
- Dry-run 是默认。

## 当前版本

```text
CharacterOS Temporal Semantics + Model Calibration core stages complete on top of V13.9 Mock-only LLM Boundary RC
V10 Core / V11 Explorer / V12 Agent SDK RC 保持封存
27 API routes + MindSpace read-only surface + offline LLM Boundary Harness
Build / Test / Next build / Core Reality / Unified Quality / Determinism / Temporal / Model Calibration / LLM Quality 必须全部通过
Next: Durable State / Event Store + Transactional Snapshot
```
