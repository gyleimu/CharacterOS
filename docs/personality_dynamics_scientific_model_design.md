# CharacterOS 人格动力学科学模型设计

## 1. 设计目标

本文定义 CharacterOS 下一代人格漂移模型。目标不是声称能够“完美还原真实人格”，而是把系统提升为一个可证伪、可回放、可校准、显式表达不确定性的单角色动力模型。

模型必须同时满足：

- 单次行为和情绪可以明显波动，但长期人格基线不能被一次普通事件改写。
- 重复、持续、方向一致且与人格维度相关的经验，可以缓慢改变长期基线。
- 同一角色在不同场景可以表现出不同状态，但仍保留稳定的个体差异。
- 事件影响必须区分短期状态、情境习惯、信念变化和长期 trait consolidation。
- 没有足够证据时，系统必须输出高不确定性，而不是生成确定结论。
- 所有变化都能追溯到事件、评估、状态表达、反应和累积证据。

这是一套工程和研究模型，不是医学诊断模型，也不代表对真实个体的客观测量。

## 2. 研究依据

### 2.1 人格稳定，但不是静止

Roberts 与 DelVecchio 汇总 152 项纵向研究，说明人格特质存在明显 rank-order consistency，而且稳定性随年龄上升；时间跨度越长，相关性会下降。这意味着模型应有长期稳定性，但不能把 trait 冻结为常量。

Roberts、Walton 与 Viechtbauer 的纵向元分析还显示，多个 Big Five 维度会在生命历程中出现平均水平变化。因此 CharacterOS 应允许慢速发展趋势，但不能把群体平均趋势当作某个角色的必然命运。

### 2.2 Trait 应被理解为状态分布，而不是单个瞬时值

Fleeson 的经验采样研究和 Whole Trait Theory 将 trait 的描述侧定义为人格状态的密度分布。个体在不同情境下会表现出较宽的状态范围，但其分布均值和形状仍保留稳定个体差异。

因此 CharacterOS 不应继续用一个 `coordinate` 同时表示“此刻表现”和“长期人格”。至少要分别建模：

- trait baseline：长期吸引子位置；
- state expression：当前情境中的人格状态表达；
- state distribution：一段时间内状态表达的均值、方差和范围。

### 2.3 长期变化来自重复的短期过程

TESSERA 框架将长期人格发展描述为重复发生的短期链路：

```text
Triggering situation
-> Expectancy
-> State / state expression
-> Reaction
-> repeated association and reinforcement
-> long-term trait development
```

这与 CharacterOS 的 Event、Belief、Emotion、Decision 和 Memory 模块天然兼容，但当前实现缺少显式 TESSERA episode，也缺少“证据积累后才 consolidation”的门。

### 2.4 动态系统需要基线、波动和吸引子强度

PersDyn 模型使用三个核心量描述人格动力：baseline、variability 和 attractor strength。DynAffect 和人格状态动态研究也使用 home base、variability 与 attractor strength 表达个体差异。

CharacterOS 已有 `coordinate`、`velocity` 和 `homeostasis`，但现有 homeostasis 不是逐人格维度吸引子，velocity 也不能替代状态分布和吸引子强度。因此应复用概念，不应直接复用当前字段含义。

### 2.5 观察值不等于 trait

Latent State-Trait Theory 将观察分解为 trait、occasion-specific state 和 measurement error。CharacterOS 虽然不是心理测量工具，但同样需要区分：

```text
observed behavior signal
= latent trait contribution
+ situational state contribution
+ observation uncertainty
```

自然语言事件、用户日志和 LLM 提取都带有测量误差。解析 confidence 只能影响证据权重，不能被当作人格事实。

### 2.6 生活事件平均效应通常不大，个体差异很重要

大样本纵向生活事件研究显示，事件与人格变化存在关联，但平均效应并非普遍巨大，且常有 anticipation、adaptation、baseline 与个体差异。模型应默认小而有界的长期效应，并通过人格、历史、情境和反应调节，而不是为每个事件类别配置固定大幅漂移。

干预研究说明人格可以在数月尺度发生变化，但这种证据不能被误用为单次输入即可重写人格。对 CharacterOS 更合适的解释是：持续、结构化、反复产生状态表达和反馈的过程，可以提高 consolidation evidence。

## 3. 目标架构

```text
Event Observation
-> Parsed Evidence + uncertainty
-> TESSERA Episode
   Trigger
   Expectancy / appraisal
   State Expression
   Reaction / outcome
-> Transient State Update
-> Context Profile Update
-> Evidence Accumulator
-> Consolidation Gate
-> Trait Attractor Update
-> Decision Surface
-> Audit / Replay / Calibration
```

### 3.1 五层状态

#### A. Trait Baseline

长期人格吸引子，继续使用现有 9 维坐标，但语义改为慢变量：

```text
openness, conscientiousness, extroversion,
agreeableness, neuroticism,
trust, attachment, fear, control
```

它不直接等于此刻行为，也不应被一次事件直接覆盖。

#### B. Transient State Expression

当前时刻、当前情境下的人格状态表达。它可以快速变化，并随时间回归 trait baseline。

```text
state_t = traitBaseline
        + contextResponse
        + appraisalResponse
        + emotionNeedResponse
```

核心路径保持确定性。系统不在 physics core 中采样随机噪声，而是把无法观测的部分保存在 uncertainty/variance 中。

#### C. State Distribution

对每个维度维护窗口统计：

```ts
interface TraitStateDistribution {
  mean: number;
  variance: number;
  effectiveSampleSize: number;
  observationSpanDays: number;
  distinctContextCount: number;
  lastObservedAt: string | null;
}
```

它描述“这个人通常如何表现”和“表现波动有多大”，而不是只保留最后一个状态点。

#### D. Context Profile

同一个 trait 在 relationship、study、social、work、rest 等情境下可以有不同条件均值。Context Profile 只影响 state expression；只有获得跨情境证据后，才更可能更新全局 trait baseline。

#### E. Trait Dynamics Parameters

每个维度维护个体化动力参数：

```ts
interface TraitDynamicsParameters {
  attractorStrength: number;
  variability: number;
  plasticity: number;
  consolidationRate: number;
  uncertainty: number;
}
```

- `attractorStrength`：偏离基线后的恢复速度。
- `variability`：正常状态波动宽度。
- `plasticity`：长期基线可改变程度。
- `consolidationRate`：充分证据转化为 trait 的速度。
- `uncertainty`：当前参数和基线可信程度。

## 4. TESSERA Episode 合同

每个可能影响人格的事件应生成结构化 episode：

```ts
interface TesseraEpisode {
  episodeId: string;
  eventId: string;
  occurredAt: string;
  trigger: {
    category: string;
    context: string;
    magnitude: number;
    confidence: number;
  };
  expectancy: {
    beliefRefs: string[];
    appraisal: Record<string, number>;
    confidence: number;
  };
  stateExpression: {
    values: PersonalityCoordinateValues;
    uncertainty: Record<PersonalityDimensionKey, number>;
  };
  reaction: {
    strategyTag: string;
    actionCandidateId: string | null;
    outcomeValence: number | null;
    feedbackConfidence: number;
  };
  evidenceRefs: string[];
  parameterSetVersion: string;
  engineSemanticsVersion: string;
}
```

如果 reaction 或 outcome 尚未发生，episode 可以保持 open，但不得提前作为完整人格证据提交。

## 5. Evidence Accumulator

人格变化不再直接使用事件次数，而使用每个维度、每个方向的累积证据：

```text
evidence = impact
         * parseConfidence
         * dimensionRelevance
         * stateExpressionStrength
         * reactionFeedback
         * temporalPersistence
         * contextGeneralization
         * noveltySaturation
```

其中：

- `temporalPersistence` 要求证据跨越真实时间，而非同一分钟重复提交。
- `contextGeneralization` 在同方向证据出现在多个情境时上升。
- `noveltySaturation` 对重复文本、重复事件和同源日志递减。
- 方向冲突不会简单抵消，而是提高 variability 和 uncertainty。
- 缺少 outcome 时降低 evidence confidence，不虚构反馈。

## 6. Consolidation Gate

只有满足门槛的 evidence 才能推动 trait baseline。建议门条件：

```text
minimum effective episodes
AND minimum observation span
AND direction consistency
AND evidence confidence
AND either repeated same-context evidence
    or cross-context generalization evidence
```

重大事件可以立即改变 emotion、boundary、belief 和 state expression，但 trait baseline 仍通过 consolidation 慢速改变。重大创伤或持续干预不使用特殊“瞬移”规则，而是提高 evidence magnitude、持续时长和后续 episode 权重。

长期更新建议使用有界吸引子公式：

```text
traitDelta_d = plasticity_d
             * consolidationRate_d
             * gateStrength_d
             * (stateDistributionMean_d - traitBaseline_d)
             * elapsedTimeScale
```

并满足：

```text
abs(singleCommitTraitDelta_d) <= dimensionCommitCap_d
```

该公式表达的是向长期状态分布缓慢移动，不是把事件向量直接叠加到 trait。

## 7. 恢复、伤痕与正向修复

模型区分三种恢复：

1. Transient recovery：state expression 回到当前 trait baseline。
2. Boundary/emotion recovery：压力、情绪和身体状态恢复。
3. Trait reconsolidation：长期一致的新证据缓慢移动 baseline。

scar 不应成为永久不可逆常数。更合理的实现是：

- 历史负向证据仍保留在 accumulator 和 memory 中；
- 新的正向 episode 可以降低负向证据的当前权重；
- 不删除历史记录；
- repair 速度可与 damage 不对称，但必须由数据和校准范围约束。

## 8. 决策层如何消费人格动力

Decision 不应只读取 trait baseline，也不能只读取瞬时情绪。建议输入：

```text
trait baseline
+ current state expression
+ context profile
+ belief / need / desire
+ boundary / emotion / energy
+ uncertainty
```

影响职责：

- trait baseline 决定稳定偏好和默认策略先验；
- state expression 调整当前候选分数；
- context profile 调整场景相关策略；
- boundary/emotion/energy 调整风险、速度和行动能力；
- uncertainty 降低解释确定性，而不是随机改变答案。

这样 fatigue 可以强烈影响当前 action surface，同时保持 conscientiousness trait 基本稳定。

## 9. 与当前 CharacterOS 的迁移映射

| 当前字段/模块 | 新语义或迁移方式 |
|---------------|------------------|
| `coordinate` | 第一阶段原样迁移为 `traitBaseline`，保持兼容读取 |
| `velocity` | 暂保留为 legacy integration momentum，后续由 evidence/consolidation trace 取代 |
| `homeostasisState` | 拆为系统稳态与逐维度 attractor strength，不再统一回归匿名默认人格 |
| `emotion` / `boundary` / `lifeContext` | 主要驱动 transient state，不直接等价于 trait |
| `beliefStates` | 为 expectancy/appraisal 提供 evidence refs |
| `decisionInfluenceLayer` | 同时消费 trait、state、context 与 uncertainty |
| `memory` / `cluster` | 为 episode 与 accumulator 提供可追溯证据，不直接用 mass 代表人格真值 |
| `parameterSetVersion` | 继续保留，并新增 `engineSemanticsVersion` |
| Time Machine | 同时恢复 trait、state distribution、context profile 和 accumulator |

迁移必须采用 shadow mode：新旧模型对同一事件序列并行计算，新模型在通过校准门前不能替换生产 decision surface。

## 10. 数据结构建议

```ts
interface PersonalityDynamicsState {
  schemaVersion: string;
  engineSemanticsVersion: string;
  traitBaseline: PersonalityCoordinate;
  currentState: PersonalityCoordinate;
  stateDistributions: Record<PersonalityDimensionKey, TraitStateDistribution>;
  dynamics: Record<PersonalityDimensionKey, TraitDynamicsParameters>;
  contextProfiles: Record<string, ContextualTraitProfile>;
  evidenceAccumulators: TraitEvidenceAccumulator[];
  openEpisodes: TesseraEpisode[];
  lastConsolidatedAt: string | null;
}
```

该结构必须进入 Durable State schema、Event Log、Snapshot、Export 和 Time Machine，不能仅存在于内存对象。

## 11. 校准和验收体系

### 11.1 必须新增的轨迹测试

- Single event bound：单次普通事件只明显改变 transient state。
- Shock then recovery：重大事件产生明显状态冲击，但长期 trait 只缓慢 consolidation。
- Repetition across time：同方向事件跨数周重复后 trait 开始变化。
- Dense duplicate saturation：同一分钟重复输入不会伪造长期证据。
- Cross-context generalization：多个情境一致变化比单一情境更容易改变全局 baseline。
- Context specificity：工作失败不能自动改写所有关系场景。
- State recovery：无后续证据时 state 回归 baseline。
- Trait persistence：已 consolidation 的改变不会在一次休息后消失。
- Repair asymmetry：修复可见但不删除历史。
- Baseline differentiation：不同 baseline 对同一 episode 保留不同响应。
- Rank-order stability：多角色 fixture 仅用于离线校准，长期排序不能被短期噪声任意颠覆。
- Uncertainty discipline：证据越少，区间越宽；不得用默认高置信度填空。

### 11.2 统计指标

- trait baseline 30/90/365 天漂移量；
- state within-person variance；
- attractor half-life；
- context-specific mean 与 global mean 距离；
- effective sample size；
- evidence direction consistency；
- consolidation event rate；
- rank-order correlation；
- test-retest stability；
- calibration error 和 out-of-sample trajectory error；
- decision responsiveness 与 overreaction score。

真实数据校准应优先使用分层 Bayesian 或 Dynamic Structural Equation Model，把个体内动态和个体间差异分开。CharacterOS 运行时仍使用确定性参数；统计模型只负责估计参数分布和区间，不把采样随机性带入 replay core。

## 12. 实施顺序

### Phase A: Durable State Foundation

- 实现 Event Store、Snapshot、expectedVersion、idempotency 和原子提交。
- 保存 `parameterSetVersion`、`engineSemanticsVersion` 和时间语义。
- 先保证旧模型可跨崩溃重放。

### Phase B: Trait-State Separation in Shadow Mode

- 新增 `PersonalityDynamicsState`。
- `coordinate` 兼容映射到 `traitBaseline`。
- emotion、boundary、energy、context 生成 `currentState`。
- 生产决策仍使用旧模型，新模型仅输出审计 diff。

### Phase C: TESSERA Episode and Evidence Accumulator

- 显式记录 trigger、expectancy、state、reaction 和 evidence refs。
- 引入时间跨度、方向一致性、重复饱和和 context generalization。
- 未闭合 episode 不进入完整 consolidation。

### Phase D: Consolidation and Attractor Model

- 实现逐维度 baseline、variability、plasticity 和 attractor strength。
- 通过 Golden、property、metamorphic、sensitivity 和 out-of-sample 门。
- 与旧 drift 并行至少完成固定长期轨迹集。

### Phase E: Decision Integration

- Decision 同时读取 trait、state、context 和 uncertainty。
- 修复 fatigue 等 transient channel，无需污染长期 trait。
- explanation 明确区分“当前状态变化”和“长期人格变化”。

### Phase F: Empirical Calibration

- 使用经同意、匿名化、非诊断目的的纵向数据。
- 预注册参数和评价指标，保留 holdout characters/periods。
- 报告置信区间、失败类别和外推边界。
- 在没有数据前只称为 engineering prior，不称为心理学验证。

## 13. 发布门

新模型替换旧人格漂移前必须满足：

```text
deterministic replay              PASS
single-event trait cap            PASS
transient recovery                PASS
cross-time consolidation          PASS
context specificity               PASS
rank-order stability              PASS
uncertainty discipline            PASS
decision responsiveness           PASS
overreaction guard                PASS
old/new shadow divergence review  PASS
```

任何一项 FAIL，新模型只能保持 shadow mode。

## 14. 明确不做

- 不把论文中的群体平均效应直接硬编码到某个角色。
- 不把一次事件、一次对话或一次 LLM 判断视为 trait 测量。
- 不通过增加随机数制造“真实感”。
- 不用神经网络黑盒直接写入人格坐标。
- 不删除负向历史来模拟修复。
- 不把模型结果描述为诊断、事实或真实人格评分。
- 不在 Durable State 和 replay versioning 完成前替换当前 drift engine。

## 15. 主要参考文献

1. Roberts, B. W., & DelVecchio, W. F. (2000). The rank-order consistency of personality traits from childhood to old age. *Psychological Bulletin, 126*(1), 3-25. [DOI](https://doi.org/10.1037/0033-2909.126.1.3)
2. Roberts, B. W., Walton, K. E., & Viechtbauer, W. (2006). Patterns of mean-level change in personality traits across the life course. *Psychological Bulletin, 132*(1), 1-25. [DOI](https://doi.org/10.1037/0033-2909.132.1.1)
3. Fleeson, W. (2001). Toward a structure- and process-integrated view of personality: Traits as density distributions of states. *Journal of Personality and Social Psychology, 80*(6), 1011-1027. [DOI](https://doi.org/10.1037/0022-3514.80.6.1011)
4. Fleeson, W., & Gallagher, P. (2009). The implications of Big Five standing for the distribution of trait manifestation in behavior. *Journal of Personality and Social Psychology, 97*(6), 1097-1114. [DOI](https://doi.org/10.1037/a0016786)
5. Fleeson, W., & Jayawickreme, E. (2015). Whole Trait Theory. *Journal of Research in Personality, 56*, 82-92. [DOI](https://doi.org/10.1016/j.jrp.2014.10.009)
6. Wrzus, C., & Roberts, B. W. (2017). Processes of Personality Development in Adulthood: The TESSERA Framework. *Personality and Social Psychology Review, 21*(3), 253-277. [DOI](https://doi.org/10.1177/1088868316652279)
7. Sosnowska, J., Kuppens, P., De Fruyt, F., & Hofmans, J. (2019). A dynamic systems approach to personality: The Personality Dynamics model. *Personality and Individual Differences, 144*, 11-18. [DOI](https://doi.org/10.1016/j.paid.2019.02.013)
8. Steyer, R., Schmitt, M., & Eid, M. (1999). Latent state-trait theory and research in personality and individual differences. *European Journal of Personality, 13*(5), 389-408. [DOI](https://doi.org/10.1002/(SICI)1099-0984(199909/10)13:5%3C389::AID-PER361%3E3.0.CO;2-A)
9. Denissen, J. J. A., Luhmann, M., Chung, J. M., & Bleidorn, W. (2019). Transactions between life events and personality traits across the adult lifespan. *Journal of Personality and Social Psychology, 116*(4), 612-633. [DOI](https://doi.org/10.1037/pspp0000196)
10. Roberts, B. W., Luo, J., Briley, D. A., Chow, P. I., Su, R., & Hill, P. L. (2017). A systematic review of personality trait change through intervention. *Psychological Bulletin, 143*(2), 117-141. [DOI](https://doi.org/10.1037/bul0000088)
11. Asparouhov, T., Hamaker, E. L., & Muthen, B. (2018). Dynamic structural equation models. *Structural Equation Modeling, 25*(3), 359-388. [DOI](https://doi.org/10.1080/10705511.2017.1406803)
12. Bleidorn, W., et al. (2021). Personality Trait Stability and Change. *Personality Science, 2*, e6009. [DOI](https://doi.org/10.5964/ps.6009)
