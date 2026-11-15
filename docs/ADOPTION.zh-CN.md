# 已有代码库接入流程

`agentrepo init` 只补齐缺失文件，不能自动取得原项目的架构决策权或规则解释权。对长期维护中的仓库，使用 `agentrepo adopt` 进行可复核的接入。

## 优先级

1. 原项目明确的任务目标、维护者决定、`AGENTS.md` 和其他现有 agent 规则。
2. 原项目的架构边界、CI、Issue/PR、发布、测试、安全及合规约束。
3. 经项目维护者审查和明确批准后附加的 AgentRepo 使用入口。
4. AgentRepo Kit 通用默认模板。

发现矛盾时停止自动接管并要求项目维护者决定。不能把原有规范重新解释成脚手架的默认规则，也不能通过生成文件数判断接入是否完成。

## 五个阶段

在目标仓库中运行全局 `agentrepo`，或用 `node /path/to/agentrepo-kit/bin/agentrepo.mjs`。接入成功后也可使用 `node .agentrepo/cli.mjs`。

```sh
# 1. 完全只读，发现原有政策、命令、CI 和文档，并记录哈希
agentrepo adopt scan --json

# 2. 先预览，再保存审核计划。保存计划会创建 .agentrepo/adoption-plan.json
agentrepo adopt plan
agentrepo adopt plan --write

# 3. 审查计划后，明确授权只新增缺失文件
agentrepo adopt apply --approve

# 4. 审查 AGENTS.md 后，明确授权追加短入口，不覆盖旧规则
agentrepo adopt activate --approve --reason "已核对现有规则，确认仅追加 AgentRepo 使用入口"

# 5. 核查原规则指纹、激活状态、待填字段与脚手架完整性
agentrepo adopt verify
```

对于已有 `AGENTS.md`，`activate` 仅追加带有唯一标记的段落，保留原始正文。重复执行不会重复添加。原项目还有 `CLAUDE.md`、Cursor rules、Copilot rules 等其他独立入口时，AgentRepo 不会擅自修改它们。项目维护者需要确认对应 Agent 是否会实际加载接入指南。

## 原项目发生合理变化

接入后，原有规则、`README.md`、关键工程配置或 GitHub 协作规范发生变化时，`adopt verify` 会报告指纹变更。应先检查 Git 差异，明确判断新的规则是否与接入方案兼容，再执行：

```sh
agentrepo adopt reconcile --approve --reason "已审查本次原项目规则变更及其影响"
agentrepo adopt verify
```

如果还没有执行 `apply`，但扫描与创建计划之间有变化，需要重新生成计划：

```sh
agentrepo adopt plan --write --refresh --approve
```

`reconcile` 只记录新的规则基线和审核理由，不证明语义兼容，也不代替自动化测试。

## 接入状态和验收

`adopt verify` 在以下情况下返回非零状态：尚未激活、原规则发生未经复核的变化、项目专属占位符还没有填写、关键脚手架文件丢失。

所有程序化接入检查通过时返回 `INTEGRATION_CHECKS_PASS`。它证明文件和基线状态完整，但**不等同于功能测试通过，也不代表模型已正确理解业务规则**。仍需要执行原项目的测试、静态检查、必要时运行 `dependency-cruiser`，并在真实 Coding Agent Eval 中验证任务完成率和人工干预次数。

当前这套流程不提供强制身份验证。命令行 `--approve` 是操作确认标记，不是维护者身份认证。建议通过 GitHub PR 审查这些改动，配合仓库权限与分支保护使用。

## 安全约束

只对本地实际文件做指纹和文件清单检测，不上传原始规则到第三方；不会执行发现阶段中的项目脚本，也不会自行添加 Actions 发布或部署工作流。符号链接路径禁止写入。新增或覆盖规则要求明确操作和审核；不能使用 `adopt` 静默替换原项目规则。
