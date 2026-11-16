# AGENTS.md 模板实仓评估

在 2026-11-16 对 Express、Click、Gin 三个不同技术栈的公开仓库做了浅克隆评估。三份副本原先都没有 `AGENTS.md` 或发现其他 Agent 专用指令；只在 `/tmp` 临时副本中添加了模板并替换项目名，没有改动或推送上游仓库。模拟任务是从实际源码追到相应测试，再从项目配置确认验证命令。没有安装依赖或执行测试，因此以下是仓库导航与模板安全边界评估，不是模型 A/B 测试，也不代表测试通过。

## 实测结果

- **Express**（`expressjs/express`，浅克隆 HEAD `43fca52`）：模拟核实 `express.json()` 时，从 [`index.js`](https://github.com/expressjs/express/blob/master/index.js#L11) 追到 [`lib/express.js`](https://github.com/expressjs/express/blob/master/lib/express.js#L77)，相关覆盖在 [`test/express.json.js`](https://github.com/expressjs/express/blob/master/test/express.json.js#L10)。README 和 `package.json` 指向 `npm test`。模板有助于提醒 Agent 查实现、测试和真实命令，但没有提供 Express 特有导航信息；`npm test` 未运行。[1] [2] [3]
- **Click**（`pallets/click`，HEAD `e38188e9e205005d5af5f9e59df51904c984586a`）：模拟追踪 `@click.command` 无括号用法，从 [`src/click/decorators.py`](https://github.com/pallets/click/blob/main/src/click/decorators.py#L182) 找到实现，直接测试是 [`tests/test_command_decorators.py::test_command_no_parens`](https://github.com/pallets/click/blob/main/tests/test_command_decorators.py#L6)。`pyproject.toml` 的 tox 配置给出定向命令 `tox run -e py3.15 -- tests/test_command_decorators.py`。模板能提示先查配置、沿用既有命令，但项目细节仍需自行探索；该 tox 命令未运行。[4] [5] [6]
- **Gin**（`gin-gonic/gin`，浅克隆 HEAD `0f09c3a`）：模拟核实 `RouterGroup.Any` 注册的方法，从 [`routergroup.go`](https://github.com/gin-gonic/gin/blob/master/routergroup.go#L180) 找到实现，相关覆盖在 [`routergroup_test.go`](https://github.com/gin-gonic/gin/blob/master/routergroup_test.go#L225) 和 [`routes_test.go`](https://github.com/gin-gonic/gin/blob/master/routes_test.go#L113)。仓库 Makefile 提供 `make test`，但该目标会写 `coverage.out`，所以未运行；`go.mod` 声明 Go 1.26.0。模板有助于让 Agent 查出这个副作用并如实说明未验证。[7] [8] [9]

三个样本都显示：这份短模板适合作为通用行为护栏，能减少覆盖既有规则、臆造事实和虚报验证结果的风险；它并不代替项目地图，也没有让实际定位源码、测试或命令的步骤消失。考虑到本项目追求低 Token，默认只加一份短 `AGENTS.md` 是合理的，不应因此自动生成架构图或额外治理文件。

初版实测还发现两处值得修正：绝对禁止公共接口变化可能挡住用户明确要求的 API 改动；笼统要求运行检查也没有表达授权和安全边界。当前模板已改为：仅在安全且获授权时运行检查；接口、依赖、CI、生产配置、提交和推送均限于任务授权范围；删除空的“项目专属规则”章节。

## References

[1]: https://github.com/expressjs/express/blob/master/lib/express.js "Express express.json implementation"
[2]: https://github.com/expressjs/express/blob/master/test/express.json.js "Express JSON parser tests"
[3]: https://github.com/expressjs/express/blob/master/package.json "Express package scripts"
[4]: https://github.com/pallets/click/blob/main/src/click/decorators.py "Click command decorator implementation"
[5]: https://github.com/pallets/click/blob/main/tests/test_command_decorators.py "Click command decorator tests"
[6]: https://github.com/pallets/click/blob/main/pyproject.toml "Click tox and test configuration"
[7]: https://github.com/gin-gonic/gin/blob/master/routergroup.go "Gin RouterGroup implementation"
[8]: https://github.com/gin-gonic/gin/blob/master/routergroup_test.go "Gin router group tests"
[9]: https://github.com/gin-gonic/gin/blob/master/Makefile "Gin test targets"
