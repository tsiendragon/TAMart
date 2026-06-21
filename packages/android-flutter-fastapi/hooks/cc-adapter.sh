#!/usr/bin/env bash
# cc-adapter.sh — Claude Code hook adapter for the tam validate scripts.
# Bridges two ABI differences:
#   1) Claude Code passes tool input as JSON on stdin (not env/args)
#      → extract tool_input.file_path / tool_input.command, re-expose as the
#        env vars the tam scripts expect (TAMART_FILE_PATH / TAMART_SHELL_COMMAND).
#   2) tam scripts use "exit 1 = block"; Claude Code uses "exit 2 = block"
#      → remap any nonzero exit to 2 so violations actually block the tool call.
# Usage (from hooks.json):  cc-adapter.sh <file|shell> <script-name>
set -uo pipefail

MODE="${1:-file}"
SCRIPT="${2:-}"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
INPUT="$(cat 2>/dev/null || true)"

field() {  # $1 = key under tool_input
  printf '%s' "$INPUT" | python3 -c "import sys,json
d=json.load(sys.stdin)
print((d.get('tool_input') or {}).get('$1','') or '')" 2>/dev/null || true
}

# tam scripts write state to .claude/state in the project dir; run there.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || true

rc=0
case "$MODE" in
  file)
    FP="$(field file_path)"
    [ -z "$FP" ] && exit 0
    TAMART_FILE_PATH="$FP" bash "$PLUGIN_ROOT/scripts/$SCRIPT" "$FP" || rc=$?
    ;;
  shell)
    CMD="$(field command)"
    [ -z "$CMD" ] && exit 0
    TAMART_SHELL_COMMAND="$CMD" bash "$PLUGIN_ROOT/scripts/$SCRIPT" "$CMD" || rc=$?
    ;;
  *)
    exit 0
    ;;
esac

# Remap tam "block" (nonzero) → Claude Code "block" (exit 2).
[ "$rc" -ne 0 ] && exit 2
exit 0
