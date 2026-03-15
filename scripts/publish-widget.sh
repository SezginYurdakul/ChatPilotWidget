#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/ChatPilotDev-or-ChatPilotProd"
  exit 1
fi

TARGET_DIR="$1"
TARGET_FILE="$TARGET_DIR/public/chatpilot-widget.js"

if [ ! -d "$TARGET_DIR" ]; then
  echo "Target directory not found: $TARGET_DIR"
  exit 1
fi

if [ ! -d "$TARGET_DIR/public" ]; then
  echo "Target public directory not found: $TARGET_DIR/public"
  exit 1
fi

npm run build
cp "$APP_DIR/dist/chatpilot-widget.js" "$TARGET_FILE"

echo "Published widget bundle to: $TARGET_FILE"
