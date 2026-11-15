# AgentRepo Kit contributor instructions

Read `README.md` for CLI behavior, `docs/ARCHITECTURE.zh-CN.md` for implementation, `docs/ADOPTION.zh-CN.md` for existing-project precedence, and `docs/EVAL.zh-CN.md` for evaluation rules. Open only the relevant documents for each task.

## Verify

- `npm test`: unit and integration tests.
- `npm run eval:smoke`: deterministic fault and workflow cases.
- `npm run check`: CLI syntax and tests.
- `npm pack --dry-run`: package contents.

## Rules

1. Existing project policies override generated defaults. Never overwrite files or enable new CI without approval.
2. Preserve Node.js 20 support and existing CLI commands.
3. Do not invent dependency edges, test results or Token savings. Report SKIP separately.
4. Add a failing regression for each confirmed bug before fixing it.
5. Keep project instructions concise; put task-specific detail in `docs/`.
6. Do not commit credentials, alter production systems or add runtime dependencies without review.

Run relevant checks before submitting; record unfinished verification and update affected documentation.
