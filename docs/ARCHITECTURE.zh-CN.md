# AgentRepo Kit 架构

目标是让新启动的 Coding Agent 能回答三个问题：代码在哪里、项目如何运行、修改后怎样验收。

| 组件 | 事实来源 | 操作 |
| --- | --- | --- |
| 仓库入口 | 现有 README、AGENTS、CI | `agentrepo inspect` |
| 统一命令 | Makefile、package.json、Go/Rust 配置 | `agentrepo setup/dev/test/verify` |
| 代码地图与可追溯引用 | 文件树、package.json 入口、源码中的相对 import 和测试引用 | `agentrepo map --check/--write` |
| 原规则 | 已存在的文件 | `agentrepo adopt` 只读；`--apply` 补缺失项 |

`templates/project/` 是生成文档的权威模板；`src/agentrepo.mjs` 是 CLI 逻辑源。执行 `npm run build:cli` 将模板嵌入 `bin/agentrepo.mjs`。该分发文件复制到目标仓库的 `.agentrepo/cli.mjs` 后仍可离线初始化其他项目。

## 边界

- 只根据真实项目文件推导命令和目录。无法检测的命令使用 `null`。
- 安装只写不存在的文件。已有 AGENTS、README、架构文档和 CI 原样保留。
- 初始化不运行项目脚本。`setup`、`dev`、`test`、`verify` 由用户显式执行。
- 使用 `spawnSync` 传递 argv 数组，不将项目命令拼接成 Shell 字符串。
- `verify` 的通过仅代表已执行的项目检查返回退出码 0，不代表业务功能都正确。

静态扫描有文件数及输出上限，不代表完整调用图。业务入口、模块职责、数据库、端口、密钥与其他项目专属事实由项目维护者核实。依赖方向可以通过原项目的 Lint 或 dependency-cruiser 写入自己的验证命令。

可定位的导出声明及其直接测试引用可自动提取，但不推导业务职责。执行 `verify --record` 可在生成的 `docs/development.md` 中留存实际退出状态；`doctor` 用代码与命令配置指纹检查这份证据是否过期。
