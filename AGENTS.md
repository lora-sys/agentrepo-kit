# AgentRepo Kit

## 优先级

遵守本仓库已有的项目规范和明确任务要求。AgentRepo Kit 必须在只有 Node.js 的环境独立运行，不依赖外部 Agent 框架。

## 代码与模板

- 模板源文件在 `templates/project/`；修改生成文本后运行 `npm run build:cli`。
- `src/agentrepo.mjs` 是 CLI 逻辑源；`bin/agentrepo.mjs` 是可分发的自包含生成文件。
- 目标仓库默认生成文件由 `plan()` 管理；不覆盖既有文件、CI 或项目配置。
- 修改 CLI、模板或初始化行为后运行 `npm run check`。包含模板构建一致性和真实子进程测试。

## 致命陷阱

- 只改 `bin/agentrepo.mjs`：下次构建会丢失修改。必须修改 `src/agentrepo.mjs` 后生成。
- 生成的 CLI 依赖外部模板路径：npm 安装和目标仓库离线使用会失败。模板必须嵌入分发文件。
- 将缺失验证命令当作通过：会产生虚假验收。应返回 `NOT_CONFIGURED` 和非零退出码。
- 覆盖原项目规则：会删除维护者约束。初始化只创建缺失文件。
