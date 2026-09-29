#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

PROFILE="memo-notary"
IDENTITY="Developer ID Application: Shailesh Mendon (P5JTNCTC7S)"
BUNDLE_DIR="src-tauri/target/release/bundle"
APP="$BUNDLE_DIR/macos/Memo.app"

notarize() {
  local out
  out=$(xcrun notarytool submit "$1" --keychain-profile "$PROFILE" --wait 2>&1)
  echo "$out"
  echo "$out" | grep -q "status: Accepted" || { echo "Notarization failed for $1" >&2; exit 1; }
}

echo "==> Building app..."
npm run tauri build

echo "==> Notarizing app..."
ZIP=$(mktemp -d)/Memo.zip
ditto -c -k --keepParent "$APP" "$ZIP"
notarize "$ZIP"
rm -f "$ZIP"

echo "==> Stapling app..."
xcrun stapler staple "$APP"

echo "==> Rebuilding DMG around the stapled app..."
VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
DMG="$BUNDLE_DIR/dmg/Memo_${VERSION}_aarch64.dmg"
STAGE=$(mktemp -d)
cp -R "$APP" "$STAGE/"
rm -f "$DMG"
(cd "$BUNDLE_DIR/dmg" && ./bundle_dmg.sh \
  --volname "Memo" \
  --volicon icon.icns \
  --window-size 660 400 \
  --icon "Memo.app" 180 170 \
  --hide-extension "Memo.app" \
  --app-drop-link 480 170 \
  "$(basename "$DMG")" "$STAGE")
rm -rf "$STAGE"
codesign --force --sign "$IDENTITY" --timestamp "$DMG"

echo "==> Notarizing DMG..."
notarize "$DMG"

echo "==> Stapling DMG..."
xcrun stapler staple "$DMG"

echo "==> Verifying..."
spctl -a -vvv -t install "$DMG"
MP=$(mktemp -d)
hdiutil attach "$DMG" -mountpoint "$MP" -nobrowse -quiet
xcrun stapler validate "$MP/Memo.app"
hdiutil detach "$MP" -quiet

echo "==> Done: $DMG"
