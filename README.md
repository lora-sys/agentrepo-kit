# AgentRepo Kit

**让代码仓库更适合 Coding Agent 理解、修改、验证和交接。**

AgentRepo Kit 是一套可接入新项目和已有仓库的 Node.js 命令行脚手架。它提供已经写好的开发规则、清晰的待确认占位符、可视化架构 HTML、可执行的仓库检查，以及保留失败案例的 Eval。

> 当前版本为 `v0.7.0`，需要 Node.js 20 或更高版本。CLI 本体不依赖第三方 npm 运行时包。
>
> 项目仍处于实验阶段。脚手架的自动化测试不能等同于真实 Coding Agent 的开发成功率。

[English](README.en.md) · [完整使用文档](docs/USAGE.zh-CN.md) · [架构设计](docs/ARCHITECTURE.zh-CN.md) · [Eval 说明](docs/EVAL.zh-CN.md) · [架构 HTML 示例](examples/architecture-demo.html)

## 为什么做这个项目

一个新启动的 Coding Agent 应当能直接从仓库获得以下信息。

1. 项目做什么，关键模块在哪里。
2. 哪些代码可以修改，哪些接口和架构边界不能破坏。
3. 如何安装、启动、测试，以及如何判断任务完成。
4. 架构图和文档是否仍与真实代码一致。
5. 前一轮任务做过什么、失败原因是什么、接下来需要验证什么。

为此，AgentRepo Kit **不要求用户从空白文档开始**。通用规则提前写好；代码事实由程序提取；业务事实保留 `{{REQUIRES_REVIEW:...}}`，不允许猜测填充。

## 核心能力

| 能力 | 对应机制 |
| --- | --- |
| 一次初始化 | 同时支持空项目和已有项目，保留原有文件，可预览改动 |
| Agent 入口 | 简短 `AGENTS.md`，把详细规则和项目知识留在仓库中 |
| 代码定位 | 生成文件索引并按任务描述返回相关源码路径 |
| 架构可视化 | 生成自包含 `docs/architecture.html`，支持搜索和依赖查看 |
| 真实依赖约束 | 对 JavaScript/TypeScript 项目可接入 `dependency-cruiser` |
| 文档防过时 | 检查路径、占位符、代码索引、架构图指纹和受影响文档复审 |
| 程序化验证 | `doctor`、`verify`、`docs check`、`arch check` |
| 持续 Eval | 内置回归样例、故障案例、固定评估任务与结果统计 |

### 生成后的仓库结构

```text
my-project/
├── README.md                    # 项目目标，需根据实际业务确认
├── AGENTS.md                    # 已写好的智能体规则
├── agentrepo.json               # 检测到的配置和待确认项
├── docs/
│   ├── architecture.md          # 架构理由及边界
│   ├── architecture.html        # 可直接打开的交互式架构图
│   ├── code-map.md              # 从真实文件树生成
│   ├── development.md           # 开发和验收步骤
│   ├── decisions/_TEMPLATE.md
│   └── plans/_TEMPLATE.md
├── eval/
│   ├── regressions.json
│   ├── scenarios.json
│   ├── incidents.json
│   └── tasks.json
└── .agentrepo/
    ├── cli.mjs
    └── architecture-template.html
```

初始化仅添加缺失文件。已有的 README、AGENTS 和自定义架构 HTML 不会被覆盖。

## 五分钟开始

目前提供源码方式安装。**尚未声明该包已经发布到 npm Registry。**

```sh
# 在 AgentRepo Kit 源码目录
npm install --offline --ignore-scripts
npm link

# 先预览，再初始化新项目或已有项目
agentrepo init ../my-project --dry-run
agentrepo init ../my-project

cd ../my-project
node .agentrepo/cli.mjs doctor
node .agentrepo/cli.mjs docs check
node .agentrepo/cli.mjs eval run
node .agentrepo/cli.mjs arch view --check
```

不需要全局安装也可以执行 `node /path/to/agentrepo-kit/bin/agentrepo.mjs init /path/to/project`。

### 开启 JavaScript/TypeScript 架构检查

```sh
# 在目标项目里
node .agentrepo/cli.mjs arch init
npm install --save-dev dependency-cruiser
node .agentrepo/cli.mjs arch check --strict
node .agentrepo/cli.mjs arch view --write
```

生成的依赖线只来自真实分析结果。如果分析器未安装，只展示文件和模块列表，不虚构依赖。其他语言不会被强制执行 JavaScript 架构检查。

## CLI 命令

| 命令 | 作用 |
| --- | --- |
| `agentrepo init [dir] --dry-run` | 预览将创建的文件 |
| `agentrepo init [dir]` | 安全初始化项目 |
| `agentrepo doctor` | 检查项目环境和待确认项 |
| `agentrepo map --check` | 检查代码索引是否过期 |
| `agentrepo locate "任务描述" --k 3` | 定位可能相关的源码文件 |
| `agentrepo docs check --base SHA` | 检测文档结构、源码变更和复审状态 |
| `agentrepo docs check --strict` | 禁止将尚未确认的占位符当作完成 |
| `agentrepo arch check --strict` | 要求架构检查实际执行成功 |
| `agentrepo arch view --write` | 更新架构 HTML |
| `agentrepo verify --require test` | 要求实际执行测试，不能跳过 |
| `agentrepo eval run` | 执行仓库回归检查 |
| `agentrepo eval scenarios` | 执行隔离的故障场景 |
| `agentrepo eval dream` | 运行确定性开发流程模拟，不会调用大模型 |
| `agentrepo eval report --input trials.json` | 汇总配对实验的结果和真实 Token 用量 |

初始化后，也可以用 `node .agentrepo/cli.mjs` 代替全局 `agentrepo` 命令。

## 如何参与开发

```sh
npm test
npm run eval:smoke
npm run check
npm pack --dry-run
```

当前源码的自动化基线为 42 项 Node.js 测试和 6 项隔离 Eval 场景。历史结果存放在 [`reports/`](reports/)，请查看报告中的限制说明。`dependency-cruiser` 在部分离线评估环境中尚未完成真实二进制集成测试；目前不能宣称已测得真实 Coding Agent 的 Token 减少率。

修复 Bug 时，先添加能够复现失败的测试，并将具有长期价值的失败记录写入 Eval。提交前运行上述命令。详见 [贡献指南](CONTRIBUTING.md) 和 [Eval 设计](docs/EVAL.zh-CN.md)。

## 项目状态与许可

- 当前代码：`v0.7.0`，已经完成 CLI 测试、基础架构 HTML 和内部回归检查。
- 尚未完成：多模型真实编程 A/B 评估、第三方分析器完整联网集成、浏览器截图视觉验收。
- 已知局限：当前源码定位主要使用轻量词法方法，大型多语言单仓库还需要更广泛评估。
- 开源协议：[MIT](LICENSE)。第三方评测项目源代码不随本仓库分发。

[更新记录](CHANGELOG.md) · [GitHub 发布说明](docs/PUBLISHING.zh-CN.md) · [安全说明](SECURITY.md) · [行为准则](CODE_OF_CONDUCT.md)

## GitHub 协作规范与已有仓库优先级

空仓库会生成 Issue Forms、PR 模板、Changelog 和只读权限的静态 Workflow。已有项目优先保留自己的规则，并检查 GitHub 允许的其他模板路径和历史文件名。已有仓库默认不会启用新的 CI Workflow。

```sh
agentrepo github check
agentrepo init ./existing-project --dry-run
# 明确决定新增 CI 时才使用
agentrepo init ./existing-project --github-workflow
```
