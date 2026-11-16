# Development

## 技术栈证据

{{STACK_LIST}}

## 检测到的命令

工作目录为仓库根目录。唯一可执行配置来源为 `agentrepo.json.commands`。

| 场景 | 原始 argv | 检测状态 |
| --- | --- | --- |
{{COMMAND_ROWS}}

`DETECTED_UNVERIFIED` 只表示仓库配置包含命令，不代表命令运行成功。`NOT_CONFIGURED` 表示未发现可执行命令。

## 实际执行

```sh
node .agentrepo/cli.mjs setup
node .agentrepo/cli.mjs dev
node .agentrepo/cli.mjs test
node .agentrepo/cli.mjs verify
```

执行后记录真实退出码、前置条件和未完成项。仅退出码为 0 的已执行检查可标为 `PASS`；其他结果保留 `FAIL` 或 `NOT_CONFIGURED`。

## 检测警告

{{COMMAND_WARNINGS}}

## 本地服务与环境变量

待维护者确认：必需服务、启动顺序、端口来源、测试数据、环境变量含义。`.env.example` 只填写非敏感变量名，不放真实凭据。
