#!/usr/bin/env bash
# pre-bash-validate.sh
# Runs before git / curl / wget shell commands.
# Exit 0 = allow, exit 1 = block.

set -euo pipefail

COMMAND="${TAMART_SHELL_COMMAND:-${*}}"

if [ -z "$COMMAND" ]; then
  exit 0
fi

mkdir -p .claude/state

ERRORS=0

err() {
  echo "BLOCKED: $1"
  ERRORS=$((ERRORS + 1))
}

# ────────────────────────────────────────────────────────────
# Rule 1: Ban --no-verify (hook bypass)
# ────────────────────────────────────────────────────────────
if echo "$COMMAND" | grep -q '\-\-no-verify'; then
  err "--no-verify is not allowed. Hooks enforce mandatory project conventions."
  echo "  If you believe a rule is incorrect, file an issue with the project maintainer."
fi

# ────────────────────────────────────────────────────────────
# Rule 2: Ban force push to main or develop
# ────────────────────────────────────────────────────────────
if echo "$COMMAND" | grep -qE 'git\s+push.*--force'; then
  if echo "$COMMAND" | grep -qE '(main|develop|master)'; then
    err "Force push to main/develop is not allowed."
    echo "  Use 'git push' without --force, or open a PR to integrate changes safely."
  fi
fi

if echo "$COMMAND" | grep -qE 'git\s+push\s+-f\s+'; then
  if echo "$COMMAND" | grep -qE '(main|develop|master)'; then
    err "Force push (-f) to main/develop is not allowed."
  fi
fi

# ────────────────────────────────────────────────────────────
# Rule 3: Validate conventional commit message format
# Allowed: type(scope): description
# Types: feat fix docs test chore refactor style ci perf
# ────────────────────────────────────────────────────────────
if echo "$COMMAND" | grep -qE 'git[[:space:]]+commit'; then
  # Extract message after -m "..." or -m '...' (portable; BSD grep has no -P/lookbehind)
  MSG=$(printf '%s' "$COMMAND" | sed -nE "s/.*-m[[:space:]]+[\"']([^\"']*)[\"'].*/\1/p" | head -1)

  if [ -n "$MSG" ]; then
    CONVENTIONAL_PATTERN='^(feat|fix|docs|test|chore|refactor|style|ci|perf|revert)(\([a-zA-Z0-9_-]+\))?: .{3,}'
    if ! echo "$MSG" | grep -qE "$CONVENTIONAL_PATTERN"; then
      err "Commit message does not follow Conventional Commits format."
      echo "  Format: type(scope): description"
      echo "  Types:  feat | fix | docs | test | chore | refactor | style | ci | perf"
      echo "  Example: feat(auth): add JWT refresh token endpoint"
      echo "  Your message: '$MSG'"
    fi
  fi
fi

# ────────────────────────────────────────────────────────────
# Rule 4: Ban git push when openapi.stale exists
# ────────────────────────────────────────────────────────────
if echo "$COMMAND" | grep -qE 'git\s+push'; then
  if [ -f ".claude/state/openapi.stale" ]; then
    err "openapi.json is stale — backend schemas/routers changed since last gen-docs."
    echo "  Run 'make gen-docs' (or /gen-docs) to update docs/api/openapi.json first."
    echo "  This ensures Flutter client can be regenerated from latest API spec."
  fi
fi

# ────────────────────────────────────────────────────────────
# Rule 5: Ban git push when migration.stale exists
# ────────────────────────────────────────────────────────────
if echo "$COMMAND" | grep -qE 'git\s+push'; then
  if [ -f ".claude/state/migration.stale" ]; then
    err "Alembic migration is stale — ORM models changed without a new migration."
    echo "  Run 'alembic revision --autogenerate -m <description>' in backend/"
    echo "  Then validate: alembic upgrade head && alembic downgrade -1"
    echo "  Then clear: rm .claude/state/migration.stale"
  fi
fi

# ────────────────────────────────────────────────────────────
# Rule 6: Ban curl / wget with hardcoded tokens/secrets in URL or headers
# ────────────────────────────────────────────────────────────
if echo "$COMMAND" | grep -qE '^(curl|wget)'; then
  # Check for Bearer tokens or API keys hardcoded inline
  if echo "$COMMAND" | grep -qE '(Authorization: Bearer [A-Za-z0-9._-]{20,}|api[_-]?key=[A-Za-z0-9._-]{16,})'; then
    err "Hardcoded token/API key in curl/wget command."
    echo "  Use environment variables instead: -H \"Authorization: Bearer \$API_TOKEN\""
  fi
fi

# ────────────────────────────────────────────────────────────
# Exit
# ────────────────────────────────────────────────────────────
if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi

exit 0
