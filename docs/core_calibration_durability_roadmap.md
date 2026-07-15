# CharacterOS Core Calibration & Durability Roadmap

## 目标

后续开发不再以新增页面或扩大产品表面为目标，而是解决四类核心风险：

```text
语言边界安全
-> 时间语义正确
-> 人格参数可校准
-> 状态持久化可靠
-> 依赖与发布持续治理
```

这条路线继续保护单角色边界。V20 Relationship Engine、多角色关系网络和世界模拟不在当前范围内。

## 执行顺序

| 阶段 | 目标 | 进入条件 | 完成标准 |
|------|------|----------|----------|
| V13.9 | LLM Boundary QA / RC | V13.8 离线闭环通过 | 独立质量门、对抗集、RC manifest、0 unsafe delivery |
| Temporal Semantics | 解除事件次数与人格速度的错误绑定 | V13 RC 封存 | ✅ 已完成：elapsed time、事件密度、恢复窗口进入核心积分，独立 Gate PASS |
| Model Calibration | 建立可复现的人格轨迹校准体系 | 时间语义稳定 | ✅ 已完成：Golden trajectory、参数注册表、敏感性和属性测试 |
| Durable State | 建立可重放的持久化边界 | 状态 schema 稳定 | Event Store、事务、版本冲突、幂等与快照恢复 |
| Provider Evaluation | 评估真实语言模型 Adapter | 前述质量门全部通过 | Provider 可替换、断网可用、无诊断和无越权写回 |

## V13.9 LLM Boundary QA / RC

必须实现：

- 独立 `LlmBoundaryQualityGate`，覆盖成功、关闭、超时、空输出、诊断、伪写回、无接地事实、标签伪装、真假混合、身份错配、密钥错误和非 Mock Provider。
- 每个 case 连续执行两次，验证结构化结果完全一致。
- 所有最终交付文本必须再次通过 validation 与 grounding。
- 任意 final fallback 复检失败时必须 fail closed，不得返回文本。
- 生成机器可读质量报告、Markdown 报告和 V13 RC manifest。
- 将质量门接入 `rc:verify` 与 CI。
- 当前阶段保持 `providerType=mock`、`networkAllowed=false`，不接真实 Provider。

发布标准：

```text
unsafe deliveries = 0
mutation claims delivered = 0
diagnosis claims delivered = 0
ungrounded claims delivered = 0
network use = 0
deterministic replay failures = 0
active warnings = 0
```

## Temporal Semantics

状态：**已完成**。实现与数值验收见 [`v14.0_temporal_semantics_report.md`](v14.0_temporal_semantics_report.md)。

### 核心改造

- 人格积分显式接收 `elapsedTime`，不再把一次事件调用等同于固定时间步。
- 将影响拆为 `instantImpact`、`accumulatedImpact` 与 `recoverySinceLastEvent`。
- 同一时间窗口内的重复事件使用饱和函数，避免按输入次数无限线性叠加。
- 长间隔事件必须先执行 recovery、decay 和 belief consolidation，再计算新影响。
- explanation trace 必须记录事件时间、事件密度、恢复窗口和有效影响量。

### 验收测试

- 同样 5 次事件集中在 1 小时与分散在 30 天，结果必须不同且可解释。
- 同一事件重复提交不能无限线性放大。
- 高频中性日志不能产生显著人格漂移。
- 长期无事件必须向稳态恢复，而不是保持永久激活。
- 同一带时间戳事件序列重放必须得到相同状态和审计结果。

当前结果：7/7 audit cases、21/21 assertions、0 failures。下一阶段不得继续凭单个 fixture 调权重，应进入 Model Calibration。

## Model Calibration

状态：**已完成**。实现、修复和数值验收见 [`v14.1_model_calibration_report.md`](v14.1_model_calibration_report.md)。当前 54 个关键参数已进入版本化注册表，160/160 Golden Trajectory、640 个场景投影、10/10 类别决策覆盖、16/16 属性序列、5/5 Metamorphic、7/7 敏感性检查和 914/914 断言通过。

### Golden Trajectory

建立覆盖以下维度的轨迹库：

```text
10 类事件
x 至少 4 类 baseline personality
x 1 / 5 / 20 / 100 个事件跨度
x relationship / study / social / action 场景
```

轨迹使用合理区间，不拟合唯一答案。正向支持应产生渐进修复，负向重大事件应产生明显但有界的塑形，中性事件应保持稳定。

### 参数治理

- 将 learning rate、recovery、recency floor、boundary multiplier 等系数收敛到版本化参数注册表。
- 禁止新增散落 magic number。
- 每个参数记录用途、范围、单位、来源、依赖通道和变更理由。
- 对关键参数执行单变量和组合敏感性分析。
- 参数上下浮动 10% 不应导致整体方向反转。

### 测试方法

- 属性测试：随机合法序列始终保持有限值、坐标范围和 ID 唯一。
- Metamorphic test：修改无关地点或措辞不应改变人格方向，修改类别和场景相关性才应改变目标通道。
- Repair asymmetry：破坏、修复和 scar retention 的长期比例必须显式定义。
- Out-of-sample fixture：校准时未使用的事件组合也必须保持方向与边界一致。

当前参数只能称为工程校准，不能声称具有心理学或临床实证效度。下一阶段是 Durable State；参数版本必须随 Event Log 和 Snapshot 持久化。

## Durable State

状态：**下一阶段**。

建议采用 Event Sourcing：

```text
Immutable Event Log
-> Deterministic Replay
-> Character State Snapshot
-> Audit Entry
-> Time Machine
```

实现要求：

- 定义统一 `CharacterStateRepository`，内存、SQLite 和未来 PostgreSQL 使用同一合同。
- Event Log 是事实来源，Snapshot 只作为重放加速缓存。
- 每次 apply 使用 expected version，发现版本冲突必须拒绝覆盖。
- Event、State、Audit 与 Snapshot 必须在同一事务边界提交。
- 每次写入必须带 idempotency key，重复请求不能重复应用事件。
- state schema、event schema、parameter set 与 engine semantics 都必须版本化并支持迁移。
- 崩溃恢复后重放结果必须与提交前指纹一致。

单机产品优先使用 SQLite。正式多实例部署前再增加 PostgreSQL Adapter，不提前引入分布式复杂度。

## LLM Grounding 后续升级

真实 Provider 不应直接返回无结构自由文本。后续输出合同应包含：

```text
text
claimType
evidenceRefs
uncertainty
safetyNotices
```

每个 evidence ref 必须真实存在。人格、信念、事件和因果断言应使用受控 claim type。结构化 claim 全部验证后，才允许渲染为最终自然语言。

## Dependency Governance

- CI 对 high / critical 漏洞直接阻断。
- moderate 漏洞进入已知风险注册表，记录影响范围、缓解措施和复查条件。
- 禁止使用 `npm audit fix --force` 自动跨主版本修改核心框架。
- 保持 lockfile、clean install、全量测试、Next build 和所有质量门同时通过。
- 只在兼容的上游修复版本存在时升级 Next/Vite/PostCSS 链路。

## 明确禁止

- 不通过手工调权重让单个 fixture 刚好通过。
- 不在时间语义稳定前做大规模人格参数拟合。
- 不在 V13 RC 前接真实 LLM Provider。
- 不让 LLM、前端或 MindSpace 获得 Core mutation/writeback 权限。
- 不用新增 UI 掩盖核心审计 WARN 或 FAIL。
- 不在持久化合同稳定前开始多角色系统。
