# AgentRepo Kit v0.6.0 评估与改造报告

日期：2026-11-15

## 目标

原 v0.5 项目可以初始化，但架构文档多为填写提示，缺少直接可打开的交互式架构图。本轮将正式规则写入文件，并用显式占位符标注需要项目所有者确认的业务事实。代码目录和依赖关系由程序负责，避免重复维护。

## 新增能力

- `docs/architecture.md` 写入默认架构规则、模块契约填写要求和可执行检查入口。
- `docs/architecture.html` 是不依赖 CDN 的交互式页面。代码模块来自当前真实文件，跨模块连线只来自 dependency-cruiser JSON。
- `arch view --write` 生成 HTML，`arch view --check` 检测是否与当前源码、可用分析器结果一致。
- `docs check --strict` 检查未确认占位符及生成 HTML 的源码指纹。
- README、开发文档、长期任务交接和架构决策模板预写完整规则和操作流程。
- 对已有的人类自定义 HTML 不覆盖也不声称可自动校验其内容语义。

## 自动化测试

`npm test`：42 项通过，0 项失败。日志见 `tests-v6.log`。

新增的失败驱动回归覆盖：

1. 改动源码后，旧架构 HTML 必须判为过时。回归记录 AR-010。
2. 已有用户自定义 HTML 不能被 CLI 覆盖。回归记录 AR-011。
3. 未运行 dependency-cruiser 时，不产生推测性依赖线。
4. 输入真实形状的 dependency-cruiser JSON 时，只绘制内部已知源码之间的真实路径。
5. 源码内不可信名称必须正确转义，不能注入 `<script>`。
6. 已安装的 target-local CLI 能再次生成 HTML。
7. 初始化已有项目时，即使存在 depcruise 可执行文件，也不需要事先有 agentrepo.json。

## 三个真实开源项目的初始化验证

测试使用本地保留的 noVNC、nvm、npm CLI 源码快照，复制到临时目录；并非抓取仓库最新版，不代表运行完整项目应用。结果见 `REAL_PROJECTS_V6.json`。

| 项目 | 新增文件 | 二次初始化新增 | doctor | docs | HTML 检查 | 模块数 | 已验证连线 |
| --- | ---: | ---: | --- | --- | --- | ---: | ---: |
| noVNC | 17 | 0 | PASS | PASS | PASS | 13 | 0 |
| nvm | 17 | 0 | PASS | PASS | PASS | 10 | 0 |
| npm CLI | 17 | 0 | PASS | PASS | PASS | 6 | 0 |

“0 条连线”并非项目没有依赖，而是测试环境没有安装 dependency-cruiser。CLI 只生成文件清单视图。

## 准确性边界

- dependency-cruiser 的 CLI 参数与 JSON 输出结构依据其官方 CLI 文档设计。本轮未安装并运行该第三方程序。相关测试使用与实际源码相对应的固定 JSON 夹具；不视为第三方工具集成已完成。
- 曾尝试使用本地无头 Chromium 对 HTML 截图，但浏览器进程超时。脚本语法和嵌入式 JSON 解析通过，未完成浏览器视觉截图验收。
- 本轮没有真实执行 Codex、Claude Code 或 OpenCode 的配对编程任务，因此没有可用的 Coding Agent 成功率、命中率增量和 Token 减少率。
- CLI 不可能自动验证自然语言业务解释的全部语义。`docs check --strict` 负责占位符、链接和源码指纹，设计理由仍需要复审。

## 下一轮改进优先级

1. 在可安装 Node 开发依赖的环境中真实运行 dependency-cruiser，并验证不同 TypeScript 路径别名及 monorepo 场景。
2. 用可用浏览器采集截图，检查 HTML 连线布局、交互和响应式展示。
3. 执行真实 Coding Agent 的仓库理解及修改任务对照实验，保留 Token 的模型实测值。
4. 对用户新增的重大失败样例，先固定复现再修复，并提交到 `eval/` 及 `tests/`。
