#!/usr/bin/env bash
# post-write-validate.sh
# Runs after file write/edit. Validates code conventions, marks stale state files.
# Exit 0 = ok, exit 1 = block (file remains but agent is warned/blocked).

set -euo pipefail

FILE_PATH="${TAMART_FILE_PATH:-${1:-}}"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

mkdir -p .claude/state

ERRORS=0

err() {
  echo "VIOLATION: $1"
  ERRORS=$((ERRORS + 1))
}

warn() {
  echo "WARNING: $1"
}

# ────────────────────────────────────────────────────────────
# Python files: syntax check
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ \.py$ ]] && [ -f "$FILE_PATH" ]; then
  if ! python3 -m py_compile "$FILE_PATH" 2>/tmp/py_compile_err; then
    err "Python syntax error in $FILE_PATH:"
    cat /tmp/py_compile_err
  fi
fi

# ────────────────────────────────────────────────────────────
# FastAPI: ban @app.on_event (deprecated, use lifespan)
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ \.py$ ]] && [ -f "$FILE_PATH" ]; then
  if grep -qn '@app\.on_event' "$FILE_PATH" 2>/dev/null; then
    err "@app.on_event is deprecated. Use 'lifespan' context manager instead."
    echo "  File: $FILE_PATH"
    echo "  Example: @asynccontextmanager async def lifespan(app): ..."
  fi
fi

# ────────────────────────────────────────────────────────────
# FastAPI: ban Pydantic v1 orm_mode
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ \.py$ ]] && [ -f "$FILE_PATH" ]; then
  if grep -qn 'orm_mode\s*=\s*True' "$FILE_PATH" 2>/dev/null; then
    err "Pydantic v1 orm_mode detected. Use Pydantic v2: model_config = ConfigDict(from_attributes=True)"
    echo "  File: $FILE_PATH"
  fi
fi

# ────────────────────────────────────────────────────────────
# FastAPI Router: ban ORM operations in Router layer
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ backend/app/routers/.*\.py$ ]] && [ -f "$FILE_PATH" ]; then
  if grep -qnE '\.(query|filter|commit|add|delete|execute)\(' "$FILE_PATH" 2>/dev/null; then
    err "ORM operations detected in Router layer: $FILE_PATH"
    echo "  Router must only do HTTP translation. Move DB logic to Service/Repository."
    echo "  Lines:"
    grep -nE '\.(query|filter|commit|add|delete|execute)\(' "$FILE_PATH" | head -5
  fi
fi

# ────────────────────────────────────────────────────────────
# Backend schemas or routers changed → mark openapi as stale
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ backend/app/(schemas|routers)/.*\.py$ ]]; then
  echo "$(date -Iseconds) $FILE_PATH" >> .claude/state/openapi.stale
  warn "openapi.json is now stale (schemas/routers changed)."
  warn "Run 'make gen-docs' or '/gen-docs' to regenerate openapi.json."
fi

# ────────────────────────────────────────────────────────────
# Backend models changed → mark migration as stale
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ backend/app/models/.*\.py$ ]]; then
  # Verify DATABASE.md has the table definition
  if [[ "$FILE_PATH" =~ backend/app/models/([^/]+)\.py ]]; then
    MODEL_FILE="${BASH_REMATCH[1]}"
    if [ -f "docs/design/DATABASE.md" ]; then
      if ! grep -qi "### ${MODEL_FILE}" docs/design/DATABASE.md 2>/dev/null; then
        err "Model '${MODEL_FILE}' has no corresponding table definition in DATABASE.md."
        echo "  DATABASE.md must document every ORM model."
      fi
    fi
  fi
  echo "$(date -Iseconds) $FILE_PATH" >> .claude/state/migration.stale
  warn "Alembic migration is now stale (models changed)."
  warn "Run 'alembic revision --autogenerate' to create a migration."
fi

# ────────────────────────────────────────────────────────────
# Flutter Presentation: ban direct import of repository_impl
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ frontend/lib/features/.*/presentation/.*\.dart$ ]] && [ -f "$FILE_PATH" ]; then
  if grep -qn 'import.*repository_impl' "$FILE_PATH" 2>/dev/null; then
    err "Presentation layer imports repository_impl directly."
    echo "  Presentation must access data through the Domain interface (Repository abstract class)."
    echo "  File: $FILE_PATH"
    echo "  Use Riverpod Provider to inject the repository, not a direct import."
  fi
fi

# ────────────────────────────────────────────────────────────
# Flutter: ban deprecated Permission.storage (Android 13+)
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ \.dart$ ]] && [ -f "$FILE_PATH" ]; then
  if grep -qn 'Permission\.storage' "$FILE_PATH" 2>/dev/null; then
    err "Permission.storage is deprecated on Android 13+ (API 33)."
    echo "  Use fine-grained permissions instead:"
    echo "    Permission.photos  — for images"
    echo "    Permission.videos  — for videos"
    echo "    Permission.audio   — for music/audio"
    echo "  File: $FILE_PATH"
  fi
fi

# ────────────────────────────────────────────────────────────
# Security: ban hardcoded secrets in Python files
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ \.py$ ]] && [ -f "$FILE_PATH" ]; then
  # Match: secret_key = "...", password = "...", api_key = "...", JWT_SECRET = "..."
  # Exclude: env var reads like os.getenv("..."), comments, empty strings, and encrypted values
  if grep -qniE '(secret[_-]?key|password|api[_-]?key|jwt[_-]?secret)\s*=\s*"[^"${}]{4,}"' "$FILE_PATH" 2>/dev/null; then
    # Check it's not reading from env (os.getenv, os.environ)
    if ! grep -qiE '(os\.getenv|os\.environ|getenv)\(' "$FILE_PATH" 2>/dev/null; then
      MATCH=$(grep -niE '(secret[_-]?key|password|api[_-]?key|jwt[_-]?secret)\s*=\s*"[^"${}]{4,}"' "$FILE_PATH" | head -3)
      if [ -n "$MATCH" ]; then
        err "Hardcoded secret detected in $FILE_PATH:"
        echo "$MATCH"
        echo "  Use environment variables: import os; SECRET = os.getenv('SECRET_KEY')"
      fi
    fi
  fi
fi

# ────────────────────────────────────────────────────────────
# Flutter: mark dart-client stale when generated client files change
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ frontend/lib/core/api_client/generated/ ]]; then
  warn "Generated API client was modified directly. It will be overwritten by 'make gen-client'."
  warn "Modify the Pydantic schemas in backend instead, then run 'make gen-docs && make gen-client'."
fi

# ────────────────────────────────────────────────────────────
# Exit
# ────────────────────────────────────────────────────────────
if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Found ${ERRORS} violation(s). Fix them before proceeding."
  exit 1
fi

exit 0
