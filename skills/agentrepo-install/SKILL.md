---
name: agentrepo-install
description: Install AgentRepo's concise AGENTS.md and optionally manage read-only upstream template update checks. Use when a user asks to bootstrap an agent-friendly repository, review template drift, or set up recurring update alerts.
---

# Install and maintain AgentRepo AGENTS

Use the minimal workflow by default. Do not install the legacy multi-file scaffold or recurring automation unless requested.

## Quick install

From the target repository root, after the command is available on the default branch:

```sh
npx --yes github:lora-sys/agentrepo-kit agents init
```

Preview without writing:

```sh
npx --yes github:lora-sys/agentrepo-kit agents init --dry-run
```

Requires Node.js 20+ and network access. From an AgentRepo checkout, use `node bin/agentrepo.mjs agents init [target-path]`.

## Install workflow

1. Confirm the target repository root and read its existing `AGENTS.md` before changing anything.
2. Use `--dry-run` when preview is useful.
3. Run the installer only for the requested target. It creates only a missing `AGENTS.md`; it never overwrites an existing file.
4. Verify the project name is filled and no unrelated files changed.
5. Add project facts only when confirmed from source, configuration, or maintainer guidance. Do not add maps, development documents, CI, or other templates by default.

If `AGENTS.md` exists, preserve it and report that fact. Do not replace, merge, or rewrite it unless the user explicitly asks.

## Optional upstream update alert

When the user asks for recurring checks, copy `templates/agentrepo-template-update-check.yml` to `.github/workflows/agentrepo-template-update-check.yml`. It runs weekly on Monday and supports manual dispatch; the cron can be changed to the requested cadence.

Before enabling it, compare the repository's `AGENTS.md` with the upstream template version it came from. Set `BASE_TEMPLATE_SHA` in the workflow to that 40-character source commit. If the baseline is unknown or the file is customized, explain that the check tracks upstream template changes—not the meaning or completeness of the local file—and ask the user to confirm a baseline. Never silently treat customized content as an exact upstream copy.

For a reviewed copy of the latest template, retrieve the current source commit with:

```sh
curl -fsSL 'https://api.github.com/repos/lora-sys/agentrepo-kit/commits?path=templates%2Fproject%2FAGENTS.md&per_page=1' | jq -r '.[0].sha'
```

The workflow uses public GitHub API/raw URLs with no repository token permissions. It compares the pinned and latest upstream template contents, then reports a diff when they differ. It does not read, modify, commit, or open a PR in the target repository. A failing check is an update notice, not an automatic sync. After an alert, review the upstream diff and propose a safe change; preserve project-specific instructions and obtain authorization before applying changes.

Do not enable this workflow by default. Do not add write permissions or automatic file updates unless the user separately requests and approves that behavior.
