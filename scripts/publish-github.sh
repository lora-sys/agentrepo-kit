#!/usr/bin/env bash
# Run from the AgentRepo Kit source directory after authenticating `gh`.
# Creates a new public repository, pushes the initial commit, and attempts to enable template mode.
set -euo pipefail

REPO="${1:-lora-sys/agentrepo-kit}"
if [[ ! "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  echo "Usage: bash scripts/publish-github.sh [owner/repository]" >&2
  exit 2
fi

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v git >/dev/null || { echo "Git is required." >&2; exit 1; }
command -v gh >/dev/null || { echo "GitHub CLI (gh) is required: https://cli.github.com/" >&2; exit 1; }
gh auth status >/dev/null || { echo "Run: gh auth login" >&2; exit 1; }

if [[ ! -d .git ]]; then
  git init -b main
fi

# Keep commit identity private when the machine has no Git identity configured.
if [[ -z "$(git config user.name || true)" ]]; then
  git config user.name "$(gh api user --jq '.login')"
fi
if [[ -z "$(git config user.email || true)" ]]; then
  id="$(gh api user --jq '.id')"
  login="$(gh api user --jq '.login')"
  git config user.email "${id}+${login}@users.noreply.github.com"
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "Initial release: AgentRepo Kit v0.6.0"
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "Existing origin detected. Refusing to change it automatically." >&2
  exit 1
fi

if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Repository $REPO already exists. Refusing automatic push to an existing remote." >&2
  echo "Inspect it and set an origin manually if you intend to use it." >&2
  exit 1
fi

gh repo create "$REPO" --public --description "Agent-friendly repository scaffold: Node.js CLI, verified docs, architecture HTML and replayable Eval" --source . --remote origin --push

if gh api -X PATCH "repos/$REPO" -F is_template=true >/dev/null; then
  echo "Template repository enabled."
else
  echo "Push succeeded. To enable template mode: Settings > General > Template repository." >&2
fi

echo "Repository: https://github.com/$REPO"
