# CharacterOS Static Demo — V10.70 Boundary Calibration Repair Handoff Package

## 如何打开

用桌面浏览器打开 `index.html`：

```
file:///C:/Users/AL/Documents/CharacterOS/outputs/characteros-demo/index.html
```

推荐 Chrome / Edge / Firefox 最新版。无需服务器、无需安装。

## 推荐浏览顺序

Demo 有 7 个区域，建议按编号顺序浏览：

1. **Overview 总览** — 了解 CharacterOS 是什么、当前角色是谁、审阅检查项
2. **Today 今日** — 角色当下的三层状态：表层状态、内部状态、趋势预测
3. **Decision 决策** — 状态如何转化为行为倾向：最可能行为、内心冲突、分化决策流程
4. **Scenarios 场景** — 五个"如果"推演：同一角色在不同压力下走向不同策略
5. **Life Preview 生命预览** — 8 小时无人观察时角色的内部生命运转
6. **Mind Galaxy 星云** — 心理因果链、可点击节点详情、原始星云 artifact
7. **Reality Audit 真实性验收** — 结构化验证事件输入是否真的改变 state 并影响后续 decision

## 每个 Tab 看什么

| Tab | 核心信息 | 使用建议 |
|---|---|---|
| Overview | 产品定位、角色介绍、审阅检查项 | 先读这个建立认知 |
| Today | 表层状态、内部状态、趋势预测、边界压力、记忆卡片 | 感受角色像一个活人，而不是数字仪表盘 |
| Decision | 最可能行为、内心冲突、Schema→Need→Desire→Strategy→Action 流程 | 理解决策的 deterministic pipeline |
| Scenarios | 策略分化矩阵、场景对比表、每个场景的 mini-flow | 用筛选按钮只看一种策略 |
| Life Preview | 能量/疲劳双条、自主候选动作、灵感种子 | 观察无人干预时的内部生命 |
| Mind Galaxy | 经历→记忆→信念→图式→缺失→欲望→行为倾向 | 点击节点看详情；也可全屏打开原始星云 |
| Reality Audit | Event→Parse→Impact→Delta→Decision→Trace→Verdict | 看结构化 JSON diff，而不是只看解释文案 |

## 如何使用 Review Mode

点击右上角 **Review Mode** 按钮，装饰元素（badges、bar fills、箭头）会淡化为 35% 透明度，突出文本和表格。再点一次 **Exit Review Mode** 恢复正常。不影响打印。

## 如何使用 Scenarios 筛选

在 Scenarios tab，顶部的筛选按钮按策略类型过滤场景：

- All (5) — 显示全部
- 关系确认 (2) — 只看确认关系信号策略的场景
- 机会 (1) / 纠偏 (1) / 控制 (1) — 单场景观察

筛选后矩阵和卡片同步更新。按钮上的数字来自实际数据。

## 如何打开 Mind Galaxy

点击 **Mind Galaxy 星云** tab，iframe 会延迟加载（首次打开时加载，之后保持）。也可以点击 **全屏打开** 链接在新标签页打开独立 artifact。

## 当前 Demo 的边界

- **只读**：无编辑、无保存、无提交
- **离线**：无 API 调用、无网络请求
- **无状态写入**：关闭浏览器即重置
- **无 LLM**：所有内容来自 deterministic 决策引擎
- **无存储**：不使用 localStorage / sessionStorage / indexedDB
- **单角色**：仅演示林凡一个角色
- **静态数据**：运行一次生成，内容不变

## V10.66 产品控制台增强

- 左侧固定栏展示角色身份、表层状态、主导情绪、压力负荷。
- 右侧洞察栏展示当前心理因果链、激活节点、Review warnings。
- Today 不再只是数字，而是展示表层状态、内部状态和趋势预测。
- Scenarios 展示第一反应、感知偏差、说出口的话、真实想法、行为风险和修复条件。
- Life Preview 明确区分候选行为、被压制行为、实际执行行为和下一步可能行为。
- Mind Galaxy 主界面新增可点击的心理因果节点详情。

## V10.67 Reality Audit 增强

- 新增 Reality Audit Runner：同一角色前后、正负反事实、同事件不同人格三类验收。
- Demo 中新增 Reality Audit 区域，展示输入事件、后续测试场景、state diff、decision diff、explanation grounding 和 verdict。
- 验收规则基于结构化 diff：state 不变则 FAIL，state 变但 decision 未响应则 WARN，解释无法引用 delta 则 WARN。
- 当前真实发现：至少一个 case 会出现 "state changed but decision did not respond" WARN，这说明底层事件链路成立，但部分决策响应仍需要核心逻辑继续加强。

## V10.68 Decision Responsiveness 增强

- 新增 Decision Influence Layer：显式消费 memory/belief/personality/need/desire/boundary/emotion delta。
- Reality Audit 展示 Decision Influence Vector、Strategy Weight Delta、Action Candidate Score Before/After。
- 新增 responsivenessScore / overreactionScore / PASS_WITH_STABLE_TOP_DECISION。
- 当前真实发现：旧的 "state changed but decision did not respond" WARN 已修复；仍保留一个物理层校准 WARN（稳定人格重大事件的人格坐标漂移弱）。

## V10.69 Impact / Personality Calibration 增强

- 新增 Impact Calibration Audit：按 severity / relevance / stability / resilience / repetition / emotion 计算每个 channel 的 expected delta range。
- Reality Audit 展示 Event Severity、Domain Relevance、Channel Impact Allocation、Expected Delta Range、Actual Delta By Channel 和 Calibration Verdict。
- 人格坐标被明确建模为慢变量：重大事件若被高稳定性/高恢复力缓冲，可给出 PASS_WITH_RESILIENCE_BUFFER，但 memory / belief / need / boundary / decision surface 必须响应。
- 当前真实发现：事件到 memory / belief / need / boundary / decision 的链路已打通；positive support case 仍出现 boundaryDelta over-response WARN，需要后续校准边界恢复/支持事件的权重。

## 审阅者应该重点反馈什么

1. **人物状态是否清楚？** — Overview 和 Today 的信息够不够理解林凡？
2. **场景差异是否可信？** — 五个场景的策略分化合理吗？
3. **决策链是否可解释？** — Decision flow 的 Schema→Need→Desire→Strategy→Action 能看懂吗？
4. **星云是否帮助理解？** — Mind Galaxy 对理解人格因子关系有用吗？
5. **浏览体验是否顺畅？** — Tab 顺序、筛选、Review Mode 等交互好用吗？

反馈时请引用具体 tab 和文案。

## Artifact 文件清单

| 文件 | 说明 |
|---|---|
| `index.html` | Demo 主入口 |
| `characteros-demo.js` | 渲染逻辑 |
| `characteros-demo.css` | 样式 |
| `characteros-demo-data.json` | 预生成数据 |
| `manifest.json` | 版本和完整性元数据 |
| `README.md` | 本文件 |
| `mind-galaxy/` | Mind Galaxy 独立 artifact |

## 重新生成

```bash
npx tsx scripts/export-mind-galaxy-static-artifact.ts
npx tsx scripts/export-characteros-demo-artifact.ts
```
