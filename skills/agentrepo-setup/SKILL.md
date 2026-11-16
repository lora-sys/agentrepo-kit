---
name: agentrepo-setup
description: Make a new or existing repository agent-friendly using short project instructions, runnable commands, checks and optional GitHub collaboration templates. Does not require npm or AgentRepo Kit.
---

# AgentRepo setup

Work on the target repository. Do not assume global modes, other skills or the AgentRepo CLI are installed.

## Read-only inspection

1. Read existing `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and the native build/test configuration that actually exists.
2. Check `.github/ISSUE_TEMPLATE/`, PR templates in the root, `docs/` and `.github/`, existing workflows, and `CHANGELOG.md`, `HISTORY.md`, `NEWS.md`, `CHANGES.md`.
3. Identify real setup, development, test and verification commands. Execute existing verification only after reviewing whether it has side effects. Do not guess unavailable commands.
4. Present a short change plan grouped as `create`, `preserve` and `needs review`. Get approval before writing to an existing repository.

## Apply only after approval

1. Add missing project-level `AGENTS.md`, `docs/architecture.md` and `docs/development.md`. Keep instructions short and specific to this repository. Do not copy generic rules into every document.
2. If GitHub templates are requested, use files under `templates/github/` as editable examples. Preserve existing Issue Forms as a group, any existing PR template, and any changelog alias. Do not introduce a second set.
3. Replace GitHub contact links with the repository's verified URL; if there is no verified GitHub remote, omit links. Never generate fake repository URLs.
4. Never install or activate a GitHub Actions workflow by default. Require separate approval and confirm that its commands work for the target repository.
5. Check every YAML issue form has a unique `name`, valid `body`, and the intended required fields. GitHub labels must exist in the destination repository to be applied automatically.
6. Run the project's real checks. Report exact command, status and error. Use `NOT_CONFIGURED` for missing commands, never `PASS`.

## Completion

Summarize files added, preserved, explicit approvals, tests executed and open questions. Do not claim the codebase is fully understood merely because templates were created.

Optional CLI from an AgentRepo Kit checkout: `node bin/agentrepo.mjs inspect <repo>` and `node bin/agentrepo.mjs github <repo> --apply`. npm installation is not required.
