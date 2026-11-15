# 已有仓库接入

原项目规则、架构约束、CI、发布与安全规范优先。AgentRepo Kit 补齐缺失能力；遇到冲突，由项目维护者审核决定。

## 接入流程

在目标仓库运行全局 `agentrepo`，或使用 `node /path/to/agentrepo-kit/bin/agentrepo.mjs`。

```sh
# 扫描原规则、工程配置与文件指纹
agentrepo adopt scan --json

# 预览并保存接入计划
agentrepo adopt plan
agentrepo adopt plan --write

# 批准新增缺失文件
agentrepo adopt apply --approve

# 审查后批准在 AGENTS.md 追加接入入口
agentrepo adopt activate --approve --reason "已核对现有规则与接入范围"

# 检查接入状态
agentrepo adopt verify
```

`apply` 保留原有文件。`activate` 在 `AGENTS.md` 中追加带唯一标记的入口，重复执行不会重复追加。已有 `CLAUDE.md`、Cursor 或 Copilot 规则不会自动修改；应检查对应 Agent 是否加载接入说明。

## 规则变更后复审

`adopt verify` 使用文件指纹检测规则和工程配置变化。审核 Git 差异后更新基线：

```sh
agentrepo adopt reconcile --approve --reason "已审查原项目规则变更"
agentrepo adopt verify
```

扫描后、执行 `apply` 前如发生变化，重新生成计划：

```sh
agentrepo adopt plan --write --refresh --approve
```

`reconcile` 记录新的审核基线，不自动验证业务语义。

## 验收标准

`adopt verify` 在接入未激活、原规则有未经审查的变化、必填占位符未确认或关键文件缺失时返回失败。全部检查通过时输出 `INTEGRATION_CHECKS_PASS`；该状态只说明接入配置有效，业务功能仍需通过原项目测试。

`--approve` 是 CLI 确认标记，不验证操作者身份。需要审批的改动应通过 GitHub PR 和仓库权限控制。扫描阶段只读取本地文件，不运行项目脚本；写入时拒绝符号链接路径。
