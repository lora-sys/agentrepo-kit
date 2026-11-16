## Unreleased

- Add evidence-backed exported-symbol and test-reference index to generated architecture docs.
- Add optional command `--record` with code-fingerprint-based freshness status.

# Changelog

## Unreleased

### Changed

- Search source content and return file/line evidence; generate architecture entrypoint, import and test reference evidence without invented calls.
- Distinguish configured commands from executed checks in generated development docs and read-only inspection.
- Separate core repository Setup Skill from optional GitHub governance; install integration-specific Issue Forms only when applicable.

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
