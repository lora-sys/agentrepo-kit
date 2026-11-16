# Architecture

## 代码地图

{{CODE_MAP}}

## 业务入口与模块契约

| 入口或模块 | 责任 | 公开契约 | 允许调用方 |
| --- | --- | --- | --- |
| 待确认 | 待确认 | 待确认 | 待确认 |

仅填写从源码与维护者确认的事实；删除不适用的行。

## 不可违反的边界

待维护者确认跨层依赖和接口兼容约束。能静态检查的规则放入项目已有的 lint 或架构检查，并纳入 `verify`。

源码文件变化后执行 `node .agentrepo/cli.mjs map --write`，然后执行 `node .agentrepo/cli.mjs map --check`。
