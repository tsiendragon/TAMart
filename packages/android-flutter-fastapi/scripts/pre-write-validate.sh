#!/usr/bin/env bash
# pre-write-validate.sh
# Runs before file write/edit. Blocks writes that violate project conventions.
# Exit 0 = allow, exit 1 = block with error message.

set -euo pipefail

FILE_PATH="${TAMART_FILE_PATH:-${1:-}}"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# ────────────────────────────────────────────────────────────
# Helper: extract feature name from path
# backend/app/models/user_profile.py → user_profile
# frontend/lib/features/user_profile/... → user_profile
# ────────────────────────────────────────────────────────────
extract_feature() {
  local path="$1"
  if [[ "$path" =~ backend/app/(models|routers|services|schemas|repositories)/([^/]+)\.py ]]; then
    echo "${BASH_REMATCH[2]}" | sed 's/_schema$//' | sed 's/_service$//' | sed 's/_repo$//'
  elif [[ "$path" =~ frontend/lib/features/([^/]+)/ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo ""
  fi
}

FEATURE=$(extract_feature "$FILE_PATH")

# ────────────────────────────────────────────────────────────
# Rule 1: Any file under backend/app/ or frontend/lib/features/
#         requires a PRD document to exist.
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ ^(backend/app|frontend/lib/features)/ ]] && [ -n "$FEATURE" ]; then
  # Look for PRD file (accept both exact match and prefix match)
  PRD_FOUND=0
  for prd in docs/product/PRD_*.md; do
    if [[ "$prd" =~ PRD_${FEATURE} ]]; then
      PRD_FOUND=1
      break
    fi
  done
  if [ "$PRD_FOUND" -eq 0 ]; then
    echo "BLOCKED: No PRD found for feature '${FEATURE}'."
    echo "  Expected: docs/product/PRD_${FEATURE}.md (or similar)"
    echo "  Run /new-feature ${FEATURE} to create the PRD first."
    exit 1
  fi
fi

# ────────────────────────────────────────────────────────────
# Rule 2: Feature branch cannot modify shared design docs.
# Only develop/main branches may modify docs/design/ARCHITECTURE.md,
# docs/design/DATABASE.md, docs/design/BACKEND_API.md.
# ────────────────────────────────────────────────────────────
SHARED_DOCS=("docs/design/ARCHITECTURE.md" "docs/design/DATABASE.md" "docs/design/BACKEND_API.md")
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

if [[ "$CURRENT_BRANCH" =~ ^feature/ ]]; then
  for shared in "${SHARED_DOCS[@]}"; do
    if [[ "$FILE_PATH" == "$shared" ]]; then
      echo "BLOCKED: Feature branch '${CURRENT_BRANCH}' cannot modify '${shared}'."
      echo "  Shared design docs must be updated on develop branch."
      echo "  Merge develop into your feature branch if you need the latest design."
      exit 1
    fi
  done
fi

# ────────────────────────────────────────────────────────────
# Rule 3: Writing a backend Model requires DATABASE.md to have
#         the corresponding table definition (### <tablename>).
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ backend/app/models/([^/]+)\.py ]]; then
  MODEL_FILE="${BASH_REMATCH[1]}"

  if [ -f "docs/design/DATABASE.md" ]; then
    # Extract __tablename__ from the file content if available via env
    # Fall back to checking if any ### heading contains model file name
    TABLE_MENTIONED=0
    if grep -qi "### ${MODEL_FILE}" docs/design/DATABASE.md 2>/dev/null; then
      TABLE_MENTIONED=1
    fi

    if [ "$TABLE_MENTIONED" -eq 0 ]; then
      echo "BLOCKED: No table definition found in DATABASE.md for model '${MODEL_FILE}'."
      echo "  DATABASE.md must contain a '### ${MODEL_FILE}' (or similar) section."
      echo "  Run /db-design ${FEATURE} to design the database schema first."
      # Write state marker
      mkdir -p .claude/state
      echo "$(date -Iseconds) $FILE_PATH" >> .claude/state/schema-unconfirmed
      exit 1
    fi

    # Check if the table has been confirmed by user
    if ! grep -qi "状态: 已确认" docs/design/DATABASE.md 2>/dev/null; then
      echo "WARNING: Database schema in DATABASE.md has not been user-confirmed."
      echo "  Ask the user to run /db-design ${FEATURE} and confirm the schema."
      mkdir -p .claude/state
      echo "$(date -Iseconds) $FILE_PATH" >> .claude/state/schema-unconfirmed
      # Warning only — do not block yet (confirmation may be in progress)
    fi
  else
    echo "BLOCKED: docs/design/DATABASE.md not found."
    echo "  Run /db-design ${FEATURE} to create the database design document first."
    exit 1
  fi
fi

# ────────────────────────────────────────────────────────────
# Rule 4: Tech Design (FEATURE_*.md) must exist before writing
#         any feature-scoped implementation file.
# ────────────────────────────────────────────────────────────
if [[ "$FILE_PATH" =~ ^(backend/app/(routers|services|schemas|repositories|models)|frontend/lib/features)/([^/]+) ]]; then
  if [ -n "$FEATURE" ]; then
    DESIGN_FOUND=0
    for design in docs/design/FEATURE_*.md; do
      if [[ "$design" =~ FEATURE_${FEATURE} ]]; then
        DESIGN_FOUND=1
        break
      fi
    done
    if [ "$DESIGN_FOUND" -eq 0 ]; then
      echo "BLOCKED: No Tech Design found for feature '${FEATURE}'."
      echo "  Expected: docs/design/FEATURE_${FEATURE}.md"
      echo "  Run /tech-design ${FEATURE} (via architect agent) to create it first."
      exit 1
    fi
  fi
fi

exit 0
