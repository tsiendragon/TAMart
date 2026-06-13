#!/usr/bin/env bash
# build-aab.sh
# Build a signed Android App Bundle (AAB) for Play Store upload.
# Signing is done via key.properties (NOT checked into git).
# Usage: bash scripts/build-aab.sh [version-name] [build-number]
#
# key.properties format (frontend/android/key.properties):
#   storePassword=<from CI secret>
#   keyPassword=<from CI secret>
#   keyAlias=<alias>
#   storeFile=keystores/release.jks

set -euo pipefail

FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
KEY_PROPS="${FRONTEND_DIR}/android/key.properties"

# ────────────────────────────────────────────────────────────
# Resolve version from pubspec.yaml if not provided
# ────────────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  VERSION_NAME="$1"
  BUILD_NUMBER="${2:-$(date +%Y%m%d%H%M)}"
else
  PUBSPEC_VERSION=$(grep "^version:" "${FRONTEND_DIR}/pubspec.yaml" | awk '{print $2}')
  VERSION_NAME=$(echo "$PUBSPEC_VERSION" | cut -d+ -f1)
  BUILD_NUMBER=$(echo "$PUBSPEC_VERSION" | cut -d+ -f2)
fi

echo "▶ Building AAB: version=${VERSION_NAME}+${BUILD_NUMBER}"

# ────────────────────────────────────────────────────────────
# Prerequisite checks
# ────────────────────────────────────────────────────────────
if [ ! -f "$KEY_PROPS" ]; then
  echo "ERROR: $KEY_PROPS not found."
  echo "  This file is NOT in git (by design)."
  echo "  In CI: inject KEYSTORE_BASE64 / STORE_PASSWORD / KEY_PASSWORD / KEY_ALIAS"
  echo "  and use scripts/ci-setup-keystore.sh to create it."
  exit 1
fi

echo "  key.properties: ✅ found"

# Verify flutter is available
if ! command -v flutter &>/dev/null; then
  echo "ERROR: flutter command not found."
  exit 1
fi

# ────────────────────────────────────────────────────────────
# Run tests before build
# ────────────────────────────────────────────────────────────
echo "▶ Running pre-build checks..."
cd "$FRONTEND_DIR"

flutter analyze --no-pub
flutter test

# ────────────────────────────────────────────────────────────
# Build AAB
# ────────────────────────────────────────────────────────────
echo "▶ Building AAB (release)..."
flutter build appbundle --release \
  --build-name="$VERSION_NAME" \
  --build-number="$BUILD_NUMBER"

AAB_PATH="build/app/outputs/bundle/release/app-release.aab"

cd ..

# ────────────────────────────────────────────────────────────
# Validate output
# ────────────────────────────────────────────────────────────
FULL_AAB="${FRONTEND_DIR}/${AAB_PATH}"
if [ ! -f "$FULL_AAB" ]; then
  echo "ERROR: AAB not found at $FULL_AAB after build."
  exit 1
fi

AAB_SIZE=$(du -sh "$FULL_AAB" | cut -f1)
echo ""
echo "✅ AAB built successfully"
echo "   Path: $FULL_AAB"
echo "   Size: $AAB_SIZE"
echo "   Version: ${VERSION_NAME}+${BUILD_NUMBER}"
echo ""
echo "Next steps:"
echo "  1. Upload to Play Console: https://play.google.com/console"
echo "  2. Or use Fastlane: fastlane supply --aab $FULL_AAB --track internal"
