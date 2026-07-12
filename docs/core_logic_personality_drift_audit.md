# CharacterOS 核心逻辑与人格偏移审计

## 审计结论

CharacterOS 的核心事件链路是真实的结构化状态演化，不是只改变解释文案：

```text
Event
-> Category / Emotion / Impact
-> MemoryNode / ImpactCluster
-> Boundary
-> Personality Coordinate / Velocity
-> Belief / Need / Desire
-> Decision Influence / Candidate Surface
-> Grounded Explanation / Reality Audit
```

人格偏移采用慢变量模型：事件不会直接覆盖人格，而是形成方向向量和记忆星团，再通过质量、稳定度、边界敏感性、学习率与动量逐步改变坐标。坐标与速度均有限幅，正向支持与负向压力走不同的边界路径。

本轮审计确认总体架构成立，但原实现存在数个会在长序列中放大的核心问题。相关问题已经修复并加入回归测试。

## 已修复的核心问题

### 运行时重复经历被二次计数

每次事件已经创建独立 `MemoryNode`，旧实现又把当前星团年龄写入每条 Memory 的 `repetitionCount`。星团质量随后对每条 Memory 再乘 repetitionCount，导致原始质量接近二次增长。

现在运行时每次事件的 `repetitionCount` 固定为 1；大于 1 的 repetitionCount 只用于导入或初始化时代表聚合历史。重复经历仍会通过多条 Memory、cluster age 和 belief assimilation 累积，但不再重复计算同一批经历。

### 普通事件被赋予过高影响

无关键词的 rule-fallback 事件曾得到接近 major 的默认影响值，长期记录普通日常也会增加边界压力。

现在 `general` 事件使用 minor 级默认影响；低影响 general 事件不增加边界压力，并使用显著降低的 personality drift activation。

### Overflow 裂纹被重复结算

旧实现会在角色已经 overflow 时，每个新事件都把全部历史超载量重新转换为 cracks。即使本次 incoming stress 为 0，裂纹仍会持续增长。

现在 cracks 和 integrity 只消费本次新增的 overflow pressure。

### 边界漂移倍率无上限

旧公式对 stress overflow 与 cracks 使用线性累加，长期负向序列可把人格学习率放大到数百倍，最后依赖 velocity clamp 才阻止数值爆炸。

现在 overflow 与 cracks 分别使用指数饱和，最终 drift multiplier 上限为 1.75。

### 人格坐标与影响向量混用

`ImpactCluster.centerCoordinate` 实际是方向向量，但旧势场把它当作绝对人格位置，与当前 core coordinate 计算距离。这会使同一事件的力大小受到无语义的坐标系差异影响。

现在力方向继续使用 impact vector；在引入真正的 `clusterPosition` 前，不再使用伪造的 core-to-vector 距离。不同 baseline 的敏感性由 boundary、learning rate、headroom 和 decision relevance 表达。

### 直接 Physics API 分类落后于 Event Parser

旧的 direct-engine 分类只识别 abandonment、betrayal 和 success。没有显式 category 的 support、failure、conflict、fatigue 等事件可能进入错误的 emotion 和 boundary 路径。

现在 direct-engine 标签分类覆盖全部事件类别，并在 emotion、boundary、reward 和 trace 之前生成统一 resolved event。

### 重复事件产生重复实体 ID

同一 event 被多次应用时，旧实现会创建相同的 particle ID 与 memory ID，破坏引用唯一性和未来 rollback 定位。

现在重复 occurrence 使用确定性序号后缀，同一状态与事件序列可重放，同时保持实体 ID 唯一。

### Repair nudge 污染 Galaxy trace

旧实现让 `state.coordinate` 与 `galaxyStep.drift.after` 共享对象引用。边界 repair nudge 会反向修改纯 Galaxy drift trace，使 trace 中的 before/velocity/after 无法严格对账。

现在 Galaxy drift 与最终 coordinate 分离；repair nudge 只进入最终 coordinate，并通过 `boundaryImpact.repairNudge` 提供接地证据。

### 长期审计的 Decision Before 取值错误

旧审计先处理事件，再从同一 after state 同时计算 decisionBefore 和 decisionAfter。这会让长期决策响应检查失真。

现在每一步先 clone before state 并计算 before decision，再处理事件并计算 after decision。

## 测试覆盖

新增与强化的回归检查包括：

- 隐式 support 标签必须进入 support emotion/boundary 路径。
- 同一事件重复应用时 Memory/Particle ID 必须唯一。
- 运行时重复事件的 cluster mass 必须按实际 occurrence 线性计数。
- 100 个普通日常事件不能改写人格或制造新裂纹。
- 极端 stress/cracks 下 drift multiplier 仍不得超过上限。
- Directional cluster force 不得依赖无意义的绝对 core 坐标距离。
- 陈旧记忆保留长期影响，但 active cluster mass 必须低于新鲜记忆。
- Galaxy drift trace 与 boundary repair nudge 必须可单独对账。
- Long-term audit 必须比较真实 before/after decision。
- 250 步混合类别序列中所有 coordinate、velocity、boundary 与 cluster 数值必须有限且有界。

## 仍需保留的模型边界

### 事件步与真实时间已完成核心解耦，参数仍需校准

事件时间、24 小时密度饱和、事件间 recovery/decay、velocity 半衰期与乱序保护已经进入 `processEvent()`。因此“记录得越勤，人格变化越快”的线性风险已被解除。剩余风险是 24 小时窗口、0.35 饱和下限与 14 天半衰期仍属于工程先验，需要 Golden Trajectory 和敏感性分析校准。

### 参数具有工程可解释性，不代表心理学实证效度

当前系数经过方向断言、反事实、长期累积和边界测试校准，可以保证系统内部一致，但不能解释为临床或真实人格测量。产品层必须持续保留 simulation-not-diagnosis 边界。

### Stress load 允许累积超过 1

`stressLoad` 是累计压力量而不是百分比，因此核心层允许大于 1。对外 surface 必须使用 bounded signal。后续可以增加 normalized reserve/capacity ratio，但不应直接破坏原始审计量。

### Recency floor 仍需数据校准

陈旧记忆当前保留 25% 的最低 active mass，避免历史被完全抹除。这个比例是工程先验，未来应通过长时间跨度 fixture 和目标人物轨迹校准。

## 后续测试建议

1. 引入属性测试，随机生成合法事件序列，持续验证有限值、坐标范围、ID 唯一和状态序列化往返。
2. 持续运行 Temporal Semantics Gate：集中/分散事件、恢复、中性稳定、乱序保护和确定性回放不得回归。
3. 为每类事件建立 golden trajectory，不只检查方向，也检查 1、5、20、100 步的合理区间。
4. 增加 metamorphic tests：改变无关字段不应改变人格漂移，改变 category relevance 才应改变目标通道。
5. 增加正负事件修复不对称测试，明确破坏、修复与 scar retention 的长期比例。
6. 增加 clean-clone CI 与浏览器 smoke test，保证 Core、Explorer、MindSpace 和 Agent 边界在全新安装环境下同时成立。
