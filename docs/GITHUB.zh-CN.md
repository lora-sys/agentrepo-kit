# GitHub 协作模板

空仓库生成只读 CI、Issue Forms、PR 检查清单和含 `Unreleased` 的 Changelog。

已有仓库保留原 Workflow、Issue 模板、PR 模板及更新日志。PR 模板识别根目录、`docs/` 与 `.github/`；更新日志识别 `HISTORY`、`NEWS`、`CHANGES` 和 `CHANGELOG`。接入时默认不增加 CI，只有仓库尚无工作流且显式传入 `init --github-workflow` 才创建。

```sh
agentrepo github check
agentrepo init ./project --dry-run
agentrepo init ./project
```

本地检查不包括组织默认社区文件、GitHub 分支保护、仓库设置和外部 CI 服务。CI 使用 `contents: read` 权限。

参考 GitHub Issue Forms、PR templates、Actions Security 和 Keep a Changelog。
