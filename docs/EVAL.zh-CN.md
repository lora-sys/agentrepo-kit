# Eval 与故障回归

## 评估类型

| 类型 | 验证内容 |
| --- | --- |
| 确定性 Eval | 初始化、文件保护、文档漂移、错误传播和架构图数据 |
| Agent 任务 Eval | 固定模型、任务起点与预算，独立验收代码修改 |

真实 Agent 对照实验应记录任务、起始提交、模型、预算、验收结果和输入输出 Token。确定性测试不计入 Agent 开发成功率。

## 运行

```sh
npm test
npm run eval:smoke
npm run check
```

使用 noVNC、nvm 和 npm CLI 的合法源码快照进行定位测试：

```sh
node benchmarks/run.mjs --projects-dir /path/to/source-snapshots --output reports/bench-local.json
```

保存源码版本、来源、SHA256 和任务标签。第三方源码不包含在本项目发布包中。

## 把错误加入永久 Eval

1. 记录故障编号、现象及最小复现步骤。
2. 添加回归测试，并确认它在修复前失败。
3. 修复代码，重新运行相关测试和回归集。
4. 记录根因、测试文件与修复版本。

项目级故障写入 `eval/incidents.json`；脚手架自身的回归保存在 `tests/` 与 `reports/`。

## 指标

| 指标 | 计算规则 |
| --- | --- |
| Top 1 / Top 3 | 正确路径是否进入前 1 / 3 个检索结果 |
| 任务成功率 | 通过预设独立验收的任务比例 |
| 准确率 | 按标注标签计算，需注明评估对象 |
| Token 减少率 | `1 - 优化组 Token / 基线组 Token`，只统计有效配对 |
| SKIP | 缺失环境或配置时单独计数，不计为通过 |

`eval dream` 是无大模型参与的确定性流程模拟测试。
