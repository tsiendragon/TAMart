#!/usr/bin/env bash
# gen-api-docs.sh
# Export openapi.json from FastAPI app and render HTML with Redoc.
# Usage: bash scripts/gen-api-docs.sh [backend-dir]

set -euo pipefail

BACKEND_DIR="${1:-backend}"
OUTPUT_JSON="docs/api/openapi.json"
OUTPUT_HTML="docs/api/index.html"
STATE_FILE=".claude/state/openapi.stale"

echo "▶ Generating openapi.json from FastAPI app..."

cd "$BACKEND_DIR"

python3 -c "
import json
import sys
sys.path.insert(0, '.')

try:
    from app.main import app
except ImportError as e:
    print(f'ERROR: Cannot import FastAPI app: {e}', file=sys.stderr)
    sys.exit(1)

spec = app.openapi()
output_path = '../${OUTPUT_JSON}'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(spec, f, indent=2, ensure_ascii=False)

endpoint_count = len(spec.get('paths', {}))
print(f'✅ openapi.json exported: {endpoint_count} endpoints → {output_path}')
"

cd ..

echo "▶ Rendering Redoc HTML..."

if command -v npx &>/dev/null; then
  # Prefer @redocly/cli
  if npx --yes @redocly/cli --version &>/dev/null 2>&1; then
    npx @redocly/cli build-docs "$OUTPUT_JSON" \
      --output "$OUTPUT_HTML" \
      --title "API Reference" \
      2>&1
  else
    # Fallback to redoc-cli
    npx --yes redoc-cli bundle "$OUTPUT_JSON" \
      -o "$OUTPUT_HTML" \
      --title "API Reference" \
      2>&1
  fi
  echo "✅ $OUTPUT_HTML rendered"
else
  echo "WARNING: npx not found. Skipping HTML render."
  echo "  Install Node.js or run: npm install -g @redocly/cli"
fi

# Clear stale marker
if [ -f "$STATE_FILE" ]; then
  rm "$STATE_FILE"
  echo "✅ openapi.stale cleared"
fi

echo ""
echo "Done. Files updated:"
echo "  $OUTPUT_JSON"
echo "  $OUTPUT_HTML"
