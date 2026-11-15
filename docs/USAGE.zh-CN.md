# AgentRepo Kit 使用指南

AgentRepo Kit 使用 Node.js CLI 为代码库配置 Agent 规则、架构图、文档检查和 Eval。要求 Node.js 20 或更高版本；CLI 本身没有第三方运行时依赖。

## 安装与初始化

在 AgentRepo Kit 源码目录运行：

```sh
npm install --offline --ignore-scripts
npm link
agentrepo init /path/to/project --dry-run
agentrepo init /path/to/project
```

也可执行 `node /path/to/agentrepo-kit/bin/agentrepo.mjs init /path/to/project`，无需全局安装。

初始化主要生成以下内容：

| 文件 | 用途 |
| --- | --- |
| `AGENTS.md` | Agent 开发规则 |
| `agentrepo.json` | 自动识别的项目信息、命令与架构配置 |
| `docs/architecture.md` | 设计依据、模块职责与业务边界 |
| `docs/architecture.html` | 离线交互式架构图 |
| `docs/code-map.md` | 根据源码生成的文件索引 |
| `docs/development.md` | 开发、测试与验收命令 |
| `docs/decisions/_TEMPLATE.md` | 架构决策记录模板 |
| `docs/plans/_TEMPLATE.md` | 长期任务交接模板 |
| `eval/` | 故障回归、隔离场景与 Agent 评估任务 |
| `.agentrepo/cli.mjs` | 随项目分发的 CLI |

项目专属信息使用 `{{REQUIRES_REVIEW:FIELD}}` 标记。执行 `doctor` 查看待确认项，`docs check --strict` 检查未填写占位符。项目目标在 README 中维护。

已有仓库保留原文件和既有 CI。正式接管请执行 [adopt 流程](ADOPTION.zh-CN.md)，不要仅运行 `init`。

## 项目检查与代码定位

```sh
cd /path/to/project
node .agentrepo/cli.mjs doctor
node .agentrepo/cli.mjs map --check
node .agentrepo/cli.mjs locate "WebSocket transport buffering" --k 3
node .agentrepo/cli.mjs docs check
node .agentrepo/cli.mjs verify --require test
node .agentrepo/cli.mjs eval run
```

在 `agentrepo.json` 的 `commands` 中配置项目命令，采用 argv 数组，例如 `"test": ["npm", "test"]`。`verify` 发现待确认占位符时返回 `FAIL`；`--require test` 要求测试实际运行且成功。非必需且未配置的检查记为 `SKIP`。

## 架构依赖与 HTML

`docs/architecture.md` 记录设计依据；`docs/architecture.html` 依据真实扫描结果绘图。没有依赖分析结果时，HTML 只显示源码清单。

JavaScript 或 TypeScript 项目安装 [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)：

```sh
npm install --save-dev dependency-cruiser
node .agentrepo/cli.mjs arch init
node .agentrepo/cli.mjs arch check --strict
node .agentrepo/cli.mjs arch view --write
node .agentrepo/cli.mjs arch view --check
```

新建项目也可使用 `agentrepo init /path/to/js-project --arch` 生成架构检查配置。已有项目安装时不会被自动修改 `package.json`。

按项目需求，在 `agentrepo.json` 中设置模块边界：

```json
{
  "architecture": {
    "forbiddenImports": [
      {
        "from": "^src/ui/",
        "to": "^src/data/",
        "reason": "UI 只能通过业务接口访问持久化层"
      }
    ]
  }
}
```

该 JSON 是配置片段，合并至已有文件后运行：

```sh
node .agentrepo/cli.mjs arch sync
node .agentrepo/cli.mjs arch check --strict
```

`arch sync` 只更新未被手工改动的托管配置。`arch check --strict` 在分析器缺失或检查失败时返回失败状态。HTML 支持搜索和依赖上下游查看；主图默认最多展示 65 条连线，并标注截断数量。自定义的架构 HTML 不会被覆盖。

## 文档同步

文件树变更后，重新生成代码索引：

```sh
node .agentrepo/cli.mjs map --write
node .agentrepo/cli.mjs docs check --base <base-commit>
```

受监控源码修改后，相关文档需要更新或复审。确认文档仍有效时记录复审：

```sh
node .agentrepo/cli.mjs docs review --base <base-commit> --id architecture --reason "已核对变更接口，现有说明仍有效"
```

复审记录绑定相关代码和文档内容。代码再次改变会使旧记录失效。

## Eval

目标仓库的 `eval/` 包含 `regressions.json`、`scenarios.json`、`incidents.json` 和 `tasks.json`。分别用于 CLI 回归、隔离故障、已确认缺陷和真实 Agent 任务。

```sh
node .agentrepo/cli.mjs eval run --json
node .agentrepo/cli.mjs eval scenarios --json
node .agentrepo/cli.mjs eval dream --json
node .agentrepo/cli.mjs eval audit --json
node .agentrepo/cli.mjs eval add-failure --id missing-config --argv '["doctor"]' --exit 1
node .agentrepo/cli.mjs eval report --input eval/trials.json
```

`eval dream` 是无大模型参与的确定性流程模拟。`eval report` 的 Token 指标使用模型返回的实际用量，要求相同任务与预算的配对数据。具体指标和故障回归流程见 [Eval 指南](EVAL.zh-CN.md)。

## 真实仓库基准

评估脚本使用 noVNC、nvm 和 npm CLI 的本地源码快照：

```sh
node benchmarks/run.mjs --projects-dir /path/to/source-snapshots --output reports/bench-local.json
```

`source-snapshots` 下应有 `novnc/`、`nvm/`、`npm/`。脚本在临时目录测试，不修改原始源码。题集和历史结果位于 `benchmarks/`、`reports/`。

## 当前验证范围

自动化测试覆盖 CLI、隔离故障、dependency-cruiser 接线与 JSON 解析、架构图数据检查。尚未完成真实 Coding Agent 配对实验、Token 减少率测量、第三方分析器完整运行以及浏览器截图验收。跨语言模块依赖仍需各自的分析器。

GitHub 协作模板与已有项目保留规则见 [GitHub 指南](GITHUB.zh-CN.md)。许可证为 MIT。
