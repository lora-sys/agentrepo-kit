# AgentRepo Kit

为代码库生成 Agent 规则、交互式架构图、验证命令和 Eval。新仓库使用完整模板，已有仓库保留原规则并补齐缺失能力。

Node.js 20+ · v0.9.0 · MIT。CLI 无第三方 npm 运行时依赖，尚未发布到 npm Registry。

[English](README.en.md) · [完整用法](docs/USAGE.zh-CN.md) · [接入已有仓库](docs/ADOPTION.zh-CN.md) · [架构](docs/ARCHITECTURE.zh-CN.md) · [Eval](docs/EVAL.zh-CN.md) · [架构 HTML 示例](examples/architecture-demo.html)

## 最小模式

执行 `agentrepo init ../my-project --minimal`，只安装 AGENTS、代码索引、开发说明、配置和 CLI 共 7 个文件。不生成架构 HTML、GitHub 模板或项目级 Eval 文件。完整模式保持 `agentrepo init`，已有文件不覆盖。

## 初始化

从源码安装 CLI：

```sh
npm install --offline --ignore-scripts
npm link
agentrepo init ../my-project --dry-run
agentrepo init ../my-project
cd ../my-project
node .agentrepo/cli.mjs doctor
node .agentrepo/cli.mjs verify
```

## 接入已有仓库

```sh
cd /path/to/existing-project
agentrepo adopt scan
agentrepo adopt plan --write
agentrepo adopt apply --approve
agentrepo adopt activate --approve --reason "已审核原项目规则"
agentrepo adopt verify
```

`init` 只补缺失文件；`adopt` 审核规则、启用接入入口并检查后续变更。操作步骤见 [接入指南](docs/ADOPTION.zh-CN.md)。

## 生成内容

| 文件 | 用途 |
| --- | --- |
| `AGENTS.md` | Agent 开发规则 |
| `docs/architecture.md` | 模块职责、设计依据和边界 |
| `docs/architecture.html` | 真实依赖分析生成的离线架构图 |
| `docs/development.md` | 开发与验收命令 |
| `docs/code-map.md` | 源码索引 |
| `.github/`、`CHANGELOG.md` | GitHub 协作与版本记录模板 |
| `eval/`、`.agentrepo/` | 回归数据与项目内 CLI |

未知业务信息保留 `{{REQUIRES_REVIEW:...}}` 占位符，`docs check --strict` 会检查是否填写。

## 常用命令

```sh
agentrepo github check
agentrepo locate "task keywords" --k 3
agentrepo docs check --strict
agentrepo arch view --write
agentrepo eval run
```

JavaScript/TypeScript 项目可安装 [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)，再运行 `agentrepo arch init` 和 `agentrepo arch check --strict`。仅有分析结果时才绘制模块依赖线；未运行的检查记为 `SKIP`。

## 真实 Agent 对照实验

使用 `npm run eval:agent:smoke` 检查 A/B/C 运行基建，模拟数据不会计入真实指标。真实运行前固定源码 commit、模型版本和独立验收脚本，见 [实验指南](benchmarks/agent-eval/README.md)。

## 开发与测试

```sh
npm test
npm run eval:smoke
npm run check
npm pack --dry-run
```

真实 Agent 成功率和 Token 减少率仍需配对实验验证。历史结果见 [reports/](reports/)。

[贡献](CONTRIBUTING.md) · [更新记录](CHANGELOG.md) · [安全](SECURITY.md) · [发布](docs/PUBLISHING.zh-CN.md)
