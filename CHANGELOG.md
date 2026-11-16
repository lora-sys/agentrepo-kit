# Changelog

## Unreleased

## 1.0.0-rc.2

### Changed

- Project AGENTS is self-contained; no external Agent framework or global Skill is required.
- All generated scaffold text has editable source templates under `templates/project/`.
- The standalone CLI embeds the project templates at build time; original project files remain untouched.

### Changed

- Default CLI rebuilt around legible, executable and verifiable repositories.
- Removed HTML, project Eval, GitHub templates and five-step adoption from normal onboarding.
- Added read-only inspection, native command discovery and non-destructive two-step adoption.

### Compatibility

- This is a new CLI contract. Previous governance commands and evaluations remain accessible in the `archive/pre-lean-v1` Git branch.
