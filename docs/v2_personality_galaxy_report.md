# CharacterOS V2 Personality Galaxy 阶段报告

## 版本结论

当前项目已经进入：

```text
CharacterOS V2.1 Biological Boundary Foundation
```

V2 的核心目标不是新增多角色、世界模拟或剧情系统，而是把单个角色内部升级成“人格星系”：

```text
BiologicalNature
-> PsychologicalBoundary
-> PersonalityCore
-> BeliefSystem
-> NeedDeficiency
-> Desire
-> Behavior
-> Experience
-> MemoryGalaxy
-> PersonalityDrift
```

V2 Galaxy 的物理链路为：

```text
PersonalityCore
-> MemoryNode
-> ImpactParticle
-> ImpactCluster
-> ClusterMass
-> ClusterForce
-> PersonalityDrift with Momentum
```

这次实现保留了 V1.0 的完整心理动力闭环，同时在 `src/core/galaxy/` 下新增纯领域模型，让 V2 内核可以被测试、序列化和可视化。

## 本阶段新增

### 0. Biological Nature / Psychological Boundary

新增：

```text
src/core/biological/nature.ts
src/core/boundary/psychologicalBoundary.ts
```

`BiologicalNature` 表示人格之下的稳定生物驱动力：

```text
survival
selfPreservation
selfInterest
reproduction
attachment
belonging
statusSeeking
control
curiosity
imagination
painAvoidance
rewardSeeking
```

`PsychologicalBoundary` 表示人物的承压结构：

```text
capacity
resilience
integrity
recoveryRate
stressLoad
cracks
overflowCount
phase
```

事件现在会先进入边界系统，计算 `incomingStress`、`overflowAmount` 和 `driftMultiplier`。边界不会直接改写人格，但当人物进入 strained / overflow 时，会放大人格漂移的敏感度。

### 1. PersonalityCore

新增：

```text
src/core/galaxy/personalityCore.ts
```

`PersonalityCore` 包含：

```text
position
velocity
learningRate
momentumAlpha
```

含义：

```text
人格核心不只是一个坐标点，而是带有惯性和学习率的慢变量。
```

当前 `velocity` 已经进入 `CharacterPhysicsState`，因此连续事件会携带上一轮人格运动速度，而不是每次都从静止重新计算。

### 2. Ebbinghaus Memory Decay

新增：

```text
src/core/galaxy/memoryDecay.ts
```

实现：

```text
M(t)=M0*exp(-k*t)
```

当前用于计算记忆在 Galaxy 视角下的衰减结果。它不会直接重写人格，只作为后续时间系统和记忆权重系统的基础。

### 3. Cluster Mass / Density / Stability

新增：

```text
src/core/galaxy/clusterMetrics.ts
```

当前规则：

```text
mass = sum(importance * repetitionCount)
stability = 1 / (1 + variance)
density = clusterMemoryCount / (1 + variance * 10)
```

这让重复经历真正形成更大的星团质量，而不是只记录为普通事件列表。

### 4. Potential Field / Cluster Force

新增：

```text
src/core/galaxy/potentialField.ts
```

实现了类势场公式：

```text
F = G * M * stability / r^2
```

含义：

```text
质量越大的影响星团，对人格核心的牵引越强。
距离越近的星团，当前牵引越明显。
```

注意：

```text
当前 ImpactCluster.centerCoordinate 表示“影响方向向量”，不是人格空间中的绝对坐标位置。
```

因此 V2 Foundation 中的力方向采用星团影响向量本身，距离只参与强度计算。未来如果引入真正的高维星团位置，应新增 `clusterPosition`，不要混用 `centerCoordinate`。

### 5. Momentum Drift

新增：

```text
src/core/galaxy/momentumDrift.ts
```

实现：

```text
velocity(t+1) = alpha * velocity(t) + force * learningRate
position(t+1) = position(t) + velocity(t+1)
```

这保证了人格不会被单个事件瞬间改写。人格变化必须通过星团合力和惯性缓慢发生。

### 6. PersonalityGalaxyEngine

新增：

```text
src/core/galaxy/personalityGalaxyEngine.ts
```

统一输出：

```text
forces
totalForce
drift
clusterMetrics
```

它是 V2 的核心快照生成器。

### 7. Future Research Interfaces

新增：

```text
src/core/galaxy/futureInterfaces.ts
```

只定义接口，不实现高级理论：

```text
EmbeddingSpaceAdapter
ClusterAlgorithm
AttractorModel
PhaseTransitionDetector
BayesianBeliefUpdater
HigherDimensionalCharacterSpace
```

这给未来 V3-V5 留出清晰接入口，但不会让当前版本过度设计。

### 8. V2 Snapshot 接入现有状态

更新：

```text
src/core/physics/physicsEngine.ts
src/core/physics/serialization.ts
```

现在所有 API / Dashboard 读取的 `SerializedCharacterPhysicsState` 都包含：

```text
state.biologicalNature
state.boundary
state.galaxy
```

其中包括：

```text
boundary.phase
boundary.stressLoad
boundary.integrity
boundary.cracks
clusterMetrics
forces
totalForce
drift
```

这意味着 V2 不是孤立模块，而是已经接入 V1.0 状态输出。

同时 `CharacterPhysicsEngine.processEvent` 内部已经切换到 V2 Galaxy drift：

```text
biological nature
-> psychological boundary
cluster metrics
-> potential-field forces
-> total force
-> momentum drift
-> update coordinate + velocity
```

旧的 `coordinateDrift` 返回字段保留，用于兼容 V1 调用方。

### 9. Galaxy 可视化升级

更新：

```text
src/core/visualization/galaxyProjection.ts
src/components/character/GalaxyView.tsx
src/app/styles.css
```

现在星系图展示：

```text
人格核心
影响星团
星团引力线
下一步人格漂移预测箭头
```

灰色线表示星团对人格核心的牵引。

橙色箭头表示合力和惯性作用下的下一步漂移趋势。

## 测试覆盖

新增：

```text
tests/core/personalityGalaxy.test.ts
```

覆盖：

```text
Ebbinghaus decay
Cluster mass/density/stability
Cluster force
Momentum drift
Personality galaxy step
```

更新：

```text
tests/core/serialization.test.ts
tests/core/galaxyProjection.test.ts
```

确认 V2 快照被序列化，并且投影层能产生力线与漂移箭头。

## 验证结果

```text
npm test       36 passed
npm run build  OK
```

## 当前能力

CharacterOS 当前可以：

```text
1. 接收单角色事件
2. 解析事件影响
3. 根据 BiologicalNature 计算压力敏感度
4. 根据 PsychologicalBoundary 吸收压力并判断 stable / strained / overflow
5. 生成 ImpactParticle
6. 写入 MemoryNode
7. 聚合 ImpactCluster
8. 根据记忆重复次数计算星团质量
9. 根据空间方差计算星团密度和稳定度
10. 根据势场公式计算 ClusterForce
11. 汇总星团合力
12. 用学习率、边界倍率和惯性预测人格核心漂移
13. 将人格速度写回角色状态
14. 派生 Belief / Need / Desire / BehaviorBias / BehaviorDecision
15. 在 Dashboard 上看到人格核心、星团、引力和漂移趋势
```

## 当前仍未实现

以下内容按路线保留，不在 V2 Foundation 中实现：

```text
自动语义 Embedding Space
DBSCAN / HDBSCAN 自动聚类
Attractor 动力学
Phase Transition
Bayesian Belief Update
Graph Networks
Worldline
Higher Dimensional Character Space
Benchmark System
```

## 版本位置

如果把最终目标视为完整 Psychological Galaxy Engine / Character Physics Engine，当前阶段大约是：

```text
V2 路线完成度：35% - 45%
整体项目完成度：35% - 40%
```

关键意义：

```text
CharacterOS 已经不再只是 Prompt + Static Profile。
它开始具备真正的人格星系内核：
记忆形成质量，星团产生引力，人格核心带惯性漂移。
```

## 下一阶段建议

下一阶段继续推进 V2，而不是跳到 V3：

```text
1. 让 MemoryDecay 进入模拟流程
2. 将 cluster mass 完全切换到 Galaxy metrics 的唯一来源
3. 增加 Galaxy Debug Panel
4. 增加多事件连续注入后的 force / drift 曲线
5. 生成新的 Dashboard 预览图
```

完成这些后，V2 可以标记为：

```text
CharacterOS V2.0 Personality Galaxy
```
