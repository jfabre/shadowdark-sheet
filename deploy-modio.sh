#!/bin/bash
# Package "The Dark Spire" for mod.io upload.
# Bumps version, generates changelog, commits, tags, and creates a zip.
#
# Usage:
#   ./deploy-modio.sh              # auto-bump patch (0.5.0 → 0.5.1)
#   ./deploy-modio.sh --version 1.0.0   # explicit version
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
cd "$SRC"

# ── Parse arguments ──────────────────────────────────
NEW_VERSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) NEW_VERSION="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Read current version from manifest.json ──────────
CUR_VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
echo "Current version: $CUR_VERSION"

# ── Determine new version ────────────────────────────
if [[ -z "$NEW_VERSION" ]]; then
  # Auto-bump patch: 0.5.0 → 0.5.1
  NEW_VERSION=$(python3 -c "
v = '$CUR_VERSION'.split('.')
v[-1] = str(int(v[-1]) + 1)
print('.'.join(v))
")
fi
echo "New version:     $NEW_VERSION"

# ── Validate version format ──────────────────────────
if ! echo "$NEW_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be X.Y.Z (got '$NEW_VERSION')"
  exit 1
fi

# ── Check for uncommitted changes ────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

# ── Find previous tag for changelog ──────────────────
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -z "$PREV_TAG" ]]; then
  echo "Warning: no previous tag found, changelog will include all commits"
  LOG_RANGE="HEAD"
else
  echo "Previous tag:    $PREV_TAG"
  LOG_RANGE="${PREV_TAG}..HEAD"
fi

# ── Generate changelog entry ─────────────────────────
TODAY=$(date +%Y-%m-%d)
COMMITS=$(git --no-pager log --oneline --no-decorate "$LOG_RANGE" | sed 's/^[a-f0-9]* /- /')

ENTRY="## [$NEW_VERSION] - $TODAY

$COMMITS"

echo ""
echo "── Changelog entry ──"
echo "$ENTRY"
echo ""

# ── Prepend to CHANGELOG.md ─────────────────────────
if [[ -f CHANGELOG.md ]]; then
  # Insert after the header block (first blank line after the title)
  python3 -c "
import re
with open('CHANGELOG.md') as f:
    content = f.read()
# Insert after the header (everything before the first '## [')
marker = '## ['
idx = content.find(marker)
if idx == -1:
    # No existing version section, append after header
    content = content.rstrip() + '\n\n' + '''$ENTRY''' + '\n'
else:
    content = content[:idx] + '''$ENTRY''' + '\n\n' + content[idx:]
with open('CHANGELOG.md', 'w') as f:
    f.write(content)
"
else
  cat > CHANGELOG.md <<EOF
# Changelog

$ENTRY
EOF
fi

# ── Update manifest.json version ─────────────────────
python3 -c "
import json
with open('manifest.json') as f:
    m = json.load(f)
m['version'] = '$NEW_VERSION'
with open('manifest.json', 'w') as f:
    json.dump(m, f, indent=2)
    f.write('\n')
"

# ── Update hardcoded version in index.html ───────────
perl -pi -e 's|(<span id="app-version">)v[\d.]+|${1}v'"$NEW_VERSION"'|' index.html

# ── Update APP_VERSION in script.js ──────────────────
perl -pi -e "s|(const APP_VERSION = ')[\\d.]+'|\${1}$NEW_VERSION'|" script.js

# ── Update version badge in README.md ────────────────
perl -pi -e 's|(version-)[\d.]+(-orange)|\1'"$NEW_VERSION"'\2|' README.md

# ── Commit and tag ───────────────────────────────────
git add manifest.json index.html script.js README.md CHANGELOG.md
git commit -m "release: v$NEW_VERSION"
git tag "v$NEW_VERSION"

# ── Build zip ────────────────────────────────────────
DIST="$SRC/dist"
mkdir -p "$DIST"
ZIP_NAME="the-dark-spire-v${NEW_VERSION}.zip"
ZIP_PATH="$DIST/$ZIP_NAME"

# Remove old zip if it exists
rm -f "$ZIP_PATH"

# Zip files at root level (no containing folder)
zip -j "$ZIP_PATH" \
  manifest.json \
  index.html \
  script.js \
  data.js \
  style.css \
  README.md \
  CHANGELOG.md

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✓ Released v$NEW_VERSION"
echo "  ✓ Tagged:   v$NEW_VERSION"
echo "  ✓ Zip:      $ZIP_PATH"
echo ""
echo "  Upload $ZIP_NAME to mod.io manually."
echo "═══════════════════════════════════════════════════"
