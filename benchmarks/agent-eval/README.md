# Coding Agent A/B/C evaluation harness

This harness is **separate** from AgentRepo Kit's deterministic CLI Eval.

## Trial arms

| Arm | Initialization |
| --- | --- |
| `baseline` | Original pinned repository |
| `minimal` | Original repository plus `agentrepo init --minimal` |
| `full` | Original repository plus `agentrepo init` |

Every trial extracts a clean pinned Git commit into its own temporary repository, creates a new local baseline commit, runs the same task prompt, then executes a predeclared acceptance command that is **not copied into the agent workspace**.

## Prerequisites

Node.js 20+, Git, tar, and one working coding-agent CLI with authentication. Use a disposable machine or container. Git working copies provide reproducibility but are **not** an OS security sandbox. Review external repositories and acceptance scripts before executing them. Agent execution may incur model charges.

The built-in Codex adapter invokes `codex exec --ephemeral --json --sandbox workspace-write --ignore-user-config --model ...`. It records `turn.completed.usage` from Codex JSONL. A `json-bridge` adapter can run other installed agents that emit a JSON summary containing `usage.inputTokens` and `usage.outputTokens`. Only use verified CLI adapters; do not claim other agents are integrated merely because a command string can be supplied.

## Prepare a real manifest

Copy `manifest.example.json` outside the workspace, fill in full 40-character Git SHAs for every locally checked-out repository, then replace all nine task prompts and add independent acceptance scripts. Pin each oracle using SHA256 in `acceptance.oracleSha256` (`sha256sum private-oracles/<task>.mjs`). **Keep hidden expected patches and acceptance fixtures outside the agent workspace.** The example contains 9 task slots and will be rejected until verified source SHAs, task prompts, and oracle hashes are supplied.

Run the same model, version, permissions, timeout, prompt, and accepted task budget in every arm. Keep credentials out of the repository and result archives. Changes to test prompts, source SHAs, or acceptance fixtures require a new benchmark ID and cannot be mixed with an existing run.

```sh
node benchmarks/agent-eval/cli.mjs doctor --manifest /path/to/real.json
node benchmarks/agent-eval/cli.mjs plan --manifest /path/to/real.json
node benchmarks/agent-eval/cli.mjs run --manifest /path/to/real.json --out reports/agent-eval-local --task task-1 --arm minimal --repeat 1 --execute --allow-paid
node benchmarks/agent-eval/cli.mjs report --out reports/agent-eval-local
```

Run the full 81-trial matrix only after inspecting the plan and costs. Set `--all --execute --allow-paid` to explicitly run every selected trial. Results are append-only per trial ID. Delete or archive an output directory and declare a new run to repeat it; do not cherry-pick retries.

## Infrastructure smoke

```sh
node benchmarks/agent-eval/cli.mjs smoke
```

`smoke` creates a temporary fixture repository and runs three fake-agent processes, one in each arm. It verifies preparation, execution, independent acceptance, and report exclusion. **This is not an Agent experiment.**

## Evidence contract

Each trial writes `trials/<task>__<arm>__<repeat>/result.json` with pinned commit, manifest hash, arm, repeat, acceptance result, timing, exit codes and provider-recorded usage when available. If no authentic usage is available, Token metrics remain null. `top3Hit` also remains null when an agent does not report three located source paths. The summary excludes synthetic runs by default.

The harness does not store raw agent logs by default to avoid leaking repository contents or secrets. Run against controlled workspaces; acceptance scripts execute real commands, so source and tests must be trusted.

## Verified upstream interface

Codex non-interactive JSONL: https://learn.chatgpt.com/docs/non-interactive-mode

Open an issue if a CLI version changes its output format; update the parser and add a fixture regression before using results.
