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

## 最近一次验证证据

对 `setup`、`dev`、`test`、`verify` 显式加 `--record` 才会记录进程退出码。未配置命令也会如实记录。`dev` 的进程退出不代表服务健康。普通执行不写文件。代码或测试变更后需重新验收，运行 `doctor` 可检测证据是否过期。

<!-- agentrepo:verification:start -->
未记录任何执行结果。状态：`NOT_VERIFIED`。
<!-- agentrepo:verification:end -->

## 检测警告

{{COMMAND_WARNINGS}}

## 本地服务与环境变量

待维护者确认：必需服务、启动顺序、端口来源、测试数据、环境变量含义。`.env.example` 只填写非敏感变量名，不放真实凭据。
