---
name: agentrepo-setup
description: Make a new or existing repository legible, executable and verifiable using real source evidence and runnable project checks. Independent of npm, AgentRepo CLI and other skills.
---

# AgentRepo setup

Work in the target repository. Preserve existing project rules. This Skill can be used without the AgentRepo CLI or any global agent framework.

## Inspect first

1. Read the existing `AGENTS.md`, `README.md`, package/build configuration and relevant tests. Follow original project constraints.
2. Locate actual code entrypoints and related tests using source search. For each finding record a file path and line number. Confirm behavior in code before labeling an entrypoint.
3. Trace observable imports and callers. Distinguish static import evidence from runtime calls and inferred architecture; leave unverified responsibilities explicitly unconfirmed.
4. Read setup, dev, test and verify commands from the native project configuration. Classify each as `NOT_CONFIGURED`, `DETECTED_UNVERIFIED`, `PASS`, or `FAIL`. Review side effects before executing setup or dev commands.
5. For an existing repository, show which files need creation, which must be preserved, and which facts require maintainer review. Get approval before writing.

## Apply after approval

- Keep the existing `AGENTS.md` unchanged. If missing, write one short agent entry with context paths, task scope and actual verification commands.
- Populate `docs/architecture.md` with source-backed entrypoints, module paths, test references and evidence. Do not invent contracts, import edges or project goals.
- Populate `docs/development.md` with runnable commands, their configuration source, executed exit codes and prerequisites. Use `NOT_CONFIGURED` for missing commands.
- Reuse existing build scripts, lint and CI. Do not add a duplicate command system or an unapproved workflow.
- Run the smallest relevant real verification command. When the generated development document is present, explicitly run `node .agentrepo/cli.mjs verify --record` to record an actual result. If no command exists, report the gap rather than claiming the project is ready.

## Acceptance

Try one real, small repository task: find code, confirm impact scope, update a test or behavior and run the relevant check. Report the touched files, exact commands, exit status and remaining unknowns. Template creation alone is not acceptance.

GitHub community templates are an optional separate workflow. Use `skills/agentrepo-github/SKILL.md` only when requested.
