# AgentRepo Kit

**A ready-to-use repository scaffold for coding agents.**

AgentRepo Kit provides a Node.js CLI that prepares new or existing repositories for code discovery, verified project documentation, architecture visualization, execution checks, handoffs, and replayable evaluations.

It ships with written rules and clear `{{REQUIRES_REVIEW:...}}` placeholders. Derived code facts are computed; unknown business facts are not invented.

**Requirements:** Node.js 20+. Current version: `v0.7.0`. No third-party npm runtime dependencies are required by the core CLI.

[中文说明](README.md) · [Full guide](docs/USAGE.zh-CN.md) · [Architecture](docs/ARCHITECTURE.zh-CN.md) · [Eval guide](docs/EVAL.zh-CN.md)

## Quick start

From a local source checkout:

```sh
npm install --offline --ignore-scripts
npm link
agentrepo init ../my-project --dry-run
agentrepo init ../my-project
cd ../my-project
node .agentrepo/cli.mjs doctor
node .agentrepo/cli.mjs docs check
node .agentrepo/cli.mjs eval run
```

For JavaScript or TypeScript repositories, optionally add `dependency-cruiser`:

```sh
node .agentrepo/cli.mjs arch init
npm install --save-dev dependency-cruiser
node .agentrepo/cli.mjs arch check --strict
node .agentrepo/cli.mjs arch view --write
```

The HTML architecture view only draws dependency edges based on verified analyzer output. Initialization preserves existing project files, including custom HTML documentation.

## Evaluation boundaries

The project includes deterministic tests, fault-injection regressions, a simulated fix-and-handoff workflow, and hooks for paired coding-agent experiments. The deterministic simulation **does not execute an LLM**. There are no verified autonomous task completion rates or model-token savings yet. Real dependency-cruiser binary integration and screenshot-based visual acceptance require further testing.

## Development

```sh
npm test
npm run eval:smoke
npm run check
npm pack --dry-run
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md).

Licensed under [MIT](LICENSE). Third-party benchmark repositories are not bundled.

## GitHub collaboration policy

Fresh repositories get complete GitHub templates. Existing repositories keep their own CI, Issue, PR and changelog conventions. Use `agentrepo github check`; workflows require explicit opt-in on adopted repositories.
