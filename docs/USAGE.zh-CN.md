# AgentRepo Kit

面向 Coding Agent 的代码库脚手架。使用一个 Node.js CLI 将新仓库初始化、已有仓库接入、代码定位、文档漂移检查、可执行验证、架构依赖约束、跨任务交接和 Eval 放进同一套流程。

当前版本：0.8.1。最低 Node.js 20。CLI 本体没有运行时 npm 依赖。`dependency-cruiser` 由 JavaScript/TypeScript 项目自行安装作为开发依赖。Shell、Go、Python 等非 JavaScript 项目不会强制启用 JS 模块检查。

## 设计原则：完整模板、明确占位符、独立 HTML

仓库初始化后，规则和文档结构已经写好，不要求用户从空白 Markdown 开始写。生成的核心文件包括：

```text
AGENTS.md                       # 已写好的 Agent 开发规则
agentrepo.json                  # 自动检测的项目元数据、命令、边界配置
docs/architecture.md            # 架构解释、设计规则、待确认的业务边界
docs/architecture.html          # 直接用浏览器打开的交互式架构图
docs/code-map.md                # 从真实文件生成的代码索引
docs/development.md             # 已写好的开发与验收流程
docs/decisions/_TEMPLATE.md     # 决策记录模板
docs/plans/_TEMPLATE.md         # 长期任务交接模板
eval/                            # 回归测试、故障集和 Agent 任务容器
.agentrepo/cli.mjs              # 目标项目内的统一 Node.js CLI
.agentrepo/architecture-template.html  # HTML 展示模板
```

只有不能从代码确定的信息使用 `{{REQUIRES_REVIEW:FIELD}}`。例如项目目标、用户群体、模块职责、项目独有的依赖边界、测试环境。`doctor` 会列出未填写项，`docs check --strict` 会报错，普通 `docs check` 只检查可确定的内容。README 是项目目标的唯一维护位置，架构说明链接过去，不复制一份。

`docs/architecture.md` 负责为什么这样设计，`docs/architecture.html` 负责当前有什么模块以及哪些真实模块依赖。**二者职责不同，不能手工画出未经验证的调用线。** 初次初始化生成文件清单视图；只有真实运行 dependency-cruiser 并读取 JSON 解析结果后，才绘制跨模块依赖连线。HTML 是自包含的，不依赖 CDN，可以直接在本地浏览器打开。

已有项目里的 `README.md`、`AGENTS.md`、`docs/architecture.html` 不会被初始化覆盖。执行 `arch view --write` 也会拒绝覆盖不属于 AgentRepo 管理的自定义 HTML。

## 快速开始

下载源码后在该目录执行：

```sh
npm install --offline --ignore-scripts
npm link
agentrepo init /path/to/project --dry-run
agentrepo init /path/to/project
```

如果不希望全局链接，可直接执行：

```sh
node /path/to/agentrepo-kit/bin/agentrepo.mjs init /path/to/project
```

随后进入目标项目，调用已随初始化复制进去的统一 CLI，不要求目标项目安装 AgentRepo Kit：

```sh
cd /path/to/project
node .agentrepo/cli.mjs doctor
node .agentrepo/cli.mjs map --check
node .agentrepo/cli.mjs locate "WebSocket transport buffering" --k 3
node .agentrepo/cli.mjs docs check
node .agentrepo/cli.mjs verify --require test
node .agentrepo/cli.mjs eval run
node .agentrepo/cli.mjs eval scenarios
node .agentrepo/cli.mjs eval dream
node .agentrepo/cli.mjs eval audit
```

无测试配置时，`verify` 默认将其标记为 `SKIP`，不得解释为通过。使用 `--require test` 可以让缺失测试直接失败。配置项目特定的测试命令，请修改 `agentrepo.json` 中的 `commands`，命令采用 argv 数组形式，例如 `"test": ["npm", "test"]`。

## 架构约束：dependency-cruiser

JavaScript 或 TypeScript 项目应启用架构检查：

```sh
agentrepo init /path/to/js-project --arch
cd /path/to/js-project
npm install --save-dev dependency-cruiser
node .agentrepo/cli.mjs arch check --strict
```

如果项目已初始化，使用 `node .agentrepo/cli.mjs arch init`。对于已有项目，CLI 不会自动修改 `package.json`，也不会在初始化时下载依赖。缺少本地可执行文件时，`arch check --strict` 失败，不会伪装成通过。该工具由原作者维护：[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)。

在 `agentrepo.json` 添加自定义层级规则，再运行 `arch sync`：

```json
{
  "architecture": {
    "forbiddenImports": [
      {
        "from": "^src/ui/",
        "to": "^src/data/",
        "reason": "UI 不能直接访问数据持久化层"
      }
    ]
  }
}
```

这只是 `architecture` 字段片段，需要合并进现有的 `agentrepo.json`。执行：

```sh
node .agentrepo/cli.mjs arch sync
node .agentrepo/cli.mjs arch check --strict
```

生成的配置包含循环依赖阻止规则和未解析依赖告警。自定义规则会被转换为 dependency-cruiser 的 `forbidden` 规则。`arch sync` 仅更新由 AgentRepo Kit 生成且尚未被其他人手工修改的配置。真实的依赖分析由独立安装的 dependency-cruiser 执行；当前发布包的测试包括调用接线、错误传播和配置校验，不包含在离线环境成功安装第三方程序的结果。

## 使用 HTML 架构图

```sh
# 初始生成 docs/architecture.html，无依赖分析器时不画连线
agentrepo init ./my-project
cd ./my-project

# JavaScript/TypeScript 项目安装真实分析器
npm install --save-dev dependency-cruiser
node .agentrepo/cli.mjs arch init
node .agentrepo/cli.mjs arch check --strict

# 使用真实分析结果重新生成可交互 HTML
node .agentrepo/cli.mjs arch view --write

# PR 中验证生成的 HTML 没过期
node .agentrepo/cli.mjs arch view --check
node .agentrepo/cli.mjs docs check --strict
```

HTML 支持模块搜索、模块选择、查看源码文件和真实依赖上下游。大图最多展示前 65 条连线，选择模块后可查看与之相关的最多 65 条，UI 会明确显示截断数量。对其他语言只展示已确认的源文件清单，不宣称已经分析依赖。

此版本的 dependency-cruiser 运行环境仍需要本机安装依赖；离线测试只覆盖解析其 JSON 输出、执行路径和严格失败逻辑，不声称已经跑通第三方真实二进制。

## 文档防过时

`docs/code-map.md` 是文件索引，来自当前文件树，不应手工修改。新增或删除源文件后会触发 `stale-map`，通过 `map --write` 重建。

`docs/architecture.md`、`docs/development.md`、`docs/domains/`、`docs/decisions/`、`docs/plans/` 和 `agentrepo.json` 显式声明的文档接受链接检查。不会把已有网站文档中的 `/commands/...` 路由当作本地路径检查。

源码变更可以让相关语义文档进入复审状态：

```sh
node .agentrepo/cli.mjs docs check --base <base-commit>
node .agentrepo/cli.mjs docs review --base <base-commit> --id architecture --reason "Reviewed the changed API; documented contracts remain unchanged."
```

复审凭据绑定 Git base、受影响文件内容和文档内容。受影响代码继续修改后，旧复审凭据会失效。文档发生真实修改时，CI 仍需要代码审查人员确认语义准确性。此机制不可能仅靠程序证明自然语言文档和业务含义完全一致。

## Eval 必须保留在仓库

初始化后的每个项目都有 `eval/`：

- `regressions.json` 包含允许列表内、只读的 CLI 回归检查。
- `scenarios.json` 包含隔离目录里的失败场景及预期结果。可以添加新的确定性场景，不能执行任意 Shell 命令。
- `incidents.json` 记录已经发生过的真实缺陷、原因和对应的防回归测试。
- `tasks.json` 留给真实 Coding Agent 任务，必须明确起始提交、任务描述、独立验收方式和执行预算。

用于更新和统计 Eval 的命令：

```sh
node .agentrepo/cli.mjs eval run --json
node .agentrepo/cli.mjs eval scenarios --json
node .agentrepo/cli.mjs eval dream --json
node .agentrepo/cli.mjs eval audit --json
node .agentrepo/cli.mjs eval add-failure --id missing-config --argv '["doctor"]' --exit 1
node .agentrepo/cli.mjs eval report --input eval/trials.json
```

`eval dream` 是确定性环境里的错误实现、测试失败、修复、重新验证、文档更新和状态交接模拟，不调用模型。`eval audit` 运行有已知真实标签的故障注入测试，计算诊断准确率、精确率、召回率。它们都不能替代真实 Coding Agent 编程任务评测。

`eval report` 要求同一 `taskId`、重复编号、模型、任务版本和环境成对比较。没有模型提供的真实输入输出 Token 用量，就不会返回 Token 减少率。**不要将字节量代理指标宣称为 Token 减少率。**

## 真实仓库基准

本次用了 noVNC 1.5.0、nvm 0.40.3、npm CLI 10.9.2 的本地源码快照，并记录源文件 SHA256、文件数量和每道定位任务的排名。评估脚本与固定题集在 `benchmarks/`，结果在 `reports/`。第三方源码快照没有包含在此软件包中，遵守各自项目的授权和发布方式。

```sh
node benchmarks/run.mjs --projects-dir /path/to/source-snapshots --output reports/bench-local.json
```

目录需要包含 `novnc/`、`nvm/`、`npm/` 三个子目录。脚本会复制源码到临时目录后初始化，每次验证原始文件未被修改。在本轮固定 30 道源码定位任务中，增强版 Top 1 为 26/30，Top 3 为 30/30，独立保留的 12 道测试题 Top 3 为 12/12。固定任务数量较少，不可外推为实际开发成功率。

## 对人类友好的边界

`init` 使用创建缺失文件的策略，保留已有 `README.md`、`AGENTS.md`、业务代码和测试。对于已经存在的仓库，会给出需要人工合并的警告。默认不运行安装命令、不启动应用、不修改生产系统、不需要 API 密钥。

## v0.6 的自动化与真实仓库验证

新增的 HTML 生成器完成了 42 项 Node.js 测试，并在本地三个真实源码快照中进行了隔离初始化、重复初始化、文档检查、doctor 和架构 HTML 新鲜度检查，结果见 `reports/ROUND6.zh-CN.md`。

这些是脚手架可靠性测试，**不是 Coding Agent 任务完成率或 Token 节省实测**。浏览器静态脚本通过语法及嵌入图数据检查；当前无头 Chromium 未能成功生成截图，因此不宣称完成视觉截图验收。

## 尚未完成的验证

1. 尚未通过真实 Codex、Claude Code 或 OpenCode 在同一任务上进行配对 A/B 实验；因此没有真实 Agent 任务完成率和 Token 减少率。
2. 当前测试环境无法连接 npm Registry，未能下载并运行 dependency-cruiser 的真实二进制；已验证配置、接线、错误传播及缺失时的严格失败逻辑。
3. 跨语言依赖检查尚需为 Go、Python、Rust 等接入其各自的静态分析器。
4. 大型单仓库的模块定位索引仍是轻量词法排序，不是语义检索引擎。

许可：MIT。第三方项目的版权归其原作者所有。

## GitHub 工程规范与已有仓库优先级

`agentrepo github check` 返回已有 Workflow、Issue、PR 和 Changelog 的实际路径。识别 `.github/`、仓库根目录、`docs/` 等 PR 模板位置以及 `HISTORY.md` 等历史文件。已有项目默认不增加新的 CI Workflow，显式传 `init --github-workflow` 才可在没有现有 Workflow 的情况下创建。CI、项目规则和许可证不自动替换。
