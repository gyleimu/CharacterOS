# CharacterOS 最新开发流程

## 当前判断

当前项目已从 V1 单角色心理动力闭环、V2 Personality Galaxy、V3 Infrastructure Hardening，推进到 V10.29 Longitudinal Single-Character Continuous Life Closed Loop。

后续开发以这份流程为准：

```text
先物理内核
再 API
再审计 / 回放 / 校准
最后才是 Dashboard 和高级可视化
```

不要为了三维星云 UI 或普通前端牺牲物理内核。3D Personality Galaxy Viewer 和用户可见 Dashboard 暂时后置。

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
- 不急着做多角色、世界模拟、关系网络和 3D 宇宙 UI。
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
3. 为"诗云式产品形态"做最小可用体验准备。
4. 不恢复用户可见前端，不扩张 3D 可视化。
5. 不做多角色、关系系统、世界模拟。
6. 不继续堆 benchmark case。
7. 确保 build、test、next:build、benchmark 全部通过。
```

## 重要限制

- 不做多角色。
- 不做世界模拟。
- 不做 3D 可视化。
- 不恢复用户可见前端。
- 不重写项目。
- 不破坏 V1/V2/V3/V10。
- Self-action candidate 永不执行。
- Dry-run 是默认。

## 当前版本

```text
CharacterOS V10.29
129 test files / 1363 tests / 0 failures
26 API routes
Build ✅ Test ✅ Next:build ✅ Benchmark V2.1 ✅
```
