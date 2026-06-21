#!/usr/bin/env bash
# e2e-native-run.sh
# L3 — Native e2e (APK truth layer): run integration_test on an Android emulator/device.
# Usage: bash scripts/e2e-native-run.sh <feature> [device-id]
#
# This is the authoritative "test the APK" path: exercises native SQLite (drift),
# secure storage, path_provider and platform channels that web cannot.

set -euo pipefail

FEATURE="${1:-}"
DEVICE="${2:-}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://10.0.2.2:8000}"   # 10.0.2.2 = host from Android emulator

if [ -z "$FEATURE" ]; then
  echo "ERROR: feature name required. Usage: e2e-native-run.sh <feature> [device-id]" >&2
  exit 2
fi

command -v flutter &>/dev/null || { echo "ERROR: flutter not found." >&2; exit 1; }

TEST_FILE="${FRONTEND_DIR}/integration_test/${FEATURE}_e2e_test.dart"
if [ ! -f "$TEST_FILE" ]; then
  echo "ERROR: $TEST_FILE missing." >&2
  echo "  Generate it from the flow spec: bash scripts/e2e-promote.sh $FEATURE" >&2
  exit 1
fi

# resolve a device
if [ -z "$DEVICE" ]; then
  DEVICE=$(cd "$FRONTEND_DIR" && flutter devices --machine 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); a=[x['id'] for x in d if x.get('targetPlatform','').startswith('android')]; print(a[0] if a else '')" 2>/dev/null || true)
fi
if [ -z "$DEVICE" ]; then
  echo "ERROR: no Android emulator/device found." >&2
  echo "  Start one: flutter emulators --launch <id>   (or 'emulator -avd <name>')" >&2
  exit 1
fi

echo "▶ L3 native e2e — feature=$FEATURE  device=$DEVICE  backend=$E2E_BASE_URL"

cd "$FRONTEND_DIR"
flutter test "integration_test/${FEATURE}_e2e_test.dart" \
  -d "$DEVICE" \
  --dart-define=E2E_BASE_URL="$E2E_BASE_URL" \
  2>&1 | tee /tmp/e2e-native-"$FEATURE".log
