# 更新日志

## [Unreleased]

### Added

- 增加真实 Coding Agent A/B/C 实验运行器，支持固定 Git SHA、隔离工作区、独立验收、Codex JSONL Token 记录和配对报告。
- 增加三组模拟执行烟雾测试与防止模拟 Token 混入真实报告的永久回归测试。

## [0.9.0] · 2026-11-15

### Changed

- 将生成的 AGENTS、架构和开发文档整理为执行指令与契约表；减少重复叙事。
- 项目未完成业务占位符审查时，`verify` 返回 `FAIL`。
- 根据 packageManager 或唯一锁文件识别包管理器；来源不明时不生成猜测的 npm 命令。
- 为上下文验证及包管理器检测增加回归与诊断 Eval。
- 压缩使用、接入和 Eval 文档中的重复解释；增加文档精简回归检查。

## [0.8.1] · 2026-11-15

### Changed

- 精简生成的 AGENTS、架构、开发和 GitHub 协作文档，并增加内容质量回归测试。

## [0.8.0] · 2026-11-15

### Added

- v0.8.0 existing-repository adoption protocol with `adopt scan`, `plan`, `apply`, `activate`, `verify`, and `reconcile`.
- Original project rule fingerprinting, explicit approval and review reason, guarded AGENTS.md bridge, and documented precedence.
- Adoption Eval covering stale plans, original file preservation, symlinks, rule drift, and idempotence.

- GitHub 协作规范模块，包含完整的 Issue/PR/Workflow/Changelog 模板。
- 已有仓库优先策略，以及 `agentrepo github check` 和 GitHub 模板回归测试。

### Fixed

- 避免已有项目使用其他受支持路径的 PR 模板时重复生成。
- 避免在已有项目中默认激活新的 CI Workflow。

## v0.6.0 · 2026-11-15

- 增加已写好规则、明确业务占位符的项目文档模板。
- 增加离线自包含架构 HTML，依赖连线仅来自真实分析结果。
- 增加源码变化后架构图过期检测、自定义 HTML 保护测试。
- 保留文档复审、代码定位、架构约束和持续 Eval。
- 在当前环境验证了 42 项 Node.js 自动化测试，以及 6 个隔离 Eval 场景。
- 仍待验证真实 dependency-cruiser 二进制集成、多模型自主开发和 Token 减少率。

更详细的测试结果和限制参见 [第六轮报告](reports/ROUND6.zh-CN.md)。
