---
name: agentrepo-install
description: Safely add AgentRepo's concise AGENTS.md to a new or existing code repository. Use when a user asks to initialize an agent-friendly repository or install the AgentRepo instructions.
---

# Install AgentRepo AGENTS

Use this workflow when the user wants only the concise AgentRepo `AGENTS.md`, not the legacy multi-file scaffold.

## Quick install

From the target repository root, after this command is available on the default branch:

```sh
npx --yes github:lora-sys/agentrepo-kit agents init
```

Preview without writing:

```sh
npx --yes github:lora-sys/agentrepo-kit agents init --dry-run
```

The GitHub package requires Node.js 20+ and network access. From an existing AgentRepo checkout, use `node bin/agentrepo.mjs agents init [target-path]` instead.

## Workflow

1. Confirm the target repository root. Read its existing `AGENTS.md` before making any changes.
2. If preview is useful, run `agents init --dry-run` first.
3. Run the installer only for the user-requested target. It creates only `AGENTS.md`; it never overwrites an existing file. A preserved result is not an installation failure.
4. Verify the file exists, the project name placeholder is filled, and no unrelated files changed.
5. Add project-specific facts only when confirmed from source, configuration, or maintainer guidance. Do not add maps, development documents, CI, or other templates by default.

If `AGENTS.md` already exists, preserve it and report that fact. Do not replace, merge, or rewrite it unless the user explicitly asks. Do not run the legacy `agentrepo init` command for the minimal single-file workflow.
