#!/usr/bin/env bash
# pre-session-stop.sh
# Runs before the Claude session ends. Non-blocking — outputs reminders only.
# Always exits 0 (never blocks session from ending).

set -euo pipefail

REMINDERS=0

remind() {
  echo "REMINDER: $1"
  REMINDERS=$((REMINDERS + 1))
}

# ────────────────────────────────────────────────────────────
# Check stale state files and remind if needed
# ────────────────────────────────────────────────────────────
if [ -f ".claude/state/openapi.stale" ]; then
  remind "openapi.json is stale. Run 'make gen-docs' before next git push."
fi

if [ -f ".claude/state/migration.stale" ]; then
  remind "Alembic migration is stale. Run 'alembic revision --autogenerate' before next push."
fi

if [ -f ".claude/state/schema-unconfirmed" ]; then
  remind "Database schema changes are unconfirmed. Run /db-design <feature> and confirm with user."
fi

if [ -f ".claude/state/dart-client.stale" ]; then
  remind "Dart API client is stale. Run 'make gen-client' to regenerate."
fi

# ────────────────────────────────────────────────────────────
# Check uncommitted changes
# ────────────────────────────────────────────────────────────
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -gt 0 ]; then
  remind "There are ${UNCOMMITTED} uncommitted change(s). Consider committing before ending the session."
  git status --short 2>/dev/null | head -10
fi

# ────────────────────────────────────────────────────────────
# Check TASK_LIST for in-progress tasks
# ────────────────────────────────────────────────────────────
INPROGRESS_TASKS=$(find docs/internal -name "TASK_LIST_*.md" -exec grep -l "☐" {} \; 2>/dev/null | head -3)
if [ -n "$INPROGRESS_TASKS" ]; then
  remind "There are unfinished tasks in TASK_LIST:"
  echo "$INPROGRESS_TASKS" | while read -r f; do
    COUNT=$(grep -c "☐" "$f" 2>/dev/null || echo 0)
    echo "  ${f}: ${COUNT} TODO task(s)"
  done
fi

if [ "$REMINDERS" -gt 0 ]; then
  echo ""
  echo "─────────────────────────────────────────────"
  echo "Session ending with ${REMINDERS} open item(s). See above."
  echo "─────────────────────────────────────────────"
fi

exit 0
