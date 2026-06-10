#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "==> Building app..."
npm run tauri build

DMG=$(ls src-tauri/target/release/bundle/dmg/*.dmg | head -1)
echo "==> Built: $DMG"

echo "==> Submitting for notarization..."
xcrun notarytool submit "$DMG" --keychain-profile "memo-notary" --wait

echo "==> Stapling ticket..."
xcrun stapler staple "$DMG"

echo "==> Verifying..."
spctl -a -vvv -t install "$DMG"

echo "==> Done: $DMG"
