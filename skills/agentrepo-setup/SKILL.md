---
name: agentrepo-setup
description: Take over a new or existing code repository for agent-assisted development. Use to orient an agent in a repository, add a concise AGENTS.md from the included template, and select optional templates only when the project needs them.
---

# AgentRepo setup

Use this Skill to make a repository understandable and workable for coding agents without turning it into a governance system. “Take over” means taking responsibility for understanding the repository and carrying out the requested development task; it does not authorize unrelated rewrites or operational changes.

## Workflow

1. Read the user's task and the repository's existing `AGENTS.md`, `README.md`, and relevant project configuration. Follow repository-specific instructions first.
2. Inspect only the code, tests, and configuration relevant to the task. Identify actual entry points and commands from source and project files; do not invent project facts.
3. If `AGENTS.md` is missing and repository guidance is useful, create it from `templates/project/AGENTS.md`. Fill only verified details. If an `AGENTS.md` already exists, preserve it unless the user asks to revise it.
4. Use files under `templates/project/` only when a concrete need exists or the user asks for them. Do not scaffold every template by default. In particular, architecture and development documents are optional; do not create them just to document an ordinary repository.
5. Make the smallest task-relevant change. Reuse the repository's existing scripts, package manager, tests, and lint commands. Do not add a second command system or new CI for convenience.
6. Run the smallest relevant existing check. Report changed files, the exact commands actually run, their outcomes, and any important unknowns.

## Repository boundaries

- Preserve existing project rules, documentation, CI, and public interfaces unless the task calls for a change.
- Do not claim an unrun command passed. If no suitable check exists, say so instead of inventing one.
- Do not read, print, or commit real secrets or production data.
- Ask before destructive changes, production or release actions, or other high-impact work outside the user's explicit request.
- Put stable, project-specific guidance in `AGENTS.md` only when it is verified and useful for future tasks. Keep task plans and temporary findings out of permanent repository policy.

## Optional capabilities

- Browse `templates/README.md` for the template catalog and selection guidance.
- Use `skills/agentrepo-github/SKILL.md` only when GitHub collaboration templates are requested.
- The AgentRepo CLI is optional. This Skill does not require it, and a repository does not need `.agentrepo/`, `agentrepo.json`, generated maps, verification ledgers, or new workflows to be agent-friendly.
