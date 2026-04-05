#!/bin/bash
# Post-build script to properly sign the macOS app bundle.
# electron-builder's ad-hoc signing creates mismatched Team IDs.
# This script signs everything in the correct order.

set -e

APP="${1:-release/mac-arm64/TitanClip.app}"

if [ ! -d "$APP" ]; then
  echo "Error: App bundle not found at $APP"
  exit 1
fi

echo "=== Signing TitanClip.app ==="

# Step 0: Remove quarantine attribute
xattr -cr "$APP"

# Step 1: Sign all dylibs (innermost first)
echo "  Signing dylibs..."
find "$APP" -name "*.dylib" -exec codesign --force --sign - {} \; 2>/dev/null

# Step 2: Sign native node addons
echo "  Signing native addons..."
find "$APP" -name "*.node" -exec codesign --force --sign - {} \; 2>/dev/null

# Step 3: Sign helper apps
echo "  Signing helper apps..."
for helper in \
  "$APP/Contents/Frameworks/TitanClip Helper.app" \
  "$APP/Contents/Frameworks/TitanClip Helper (GPU).app" \
  "$APP/Contents/Frameworks/TitanClip Helper (Renderer).app" \
  "$APP/Contents/Frameworks/TitanClip Helper (Plugin).app"; do
  if [ -d "$helper" ]; then
    codesign --force --sign - "$helper"
  fi
done

# Step 4: Sign frameworks (seals the dylibs inside)
echo "  Signing frameworks..."
for framework in \
  "$APP/Contents/Frameworks/Mantle.framework" \
  "$APP/Contents/Frameworks/ReactiveObjC.framework" \
  "$APP/Contents/Frameworks/Squirrel.framework" \
  "$APP/Contents/Frameworks/Electron Framework.framework"; do
  if [ -d "$framework" ]; then
    codesign --force --sign - "$framework"
  fi
done

# Step 5: Sign the main app bundle
echo "  Signing app bundle..."
codesign --force --sign - "$APP"

# Step 6: Verify
echo "  Verifying..."
codesign --verify --deep --strict "$APP"

echo "=== Done! App signed successfully ==="
