# AgentRepo Kit

把代码库整理成 Coding Agent 能读懂、能运行、能验证的状态。

默认只做三件事：**可读、可跑、可验**。适用于新项目和已有项目。Node.js 20+，CLI 无第三方运行时依赖。

## 使用

从仓库源码目录执行：

```sh
node bin/agentrepo.mjs inspect /path/to/project
node bin/agentrepo.mjs verify /path/to/project
node bin/agentrepo.mjs init /path/to/project --dry-run
node bin/agentrepo.mjs init /path/to/project
```

`inspect` 只读检查项目已有规则、语言和命令，并将未执行命令标为 `DETECTED_UNVERIFIED`。`verify` 在初始化前就可以执行已发现的项目原生检查。`init` 只增加缺失文件，不执行安装脚本、不覆盖已有文档和 CI。

进入目标项目后，可直接使用随项目复制的 CLI：

```sh
cd /path/to/project
node .agentrepo/cli.mjs setup
node .agentrepo/cli.mjs dev
node .agentrepo/cli.mjs test
node .agentrepo/cli.mjs verify --record
node .agentrepo/cli.mjs doctor
node .agentrepo/cli.mjs map --check
```

`setup/test/verify --record` 将实际退出码写入可管理的开发文档区块；`doctor` 检查其是否仍适用于当前源码。没有配置的命令会返回 `NOT_CONFIGURED`；`verify` 缺失时按失败处理。命令的唯一配置来源是 `agentrepo.json.commands`。检测结果可以手动修改，使用 argv 数组，不需要 Shell 包装。

## 接手已有项目

```sh
node bin/agentrepo.mjs adopt /path/to/existing-project
node bin/agentrepo.mjs adopt /path/to/existing-project --apply
```

第一条只读生成接入预览；第二条仅补缺失文件。已有 `AGENTS.md`、README、架构文档、Workflow 和业务代码一律保留。若已有 `AGENTS.md`，CLI 会提示人工检查是否需要增加开发命令入口。

## 默认补齐内容

| 文件 | 内容 |
| --- | --- |
| `AGENTS.md` | 简短项目入口、修改约束、运行命令 |
| `docs/architecture.md` | 真实目录地图和待维护者确认的模块边界 |
| `docs/development.md` | 环境、统一命令和通过条件 |
| `agentrepo.json` | 已检测的可执行命令；未知命令为 `null` |
| `.agentrepo/cli.mjs` | 可离线运行的自包含 CLI |
| `.env.example` | 非敏感配置变量示例 |
| `README.md`、`.gitignore` | 仅在不存在时生成 |

使用 `node .agentrepo/cli.mjs locate "duplicate email"` 搜索文件名与源码内容，并返回命中行号。代码地图还会记录可追溯的导出符号、相对 import、package.json 入口及测试引用证据，但不把静态引用当成完整调用图。也不会根据导出符号自动编造业务职责。

要更新源码目录地图：

```sh
node .agentrepo/cli.mjs map --write
node .agentrepo/cli.mjs map --check
```

项目级 Eval、交互式 HTML 和额外 GitHub 模板不在默认安装范围。已有 `dependency-cruiser`、Lint 和测试可以纳入项目自己的 `verify` 命令；脚手架不会凭空生成架构依赖关系。

## 可选的 GitHub 协作模板

GitHub Issue Forms、PR 和 Changelog 不属于代码库接入的必需步骤。需要时按 [`agentrepo-github` Skill](skills/agentrepo-github/SKILL.md) 使用 [`templates/github/`](templates/github/)；普通项目不生成 Skill/Connector 故障表单。

```sh
node bin/agentrepo.mjs github /path/to/project
node bin/agentrepo.mjs github /path/to/project --apply
# 有 Skill 或连接器的项目可额外选择该表单
node bin/agentrepo.mjs github /path/to/project --apply --integrations
```

完整的 GitHub 协作接入步骤在 [`agentrepo-github` Skill](skills/agentrepo-github/SKILL.md)。CI Workflow 仍需单独授权 `--workflow`。已有 GitHub 协作规范保持不变。

## 独立使用与模板

无需任何额外 Agent 框架或插件。默认 `AGENTS.md` 已包含上下文入口、执行步骤、安全边界及验收要求。维护者可按 [`templates/AGENTS.project.md`](templates/AGENTS.project.md) 补充项目专属规则。

生成内容的 Markdown 源模板在 `templates/project/`。CLI 构建会将模板嵌入单文件分发包；目标仓库仍只生成基础文件，且所有原有文件保持不变。

## 开发与测试

```sh
npm run build:cli
npm test
npm run check
npm pack --dry-run
```

[English](README.en.md) · [架构与设计边界](docs/ARCHITECTURE.zh-CN.md) · [贡献](CONTRIBUTING.md) · [许可证](LICENSE)

旧版完整治理工具与 Eval 历史保存在 GitHub 的 `archive/pre-lean-v1` 分支，不属于当前 CLI 默认流程。
