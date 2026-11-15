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

`inspect` 只读检查项目已有规则、语言和命令。`verify` 在初始化前就可以执行已发现的项目原生检查。`init` 只增加缺失文件，不执行安装脚本、不覆盖已有文档和 CI。

进入目标项目后，可直接使用随项目复制的 CLI：

```sh
cd /path/to/project
node .agentrepo/cli.mjs setup
node .agentrepo/cli.mjs dev
node .agentrepo/cli.mjs test
node .agentrepo/cli.mjs verify
node .agentrepo/cli.mjs map --check
```

没有配置的命令会返回 `NOT_CONFIGURED`；`verify` 缺失时按失败处理。命令的唯一配置来源是 `agentrepo.json.commands`。检测结果可以手动修改，使用 argv 数组，不需要 Shell 包装。

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

要更新源码目录地图：

```sh
node .agentrepo/cli.mjs map --write
node .agentrepo/cli.mjs map --check
```

项目级 Eval、交互式 HTML 和额外 GitHub 模板不在默认安装范围。已有 `dependency-cruiser`、Lint 和测试可以纳入项目自己的 `verify` 命令；脚手架不会凭空生成架构依赖关系。

## 项目 AGENTS.md 的维护边界

自动生成的 `AGENTS.md` 只保留仓库级优先级与验证入口。项目维护者只补充无法从代码或配置推导、违反代价高的项目事实。复杂 Agent 流程放在项目 Skill 中，公共流程交给已安装的全局 Skill。使用 `lora-mode` 的项目可参考 [`templates/AGENTS.project.lora-mode.md`](templates/AGENTS.project.lora-mode.md)，此模板不会自动生成到目标仓库。

## 开发与测试

```sh
npm test
npm run check
npm pack --dry-run
```

[English](README.en.md) · [架构与设计边界](docs/ARCHITECTURE.zh-CN.md) · [贡献](CONTRIBUTING.md) · [许可证](LICENSE)

旧版完整治理工具与 Eval 历史保存在 GitHub 的 `archive/pre-lean-v1` 分支，不属于当前 CLI 默认流程。
