# AgentRepo Kit

给新项目生成 Agent 规则、架构 HTML、验证命令和 Eval；接手已有仓库时，原规则优先，缺什么补什么。

Node.js 20+ · v0.8.1 · MIT。CLI 无第三方 npm 运行时依赖；尚未发布到 npm Registry。

[English](README.en.md) · [完整用法](docs/USAGE.zh-CN.md) · [架构](docs/ARCHITECTURE.zh-CN.md) · [Eval](docs/EVAL.zh-CN.md) · [交互式架构图示例](examples/architecture-demo.html)

## 使用

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

`init` 只新增缺失文件。已存在的 README、AGENTS、架构 HTML、Workflow、Issue、PR 和 Changelog 不会被覆盖；接手已有仓库时也不会默认添加 CI。

## 接手已有仓库

不要把 `init` 当成规则接管。先扫描原规则、审查接入计划，再显式批准。

```sh
cd /path/to/existing-project
agentrepo adopt scan
agentrepo adopt plan --write
agentrepo adopt apply --approve
agentrepo adopt activate --approve --reason "已核对原项目规则和兼容性"
agentrepo adopt verify
```

`activate` 只向已有 `AGENTS.md` 追加经批准的入口，不重写原规则。`verify` 检查原文件变化和待确认项，不代表业务功能已经通过测试。[接入规范](docs/ADOPTION.zh-CN.md)

## 生成什么

| 文件 | 用途 |
| --- | --- |
| `AGENTS.md` | 简短任务规则，已有文件优先 |
| `docs/architecture.md` | 模块职责、接口与边界，未知业务事实保留待审占位符 |
| `docs/architecture.html` | 可搜索的离线架构图，仅显示真实依赖分析结果 |
| `docs/development.md` | 环境、命令与验证要求 |
| `docs/code-map.md` | 程序生成的代码目录 |
| `.github/`、`CHANGELOG.md` | 空仓库默认协作模板，已有仓库避免重复 |
| `eval/`、`.agentrepo/` | 回归数据和统一 CLI |

项目专属事实通过 `{{REQUIRES_REVIEW:...}}` 标记。未完成审查时，`docs check --strict` 会失败，不会把未知内容自动编成事实。

## 常用命令

```sh
agentrepo github check
agentrepo locate "task keywords" --k 3
agentrepo docs check --strict
agentrepo arch view --write
agentrepo eval run
```

JavaScript/TypeScript 项目按需安装 `dependency-cruiser`，再运行 `agentrepo arch init` 和 `agentrepo arch check --strict`。未安装分析器时，不虚构依赖连线，也不将 SKIP 计为通过。

## 开发与验证

```sh
npm test
npm run eval:smoke
npm run check
npm pack --dry-run
```

当前测试数量以 CI 为准。[历史评估](reports/) 单独记录。确定性 Eval 不等于 Coding Agent 的真实任务成功率；尚无配对实验可证明 Token 减少率。

[贡献指南](CONTRIBUTING.md) · [更新记录](CHANGELOG.md) · [发布说明](docs/PUBLISHING.zh-CN.md) · [安全说明](SECURITY.md) · [行为准则](CODE_OF_CONDUCT.md)
