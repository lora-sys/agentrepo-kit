# AGENTS.md 模板实仓评估

在 2026-11-16 对 Express、Click、Gin 三个不同技术栈的公开仓库做了浅克隆评估。三份原始副本都没有 `AGENTS.md` 或发现其他 Agent 专用指令。模拟任务是从实际源码追到相应测试，再从项目配置确认验证命令。随后用 GitHub `npx` 命令在三份临时副本上依次做 dry-run、创建和重复执行保护测试；每个副本只多出一个 `AGENTS.md`，跟踪文件无变化。整个过程没有提交或推送到上游仓库。

没有安装依赖或运行项目测试，因此评估的是模板的导航和安全边界，不是模型盲测或测试通过率。

## 实测结果

- **Express**（`expressjs/express`，浅克隆 HEAD `43fca52`）：模拟核实 `express.json()` 时，从 `index.js` 追到 `lib/express.js`，相关覆盖位于 `test/express.json.js`；README 与 `package.json` 将 `npm test` 作为测试入口。源码入口、实现、测试和命令配置可分别在 [1] [2] [3] [4] 找到。GitHub 安装器报告 `WOULD_CREATE`、`CREATED`、再次执行 `PRESERVED`；项目名被渲染为 `express`。
- **Click**（`pallets/click`，HEAD `e38188e9e205005d5af5f9e59df51904c984586a`）：模拟追踪 `@click.command` 无括号用法，在 `src/click/decorators.py` 找到实现，在 `tests/test_command_decorators.py::test_command_no_parens` 找到覆盖；`pyproject.toml` 的 tox 配置对应 `tox run -e py3.15 -- tests/test_command_decorators.py`。[5] [6] [7] 安装器在临时副本中成功预览、新增并保留文件，项目名渲染为 `click`。
- **Gin**（`gin-gonic/gin`，浅克隆 HEAD `0f09c3a`）：模拟核实 `RouterGroup.Any` 注册的方法，在 `routergroup.go` 找到实现，并在 `routergroup_test.go` 和 `routes_test.go` 找到相关测试；Makefile 提供 `make test`，但会写入 `coverage.out`，所以未运行。`go.mod` 声明 Go 1.26.0。[8] [9] [10] [11] [12] 安装器在临时副本中成功预览、新增并保留文件，项目名渲染为 `gin`。

三个样本说明，这份短模板适合作为通用行为护栏：它提醒 Agent 查真实源码、测试和命令，限制无关改动，并要求如实报告未验证事项。它不会替代项目地图，也没有消除定位项目细节所需的实际探索。对目标项目来说，只增加一个 `AGENTS.md` 比自动生成架构图、开发手册或 CI 更合适。

实测也暴露了初版模板的过度限制：绝对禁止公共接口改动可能挡住用户明确要求的 API 变更；笼统要求运行检查没有表达授权、安全和副作用边界。最终模板已收敛为 14 行、230 字符：检查只在安全且获授权时运行；接口、依赖、CI、生产配置、提交和推送都限于任务授权范围；空的项目专属规则章节已删除。

## 快捷安装

最简安装命令是：

```sh
npx --yes github:lora-sys/agentrepo-kit agents init
```

npm registry 当前没有 `agentrepo-kit` 包 [13]，因此命令直接从 GitHub 获取。该功能合并到默认分支后可省略分支名；本次在临时仓库实测时使用了 PR 分支 `#feat/skill-first-agentrepo` [14]。`--dry-run` 不写文件；正常运行只创建缺失的 `AGENTS.md`；重复执行会返回 `PRESERVED` 且不覆盖文件。一次安装仅新增一个文件，既有代码和配置保持不变。

## References

[1]: https://github.com/expressjs/express/blob/master/index.js "Express module entry"
[2]: https://github.com/expressjs/express/blob/master/lib/express.js "Express JSON parser export"
[3]: https://github.com/expressjs/express/blob/master/test/express.json.js "Express JSON parser tests"
[4]: https://github.com/expressjs/express/blob/master/package.json "Express package scripts"
[5]: https://github.com/pallets/click/blob/main/src/click/decorators.py "Click command decorator implementation"
[6]: https://github.com/pallets/click/blob/main/tests/test_command_decorators.py "Click command decorator tests"
[7]: https://github.com/pallets/click/blob/main/pyproject.toml "Click tox and test configuration"
[8]: https://github.com/gin-gonic/gin/blob/master/routergroup.go "Gin router group implementation"
[9]: https://github.com/gin-gonic/gin/blob/master/routergroup_test.go "Gin router group tests"
[10]: https://github.com/gin-gonic/gin/blob/master/routes_test.go "Gin route registration tests"
[11]: https://github.com/gin-gonic/gin/blob/master/Makefile "Gin test targets"
[12]: https://github.com/gin-gonic/gin/blob/master/go.mod "Gin module and Go version"
[13]: https://registry.npmjs.org/agentrepo-kit "npm registry entry for agentrepo-kit"
[14]: https://github.com/lora-sys/agentrepo-kit/pull/18 "AgentRepo Kit installer pull request"
