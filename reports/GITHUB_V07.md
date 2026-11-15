# GitHub governance evaluation

在正式代码仓库之外的临时目录测试。项目自身自动化套件覆盖空项目、已有 CI 和模板保留、其他合法 PR 路径、替代 Changelog 名称、重复初始化和显式启用新 Workflow。真实 Agent 自主任务与 Token 减少率未在本轮测量。

本轮另使用 AgentRepo Kit 仓库的源码快照进行已有仓库接入验证：七个原始 GitHub/Agent 文件的内容哈希保持一致，没有生成重复 Workflow、Issue、PR 或 Changelog，第二次初始化没有新增文件。

GitHub 的 Workflows、Issue、PR 和 Changelog 都应服从接手项目现有约定。新 Workflow 在已有项目中必须显式启用。
