# Round 8: existing-repository adoption

Date: 2026-11-15. Version: 0.8.0.

## Problem

The previous `init` path preserved existing repository documents but did not actually install an agent instruction bridge or provide a traceable acceptance process. Simply adding missing files did not establish authority, detect future policy changes, or distinguish an installed scaffold from a reviewed project.

## Implementation

- Added independent, dependency-free `bin/adoption.mjs` and bundled it into the generated local CLI.
- Added `adopt scan`, `plan`, `apply`, `activate`, `verify` and `reconcile`.
- Existing repository rules always take priority; `scan` and default `plan` do not write files.
- Saved plans record original policy and config hashes; `apply` refuses stale plans and requires explicit approval.
- `activate` requires an operator decision note, appends a unique small link to existing `AGENTS.md`, and remains idempotent.
- `verify` checks original rule hashes and flags unresolved project-specific placeholders. It reports `INTEGRATION_CHECKS_PASS` only for mechanically complete integration.
- `reconcile` requires explicit approval and a reason when an original project legitimately changes.
- No additional Actions workflows are installed by default in existing repositories.

## Executed tests

- `npm run check`: **67 of 67** Node.js unit and integration tests passed.
- `npm run eval:smoke`: **10 of 10** isolated scenarios, **11 of 11** deterministic lifecycle steps; known-fault diagnostic fixtures have 7 TP, 7 TN, 0 FP, 0 FN. These are **not** model task accuracy measurements.
- `npm pack` plus offline installation of the tarball and `agentrepo version`: successful.
- Real prior AgentRepo Kit GitHub-ready source archive: **53 original files** scanned, **19** missing files installed, **0 original files** changed during `apply`. During explicit `activate`, only `AGENTS.md` changed and the complete original content remained at the start. Verification correctly remained `REVIEW_REQUIRED` with three unresolved fields.

## Fixed failures and permanent regression cases

- A symlink guard test initially collided with an existing `docs` directory. The fixture was corrected to target an unused nested directory; protection is now exercised.
- Existing tests had hardcoded prior corpus sizes. Updated the expected regression count to 6 and scenario count to 10, so additions remain visible in test reviews.
- Recorded previous governance mistakes and policy-change detection in generated incident records `AR-014` and `AR-015`.

## Limits

- No model-based autonomous coding trial or paired token measurement has been run. Token reduction and Coding Agent completion accuracy remain unknown.
- Successful integration checks cannot establish semantic compatibility. Repository owner review and real project tests are required.
- `--approve` requires an explicit command-line flag but is not authentication of the human operator. GitHub permissions and PR reviews remain the control boundary.
- The actual OpenScience repository has not been modified or adopted in this round.
