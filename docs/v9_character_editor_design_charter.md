# CharacterOS V9.0 Character Editor Design Charter

## 版本

```text
CharacterOS V9.0 — Character Editor Design Charter
Date: 2026-06-23
Based on: V8 Graph Viewer (Complete)
Status: DESIGN ONLY, NO CODE
```

## 验证

```text
npm run build        ✓ passed
npm test             ✓ 91 files, 691 tests, zero failures
npm run next:build   ✓ 18 API routes, zero errors
```

---

## 1. V9 核心目标

### V9 是什么

```text
V9 = Character Editor

V9 的任务是设计一个结构化、可验证、可回溯的 character editing system。

V9 不是 "简单的参数表单"。
V9 不是 "可视化人设编辑器"。
V9 是 CharacterPhysicsState 的精确编辑工具。

Editor 的核心职责：
  - 允许用户查看和修改 character state 的任何字段
  - 每次修改都是可验证的（integrity check）
  - 每次修改都是可回溯的（patch history）
  - 每次修改都可以预览（preview tick）
  - 不允许直接写入非法 state
```

### V9 不是什么

```text
V9 不是 React 前端。                  → V9.5+
V9 不是 Dashboard。                    → 永久排除
V9 不是可视化编辑器。                  → V10+
V9 不是 LLM 辅助的角色创建向导。       → V11+
V9 不是批量编辑工具。                  → V12+
V9 不修改 CharacterPhysicsState 结构。 → 永久禁用
```

---

## 2. Character Editor 的定位

```text
Character Editor 不是 "人设编辑器"。

它不是改：名字、性格标签、头像、简介。

它是精确编辑 V3 CharacterPhysicsState 的任何一个结构化字段：

  state.coordinate.values.trust       = 0.42
  state.boundary.stressLoad           = 0.65
  state.metaState.emotionalSensitivity = 0.78
  state.rewardState.dopamineLevel     = 0.28

以及批量操作：
  - 注入一组事件
  - 运行一段连续时间
  - 重置到 blueprint baseline
  - 导出/导入完整 state
```

---

## 3. Edit Boundaries

### 3.1 Field-Level Editing

```text
每个 state field 都可以独立读写。

编辑分类：
  A. Coordinate fields (trust, fear, attachment, etc.)     — read/write
  B. Personality dimension values (big five)                — read/write
  C. Boundary fields (stress, integrity, cracks, phase)     — read/write
  D. Meta state fields (sensitivity, resilience, etc.)      — read/write
  E. Reward state fields (dopamine, craving, etc.)          — read/write
  F. Homeostasis state fields (set points, bias)            — read/write
  G. Memories (list, add, remove)                            — read/write
  H. Clusters (inspect only — derived)                      — read-only
  I.  Particles (inspect only — derived)                     — read-only
  J.  Beliefs (inspect only — derived)                       — read-only
```

### 3.2 Batch Operations

```text
1. Inject Events
   - 输入：event JSON
   - 执行：CharacterPhysicsEngine.processEvent
   - 验证：state integrity post-injection

2. Simulate Time
   - 输入：daysElapsed, optional overrides
   - 执行：runContinuousTick
   - 验证：trace correctness

3. Reset to Blueprint
   - 输入：blueprint ID
   - 执行：resetCharacter
   - 验证：state matches blueprint

4. Apply Patch
   - 输入：key-value pairs
   - 执行：merge into state, rerun integrity check
   - 验证：no invalid transitions
```

---

## 4. Patch System

### 4.1 Patch Format

```typescript
interface CharacterEditPatch {
  /** Unique patch id. */
  id: string;
  /** ISO timestamp. */
  appliedAt: string;
  /** Human-readable description of what this patch does. */
  description: string;
  /** List of field modifications. */
  changes: PatchChange[];
  /** Patch metadata. */
  metadata: { source: "manual" | "import" | "blueprint" | "benchmark" };
}

interface PatchChange {
  /** Dot-separated path (e.g. "coordinate.values.trust"). */
  path: string;
  /** Old value. */
  from: unknown;
  /** New value. */
  to: unknown;
  /** Reason for this change. */
  reason: string;
}
```

### 4.2 Patch History

```text
每次修改产生一个 patch。
Patches 按时间顺序存储。

API:
  GET  /api/characters/[characterId]/patches       — 历史列表
  GET  /api/characters/[characterId]/patches/[id]  — 单个 patch
  POST /api/characters/[characterId]/patches       — 应用新 patch（需 auth）
```

### 4.3 Patch Rollback

```text
支持回滚到任何历史 patch：
  - 计算 inverse patch
  - 应用 inverse 到 current state
  - 验证完整性
  - 截断历史（删除回滚点之后的 patches）
```

---

## 5. Preview System

### 5.1 Preview Tick

```text
在应用修改之前，先预览效果：

POST /api/characters/[characterId]/preview

输入：
  - proposed patch（可选）
  - daysElapsed（可选，默认 0）
  - events（可选）

返回：
  - state.before（当前状态）
  - state.after（应用 patch + tick 后的状态）
  - diff（哪些 field 被改变了，delta 是多少）
  - warnings（越界、冲突、异常变化）
```

### 5.2 Change Audit

```text
Preview 时自动计算：
  - 哪些 coordinate values 会发生变化
  - 哪些 beliefs 会被 strengthening/weakening
  - 哪些 clusters 会增长/收缩
  - homeostasis 是否会触发大幅调整

这不阻止编辑。只是提醒用户 "这个改变会引发连锁反应"。
```

---

## 6. Validation Rules

### 6.1 State Integrity

```text
每次编辑后自动运行 state integrity check：
  - all fields clamped to valid ranges
  - coordinate.bigFive = f(coordinate.mb)
  - cluster mass = Σ particle impact
  - memory count ≥ 0
  - no orphan references

如果 validation 失败 → edit is rejected → return error + explanation
```

### 6.2 Behavioral Consistency

```text
编辑后可以运行轻量级 consistency check：
  - trust + fear + attachment 不应该完全独立变化
  - 高 fear + 低 trust 应该伴有高 neuroticism
  - 高 boundary stress 应该伴有 low integrity

这些不是 hard gates。
它们是 warnings（黄色）而不是 errors（红色）。
```

### 6.3 Benchmark Regression

```text
编辑后可以运行 V6 benchmarks：
  - 如果 benchmark pass → 编辑不会破坏现有行为
  - 如果 benchmark fail → 编辑改变了行为方向 → 显示 warning

Benchmark 不是 gate。
它是 information layer。
```

---

## 7. Safety Principles

```text
1. 不允许直接写入非法 state。
   所有字段经过 clamp/validate 后写入。

2. 不允许跳过 integrity check。
   每次写后自动运行 validateState。

3. 不允许删除 identity。
   identity id 不可变。

4. 不允许批量覆盖 memories/clusters。
   只能通过 event injection 添加 memory。
   不能直接编辑 memory 数组。

5. 需要 auth 的 operation：
   - POST /patches（需要 API key）
   - POST /preview（需要 API key）
   GET /patches 是只读的，不需要 auth。
```

---

## 8. V9 分阶段路线

```text
V9.0  Character Editor Design Charter    (本阶段)  — 设计文档
V9.1  Patch Types & Validation           (代码)    — PatchChange, validators
V9.2  Patch History API                  (代码)    — GET/POST /patches
V9.3  Preview API                        (代码)    — POST /preview
V9.4  Patch Rollback                     (代码)    — 回滚到历史 patch
V9.5  Minimal Web Editor                 (代码)    — 基础 React 表单
V9.6  Batch Event Injection              (代码)    — 事件批量导入
V9.7  Benchmark Gate Integration         (代码)    — 编辑后自动 benchmark
V9.8  Editor Report                      (文档)    — 总结
```

### 每阶段约束

```text
V9.1-V9.7:
  - 不改 V3/V4/V5/V6/V7/V8 核心行为
  - 不改 CharacterPhysicsState 结构
  - 所有修改通过 patch 系统（可回溯）
  - 所有写入需要 auth
  - 不引入新数据库
```

---

## 9. V3 → V9 路线总览

```text
V3:  Physics Core          256 tests   — stable candidate
V4:  Homeostasis Layer     407 tests   — observability
V5:  Process Decomp.       465 tests   — subprocess instrumentation
V6:  Benchmark System      589 tests   — directional regression
V7:  Graph Data Model      669 tests   — structured projection
V8:  Graph Viewer          691 tests   — layout + SVG export
V9:  Character Editor      design      — structured editing
V10: Continuous Life        future     — long-term observation
```

---

## 10. 最终声明

```text
CharacterOS V9 starts as Character Editor Design, not implementation.

V9 是 V3-V8 积累的结构化能力的交互层：
  - V3: stable physics → what can be edited
  - V4-V5: temporal observability → preview tick
  - V6: benchmark system → edit validation
  - V7-V8: graph visualization → edit visualization

V9 不是 "GUI for character creation"。
V9 是 CharacterPhysicsState 的精确、可验证、可回溯的编辑系统。

V9.1: Patch Types → 开始实现 patch 格式和验证器。
```

## 验证

```text
npm run build        ✓
npm test             ✓ 91 files, 691 tests, zero failures
npm run next:build   ✓ 18 API routes, zero errors
```

已通过所有测试。
已完成
