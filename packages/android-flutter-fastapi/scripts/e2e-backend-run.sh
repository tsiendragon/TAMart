#!/usr/bin/env bash
# e2e-backend-run.sh
# L1 — Backend full-stack e2e: start FastAPI + test DB, run end-to-end pytest flows.
# Usage: bash scripts/e2e-backend-run.sh <feature> [test|docker]
#   test   (default) — in-process TestClient + sqlite :memory: (fast, no infra)
#   docker            — real stack via docker-compose (MySQL+Redis+API), httpx flows

set -euo pipefail

FEATURE="${1:-}"
MODE="${2:-test}"
BACKEND_DIR="${BACKEND_DIR:-backend}"
E2E_DIR="${E2E_DIR:-tests/e2e}"

if [ -z "$FEATURE" ]; then
  echo "ERROR: feature name required. Usage: e2e-backend-run.sh <feature> [test|docker]" >&2
  exit 2
fi

mkdir -p .claude/state
echo "▶ L1 backend e2e — feature=$FEATURE mode=$MODE"

cd "$BACKEND_DIR"

if [ "$MODE" = "docker" ]; then
  if ! command -v docker &>/dev/null; then
    echo "ERROR: docker not found but mode=docker requested." >&2
    exit 1
  fi
  echo "▶ Starting docker-compose stack..."
  docker compose up -d
  # wait for health (max ~30s)
  for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
      echo "✅ backend healthy"; break
    fi
    sleep 1
    [ "$i" = "30" ] && { echo "ERROR: backend did not become healthy" >&2; docker compose logs --tail=50; exit 1; }
  done
  export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:8000}"
  RESULT=0
  PYTHONPATH=. pytest "${E2E_DIR}/test_${FEATURE}_e2e.py" -v 2>&1 | tee /tmp/e2e-backend-"$FEATURE".log || RESULT=$?
  echo "▶ Tearing down docker stack..."
  docker compose down
  exit $RESULT
else
  # in-process mode: pytest spins the app via TestClient; sqlite memory
  PYTHONPATH=. DATABASE_URL="${DATABASE_URL:-sqlite:///:memory:}" \
    JWT_SECRET_KEY="${JWT_SECRET_KEY:-test_secret_key}" \
    pytest "${E2E_DIR}/test_${FEATURE}_e2e.py" -v 2>&1 | tee /tmp/e2e-backend-"$FEATURE".log
fi
