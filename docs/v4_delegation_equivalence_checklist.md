# CharacterOS V4 Delegation Equivalence Checklist

## 用途

每个 TemporalProcess adapter 从 `"adapter_shell"` 升级为 `"delegated"` 时，必须逐项通过此清单。

## 检查项

### D1: Direct Function Equivalence

```text
□ adapter 调用结果与直接调用 V3 函数完全一致
□ before / after 值相等
□ 所有数值字段相等（delta, drive, chance, quality 等）
□ reasons 数组相等
□ 可选字段（如 inspiration）的 present/absent 一致
□ 测试覆盖不同 daysElapsed 值（至少 1 和 30）
```

### D2: Phase Trace Shape Equivalence

```text
□ adapter 返回的 phase.name 与 V3 phase name 一致
□ phase.changedStates 与 V3 原代码一致
□ phase.reasons 非空且包含 V3 函数返回的 reasons
□ V3 trace 中该 phase 的 reasons 通过 adapter 正确传递
```

### D3: State Mutation Equivalence

```text
□ adapter 写回 state 的字段与 V3 原代码一致
□ adapter 不写额外字段
□ adapter 不读取额外状态字段
□ adapter 本身不直接 mutate state（由调用方负责写回）
□ 同一 state 经 V3 tick 后，被委托字段的值与 delegation 前相同
```

### D4: Phase Order Equivalence

```text
□ adapter 在 tick pipeline 中的执行位置与 sourcePhase 一致
□ 不提前执行
□ 不延后执行
□ 其他 phase 的 changedStates 不受影响
```

### D5: Registry Status Update

```text
□ adapter 的 implementationStatus 从 "adapter_shell" 改为 "delegated"
□ 其他 adapter 的 status 不变
□ registry.summarize() 的 byStatus.adapter_shell 减 1
□ registry.summarize() 的 byStatus.delegated 加 1
□ missingPhaseIds 保持空数组
```

### D6: UnifiedTickTrace Visibility

```text
□ 被委托 process 的 adapterStatus 为 "delegated"
□ 被委托 process 的 observedOnly 为 false
□ 其他 process 的 observedOnly 保持 true
□ mutationSummary.delegateCandidateCount 不变（delegation 不改变数量）
```

### D7: No Extra Mutation

```text
□ adapter 不修改 CharacterPhysicsState 的其他字段
□ tick 前后，未委托字段的值不变
□ InternalStateField 的 variable count 稳定
□ 所有 normalizedValue 仍在 [0, 1]
```

### D8: All V3 Tests Pass

```text
□ npm run build 通过
□ npm test 全部通过（包括 V3 原有 + V4 新增）
□ continuousTick 相关测试全部通过
□ homeostasisConsistency 测试全部通过
□ unifiedTickTrace 测试全部通过
```

### D9: Rollback Path

```text
□ 回滚只需恢复 V3 tick 中的原 inline 代码
□ 回滚只需删除 adapter import
□ 回滚只需将 registry status 改回 "adapter_shell"
□ 回滚只需恢复测试的旧断言
□ 不需要数据迁移
□ 不需要修改其他文件
```

### D10: Overwrite Semantics Equivalence（仅 multi-state overwrite adapter）

```text
适用条件：adapter 写入 state 字段的同时，覆盖了前一个 phase 的输出。

□ Phase N 的 regulated/overwrite 输出 == 最终 state 的值
□ Phase N-1 的输出被 Phase N 成功覆盖（不等于是有意设计）
□ adapter 的 regulated 值与直接调用 V3 函数的 regulated 值完全一致
□ adapter 不跳过 overwrite（不会出现 Phase N-1 的值残留）
□ InternalStateField 的 pressure/risk 仍与 homeostasis consistency tests 对齐

当前适用：
- V4.12 Homeostasis: 覆盖 Phase 3 recovery 的 meta/boundary/reward 输出
- V4.7 Boredom / V4.8 Belief Evolution / V4.10 Meta Drift: 不需要 D10
```

---

## 使用示例

```text
V4.7  Boredom:           D1-D9 全部通过 ✓
V4.8  Belief Evolution:  D1-D9 全部通过 ✓
V4.10 Meta Drift:        D1-D9 全部通过 ✓
V4.12 Homeostasis:       D1-D10 全部通过 ✓ (D10 applies)
```
