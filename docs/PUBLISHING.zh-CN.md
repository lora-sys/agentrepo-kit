# 发布到 GitHub

本项目建议使用公开仓库 `lora-sys/agentrepo-kit`。已有 MIT License、README、贡献指南、CI、Issues 表单和 Eval。

## 一条命令发布

在已安装 [GitHub CLI](https://cli.github.com/) 并完成 `gh auth login` 的机器上，从本项目根目录执行：

```sh
bash scripts/publish-github.sh lora-sys/agentrepo-kit
```

脚本会检查 `gh` 登录状态，初始化本地 Git，保留已有用户 Git 身份或配置本地 GitHub noreply 身份，生成初始提交，创建公开 GitHub 仓库并推送 `main`。最后会尝试启用 GitHub 仓库模板功能。

安全限制：如果已经配置 `origin`，或同名远程仓库已存在，脚本不会自动覆盖或强行推送。运行前请检查准备公开的文件中是否包含不应公开的信息。

## 使用网页创建

也可以在 https://github.com/new 创建名为 `agentrepo-kit` 的公开空仓库，不要勾选自动生成 README、License 或 .gitignore。然后在本地执行：

```sh
git init -b main
git add -A
git commit -m "Initial release: AgentRepo Kit v0.6.0"
git remote add origin https://github.com/lora-sys/agentrepo-kit.git
git push -u origin main
```

上面的手动方式要求本机已有 Git 身份与推送认证。仓库建好后，GitHub 仓库管理者可以在 Settings 中勾选 **Template repository**，允许其他人使用 `Use this template`。

## 首次发布后的检查

1. 确认主分支是 `main`，README 和 MIT License 能在仓库首页读取。
2. 观察 GitHub Actions 的 Node.js 20 与 22 CI 是否通过。
3. 在仓库的 About 设置描述和 Topics。
4. 检查 Issues 功能已开启，并确认表单能正常显示。
5. 按需打开 Security 页面中的私密漏洞报告。
6. 试用 GitHub 仓库的 `Use this template` 按钮，并在复制的项目里执行 CLI 初始化。

注意 GitHub 仓库模板和 AgentRepo CLI 是两种不同的复用方式。这个仓库本身可以作为代码模板，也可以把 CLI 安装到其他现有仓库。直接使用 GitHub 模板会复制 AgentRepo Kit 的源码，不会自动把它改造成任意业务项目。
