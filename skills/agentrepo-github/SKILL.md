---
name: agentrepo-github
description: Review and optionally install GitHub Issue Forms, PR templates and changelog conventions without changing existing workflows or repository policies.
---

# GitHub collaboration templates

This Skill is optional. Do not treat GitHub template installation as proof that a coding agent can understand or develop the project.

## Inspect

1. Check `.github/ISSUE_TEMPLATE/`, PR templates in root, `docs/` or `.github/`, changelogs and existing workflows.
2. Read `CONTRIBUTING.md` and `SECURITY.md` for established review, vulnerability and label policies.
3. Identify the repository's GitHub remote, if available. Do not invent contact links.
4. Plan only missing template categories. Keep existing Issue Forms as a group. Preserve all existing PR templates, changelogs and workflows.

## Apply after explicit approval

- Use `templates/github/ISSUE_TEMPLATE/` for Bug, Feature and Question forms.
- Add `broken_skill_or_integration.yml` only for repositories that actually ship skills, connectors or plugins, or if explicitly requested.
- Ensure labels referenced in YAML exist in the target repository. GitHub Forms do not create labels.
- Set `blank_issues_enabled: false` only when intended by the maintainer. Route security reports to the real private disclosure mechanism.
- Add CI Workflow only after separate approval and successful verification of its intended commands.
- Use `templates/github/pull_request_template.md` and `templates/github/CHANGELOG.md` only if no equivalent already exists.

Report created and preserved files, exact manual review items and any checks run. Do not rewrite project-owned content.
