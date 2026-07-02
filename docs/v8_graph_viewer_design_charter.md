# CharacterOS V8.0 Graph Viewer Design Charter

## 版本

```text
CharacterOS V8.0 — Graph Viewer Design Charter
Date: 2026-06-23
Based on: V7 Graph Data Model (Complete Candidate)
Status: DESIGN ONLY, NO CODE
```

## 验证

```text
npm run build        ✓ passed
npm test             ✓ 89 files, 669 tests, zero failures
npm run next:build   ✓ 18 API routes, zero errors
```

---

## 1. V8 核心目标

### V8 是什么

```text
V8 = Graph Viewer

V8 的任务是把 V7 的 MindGraphSnapshot 转换为
可布局、可解释、可调试、可视化友好的交互式视图。

V8 不是 "美化图"。
V8 是 V7 的结构化可读视图。

V8 的目标用户：
  - CharacterOS 开发者：调试 personality drift、belief strength、cluster formation
  - 研究者：观察心理结构的 emergent properties
  - 作者：理解角色的内在冲突和选择逻辑
```

### V8 不是什么

```text
V8 不是 3D 渲染。                      → V50+
V8 不是 game engine。                   → 永久排除
V8 不是多角色社交网络图。               → V20+
V8 不是社会模拟器。                     → 永久排除
V8 不是 Obsidian 插件。                 → 永久排除
V8 不是实时动画。                       → V8.4+
V8 不修改 CharacterPhysicsState。       → 永久禁用
V8 不引入新的图数据库。                 → 永久排除
```

---

## 2. Visual Metaphor Map

```text
V7 Graph Node → Visual Representation:

  personality_core       = 中心恒星（center star）
    - 最大、最亮、居中
    - 大小反映 personality mass
    - 颜色反映 trust/fear balance

  memory                 = 星点（star points）
    - 围绕 cluster 或自由轨道
    - 亮度反映 recency
    - 大小反映 effectiveWeight
    - 颜色反映 emotion category

  impact_particle        = 星尘粒子（dust particles）
    - 小、半透明、散布在 cluster 附近
    - 亮度反映 impactScore
    - 颜色反映 category

  impact_cluster         = 星云 / 星团（nebula / cluster cloud）
    - 包围相关 memories
    - 大小反映 mass
    - 颜色反映 category
    - 透明度反映 density

  belief                 = 轨道规则环（orbital rule ring）
    - 围绕 personality_core 的环
    - 环宽反映 belief.strength
    - 环径反映 evidenceCount

  need                   = 引力黑洞（gravity well / black hole）
    - 暗色、有向内拉力
    - 大小反映 intensity
    - 位置靠近 personality_core

  desire                 = 推进向量（propulsion arrow）
    - 箭头从 need 指向外
    - 长度反映 intensity
    - 方向指向可能的 action

  behavior_bias          = 轨迹线（trajectory line）
    - 从 desire 末端延伸
    - 线宽反映 likelihood
    - 颜色反映 tendency type

  temporal_process       = 时间刻环（time ring）
    - 围绕整个系统的环
    - 环上标记 phases

  internal_state_variable = 状态场（field wave）
    - 半透明覆盖
    - 颜色反映 deviation from baseline

  benchmark_signal       = 望远镜标记（observatory tag）
    - 小标记在节点附近
    - 绿色 = pass, 红色 = fail
```

---

## 3. Layout Principles

### 3.1 Central Anchor

```text
personality_core 始终置于画布中心。

所有其他节点围绕 core 布局。
Core 的位置在系统中是不变的 anchor point。
```

### 3.2 Cluster-Based Grouping

```text
每个 impact_cluster 形成一个子区域。

Cluster 位置由其 category 决定：
  - abandonment clusters → 偏左下方（压力区）
  - support clusters → 偏右上方（资源区）
  - betrayal clusters → 偏左上方（威胁区）

Memories 被吸引到对应 cluster 附近。
```

### 3.3 Force-Directed Layout

```text
基础力学模型（简化版）：

1. 引力：
   - cluster → memory：基于 belongs_to_cluster 边权重
   - core → all：轻引力，防止节点漂太远
   - cluster → core：基于 pulls_personality weight

2. 斥力：
   - node ↔ node：防止重叠
   - cluster ↔ cluster：防止 category 区域合并

3. 环布局：
   - temporal_process nodes 在固定半径的环上分布
   - beliefs 在固定半径的环上分布

不需要 100% 物理仿真。
目标是视觉可读性，不是物理正确性。
```

---

## 4. Interaction Model

### 4.1 Zoom

```text
支持缩放：
  - Zoom in: 看到子节点细节（memory content, belief strength）
  - Zoom out: 看到整体结构（cluster distribution, core tension）
```

### 4.2 Filter

```text
按节点类型过滤：
  - 只看 personality_core + clusters（宏观视角）
  - 只看 belief + need + desire（决策链视角）
  - 只看 temporal_process + benchmark_signal（时序验证视角）

按权重过滤：
  - 隐藏 weight < 0.1 的节点/边
```

### 4.3 Drill-Down

```text
点击节点 → 展示 detail panel：
  - 完整 metadata
  - 连接的边
  - 关联的 benchmark 结果（如果有）

点击边 → 展示 projection explanation：
  - 为什么这条边存在
  - weight 含义
  - evidence source
```

### 4.4 Diff

```text
加载两个 snapshot（t0 和 t1）→ 显示变化：
  - 新节点（绿色闪烁）
  - 消失节点（红色淡出）
  - weight 变化（箭头大小变化）
  - 新边（绿色虚线）
```

---

## 5. Data Contract

```text
Viewer 只消费 V7 API 的 JSON 数据：

GET /api/characters/[characterId]/graph

Viewer 不直接操作 CharacterPhysicsState。
Viewer 不调用 builder。
Viewer 不执行任何 mutation。

Data contract:
  - Input: MindGraphSnapshot JSON
  - Output: Rendered interactive view
  - Intermediate: Layout positions (x, y) computed locally
```

---

## 6. Technology Candidates

| Technology | Pros | Cons |
|------------|------|------|
| SVG + React | 易调试、DOM inspectable、可访问 | 200+ nodes 可能卡顿 |
| HTML5 Canvas 2D | 性能好、200+ nodes 流畅 | 难调试、不可 inspect |
| D3.js force layout | 内置力学引擎、生态丰富 | 学习曲线、依赖大 |
| WebGL (Three.js) | 3D 能力、粒子效果 | 过度工程化、代码量大 |

**推荐：SVG + React for V8.1-V8.3, Canvas 2D for V8.4+ if performance needed。**

D3 的 force simulation 可以独立使用（不引入整个 D3 生态）。

---

## 7. V8 分阶段路线

```text
V8.0  Graph Viewer Design Charter    (本阶段)  — 设计文档
V8.1  Graph Layout Data Model        (代码)    — 位置、尺寸、颜色的纯数据层
V8.2  Static SVG Renderer            (代码)    — 单帧静态 SVG 渲染
V8.3  Interactive Viewer Component   (代码)    — React + SVG 交互组件
V8.4  Force-Directed Layout Engine   (代码)    — 自适应布局算法
V8.5  Diff / Comparison View         (代码)    — 两个 snapshot 的 diff
V8.6  Filter / Drill-Down            (代码)    — 过滤和详情面板
V8.7  Viewer API Integration         (代码)    — 集成到 Web UI
V8.8  Viewer Report                  (文档)    — 总结和未来路线
```

### 每阶段约束

```text
V8.1-V8.7:
  - 不改 V3/V4/V5/V6/V7 核心行为
  - 不改 CharacterPhysicsState
  - 不改 graph builder
  - 只读 MindGraphSnapshot JSON
  - 不调用 LLM
  - 不做 3D
```

---

## 8. 成功标准

### 必须达成

| 标准 | 描述 |
|------|------|
| S1 | Viewer 只消费 V7 API JSON — 不直接操作 state |
| S2 | 每种 node type 有视觉区分 — 不同 shape/color/size |
| S3 | 每条 edge type 有视觉区分 — 不同 line style/color/width |
| S4 | 内容可读 — node labels 在 zoom-in 时可见 |
| S5 | 布局在相同输入下稳定 — 不跳动 |
| S6 | V3-V7 tests remain passing |
| S7 | 不引入新的外部 API 依赖 |

### 可选达成

| 标准 | 描述 |
|------|------|
| S8 | Force-directed layout 自适应 |
| S9 | 多 snapshot diff |
| S10 | Benchmark signal 集成 |

---

## 9. V3 → V8 路线总览

```text
V3: Character Physics Core          256 tests  — stable candidate
V4: Temporal Homeostasis Layer      407 tests  — observability
V5: Temporal Process Decomp.        465 tests  — subprocess instrumentation
V6: Benchmark System                589 tests  — directional regression
V7: Graph Data Model                669 tests  — structured projection
V8: Graph Viewer                    design     — readable visualization
```

---

## 10. 最终声明

```text
CharacterOS V8 starts as Graph Viewer Design, not implementation.

V8 是 V7 的 "眼睛"。
不是炫酷的 3D 粒子效果。
是 V7 的结构化可读视图。

V8 不能修改任何底层状态。
V8 是 read-only visual reflection。

V8.0 Design Charter 完成后，V8.1 开始写布局数据模型。
V8.2 开始渲染第一帧静态 SVG。
```

## 验证

```text
npm run build        ✓
npm test             ✓ 89 files, 669 tests, zero failures
npm run next:build   ✓ 18 API routes, zero errors
```

已通过所有测试。
已完成
