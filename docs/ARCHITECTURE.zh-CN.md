# AgentRepo Kit 架构

主流程由仓库接管 Skill 定义，模板库提供按需素材。Coding Agent 读取 [`skills/agentrepo-setup/SKILL.md`](../skills/agentrepo-setup/SKILL.md)，先遵循目标仓库已有约定，再判断是否需要新增内容。

| 部分 | 作用 | 默认行为 |
| --- | --- | --- |
| `skills/agentrepo-setup/SKILL.md` | 说明 Agent 如何理解、接手和开发一个仓库 | 是主入口，不要求 AgentRepo CLI |
| `templates/` | 提供 AGENTS、README、架构、开发环境及 GitHub 模板 | 仅按需选取；不是一次性安装清单 |
| `skills/agentrepo-github/SKILL.md` | GitHub Issue、PR 和 Changelog 模板的可选流程 | 仅在用户需要时使用 |
| `src/`、`bin/` | 可选 AgentRepo CLI 的源码与分发包 | 兼容现有 CLI 工作流，不是 Skill 的依赖 |

## 边界

- 默认入口是精简的 `AGENTS.md`；已有 `AGENTS.md` 默认保留。
- 项目地图、开发文档、命令包装器、验证记录、GitHub 模板和 CI 都不是默认要求。
- 模板中的项目事实由目标仓库源码或维护者确认，不根据文件名或静态线索编造业务职责。
- Agent 优先复用项目原有命令、测试和 CI。验证只报告实际执行的结果。
- 需要修改生产设置、发布流程或其他高影响内容时，遵循任务授权并先取得必要确认。

## 可选 CLI

CLI 的实现位于 `src/agentrepo.mjs`，构建脚本会将项目模板嵌入 `bin/agentrepo.mjs`。CLI 保留 inspect、adopt、verify、map 和 GitHub 模板等自动化能力。其历史初始化流程仍可生成多份辅助文件；最简 Skill 工作流不依赖该流程。
