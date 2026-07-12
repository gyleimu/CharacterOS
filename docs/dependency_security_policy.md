# CharacterOS Dependency Security Policy

## 目标

依赖治理必须降低真实风险，不能为了让 `npm audit` 数字归零而自动执行不兼容的框架降级。

## CI 策略

```text
critical -> block
high     -> block
moderate -> require risk registry entry and review
low      -> monitor and update when compatible fix exists
```

CI 使用 `DependencySecurityGate` 读取 live `npm audit --json`。high/critical、未登记的 moderate/low、注册表计数漂移都会失败。该命令需要网络，因此不放入要求离线、可重复执行的 `rc:verify`；RC 验证改为检查已提交的风险注册表、最近一次安全门报告和发布 manifest。

## 当前风险基线

2026-07-12 审计结果：

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Moderate | 2 |
| Low | 1 |

机器可读记录位于 `outputs/dependency-risk-register.json`。

当前告警来自：

- `esbuild`：Vite 开发工具链的 low 风险，本地 Windows 开发服务器相关。
- `postcss`：Next 内部依赖的 moderate 风险，涉及不安全 CSS stringify 输入。
- `next`：npm audit 通过 PostCSS 依赖链汇总为 moderate。

npm 当前给出的自动方案会把 Next 改为不兼容的旧主版本，因此不采用该方案。等待兼容的上游修复版本后，必须执行 clean install、全量测试、Next build 和所有质量门。

## 更新规则

- 每次依赖版本变更后重新运行 `npm audit --json`。
- 新 high/critical 必须阻止合并和发布。
- 新 moderate 必须先写入风险注册表，说明暴露面、缓解措施和解除条件。
- 风险条目只能在升级后重新审计为 0，或确认依赖路径消失后标记 resolved。
- 禁止隐藏、删除或人为降低安全告警等级。
- 禁止执行 `npm audit fix --force` 修改核心框架主版本。
