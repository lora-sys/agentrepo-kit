# Architecture

## 源码证据

{{CODE_MAP}}

## 经过确认的业务入口与模块契约

本节由维护者根据任务和源码证据确认，不随 `map --write` 自动覆盖。导出符号与静态 import 是定位线索，不是已验证的业务职责或运行时调用关系。

| 入口或模块 | 业务职责 | 公开契约 | 禁止依赖或修改范围 | 证据路径 |
| --- | --- | --- | --- | --- |
| 待确认 | 待确认 | 待确认 | 待确认 | 待确认 |

## 验证

- 新增、移动源文件或修改 import 后：`node .agentrepo/cli.mjs map --write`
- 提交前：`node .agentrepo/cli.mjs map --check`
- 确认的架构限制应加入现有 lint 或静态分析器，并纳入项目 `verify`。
