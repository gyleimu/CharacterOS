# CharacterOS Benchmark V2 Real Run Report

本报告由 `outputs/run-benchmark-v2.ts` 真实执行生成。执行过程读取 V2 docx 抽取出的环境、人格式种子、200 精测 case、2000 矩阵 case，并调用当前 CharacterOS TypeScript 核心模块：`CharacterPhysicsEngine`、`deriveCharacterState`、`runLifeTickDryRun`。没有使用 LLM 代替系统输出。

## Executive Summary

- Matrix cases: 2000
- Matrix PASS/WARN/FAIL: 0/1623/377
- Matrix average score: 0.591
- Focus cases: 200
- Focus average score: 0.333
- Same-result-different-reason average score: 0.19
- Continuity average score: 0.073
- Growth drift dynamic execution: 0/5

## Key Metric Breakdown

- Behavior direction avg: 0.843
- Core reason avg: 0.093
- Chain completeness avg: 1
- Anti-template avg: 0.45

## Actual Direction Distribution

- 条件性行动: 1674
- 延迟/拒绝: 326

## Actual Action Distribution

- 压住情绪，先追问原因。: 1674
- 表现得克制、冷淡，避免暴露依赖。: 326

## Environment Differentiation

| ENV | Avg | Pass | Warn | Fail | Unique Actions | Unique Needs | Diff Score |
|---|---:|---:|---:|---:|---:|---:|---:|
| ENV_001 | 0.559 | 0 | 64 | 36 | 2 | 3 | 0.517 |
| ENV_002 | 0.596 | 0 | 86 | 14 | 2 | 3 | 0.517 |
| ENV_003 | 0.609 | 0 | 91 | 9 | 2 | 3 | 0.517 |
| ENV_004 | 0.629 | 0 | 90 | 10 | 2 | 3 | 0.517 |
| ENV_005 | 0.582 | 0 | 75 | 25 | 2 | 3 | 0.517 |
| ENV_006 | 0.634 | 0 | 100 | 0 | 1 | 2 | 0.308 |
| ENV_007 | 0.583 | 0 | 79 | 21 | 2 | 3 | 0.517 |
| ENV_008 | 0.605 | 0 | 90 | 10 | 2 | 3 | 0.517 |
| ENV_009 | 0.577 | 0 | 77 | 23 | 2 | 3 | 0.517 |
| ENV_010 | 0.605 | 0 | 90 | 10 | 2 | 3 | 0.517 |
| ENV_011 | 0.583 | 0 | 79 | 21 | 2 | 3 | 0.517 |
| ENV_012 | 0.581 | 0 | 78 | 22 | 2 | 3 | 0.517 |
| ENV_013 | 0.583 | 0 | 79 | 21 | 2 | 3 | 0.517 |
| ENV_014 | 0.58 | 0 | 77 | 23 | 2 | 3 | 0.517 |
| ENV_015 | 0.583 | 0 | 79 | 21 | 2 | 3 | 0.517 |
| ENV_016 | 0.608 | 0 | 88 | 12 | 2 | 3 | 0.517 |
| ENV_017 | 0.598 | 0 | 79 | 21 | 2 | 3 | 0.517 |
| ENV_018 | 0.583 | 0 | 79 | 21 | 2 | 3 | 0.517 |
| ENV_019 | 0.551 | 0 | 64 | 36 | 2 | 3 | 0.517 |
| ENV_020 | 0.583 | 0 | 79 | 21 | 2 | 3 | 0.517 |

## Lowest Matrix Cases

| CASE | Verdict | Score | Expected | Actual | Action | Misses |
|---|---:|---:|---|---|---|---|
| ENV_001_PID_002 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_001_PID_007 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_001_PID_012 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_001_PID_017 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_001_PID_082 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以修复、崩溃、逃避、重建或突破保护恢复感、方向感、自尊或掌控感; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_001_PID_087 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以修复、崩溃、逃避、重建或突破保护恢复感、方向感、自尊或掌控感; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_001_PID_097 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以修复、崩溃、逃避、重建或突破保护恢复感、方向感、自尊或掌控感; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_002_PID_002 | FAIL | 0.338 | 核验后有限合作 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=核验后有限合作, actual=延迟/拒绝; core reason weak match: 信任倾向为低，必须先建立证据链; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_002_PID_007 | FAIL | 0.338 | 核验后有限合作 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=核验后有限合作, actual=延迟/拒绝; core reason weak match: 信任倾向为低，必须先建立证据链; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_002_PID_012 | FAIL | 0.338 | 核验后有限合作 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=核验后有限合作, actual=延迟/拒绝; core reason weak match: 信任倾向为低，必须先建立证据链; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_002_PID_017 | FAIL | 0.338 | 核验后有限合作 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=核验后有限合作, actual=延迟/拒绝; core reason weak match: 信任倾向为低，必须先建立证据链; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_003_PID_010 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_003_PID_015 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_003_PID_020 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_003_PID_085 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以修复、崩溃、逃避、重建或突破保护恢复感、方向感、自尊或掌控感; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_003_PID_095 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以修复、崩溃、逃避、重建或突破保护恢复感、方向感、自尊或掌控感; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_003_PID_100 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以修复、崩溃、逃避、重建或突破保护恢复感、方向感、自尊或掌控感; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_004_PID_085 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以修复、崩溃、逃避、重建或突破保护恢复感、方向感、自尊或掌控感; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_004_PID_095 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以修复、崩溃、逃避、重建或突破保护恢复感、方向感、自尊或掌控感; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_004_PID_100 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以修复、崩溃、逃避、重建或突破保护恢复感、方向感、自尊或掌控感; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_007_PID_002 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_007_PID_007 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_007_PID_010 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_007_PID_012 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |
| ENV_007_PID_015 | FAIL | 0.338 | 条件性行动 | 延迟/拒绝 | 表现得克制、冷淡，避免暴露依赖。 | behavior direction expected=条件性行动, actual=延迟/拒绝; core reason weak match: 以按主要特质进行选择保护自我一致性与可解释性; template risk: action="表现得克制、冷淡，避免暴露依赖。" |

## Focus Field Averages

- perception: 0.274
- emotion: 0.001
- memory: 1
- belief: 0.83
- need: 0.085
- desire: 0.025
- behavior: 0
- antiTemplate: 0.45

## Same Result, Different Reason Audit

| Persona | Score | Action |
|---|---:|---|
| 被背叛者 | 0.4 | 压住情绪，先追问原因。 |
| 长期贫困者 | 0.167 | 表现得克制、冷淡，避免暴露依赖。 |
| 完美主义者 | 0.2 | 压住情绪，先追问原因。 |
| 责任型人格 | 0 | 表现得克制、冷淡，避免暴露依赖。 |
| 原则主义者 | 0.25 | 压住情绪，先追问原因。 |
| 回避依恋 | 0 | 压住情绪，先追问原因。 |
| 悲观主义者 | 0 | 压住情绪，先追问原因。 |
| 控制型人格 | 0.5 | 压住情绪，先追问原因。 |

## Continuity Audit

| Persona | Environment | Score | Action |
|---|---|---:|---|
| PID_021 被背叛者 | ENV_001 高风险合作 | 0.167 | 压住情绪，先追问原因。 |
| PID_021 被背叛者 | ENV_002 朋友借钱 | 0 | 压住情绪，先追问原因。 |
| PID_021 被背叛者 | ENV_006 亲密冷淡 | 0 | 压住情绪，先追问原因。 |
| PID_021 被背叛者 | ENV_007 权威命令 | 0.2 | 压住情绪，先追问原因。 |
| PID_021 被背叛者 | 成长修复状态 | 0 | 压住情绪，先追问原因。 |

## Growth Drift Audit

V2 文档包含成长漂移判定标准，但当前 runner 没有执行多步修复/新证据注入/前后状态对比，因此这一项如实标记为未执行。需要专门的 V2.1 dynamic growth runner 才能真实测试。

## Honest Findings

1. 当前系统可以稳定生成完整心理链路字段：感知、情绪、记忆、信念、需求、欲望、行为均有实际输出。
2. 2000 矩阵中大多数期望行为方向是“条件性行动”，当前系统的 `压住情绪，先追问原因。` 很容易覆盖这类期待，因此 matrix pass 不能单独代表人格分化已成熟。
3. 决策表达层明显偏窄。实际 action 主要集中在两个模板上，反模板化平均分较低。
4. 同结果异因和人格连续性有可用信号，但多依赖 seed belief/need，而不是更丰富的行为策略分化。
5. 成长漂移没有被动态执行，不能虚报通过。

## Output Files

- `outputs/benchmark_v2_results.json`
- `outputs/benchmark_v2_matrix_results.csv`
- `outputs/benchmark_v2_focus_results.csv`
- `outputs/benchmark_v2_real_run_report.md`