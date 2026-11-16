# Development

## 检测到的技术栈

{{STACK_LIST}}

## 命令与验收

工作目录为仓库根目录；唯一命令配置来源是 `agentrepo.json.commands`。

| 场景 | 命令 | 通过条件 |
| --- | --- | --- |
| 安装 | `node .agentrepo/cli.mjs setup` | 已配置的命令退出码为 0 |
| 开发 | `node .agentrepo/cli.mjs dev` | 项目按自身启动检查确认可用 |
| 测试 | `node .agentrepo/cli.mjs test` | 已配置的命令退出码为 0 |
| 验收 | `node .agentrepo/cli.mjs verify` | 所有配置的检查退出码为 0 |

缺失命令返回 `NOT_CONFIGURED` 且退出码非 0。禁止猜测包管理器命令、端口、数据库或服务地址。

## 本地环境

维护者在本节填写必需服务、非敏感环境变量的含义，以及可复现的启动前置条件。变量名放在 `.env.example`，不要填写真实凭据。
