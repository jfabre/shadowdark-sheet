#!/bin/bash
# Deploy "The Dark Spire" to TaleSpire's local Symbiotes folder (macOS)
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/com.bouncyrock.talespire/Symbiotes/the Dark Spire"

mkdir -p "$DEST"
cp "$SRC/index.html" "$SRC/script.js" "$SRC/style.css" "$SRC/manifest.json" "$DEST/"

echo "✓ Deployed to: $DEST"
ls -lh "$DEST"
