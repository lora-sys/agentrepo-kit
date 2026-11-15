# 更新日志

## [Unreleased]

### Added

- GitHub Workflow、Issue、PR、Changelog 预设模板和已有项目优先的接入规则。
- 新增 github check 与隔离的 GitHub 回归场景。

### Fixed

- 避免重复生成其他支持路径上的 PR 模板。
- 避免接手已有仓库时自动激活新 Workflow。

## v0.6.0 · 2026-11-15

- 增加已写好规则、明确业务占位符的项目文档模板。
- 增加离线自包含架构 HTML，依赖连线仅来自真实分析结果。
- 增加源码变化后架构图过期检测、自定义 HTML 保护测试。
- 保留文档复审、代码定位、架构约束和持续 Eval。
- 在当前环境验证了 42 项 Node.js 自动化测试，以及 6 个隔离 Eval 场景。
- 仍待验证真实 dependency-cruiser 二进制集成、多模型自主开发和 Token 减少率。

更详细的测试结果和限制参见 [第六轮报告](reports/ROUND6.zh-CN.md)。
