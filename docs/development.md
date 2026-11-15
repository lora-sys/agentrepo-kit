# Development

## Runtime

Node.js 20 or newer. The CLI has no third-party runtime dependencies.

## Commands

| Purpose | Command |
| --- | --- |
| Inspect | `node bin/agentrepo.mjs inspect ./example` |
| Test | `npm test` |
| Verify CLI and tests | `npm run check` |
| Dry run | `node bin/agentrepo.mjs init ./example --dry-run` |

When a defect is fixed, add a focused test to `tests/lean.test.mjs` and run `npm test`.
