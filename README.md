# AgentRepo Kit

一个面向 Coding Agent 的**仓库接管 Skill**，配一组按需使用的模板。目标不是给每个项目装一套治理工具，而是让 Agent 能快速理解仓库、按项目原有方式开发，并验证实际改动。

## 默认怎么用

先读取 [`skills/agentrepo-setup/SKILL.md`](skills/agentrepo-setup/SKILL.md)，让 Agent 按其中流程接手新仓库或已有代码库。

默认只在仓库缺少 Agent 入口且确有需要时使用 [`templates/project/AGENTS.md`](templates/project/AGENTS.md)。其他文件从 [`templates/`](templates/README.md) 按需选取。已有规则、文档、命令和 CI 优先保留；不为了模板完整而自动铺文件。

这个 Skill 不要求项目使用 AgentRepo CLI，也不会默认要求生成代码地图、验证台账、新 CI 或新的命令系统。Agent 应使用项目本身已有的开发与测试命令。

## 一键安装 AGENTS.md

此变更合并后，在目标仓库根目录运行（需要 Node.js 20+ 和网络）：

```sh
npx --yes github:lora-sys/agentrepo-kit agents init
```

先预览可加 `--dry-run`。命令只创建 `AGENTS.md`，已有同名文件会原样保留。npm 包尚未发布，命令直接从 GitHub 获取；完整流程见 [`agentrepo-install` Skill](skills/agentrepo-install/SKILL.md)。

## 模板

模板目录包含项目说明、架构与开发文档、环境变量示例、`.gitignore` 和可选 GitHub 协作模板。它们是素材，不是初始化时的必装清单。使用原则见 [`templates/README.md`](templates/README.md)。

## 可选 CLI

仓库仍保留 AgentRepo CLI，供需要自动检查、接入预览、命令运行、代码地图或 GitHub 模板预览的场景使用。它是可选工具，不是上述 Skill 的依赖。

```sh
node bin/agentrepo.mjs agents init /path/to/project
node bin/agentrepo.mjs inspect /path/to/project
node bin/agentrepo.mjs adopt /path/to/project
node bin/agentrepo.mjs adopt /path/to/project --apply
node bin/agentrepo.mjs --help
```

`agents init` 只安装 AGENTS.md；CLI `init` / `adopt --apply` 的历史脚手架行为仍可能生成多份辅助文件。

## 本仓库开发

```sh
npm test
npm run check
```

修改 Skill、模板或 CLI 后，运行相关检查。模板源文件位于 `templates/`；CLI 分发文件的构建与一致性检查由 `npm run build:cli` 和 `npm run check` 管理。

[English](README.en.md) · [架构与设计边界](docs/ARCHITECTURE.zh-CN.md) · [贡献](CONTRIBUTING.md) · [许可证](LICENSE)
