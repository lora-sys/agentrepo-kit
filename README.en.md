# AgentRepo Kit

A Node.js CLI that adds agent instructions, architecture visualization, verification commands, and replayable evals to repositories. New projects receive a complete template; existing projects retain their own rules.

Requires Node.js 20+. Current version: v0.9.0. MIT license. No third-party runtime dependencies. Not published to the npm Registry.

[中文说明](README.md) · [Usage](docs/USAGE.zh-CN.md) · [Adoption](docs/ADOPTION.zh-CN.md) · [Architecture](docs/ARCHITECTURE.zh-CN.md) · [Evals](docs/EVAL.zh-CN.md)

## Initialize

From a source checkout:

```sh
npm install --offline --ignore-scripts
npm link
agentrepo init ../my-project --dry-run
agentrepo init ../my-project
cd ../my-project
node .agentrepo/cli.mjs doctor
node .agentrepo/cli.mjs verify
```

Generated files include `AGENTS.md`, `docs/architecture.md`, `docs/architecture.html`, `docs/code-map.md`, `docs/development.md`, `eval/`, and `.agentrepo/cli.mjs`. Unknown project facts use `{{REQUIRES_REVIEW:...}}` placeholders.

## Adopt an existing repository

```sh
agentrepo adopt scan
agentrepo adopt plan --write
agentrepo adopt apply --approve
agentrepo adopt activate --approve --reason "Reviewed existing rules"
agentrepo adopt verify
```

`init` adds missing files. `adopt` checks existing rules, installs the integration entry point after approval, and detects later changes. See the [adoption guide](docs/ADOPTION.zh-CN.md).

## Architecture checks

JavaScript and TypeScript projects can install [dependency-cruiser](https://github.com/sverweij/dependency-cruiser):

```sh
npm install --save-dev dependency-cruiser
node .agentrepo/cli.mjs arch init
node .agentrepo/cli.mjs arch check --strict
node .agentrepo/cli.mjs arch view --write
```

Dependency edges in the generated HTML come from analyzer output. Missing checks are reported as `SKIP`.

## Tests and evals

```sh
npm test
npm run eval:smoke
npm run check
npm pack --dry-run
```

Deterministic evals cover CLI behavior. Autonomous task success and Token savings require paired agent runs with measured usage.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md) · [License](LICENSE)
