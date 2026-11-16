# Development

## Runtime

Node.js 20 or newer. The CLI has no third-party runtime dependencies.

## Commands

| Purpose | Command |
| --- | --- |
| Inspect | `node bin/agentrepo.mjs inspect ./example` |
| Build CLI after template edits | `npm run build:cli` |
| Test | `npm test` |
| Verify CLI and tests | `npm run check` |
| Dry run | `node bin/agentrepo.mjs init ./example --dry-run` |

Update Markdown under `templates/project/`; then run `npm run build:cli`. Add a focused test in `tests/` for behavior changes and run `npm run check`.
