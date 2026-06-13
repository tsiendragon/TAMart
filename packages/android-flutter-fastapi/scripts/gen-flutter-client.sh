#!/usr/bin/env bash
# gen-flutter-client.sh
# Generate Dart/Flutter API client from openapi.json using openapi-generator.
# Usage: bash scripts/gen-flutter-client.sh

set -euo pipefail

INPUT="docs/api/openapi.json"
OUTPUT_DIR="frontend/lib/core/api_client/generated"
STATE_FILE=".claude/state/dart-client.stale"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: $INPUT not found."
  echo "  Run 'make gen-docs' or 'bash scripts/gen-api-docs.sh' first."
  exit 1
fi

echo "▶ Generating Dart API client from $INPUT..."
echo "  Output: $OUTPUT_DIR"

# Try dart-based openapi_generator first (preferred for Flutter projects)
if command -v dart &>/dev/null; then
  if dart pub global list 2>/dev/null | grep -q 'openapi_generator'; then
    dart run openapi_generator -- generate \
      -i "$INPUT" \
      -g dart-dio \
      -o "$OUTPUT_DIR" \
      --additional-properties="pubName=api_client,nullableFields=true,dateLibrary=timemachine"
    echo "✅ Dart client generated (dart run openapi_generator)"
  else
    echo "INFO: openapi_generator not activated via dart pub global."
    echo "  Run: dart pub global activate openapi_generator"
    echo "  Trying java-based generator instead..."
    USE_JAVA=1
  fi
else
  USE_JAVA=1
fi

if [ "${USE_JAVA:-0}" -eq 1 ]; then
  if command -v openapi-generator-cli &>/dev/null; then
    openapi-generator-cli generate \
      -i "$INPUT" \
      -g dart-dio \
      -o "$OUTPUT_DIR" \
      --additional-properties="pubName=api_client,nullableFields=true"
    echo "✅ Dart client generated (openapi-generator-cli)"
  else
    echo "ERROR: Neither 'dart run openapi_generator' nor 'openapi-generator-cli' found."
    echo "  Install option A: dart pub global activate openapi_generator"
    echo "  Install option B: npm install @openapitools/openapi-generator-cli -g"
    exit 1
  fi
fi

# Clear stale marker
if [ -f "$STATE_FILE" ]; then
  rm "$STATE_FILE"
  echo "✅ dart-client.stale cleared"
fi

echo ""
echo "Done. Generated client:"
echo "  $OUTPUT_DIR"
echo ""
echo "Next step: run 'flutter pub get' in frontend/ if pubspec.yaml changed."
