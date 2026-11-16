# AgentRepo Kit

An **agent repository takeover Skill** with a small library of optional templates. The goal is not to install a governance system in every project. It is to help an agent understand a repository, work with its existing conventions, and verify the change it actually made.

## Default workflow

Start with [`skills/agentrepo-setup/SKILL.md`](skills/agentrepo-setup/SKILL.md) when an agent needs to take over a new or existing repository.

Use [`templates/project/AGENTS.md`](templates/project/AGENTS.md) only when a useful agent entry point is missing. Select any other file from [`templates/`](templates/README.md) only when the repository has a concrete need. Preserve existing rules, docs, commands, and CI rather than filling out a checklist.

The Skill does not require the AgentRepo CLI. It does not require a generated code map, verification ledger, new CI, or a second command system. Agents should use the project's existing development and test commands.

## One-command AGENTS.md install

After this change is merged, run this from the target repository root (Node.js 20+ and network access required):

```sh
npx --yes github:lora-sys/agentrepo-kit agents init
```

Add `--dry-run` to preview. The command creates only `AGENTS.md` and preserves an existing file. The npm package is not published yet, so npx installs directly from GitHub. See the [`agentrepo-install` Skill](skills/agentrepo-install/SKILL.md) for the full workflow.

## Templates

The template library includes optional project README, architecture and development docs, environment examples, `.gitignore`, and GitHub collaboration templates. They are resources, not a default installation bundle. See [`templates/README.md`](templates/README.md) for selection guidance.

## Optional CLI

The repository retains the AgentRepo CLI for users who need automated inspection, adoption previews, command execution, code maps, or GitHub template previews. The CLI is not required by the Skill.

```sh
node bin/agentrepo.mjs agents init /path/to/project
node bin/agentrepo.mjs inspect /path/to/project
node bin/agentrepo.mjs adopt /path/to/project
node bin/agentrepo.mjs adopt /path/to/project --apply
node bin/agentrepo.mjs --help
```

`agents init` installs only `AGENTS.md`. The historical `init` / `adopt --apply` scaffold may still create several helper files.

## Development

```sh
npm test
npm run check
```

After editing the Skill, templates, or CLI, run the relevant checks. Template source files live in `templates/`; `npm run build:cli` and `npm run check` manage the CLI bundle and its consistency check.

See [Architecture](docs/ARCHITECTURE.zh-CN.md), [Contributing](CONTRIBUTING.md), and [MIT License](LICENSE).
