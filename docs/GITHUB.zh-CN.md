# GitHub 协作模板与接手项目

## 默认生成规则

空仓库自动获得只读 GitHub Actions 工作流、Bug 和功能建议 Issue Forms、PR 检查清单，以及 Keep a Changelog 格式的 Unreleased 入口。

## 已有项目优先

接入已有仓库时，先检查以下文件的现有位置和内容。已有 Workflow 不替换，已有 Issue 模板目录不注入额外表单，已有 PR 模板无论位于根目录、docs 或 .github 都保留，已有 HISTORY、NEWS、CHANGES、CHANGELOG 不复制一份。

接入已有项目默认不新增 Workflow，只有显式选择 init --github-workflow，且不存在其他工作流时才补上默认检查。CI 仅使用 contents: read 权限，不访问生产部署密钥。

## 运行检查

```sh
agentrepo github check
agentrepo init ./project --dry-run
agentrepo init ./project
```

## 局限

CLI 只检查本地文件。GitHub 组织的默认社区文件、仓库设置、分支保护规则和外部 CI 服务需要另外核实。缺少本地模板不是现有项目失败的证据。

参考 GitHub 官方 Issue Forms、PR templates、GitHub Actions Security 与 Keep a Changelog。
