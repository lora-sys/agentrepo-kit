# AgentRepo Kit source-backed acceptance, 2026-11-16

## Sample and scope

- Public source repository: https://github.com/lukeed/clsx
- Fixed upstream commit: `925494cf31bcd97d3337aacd34e659e80cae7fe2`
- Source files fetched from that commit: `src/index.js` and `src/lite.js`.
- Verified upstream Git blob IDs: `src/index.js` = `c1f53ca795dd8c91c50622476143c4e232ece247`; `src/lite.js` = `c1e9364bf53ebee62da4d0f233745ac69c325379`.
- The local sandbox is a **selected-file snapshot**, not a full Git checkout. `package.json` and `test/index.js` are reduced copies retaining relevant configuration and test import relationships. Full upstream dependency installation and the original suite were not performed.
- Operator: assistant applying a defined change, **not an autonomous coding-agent A/B run**.

## Task

In this isolated copy only, change object-class handling so inherited enumerable properties do not contribute class names. Add an independent Node `node:test` regression for own versus inherited keys. This is an experimental behavior contract, **not evidence of an upstream bug report or accepted upstream change**.

## Observations

| Step | Evidence | Result |
| --- | --- | --- |
| Locate source | `node .agentrepo/cli.mjs locate 'for (y in mix)' --json` | `src/index.js:18` |
| Architecture | Generated `docs/architecture.md` | `clsx` export at `src/index.js:30`; direct tests at `test/index.js:4` and independent `test/agentrepo-inherited.test.mjs:3` |
| Baseline regression | `node --test test/agentrepo-inherited.test.mjs` | **FAIL**, expected `owned`, received `owned inherited` |
| Existing project command | `node .agentrepo/cli.mjs verify --record --json` | **FAIL**, underlying `npm run test` returned exit code **127** because `uvu` was not installed |
| Minimal source fix | `Object.prototype.hasOwnProperty.call(mix, y) && mix[y]` in `src/index.js` | One-condition change in isolated copy |
| Regression after fix | `node --test test/agentrepo-inherited.test.mjs` | **PASS**, 1 of 1 |
| Freshness after source edit | `node .agentrepo/cli.mjs doctor --json` | `STALE` |
| Explicit independent acceptance configuration | Set *sandbox-only* `agentrepo.json.commands.verify` to `node --test test/agentrepo-inherited.test.mjs` | Experimental override, not a replacement for upstream native suite |
| Independent acceptance | `node .agentrepo/cli.mjs verify --record --json` | **PASS**, exit code 0 |
| Freshness after independent acceptance | `node .agentrepo/cli.mjs doctor --json` | `RECORDED_PASS` |

## Limitations

The upstream `npm test` suite remains **unverified**, not PASS. It depends on unavailable `uvu` packages. `RECORDED_PASS` covers **only the configured independent acceptance command on the recorded source fingerprint**. This trial measures functional integration and evidence correctness, not coding-agent success rates, token reduction, or general architectural understanding.
