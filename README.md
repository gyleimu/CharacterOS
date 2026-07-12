# CharacterOS

CharacterOS 是一个 AI 小说人物决策引擎。

它的目标不是让 AI 写剧情，而是让 AI 根据人物经历模拟心理反应和抉择。

当前方向已经从 Prompt Character Engine 重构为 Character Physics Engine。

当前新增原则：

```text
不要设计成千上万个固定参数。
要设计参数如何演化。
生命不是无限变化，而是在变化中维持平衡。
```

CharacterOS 的核心不是精确数值，而是 baseline、inertia、homeostasis、accumulation、recovery、parameter network 和 calibration。

当前单角色雏形已经收束为 Character Blueprint：

```text
CharacterIdentity
-> initial PersonalityCoordinate
-> optional Initial Experiences
-> BiologicalNature
-> MetaState
-> PsychologicalBoundary
-> ProceduralRoutine
-> CharacterPhysicsState
```

当前阶段：

```text
CharacterOS — Core Kernel · Explorer Platform · Agent SDK · LLM Boundary
V10/V11/V12 RC artifacts remain sealed; V13.9 Mock-only LLM Boundary RC is complete.
```

当前项目状态：

```text
headless core         — Core 不依赖 React、Next.js 或 Three.js
Explorer              — 单角色状态、事件、解释与历史观察面
MindSpace 3D          — 只读高级观察器，不参与核心状态写入
Agent / LLM boundary  — 可嵌入接口层，默认不调用真实 LLM
single-character      — 单角色内核，不做多角色关系网络
no multi-character    — 不做关系网络（V20 未开始）
no world simulation   — 不做世界模拟
no autonomous scheduler — 不做自主调度
no mobile             — 不做移动端
no server deployment  — 不做服务器部署
```

当前测试结果：

```text
npm run build        tsc --noEmit
npm test             183 files / 2483 tests / 0 failures
npm run next:build   Explorer/MindSpace 页面 + API routes
```

当前质量门状态：

```text
Core Reality Gate         PASS   (0 active warnings, 0 failures)
Unified Quality Gate      PASS   (releaseReady=true)
Quality Trend             STABLE (0 regression flags)
Known Warning Registry    0 active / 1 allowed / 0 regressed
Benchmark V2.1            6/6 passed (100%)
Determinism Boundary      PASS
LLM Boundary Quality Gate PASS   (18/18, 0 unsafe deliveries)
Dependency Security       0 high / 0 critical
```

V10 RC Verdict: **PASS** ✅

V10 审计套件（12 modules, V10.67–V10.78）：
Reality Audit → Decision Responsiveness → Impact Calibration → Boundary Repair →
Long-Term Accumulation → Force Saturation + Trust Repair → Event Type Coverage →
Regression Gate → Unified Quality Gate → Trend Baseline → Warning Registry → RC Freeze

最新开发流程：

```text
docs/latest_development_flow.md
```

核心打磨计划：

```text
docs/core_polish_plan.md
```

架构宪法：

```text
docs/architecture_bible.md
docs/character_physics_upgrade_blueprint.md
```

参数与稳态系统文档：

```text
docs/parameter_system.md
docs/parameter_evolution.md
docs/homeostasis_system.md
docs/recovery_system.md
```

短期主线仍以 Character Physics Core 为中心：先完善数据结构、纯逻辑、测试和必要 API。Explorer 与 MindSpace 是 Core 之上的只读观察面，不得反向依赖或修改核心状态。

主项目方向采用 TypeScript Core 优先。Python 原型保留为算法实验和行为参考。

Character Physics V1 核心链路：

```text
Event -> Emotion -> Impact Particle -> Impact Cluster -> Personality Drift
-> Belief -> Need Deficiency -> Desire -> Behavior Bias -> Behavior Decision
```

Character Physics V2 新增人格星系层：

```text
PersonalityCore -> MemoryNode -> ImpactParticle -> ImpactCluster
-> ClusterMass -> ClusterForce -> PersonalityDrift with Momentum
```

V2.1 新增星云底层结构：

```text
Biological Nature -> Psychological Boundary -> Personality Core
-> Belief System -> Need Deficiency -> Desire -> Behavior
-> Experience -> Memory Galaxy -> Personality Drift
```

Legacy V0.x Prompt 链路：

```text
经历 -> 记忆空间 -> 记忆 -> 记忆簇 -> 信念 -> 缺失 -> 欲望 -> 情绪 -> 抉择
```

V0.x 仍然保留为可运行的心理分析链路。Character Physics V1 开始建立经验驱动人格系统。

当前人格空间基础维度：

```text
openness, conscientiousness, extroversion, agreeableness, neuroticism,
trust, attachment, fear, control
```

`EventImpactVector` 已经使用这套完整坐标系。Big Five drift 作为兼容投影保留。

ImpactCluster 也已经使用 9D `center_coordinate`。人格坐标漂移来自星团引力，而不是事件直接修改人格。

V2 已经新增 `src/core/galaxy/`，用于计算记忆衰减、星团质量、星团密度、星团稳定度、势场引力、合力和带惯性的人格漂移预测。

V2.1 新增 `src/core/biological/` 和 `src/core/boundary/`。生物本质提供稳定驱动力，心理边界提供承压容量、韧性、完整度、压力负载、裂纹和 overflow 状态。边界不会直接改写人格，但会影响人格漂移倍率。

V3.7.48 移除了用户可见网页、Dashboard 组件和 2D 星系投影代码。人格星系仍然是核心领域模型，但暂时只通过 TypeScript core、API、测试和 replay artifact 观察。

注意：`biological/` 和 `boundary/` 当前视为 V3/V4 前置原型，短期不继续扩张。接下来优先收敛 V2 的 Memory Decay、Cluster Mass、Cluster Force、Momentum 和 Drift。

V2.3 已经把运行态 `ImpactCluster.mass/density/stability` 同步到 Galaxy Metrics，并让 simulation snapshot 输出 `force` 与 `velocity`，便于观察连续事件下的人格惯性漂移。

当前 V2 测试已覆盖抛弃星团的负向牵引，以及支持/陪伴星团对 trust/fear 的反向修复力。

`PhysicsStepResult` 和 `POST /physics` 响应现在也包含轻量 `galaxyTrace`，用于观察单次事件的 totalForce、previousVelocity、nextVelocity、before/after 和 clusterMetrics。

V2.4 将 `GalaxyStepTrace` 下沉到 `src/core/trace/`，并让 simulation snapshot 每一步都携带 `boundaryImpact` 和 `galaxyTrace`。单步事件和多步模拟现在使用同一套可审计 trace。

V2.5 新增 `npm run demo:trace`，会生成 trace replay JSON。Trace 现在包含 per-cluster forces，可以观察每个星团分别如何贡献 trust / fear 力。

V2.6 将 trace replay 抽成 `src/core/trace/traceReplay.ts`，并支持多个固定 replay artifact：`abandonment_then_repair`、`betrayal_spiral`、`success_recovery`。

V2.7 为 replay artifact 增加 `schemaVersion`、`scenarioMeta`、`createdBy` 和 `parameters`，使其具备未来作为 Benchmark seed 的最小元数据。

V2.8 新增 `validateTraceReplayArtifact` 运行时校验。`npm run demo:trace` 现在会在写出 replay JSON 前检查 schemaVersion、scenario metadata、parameters、step trace、force、velocity、coordinate、clusterForces 和 clusterMetrics，避免后续 Benchmark seed 混入破损 artifact。

V2.9 修正 `calculateGalaxyClusterMetrics` 的空星团边界行为：没有挂载 MemoryNode 时，星团会保留自身已有 mass / density / stability，而不是凭空得到满稳定度。测试也新增了集中记忆与离散记忆的 density / stability 对照。

V2.10 新增 `repeated_abandonment_accumulation` 长序列 replay，用于观察同类抛弃/失联经历如何持续增加星团质量，并通过 personality momentum 让 trust 负向速度和 fear 正向速度逐步累积。

V2.11 新增 `support_recovery_accumulation` 长序列 replay，作为重复抛弃累积的修复性对照：持续解释、陪伴和兑现承诺会形成支持星团，让 trust 正向速度与 fear 负向速度逐步累积。

V2.12 新增 `TraceReplaySummary`。`npm run demo:trace` 现在会为每个 replay artifact 额外生成 `_summary.json`，包含 coordinateDelta、首尾 force、首尾 velocity、cluster mass/density/stability 趋势和 `dominantDirection`。

V2.13 新增 `TraceReplaySummaryIndex`。`npm run demo:trace` 现在会额外生成 `outputs/trace_replay_summary_index.json`，汇总全部 replay summary，并统计 `defensive_drift` / `recovery_drift` 等方向分布。

V2.14 新增 `validateTraceReplaySummary` 和 `validateTraceReplaySummaryIndex`。现在 replay artifact、summary 和 summary index 三层输出都会在写入前通过运行时结构校验。

V2.15 为 `TraceReplaySummary` 新增 `forceDelta`、`velocityDelta` 和 `dominantClusterCategory`，用于直接观察牵引力增强、人格惯性累积和主导星团类别。

V2.16 将 `TraceReplaySummaryIndex` 接入 Dashboard，新增“Replay 轨道总览”面板，用中文显示 replay 场景数量、方向分布、主导星团、trust/fear 漂移、速度增量和主星团质量增量。

V2.17 新增 `GET /api/trace/replay/summary`，返回经过校验的 `TraceReplaySummaryIndex`。Vitest 也补齐 `@` alias，使 API route 可以直接进入测试。

V2.18 将 Dashboard 的“Replay 轨道总览”接入 `/api/trace/replay/summary`，新增刷新按钮和加载状态，使前端可以从 API 重新读取 replay summary index。

V2.19 为“Replay 轨道总览”新增方向过滤和排序控件，可按防御/修复漂移筛选，并按主星团质量增量、trust 漂移、fear 漂移或标题排序。

V2.20 将 replay summary 的过滤和排序下沉到 core 与 API。`GET /api/trace/replay/summary` 现在支持 `direction` 和 `sort` query 参数，Dashboard 刷新时会携带当前控件状态。

V2.21 引入 Architecture Bible 和 Continuous Tick V0。`runContinuousTick` 可以在不调用 LLM、不改写人格坐标的情况下，让记忆 recency 衰减、心理边界恢复，并在压力过高时建议 Deep Thinking。

V2.22 引入 Meta State System。`CharacterPhysicsState` 现在包含动态 `metaState`，Continuous Tick 会用它影响有效遗忘速度、Deep Thinking 阈值，并让 emotionalSensitivity、resilience、selfControl、traumaAmplification 等元参数随压力缓慢漂移。

V2.23 引入 Attention System V0。系统现在可以根据 `MetaState`、`PsychologicalBoundary` 和事件 tags 计算注意力偏置，判断角色更容易注意 danger、relationship、reward、novelty 还是 control。

V2.24 引入 Embodiment / Action Noise V0。系统现在会把 `BehaviorDecision.mostLikelyAction` 继续送入身体执行层，根据 `MetaState.selfControl`、`resilience`、`PsychologicalBoundary`、疲劳、疼痛、恐惧、兴奋和 skill 计算动作噪声、可用自控力、误差风险和最终行动表现。`SerializedCharacterPhysicsState` 也开始保存 `metaState`，避免持久化后丢失元状态。

V2.25 引入 Procedural Memory V0。角色状态现在可以保存 `proceduralRoutines`，系统能根据 cue tags 激活自动行为，计算 cueMatch、automaticity 和 activationScore；重复行为会强化，长期未使用会衰减。Continuous Tick 现在也会让 procedural routines 随时间缓慢衰减，并在 trace 中输出平均习惯强度。

V2.26 将 Continuous Tick 接入服务层和 API。`CharacterPhysicsService.tickCharacter()` 可以推进角色内部时间，`POST /api/characters/[characterId]/physics/tick` 会返回 tick trace 和最新 state，使“角色在没人对话时继续变化”具备外部调用入口。

V2.27 将 Continuous Tick 接入 Dashboard。页面现在提供“推进 1 天 / 7 天 / 30 天”按钮，并显示记忆新近度、记忆有效权重、心理边界压力、元状态 self-control、注意力主通道、习惯数量、平均习惯强度和 Deep Thinking 建议。

V2.28 将 Procedural Memory 接入 DerivedState 和 Dashboard。默认林凡状态现在包含“反复查看手机消息”“深夜沉默退缩”等 procedural routines；系统会从最近记忆内容、beliefEffect、emotion 和 clusterId 中提取 cue，激活自动行为，并在心理动力状态面板中显示 cue 匹配、自动化程度和激活分。

V2.29 为 `POST /api/characters/[characterId]/physics/tick` 增加 route 级测试，确认 API 能推进角色时间、返回 tick trace、保留默认 procedural routines，并让平均习惯强度随时间衰减。

V2.30 将 Procedural Memory 接入事件处理闭环。`CharacterPhysicsEngine.processEvent` 现在会用事件 tags 激活 procedural routines，并强化被触发的自动行为；`ProcessEventResponse` 会返回本次 proceduralActivations，Dashboard 的“本次物理结果”也会显示本次事件触发的自动行为。

V3.0 引入 Social Mask / Multi-State V0。`DerivedCharacterState` 现在包含 `socialExpression`，区分 trueState、consciousState、expressedState 和 behaviorState，并计算 maskPressure、honestyLevel、selfDeceptionLevel、lieType 和 conflictLevel。Dashboard 的人物抉择面板会显示真实状态、意识说法、表达状态、行为状态和冲突。

V3.1 引入 Reward / Dopamine V0。`CharacterPhysicsState` 现在包含 `rewardState`，包括 dopamineLevel、dopamineThreshold、rewardSensitivity、noveltyNeed、adaptationRate 和 craving。事件处理会生成 rewardResult，重复奖励会产生 hedonic adaptation，有害习惯可能提高 craving；Continuous Tick 会让 reward state 向基线恢复。Dashboard 现在显示本次 reward 变化和 tick 中的 dopamine/craving 恢复。

V3.2 引入 Homeostasis / Adaptation V0。`CharacterPhysicsState` 现在包含 `homeostasisState`，包括 stabilitySetPoint、changeResistance、recoveryBias、moderationBias 和 scarRetention。Continuous Tick 会在记忆、边界、元状态、奖励恢复之后，再执行统一 homeostasis 调节，让系统缓慢回到平衡，同时保留伤痕与变化阻力。Dashboard 的 Tick 面板会显示 homeostasis 压力、变化阻力和调节原因。

V3.3 引入 Meaning System V0。`DerivedCharacterState` 现在包含 `meaning`，从 belief、need、desire、personality coordinate 和 rewardState 中推导意义锚点，计算 meaningIntensity、painTolerance、rewardOverride 和 existentialClarity。Dashboard 的心理动力状态面板会显示意义锚点、痛苦承受、奖励覆盖和存在清晰度。

V3.4 引入 Time Perception V0。系统现在会计算事件和 Continuous Tick 的主观时间，等待、孤独、恐惧会拉长时间，正向投入和奖励会压缩时间。`PhysicsStepResult` / `ProcessEventResponse` 和 `ContinuousTickTrace` 都包含 `timePerception`，Dashboard 会显示主观时间倍率、时间模式和客观/主观时间对照。

V3.5 引入 World Model / Interpretation V0。系统现在会把客观事件解释成角色的主观现实，输出 frame、subjectiveReality、confidence、distortionLevel、threatBias、trustBias、ambiguity、evidence 和 alternatives。事件响应和 DerivedState 都会包含 worldInterpretation，Dashboard 的人物抉择面板会显示主观现实解释。

V3.6 引入 Boredom / Inspiration V0。`CharacterPhysicsState` 现在包含 `boredomState`，包括 boredomLevel、stimulationNeed、daydreamingTendency、creativePressure 和 restlessness。Continuous Tick 会根据低刺激、奖励缺口、新奇需求、好奇心、压力和恢复质量更新无聊水平、探索驱动和灵感概率；Dashboard 会显示无聊水平、探索驱动、灵感概率、恢复质量和可选的 inspiration spark。

V3.7 引入 Belief Evolution V0。`CharacterPhysicsState` 现在保存 `beliefStates`，事件生成的 `MemoryNode` 会被同化为信念证据；Continuous Tick 会根据当前记忆支持、遗忘速度和元状态塑性缓慢增强或削弱信念，并输出 `beliefEvolution` trace。DerivedState 会优先使用持久化信念状态，而不是每次完全从记忆即时重算。

V3.7.50 引入 Character Blueprint Foundation。`CharacterPhysicsState` 现在包含 `identity`，林凡的身份、初始人格坐标、元状态、生物本质、心理边界、习惯和 learningRate 被收束到 `createLinFanBlueprint()`，默认状态由蓝图生成。

V3.7.51 将 Character Blueprint 接入角色生命周期。`DELETE /api/characters/[characterId]/physics` 仍然默认重置为空白蓝图状态；如果传入 `?seedInitialExperiences=true`，则会显式把林凡的三条初始经历灌入 Memory Galaxy，形成初始 MemoryNode、ImpactCluster 和 BeliefState。

V3.7.52 新增 Character State Integrity Inspection。`src/core/state/stateIntegrity.ts` 会检查 identity、coordinate、learningRate、MemoryNode、ImpactParticle、ImpactCluster、BeliefState 和 ProceduralRoutine 的基础一致性；`GET /api/characters/[characterId]/physics` 现在会返回 `integrity` 报告，用于无前端状态下直接审计角色内部结构。

V3.7.53 将 State Integrity 接入导入链路。`buildCharacterImportPlan` 现在会反序列化候选包并运行完整性检查；格式合法但内部引用断裂的包会被 `blocked`，`/import/validate` 会返回 422，`/import/apply` 即使带确认短语也不能绕过完整性失败。

V3.7.54 将 State Integrity 接入导出包。`GET /api/characters/[characterId]/export` 现在会附带 `stateIntegrity` 快照；`validateCharacterExportPackage` 会在该字段存在时校验其结构，`summarizeCharacterExportPackage` 也会输出导出时的 integrity 状态。

V3.7.55 将导出包内嵌 `stateIntegrity` 和导入时重新计算的 integrity 做对比。旧包没有快照时继续兼容；快照匹配时记录 `matched`；快照与当前状态不一致时导入计划升级为高风险 `needs_review`，确认短语也不能直接应用。

V3.7.56 为导出包新增 `packageDigest`。真实导出会基于稳定 JSON 规范计算 sha256 摘要；导入计划会重新计算 digest 并与内嵌值对比。旧包缺少 digest 时继续兼容，digest 不一致时进入高风险 review，普通确认导入不能绕过。

V3.7.57 为 `CharacterImportPlan` 新增 `auditSummary`。导入验证现在除了详细 plan，还会给出 `can_apply` / `review_required` / `rejected` 的高层结论、检查项、blockers、warnings 和 nextAction，方便无前端 API 工作流快速判断下一步。

V3.7.58 为 `CharacterImportApplyTrace` 新增导入应用转换轨迹。确认导入成功后，trace 会记录 `appliedAt`、替换前 `beforeStateIntegrity` 和替换后 `afterStateIntegrity`，让状态替换具备可审计的前后对照；未应用的 blocked trace 不产生转换快照。

V3.7.59 为成功导入新增 `transitionId` 和 `transitionSummary`。`transitionId` 基于目标角色、来源角色、包摘要和前后完整性摘要生成；`transitionSummary` 会输出 memory、particle、cluster、belief、procedural routine 的前后数量和 delta，使导入替换可以被 API 工作流直接追踪和比较。

V3.7.60 新增 Import Transition History。每次调用 `/import/apply` 都会记录一条角色级导入尝试历史，无论成功还是被阻止；`GET /api/characters/[characterId]/import/history` 会返回 history 和 summary。Next 单例使用轻量 JSON 文件仓库保存导入历史，reset 角色时会清空该角色的导入历史。

V3.7.61 将 `/import/apply` 返回的 trace 与 Import Transition History 直接打通。每个 applied 或 blocked trace 现在都会带上 `historyEntryId` 和 `historyRecordedAt`，并且历史列表里的 entry.trace 会保存同一组字段，方便调用方精确定位刚刚发生的导入尝试。

V3.7.62 为 `CharacterImportApplyTrace` 新增 `transactionSteps`。导入应用现在会显式记录 `authorization_checked`、`before_state_integrity_inspected`、`state_deserialized`、`after_state_integrity_inspected`、`state_replaced`、`adjustment_history_replaced`、`history_recorded` 等步骤；blocked 请求也会记录授权阻止和历史写入步骤，为未来数据库事务和失败回滚打基础。

V3.8 收束 Import Transaction Boundary。`CharacterImportApplyTrace` 现在同时包含 `transactionSteps` 和 `transactionSummary`，可以直接判断导入是否完成、是否被阻止、是否失败、是否替换了角色状态、是否替换了调整历史、是否写入导入历史。本地 JSON 文件仓库的锁逻辑也被抽成共享 helper，并在测试环境下使用内存仓库隔离 API route 测试，避免测试并发污染运行态文件。

`simulation/` 支持重复事件序列，用来观察同类经历如何增加 cluster mass、density、stability，并缓慢改变人格坐标。

每个 physics event 现在也会生成 `MemoryNode`，并挂到对应的 `ImpactCluster` 上。

MemoryNode 支持最小时间衰减：`recency` 会随模拟时间下降，并影响 `effective_memory_weight`，但不会直接修改人格。

- 一个测试人物：林凡
- 几条记忆
- 一个当前事件
- 简单标签检索
- 根据 impact 和 activation_count 计算记忆空间层级
- 从激活记忆中提取当前信念
- 从相关记忆中激活当前记忆簇
- 从激活信念中推导当前缺失
- 从当前缺失中推导当前欲望
- 每次运行后强化被激活记忆，轻微衰减未激活记忆
- Prompt 拼装
- OpenAI-compatible LLM 调用

## 贡献与变更

- [CHANGELOG.md](CHANGELOG.md) — 版本变更记录
- [CONTRIBUTING.md](CONTRIBUTING.md) — 开发流程与质量门
- [docs/INDEX.md](docs/INDEX.md) — 文档索引

## 项目结构

```text
src/
├── app/
│   ├── api/
│   └── layout.tsx
├── appContracts/
├── core/
│   ├── benchmark/
│   ├── biological/
│   ├── boredom/
│   ├── boundary/
│   ├── character/
│   ├── personality/
│   ├── event/
│   ├── emotion/
│   ├── memory/
│   ├── cluster/
│   ├── galaxy/
│   ├── drift/
│   ├── physics/
│   ├── simulation/
│   └── demo/
├── db/
│   └── repositories/
├── server/
└── services/
    └── demo/

character_os/
├── main.py
├── models.py
├── physics_engine.py
├── physics_demo.py
├── benchmark/
├── personality/
├── emotion/
├── memory/
├── cluster/
├── drift/
├── simulation/
├── memory_engine.py
├── cluster_engine.py
├── space_engine.py
├── belief_engine.py
├── deficiency_engine.py
├── desire_engine.py
├── reinforcement_engine.py
├── prompt_builder.py
├── llm_client.py
└── data/
    └── sample_character.json
```

## 运行方式

进入项目目录后运行：

TypeScript Core：

```bash
npm install
npm run build
npm test
npm run next:build
```

Quality Gates：

```bash
npm run test:reality   # Core Reality Gate
npm run test:quality   # Unified Quality Gate (benchmark + reality)
npm run test:trend     # Quality Trend Baseline
npm run test:determinism # Determinism Boundary Audit
npm run test:llm-quality # LLM Boundary Quality Gate
npm run test:security  # Block high/critical dependency vulnerabilities
npm run rc:verify      # All gates (RC verification)
```

Demo scripts：

```bash
npm run demo:physics
npm run demo:simulation
npm run demo:trace
npm run demo:service
```

Next.js 同时承载本地 Explorer/MindSpace 观察面与 API routes：

```bash
npm run next:build
```

如需本地调用 API，可运行：

```bash
npm run next:dev
```

本地访问：

```text
http://localhost:3000/           MindSpace 3D
http://localhost:3000/mindspace  MindSpace 3D 独立入口
outputs/characteros-explorer/    离线 Explorer artifact
outputs/llm-boundary-harness/    离线 LLM Boundary 审计 Harness
```

V0.9 新增心理动力状态面板：

```text
MemoryNode
-> BeliefState
-> NeedDeficiency
-> DesireState
-> BehaviorBias
```

V1.0 新增人物抉择面板：

```text
DerivedCharacterState
-> BehaviorDecision
-> inner thoughts
-> emotional reaction
-> inner conflict
-> will-not-do
-> most likely action
-> personality-consistency rationale
```

人格星系核心状态保存在 `PersonalityCoordinate`、`ImpactParticle`、`ImpactCluster` 和 `state.galaxy` 中，并通过测试、API、trace replay 以及只读 MindSpace 3D 观察。可视化不得成为核心计算或写入状态的来源。

V2 Galaxy 快照包含：

```text
clusterMetrics
forces
totalForce
drift
```

V2.1 底层状态包含：

```text
biologicalNature
boundary
boundary.phase: stable / strained / overflow
boundary.stressLoad
boundary.integrity
boundary.cracks
```

当前 Next 服务使用轻量 JSON 文件仓库保存物理状态：

```text
data/physics_states.json
```

该文件被 `.gitignore` 忽略。后续接入 Prisma/SQLite 时，只需要替换 `CharacterPhysicsRepository` 实现。

API（27 routes）：

```bash
# Character state
GET    /api/characters/[characterId]/physics
POST   /api/characters/[characterId]/physics
DELETE /api/characters/[characterId]/physics
DELETE /api/characters/[characterId]/physics?seedInitialExperiences=true

# Event parsing
POST   /api/characters/[characterId]/physics/parse

# Simulation & time
POST   /api/characters/[characterId]/physics/simulate
POST   /api/characters/[characterId]/physics/tick

# Parameter adjustment
POST   /api/characters/[characterId]/physics/adjustment/apply
POST   /api/characters/[characterId]/physics/adjustment/rollback
GET    /api/characters/[characterId]/physics/adjustment/history

# Calibration (read-only)
GET    /api/characters/[characterId]/physics/calibration

# Decision
GET    /api/characters/[characterId]/decision

# Export / Import
GET    /api/characters/[characterId]/export
POST   /api/characters/[characterId]/import/validate
POST   /api/characters/[characterId]/import/apply
GET    /api/characters/[characterId]/import/history

# Editor
POST   /api/characters/[characterId]/editor/preview
POST   /api/characters/[characterId]/editor/apply
GET    /api/characters/[characterId]/editor/history
POST   /api/characters/[characterId]/editor/rollback

# Graph
GET    /api/characters/[characterId]/graph

# Trace replay (global)
GET    /api/trace/replay/summary
GET    /api/trace/replay/calibration

# Longitudinal Life Simulation (V10)
POST   /api/characters/[characterId]/life/simulate
POST   /api/characters/[characterId]/life/simulate/commit/preview
POST   /api/characters/[characterId]/life/simulate/commit/apply
POST   /api/characters/[characterId]/life/simulate/commit/rollback
```

API 保护：

```text
CHARACTEROS_API_KEY 环境变量（可选）
- 设置后：所有 POST/DELETE route 需要 x-api-key header
- 未设置（本地开发）：全部放行
- GET 只读 route 保持开放
- /decision GET 额外保护（LLM 成本）
```

`ExperienceEvent` 支持两种输入方式：

- 只传 tags，由引擎启发式推断 emotion/category/vector。
- 显式传入 `category`、`emotion`、`coordinateDelta`、`beliefEffect`，用于事件编辑器或 LLM Parser 输出结构化物理事件。

当前已经有一个最小规则版事件解析器：

```text
natural language event + tags
-> ParsedExperienceEvent
-> EventImpactVector
-> MemoryNode
-> ImpactCluster
-> PersonalityDrift
```

`POST /physics/parse` 会返回：

- `category`
- `emotion`
- `coordinateDelta`
- `beliefEffect`
- `intensity`
- `importance`
- `relationshipWeight`
- `expectationGap`
- `personalitySensitivity`
- `parser.confidence`
- `parser.matchedKeywords`

后续接入 LLM Parser 时，应保持 `ParsedExperienceEvent` 输出结构不变，只替换解析来源。

当前也已经接入 OpenAI-compatible LLM Parser Adapter：

- 配置 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL` 后，`POST /physics/parse` 会优先调用 LLM。
- LLM 输出会被 normalize 成同一个 `ParsedExperienceEvent`。
- 如果未配置环境变量、模型返回非法 JSON、请求失败，会自动 fallback 到规则解析。
- 请求体可传 `useLLM: false` 强制只使用规则解析。

V3 基础设施摘要：

```text
State integrity        — 角色状态一致性检查
Export/import          — 状态导出/导入，带完整性快照和 sha256 digest
Import audit           — 导入 transaction steps + mutation outcome + pre-mutation snapshot
Parameter adjustment   — 手动参数调整，带 governance / cooldown / override / history
Continuous tick        — 17-phase 角色内部时间推进（decay, recovery, homeostasis, etc.）
Longitudinal life      — V10 continuous life simulation + commit preview/apply/rollback
Tag normalization      — English → Chinese canonical tag 映射（60+ entries, 8 语义域）
Attention diagnostic   — 每次事件处理的注意力评估（纯诊断，不改人格）
Calibration API        — 只读校准报告（clone + tick + hints + discard）
API key protection     — 最小 API 保护（本地开发零配置）
File lock              — 共享文件锁，stale owner 检测
Test isolation         — Vitest 内存仓库，不污染数据文件
```

PowerShell 示例：

```powershell
$body = @{
  description = "王雪已经三天没有回复林凡的消息，今天深夜突然出现在他家门口。"
  tags = @("王雪", "失联", "等待", "亲密关系", "夜晚")
  categoryHint = "auto"
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/characters/lin-fan-dashboard/physics/parse" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

阶段报告：

```text
docs/v0.9_report.md
docs/v1.0_report.md
docs/v2_personality_galaxy_report.md
docs/v2.2_boundary_dashboard_report.md
docs/v2.3_core_convergence_report.md
docs/v2.4_trace_standardization_report.md
docs/v2.5_trace_replay_report.md
docs/v2.6_trace_replay_schema_report.md
docs/v2.7_trace_metadata_report.md
docs/v2.8_trace_schema_guard_report.md
docs/v2.9_cluster_metrics_guard_report.md
docs/v2.10_repeated_event_replay_report.md
docs/v2.11_recovery_replay_contrast_report.md
docs/v2.12_trace_replay_summary_report.md
docs/v2.13_trace_summary_index_report.md
docs/v2.14_trace_summary_guard_report.md
docs/v2.15_trace_trend_delta_report.md
docs/v2.16_trace_summary_dashboard_report.md
docs/v2.17_trace_summary_api_report.md
docs/v2.18_trace_summary_refresh_report.md
docs/v2.19_trace_summary_controls_report.md
docs/v2.20_trace_summary_query_api_report.md
docs/v2.21_continuous_tick_foundation_report.md
docs/v2.22_meta_state_foundation_report.md
docs/v2.23_attention_system_foundation_report.md
docs/v2.24_action_noise_foundation_report.md
docs/v2.25_procedural_memory_foundation_report.md
docs/v2.26_continuous_tick_api_report.md
docs/v2.27_continuous_tick_dashboard_report.md
docs/v2.28_procedural_activation_dashboard_report.md
docs/v2.29_continuous_tick_route_guard_report.md
docs/v2.30_procedural_reinforcement_loop_report.md
docs/v3.0_social_mask_foundation_report.md
docs/v3.1_reward_dopamine_foundation_report.md
docs/v3.2_homeostasis_foundation_report.md
docs/v3.3_meaning_system_foundation_report.md
docs/v3.4_time_perception_foundation_report.md
docs/v3.5_world_model_foundation_report.md
docs/v3.6_boredom_inspiration_foundation_report.md
docs/v3.7_belief_evolution_foundation_report.md
docs/v3.7.1_belief_evolution_polish_report.md
docs/v3.7.2_continuous_tick_polish_report.md
docs/v3.7.3_physics_engine_pipeline_polish_report.md
docs/v3.7.4_core_polish_sweep_report.md
docs/v3.7.5_replay_calibration_report.md
docs/v3.7.6_replay_calibration_dashboard_report.md
docs/v3.7.7_replay_calibration_guard_report.md
docs/v3.7.8_manual_calibration_controls_report.md
docs/v3.7.9_learning_rate_calibration_control_report.md
docs/v3.7.10_parameter_evolution_architecture_update.md
docs/v3.7.11_parameter_homeostasis_docs_report.md
docs/v3.7.12_parameter_core_refactor_report.md
docs/v3.7.13_parameter_network_foundation_report.md
docs/v3.7.14_parameter_network_dashboard_report.md
docs/v3.7.15_tick_parameter_inputs_report.md
docs/v3.7.16_parameter_network_panel_refactor_report.md
docs/v3.7.17_tick_manual_controls_report.md
docs/v3.7.18_parameter_network_calibration_hints_report.md
docs/v3.7.19_homeostasis_calibration_hints_report.md
docs/v3.7.20_calibration_hint_list_refactor_report.md
docs/v3.7.21_recovery_trace_foundation_report.md
docs/v3.7.22_recovery_stabilization_estimate_report.md
docs/v3.7.23_tick_option_normalization_report.md
docs/v3.7.24_baseline_drift_observation_report.md
docs/v3.7.25_baseline_drift_calibration_hints_report.md
docs/v3.7.26_parameter_accumulation_trace_report.md
docs/v3.7.27_parameter_adjustment_draft_report.md
docs/v3.7.28_parameter_adjustment_preview_report.md
docs/v3.7.29_parameter_adjustment_audit_report.md
docs/v3.7.30_parameter_adjustment_patch_report.md
docs/v3.7.31_parameter_adjustment_snapshot_report.md
docs/v3.7.32_parameter_adjustment_apply_report.md
docs/v3.7.33_parameter_adjustment_api_report.md
docs/v3.7.34_manual_adjustment_dashboard_report.md
docs/v3.7.35_parameter_adjustment_history_report.md
docs/v3.7.36_parameter_adjustment_history_summary_report.md
docs/v3.7.37_parameter_adjustment_governance_report.md
docs/v3.7.38_parameter_adjustment_cooldown_report.md
docs/v3.7.39_parameter_adjustment_governance_override_report.md
docs/v3.7.40_parameter_adjustment_override_audit_fields_report.md
docs/v3.7.41_manual_adjustment_override_dashboard_report.md
docs/v3.7.42_character_export_audit_package_report.md
docs/v3.7.43_dashboard_export_audit_package_report.md
docs/v3.7.44_export_package_validation_report.md
docs/v3.7.45_import_validation_api_report.md
docs/v3.7.46_dashboard_import_validation_report.md
docs/v3.7.47_import_plan_core_report.md
docs/v3.7.48_frontend_visualization_removal_report.md
docs/v3.7.49_confirmed_import_apply_api_report.md
docs/v3.7.50_character_blueprint_foundation_report.md
docs/v3.7.51_blueprint_reset_lifecycle_api_report.md
docs/v3.7.52_state_integrity_inspection_report.md
docs/v3.7.53_import_integrity_gate_report.md
docs/v3.7.54_export_integrity_snapshot_report.md
docs/v3.7.55_import_integrity_snapshot_comparison_report.md
docs/v3.7.56_export_package_digest_report.md
docs/v3.7.57_import_audit_summary_report.md
docs/v3.7.58_import_apply_transition_trace_report.md
docs/v3.7.59_import_transition_summary_report.md
docs/v3.7.60_import_transition_history_report.md
docs/v3.7.61_import_history_trace_link_report.md
docs/v3.7.62_import_transaction_steps_report.md
docs/v10.29_longitudinal_commit_lifecycle_qa_report.md
docs/v10.28_longitudinal_commit_rollback_api_report.md
docs/v10.26_longitudinal_commit_apply_api_report.md
docs/v10.22_longitudinal_commit_preview_report.md
docs/v10.19_longitudinal_simulation_governance_report.md
docs/v10.18_longitudinal_simulation_api_report.md
docs/v10.17_longitudinal_single_character_simulation_harness_report.md
docs/v10.10_continuous_living_stable_report.md
docs/v10_continuous_life_design_charter.md
docs/v9_character_editor_design_charter.md
docs/v8_graph_viewer_design_charter.md
docs/v7_graph_data_model_design_charter.md
docs/v6_benchmark_design_charter.md
docs/v5_design_charter.md
docs/v4_design_charter.md
docs/v3.8_project_progress_report.md
docs/parameter_system.md
docs/parameter_evolution.md
docs/homeostasis_system.md
docs/recovery_system.md
docs/v3.4_self_check_report.md
docs/core_polish_plan.md
docs/architecture_bible.md
docs/latest_development_flow.md
```

Character Physics V1 demo：

```bash
python character_os/physics_demo.py
```

Repeated-event simulation：

```bash
python character_os/simulation_demo.py
```

Character Physics tests：

```bash
python -m unittest discover -s tests
```

Legacy V0.x prompt pipeline：

```bash
python character_os/main.py
```

测试事件：

```text
王雪已经三天没有回复林凡的消息，今天深夜突然出现在他家门口。
```

测试 tags：

```text
王雪, 失联, 等待, 亲密关系, 夜晚
```

## 配置 LLM

如果不配置 API key，程序仍然可以运行，并会直接打印生成的 prompt。

如需调用 OpenAI-compatible API，可以复制 `.env.example` 为 `.env`：

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=你的 API key
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT=120
```

`.env` 已被 `.gitignore` 忽略，不要提交真实 API key。

也可以直接设置环境变量：

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=你的 API key
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT=120
```

PowerShell 示例：

```powershell
$env:LLM_BASE_URL="https://api.openai.com/v1"
$env:LLM_API_KEY="你的 API key"
$env:LLM_MODEL="gpt-4o-mini"
$env:LLM_TIMEOUT="120"
python character_os/main.py
```

## 成功标准

输入一个事件后，系统能：

1. 找到相关记忆。
2. 计算记忆空间层级。
3. 从相关记忆中激活当前记忆空间节点。
4. 从相关记忆中激活当前记忆簇。
5. 从相关记忆中激活当前信念。
6. 从当前信念中激活缺失。
7. 从当前缺失中激活欲望。
8. 把记忆空间、记忆、记忆簇、信念、缺失和欲望拼进 prompt。
9. 调用大模型，或在未配置 API key 时打印 prompt。
10. 输出一个符合人物经历、记忆空间、记忆簇、信念、缺失和欲望结构的心理与抉择分析。
11. 强化本次被激活的记忆，并把更新后的人物状态写回 JSON。

## 记忆强化

V0.05 会在每次运行后更新 `character_os/data/sample_character.json`：

- 被激活的记忆：`impact + 2`，最高不超过 100。
- 未被激活的记忆：`impact - 1`，最低不低于 0。
- 被激活的记忆会增加 `activation_count`，并记录 `last_activated`。

## 记忆簇

V0.1 会在运行时根据记忆 tags、effects 和 beliefs 推导记忆簇。

当前内置簇：

- 抛弃创伤簇
- 亲密关系不可靠簇
- 王雪依赖簇

记忆簇暂时不写回 JSON。中心、边界和空间层级由 V0.2 的记忆空间在运行时计算。

## 记忆空间

V0.2 会在运行时根据 `impact` 和 `activation_count` 计算记忆位置。

当前层级：

- `core`：核心记忆
- `near_core`：近核心记忆
- `middle`：中层记忆
- `boundary`：边界记忆

`core_distance` 越接近 `0`，说明记忆越靠近人格核心。

记忆空间暂时不写回 JSON。V0.5 再处理 2D 可视化。
