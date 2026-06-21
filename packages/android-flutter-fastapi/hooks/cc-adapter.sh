#!/usr/bin/env bash
# cc-adapter.sh — Claude Code hook adapter for the tam validate scripts.
# Bridges three gaps between Claude Code's hook ABI and the tam scripts:
#   1) PROJECT GATE — the plugin is installed at user scope (global), so without
#      a gate its hooks would fire in EVERY repo. Only act in Flutter+FastAPI
#      projects (same heuristic as session-start-rules.sh) so unrelated repos
#      (and their commit conventions / pushes) are never affected.
#   2) Claude Code passes tool input as JSON on stdin → extract
#      tool_input.file_path / tool_input.command → re-expose as the env vars the
#      tam scripts expect (TAMART_FILE_PATH / TAMART_SHELL_COMMAND).
#   3) tam scripts use "exit 1 = block"; Claude Code uses "exit 2 = block"
#      → remap nonzero → 2 (file/shell modes only; never for stop).
# Usage:  cc-adapter.sh <file|shell|stop> <script-name>
set -uo pipefail

MODE="${1:-file}"
SCRIPT="${2:-}"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PROJ="${CLAUDE_PROJECT_DIR:-$PWD}"

# 1) Project gate — no-op outside Flutter+FastAPI repos.
if [ ! -f "$PROJ/frontend/pubspec.yaml" ] || [ ! -d "$PROJ/backend/app" ]; then
  exit 0
fi

cd "$PROJ" 2>/dev/null || true

field() {  # $1 = key under tool_input; reads JSON from $INPUT
  printf '%s' "$INPUT" | python3 -c "import sys,json
d=json.load(sys.stdin)
print((d.get('tool_input') or {}).get('$1','') or '')" 2>/dev/null || true
}

rc=0
case "$MODE" in
  file)
    INPUT="$(cat 2>/dev/null || true)"
    FP="$(field file_path)"
    [ -z "$FP" ] && exit 0
    TAMART_FILE_PATH="$FP" bash "$PLUGIN_ROOT/scripts/$SCRIPT" "$FP" || rc=$?
    [ "$rc" -ne 0 ] && exit 2   # tam block → CC block
    ;;
  shell)
    INPUT="$(cat 2>/dev/null || true)"
    CMD="$(field command)"
    [ -z "$CMD" ] && exit 0
    TAMART_SHELL_COMMAND="$CMD" bash "$PLUGIN_ROOT/scripts/$SCRIPT" "$CMD" || rc=$?
    [ "$rc" -ne 0 ] && exit 2   # tam block → CC block
    ;;
  stop)
    # Non-blocking reminders; never remap to a blocking exit.
    bash "$PLUGIN_ROOT/scripts/${SCRIPT:-pre-session-stop.sh}" 2>&1 || true
    exit 0
    ;;
esac

exit 0
