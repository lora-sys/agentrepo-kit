# AgentRepo Kit 架构

目标是让新启动的 Coding Agent 能回答三个问题：代码在哪里、项目如何运行、修改后怎样验收。

| 组件 | 事实来源 | 操作 |
| --- | --- | --- |
| 仓库入口 | 现有 README、AGENTS、CI | `agentrepo inspect` |
| 统一命令 | Makefile、package.json、Go/Rust 配置 | `agentrepo setup/dev/test/verify` |
| 代码地图 | 当前文件树 | `agentrepo map --check/--write` |
| 原规则 | 已存在的文件 | `agentrepo adopt` 只读；`--apply` 补缺失项 |

`bin/agentrepo.mjs` 是唯一运行时入口。初始化时将该文件复制到目标仓库的 `.agentrepo/cli.mjs`，无需再次安装本工具。

## 边界

- 只根据真实项目文件推导命令和目录。无法检测的命令使用 `null`。
- 安装只写不存在的文件。已有 AGENTS、README、架构文档和 CI 原样保留。
- 初始化不运行项目脚本。`setup`、`dev`、`test`、`verify` 由用户显式执行。
- 使用 `spawnSync` 传递 argv 数组，不将项目命令拼接成 Shell 字符串。
- `verify` 的通过仅代表已执行的项目检查返回退出码 0，不代表业务功能都正确。

代码边界、数据库、端口、密钥与其他项目专属事实由项目维护者补齐。依赖方向可以通过原项目的 Lint 或 dependency-cruiser 写入自己的验证命令。
