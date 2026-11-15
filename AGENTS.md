# Agent instructions for this repository

## Purpose

This repository contains AgentRepo Kit itself, a Node.js CLI that generates agent-friendly scaffolds in other repositories. Do not confuse this document with the `AGENTS.md` produced in an initialized target project.

## Read before editing

- `README.md` describes user-facing behavior and supported commands.
- `docs/ARCHITECTURE.zh-CN.md` explains the current implementation.
- `docs/EVAL.zh-CN.md` defines the evaluation contract.
- `reports/ROUND6.zh-CN.md` documents the last recorded validation and outstanding gaps.

## Commands

- `npm test`: Node.js unit and integration tests.
- `npm run eval:smoke`: isolated scenario, deterministic dream, and audit checks.
- `npm run check`: CLI syntax plus tests.
- `npm pack --dry-run`: verify npm package file selection.

## Working rules

1. When adopting projects, respect existing GitHub workflows, templates and changelogs before adding fallbacks.
2. Preserve compatibility with Node.js 20 and the existing CLI command names.
2. Initializing an existing repository must not overwrite user-managed files.
3. Never invent dependency edges or treat a skipped check as passed.
4. Never report model token savings without actual paired model usage records.
5. When fixing a bug, add a failing regression first; then fix and rerun tests.
6. Keep the root README concise. Put detailed instructions in `docs/`.
7. Do not add new third-party runtime dependencies without a specific demonstrated benefit.
8. Do not embed credentials or make destructive changes to target projects.

## Completion checklist

Run the relevant tests and Eval. Report the exact checks that ran, any skipped checks, and limitations. Update architecture docs when behavior changes and add a durable failure case for repeated errors.
