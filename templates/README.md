# 模板目录

AgentRepo 的默认工作流是先理解仓库，再按需补充内容。模板不是安装清单，不要因为文件存在就全部复制到目标项目。

## 默认模板

- [`project/AGENTS.md`](project/AGENTS.md)：新仓库缺少 Agent 入口时使用。填入从仓库事实中确认的内容；已有 `AGENTS.md` 默认保留。

## 按需模板

- [`project/README.md`](project/README.md)：项目确实缺少面向人的说明，或用户要求建立 README 时使用。
- [`project/docs/architecture.md`](project/docs/architecture.md)：只有在模块边界或入口难以从代码中定位时使用；职责必须由代码证据或维护者确认。
- [`project/docs/development.md`](project/docs/development.md)：只有在启动、测试或本地环境不易发现时使用；命令须来自项目配置并实际核实。
- [`project/.env.example`](project/.env.example) 和 [`project/gitignore.tmpl`](project/gitignore.tmpl)：仅在项目存在相应需求且没有现成文件时使用。绝不放入真实密钥。
- [`AGENTS.project.md`](AGENTS.project.md)：为已有项目指令补充经过确认的专属约束时参考。
- [`github/`](github/)：GitHub Issue、PR 和 Changelog 模板。是否使用由独立的 GitHub Skill 决定。

不需要模板时，什么也不用生成。不要为了“对 Agent 友好”而引入重复文档、额外 CLI、自动地图、状态台账或新 CI。
