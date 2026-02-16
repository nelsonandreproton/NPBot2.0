#!/bin/bash
# Generates the Teams app package (.zip) for upload to Teams Admin Center
# Usage: ./generate-package.sh <MICROSOFT_APP_ID>

set -e

APP_ID="${1:?Usage: ./generate-package.sh <MICROSOFT_APP_ID>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR"

echo "Generating Teams app package for App ID: $APP_ID"

# Create temp directory
TEMP_DIR=$(mktemp -d)

# Process manifest
sed "s/{{MICROSOFT_APP_ID}}/$APP_ID/g" "$SCRIPT_DIR/manifest.json" > "$TEMP_DIR/manifest.json"

# Generate placeholder icons if they don't exist
if [ ! -f "$SCRIPT_DIR/color.png" ]; then
  echo "Note: color.png not found. Using a placeholder."
  echo "Replace teams-app/color.png with a 192x192 color icon."
  # Create a minimal 1x1 PNG as placeholder
  printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > "$TEMP_DIR/color.png"
else
  cp "$SCRIPT_DIR/color.png" "$TEMP_DIR/color.png"
fi

if [ ! -f "$SCRIPT_DIR/outline.png" ]; then
  echo "Note: outline.png not found. Using a placeholder."
  echo "Replace teams-app/outline.png with a 32x32 outline icon."
  printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > "$TEMP_DIR/outline.png"
else
  cp "$SCRIPT_DIR/outline.png" "$TEMP_DIR/outline.png"
fi

# Create zip
cd "$TEMP_DIR"
zip -j "$OUTPUT_DIR/npbot-teams-app.zip" manifest.json color.png outline.png

# Cleanup
rm -rf "$TEMP_DIR"

echo "Package created: $OUTPUT_DIR/npbot-teams-app.zip"
echo "Upload this file to Teams Admin Center > Manage apps > Upload new app"
