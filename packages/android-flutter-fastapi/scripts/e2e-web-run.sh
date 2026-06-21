#!/usr/bin/env bash
# e2e-web-run.sh
# L2 — Web e2e: build Flutter web (semantics-enabled test entry) + drive with Playwright.
# Usage: bash scripts/e2e-web-run.sh <feature> [--update-snapshots]
#
# Prereqs (the runner checks and reports):
#   - flutter, python3 (web server), node/npx with @playwright/test installed
#   - backend reachable at $E2E_BASE_URL (start it first or use docker mode of e2e-backend-run.sh)
#
# Flutter web renders to <canvas>; Playwright must target the SEMANTICS tree.
# lib/main_e2e.dart forces semantics on (SemanticsBinding.instance.ensureSemantics()).

set -euo pipefail

FEATURE="${1:-}"
UPDATE_SNAPSHOTS=""
[ "${2:-}" = "--update-snapshots" ] && UPDATE_SNAPSHOTS="--update-snapshots"

FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
WEB_PORT="${WEB_PORT:-8080}"
BUILD_DIR="${FRONTEND_DIR}/build/web"
export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:8000}"
export E2E_WEB_URL="http://localhost:${WEB_PORT}"

if [ -z "$FEATURE" ]; then
  echo "ERROR: feature name required. Usage: e2e-web-run.sh <feature> [--update-snapshots]" >&2
  exit 2
fi

for tool in flutter python3 npx; do
  command -v "$tool" &>/dev/null || { echo "ERROR: '$tool' not found in PATH." >&2; exit 1; }
done

if [ ! -f "${FRONTEND_DIR}/lib/main_e2e.dart" ]; then
  echo "ERROR: ${FRONTEND_DIR}/lib/main_e2e.dart missing." >&2
  echo "  Create the semantics-enabled e2e entry point (see spec 07 §3.2)." >&2
  exit 1
fi

if [ ! -f "playwright.config.ts" ]; then
  echo "WARNING: playwright.config.ts missing — 视觉基线不会落到 e2e/baselines/。" >&2
  echo "  一次性安装：cp 模板 templates/playwright.config.ts.template → playwright.config.ts；" >&2
  echo "             并 npm i -D @playwright/test && npx playwright install --with-deps chromium" >&2
fi

echo "▶ L2 web e2e — feature=$FEATURE  backend=$E2E_BASE_URL"

# 1. build web with the e2e entry point
echo "▶ Building Flutter web (target=lib/main_e2e.dart)..."
( cd "$FRONTEND_DIR" && flutter build web --target=lib/main_e2e.dart --profile \
    --dart-define=E2E_BASE_URL="$E2E_BASE_URL" )

# 2. serve the build
echo "▶ Serving $BUILD_DIR on :$WEB_PORT ..."
python3 -m http.server "$WEB_PORT" --directory "$BUILD_DIR" >/tmp/e2e-web-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
for i in $(seq 1 15); do
  curl -sf "$E2E_WEB_URL" >/dev/null 2>&1 && break
  sleep 1
done

# 3. run Playwright regression spec for this feature
echo "▶ Running Playwright spec: e2e/playwright/${FEATURE}.spec.ts"
RESULT=0
npx playwright test "e2e/playwright/${FEATURE}.spec.ts" $UPDATE_SNAPSHOTS 2>&1 \
  | tee /tmp/e2e-web-"$FEATURE".log || RESULT=$?

echo "▶ Playwright report: playwright-report/  |  baselines: e2e/baselines/${FEATURE}/"
exit $RESULT
