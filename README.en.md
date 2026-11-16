# AgentRepo Kit

Make a repository **legible, executable, and verifiable** for coding agents. Node.js 20+. Zero third-party runtime dependencies.

## Quick start

```sh
node bin/agentrepo.mjs inspect /path/to/project
node bin/agentrepo.mjs verify /path/to/project
node bin/agentrepo.mjs init /path/to/project --dry-run
node bin/agentrepo.mjs init /path/to/project
```

`inspect` reads existing rules and detects the native toolchain. `verify` can run detected native tests even before initialization. `init` installs only missing files, never overwrites project-owned instructions or CI, and never runs setup scripts.

After initialization:

```sh
cd /path/to/project
node .agentrepo/cli.mjs setup
node .agentrepo/cli.mjs dev
node .agentrepo/cli.mjs test
node .agentrepo/cli.mjs verify
```

Commands live in `agentrepo.json.commands` as arrays of argv arrays. Unknown commands stay `null`; missing verification is a failure, not a pass.

## Existing repositories

```sh
node bin/agentrepo.mjs adopt /path/to/existing-project
node bin/agentrepo.mjs adopt /path/to/existing-project --apply
```

The first command is read-only. The second adds missing files. Existing README, AGENTS, docs, workflows, source and tests remain unchanged. Review the integration note if AGENTS already exists.

## Installed files

A short `AGENTS.md`, one-page `docs/architecture.md`, `docs/development.md`, `agentrepo.json`, and a standalone `.agentrepo/cli.mjs`. README, `.env.example`, and `.gitignore` are created only as needed. No HTML diagrams, project-level evaluation framework, or new CI workflows are installed by default.

## Development

```sh
npm test
npm run check
```

See [Architecture](docs/ARCHITECTURE.zh-CN.md), [Contributing](CONTRIBUTING.md), and [MIT License](LICENSE).

The previous governance and evaluation implementation is preserved in the `archive/pre-lean-v1` branch.

## Standalone project templates

No global skills or external agent modes are required. The generated `AGENTS.md` contains the complete task workflow and verification rules. Edit `templates/project/` for scaffold source text and run `npm run build:cli` to regenerate the self-contained CLI. Project-specific rules can be added using `templates/AGENTS.project.md`.

## Optional GitHub collaboration templates

No npm installation is required. Follow [the standalone setup Skill](skills/agentrepo-setup/SKILL.md) and edit [GitHub Issue Forms and PR templates](templates/github/). Or run `node bin/agentrepo.mjs github /path/to/repo` to preview and add `--apply` to install only missing templates. CI requires separate `--workflow` approval and existing executable setup/verify commands.
