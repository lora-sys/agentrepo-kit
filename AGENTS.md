# Agent instructions for AgentRepo Kit

- Product contract: `README.md`; implementation boundaries: `docs/ARCHITECTURE.zh-CN.md`.
- CLI entry: `bin/agentrepo.mjs`; tests: `tests/lean.test.mjs`.
- Preserve user-owned files and CI. Do not infer unconfirmed project commands.
- Keep the CLI standalone on Node.js 20+. No new runtime packages without approval.
- For behavior changes, add a regression test; run `npm test` and `npm run check`.
- Avoid recreating old governance features unless a concrete repository case requires them.
- Do not claim model-success or token-efficiency improvements without real paired trials.
