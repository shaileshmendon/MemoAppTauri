# Deployment Guide — Memo v1.0.0

**Last Updated:** 2026-06-02  
**Audience:** Developer building and distributing the application

---

## Prerequisites

### Required Tools

| Tool | How to Install |
|---|---|
| **Xcode Command Line Tools** | `xcode-select --install` |
| **Rust (stable)** | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Node.js 20+** | Download from [nodejs.org](https://nodejs.org) or use `nvm` |
| **npm** | Bundled with Node.js |

### Verify Installation

```bash
node --version          # Should be 20.x.x or later
npm --version           # Should be 10.x.x or later
rustc --version         # Should be 1.75.0 or later (stable)
cargo --version         # Should match rustc version
xcode-select -p         # Should return a path
```

---

## Repository Setup

```bash
# Clone the repository
git clone https://github.com/shaileshmendon/MemoAppTauri.git
cd MemoAppTauri

# Install JavaScript dependencies
npm install
```

This installs all frontend dependencies including the Tauri CLI. The Rust dependencies are managed by Cargo and downloaded automatically on first build.

---

## Development Mode

```bash
npm run tauri dev
```

What happens:
1. Vite starts a dev server on `http://localhost:1420`
2. Tauri launches a native macOS window pointing at the dev server
3. Vite HMR (Hot Module Replacement): changes to `src/` are reflected instantly
4. Rust changes require restarting `npm run tauri dev`

**Dev database location:** Same as production — `~/Library/Application Support/com.memoapp.app/memoapp.db`. Development and production share the same database file.

---

## Type Checking

Run TypeScript type checking without building:

```bash
npx tsc --noEmit
```

This should output nothing (no errors). Run this before every build to catch type errors early.

---

## Production Build

```bash
npm run tauri build
```

**Build time:** 3–8 minutes on first build (Rust compilation); 1–3 minutes on subsequent builds (incremental).

### Build Output

```
src-tauri/target/release/bundle/
├── macos/
│   └── Memo.app                    # App bundle
└── dmg/
    └── Memo_1.0.0_aarch64.dmg      # Installer DMG (share this)
```

The DMG is the file to distribute to users.

---

## App Icon Management

The app icon source is `app-icon.svg` in the project root.

To regenerate all icon sizes from the SVG:

```bash
npm run tauri icon app-icon.svg
```

This creates:
```
src-tauri/icons/
├── 32x32.png
├── 64x64.png
├── 128x128.png
├── 128x128@2x.png
├── icon.png         # 512x512
├── icon.icns        # macOS icon bundle
└── icon.ico         # Windows icon
```

The SVG should be:
- Square dimensions
- At least 1024×1024 equivalent resolution
- File: `app-icon.svg` at project root

Current design: Black rounded rectangle (`rx="220"`) with white bold "M" text (`font-size="580"`, `font-weight="700"`).

---

## Version Bumping

To release a new version:

### 1. Update version strings

**`src-tauri/tauri.conf.json`:**
```json
"version": "1.1.0"
```

**`src/components/AboutModal.tsx`:**
```tsx
<p className="text-neutral-400 text-sm mt-1">Version 1.1.0</p>
```

**`src/components/SupportModal.tsx`:**
```typescript
const APP_VERSION = "1.1.0";
```

### 2. Update schema (if needed)

In `src/db.ts → migrate()`, add new `addIfMissing()` calls:
```typescript
await addIfMissing("matters", "new_column", "TEXT");
```

### 3. Update documentation

- `docs/CHANGELOG.md` — add new version entry
- Other docs as relevant

### 4. Build and test

```bash
npx tsc --noEmit         # Type check
npm run tauri build      # Build
# Test on Mac with existing database
# Test on fresh Mac
```

---

## Configuration Files

### `src-tauri/tauri.conf.json`

Key settings:

```json
{
  "productName": "Memo",
  "version": "1.0.0",
  "identifier": "com.memoapp.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "Memo",
      "width": 1280, "height": 800,
      "minWidth": 900, "minHeight": 600,
      "titleBarStyle": "Overlay"
    }]
  }
}
```

**`titleBarStyle: "Overlay"`** — native traffic lights float over the WebView content. The app renders a custom drag region using `data-tauri-drag-region` on a div.

### `src-tauri/capabilities/default.json`

IPC permission grants. Add new entries when adding new Tauri plugin operations:

```json
{
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "opener:default",
    "sql:default", "sql:allow-execute", "sql:allow-select",
    "sql:allow-load", "sql:allow-close",
    "dialog:default", "dialog:allow-save", "dialog:allow-open",
    "fs:default",
    "fs:allow-write-file", "fs:allow-write-text-file",
    "fs:allow-read-file", "fs:allow-read-text-file"
  ]
}
```

### `src-tauri/Info.plist`

macOS privacy usage descriptions:

```xml
<key>NSContactsUsageDescription</key>
<string>Memo uses your Contacts to help fill in client and firm details when creating new records.</string>
```

If adding new macOS permission (e.g. calendar), add the corresponding `NS*UsageDescription` key here.

### `src-tauri/Cargo.toml`

Rust dependencies. Current:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
```

---

## Adding a New Tauri Plugin

When you need a new system capability:

1. Find the plugin in the Tauri ecosystem (e.g. `tauri-plugin-notification`)
2. Add to `src-tauri/Cargo.toml`:
   ```toml
   tauri-plugin-notification = "2"
   ```
3. Add to `src-tauri/src/lib.rs`:
   ```rust
   .plugin(tauri_plugin_notification::init())
   ```
4. Add npm package: `npm install @tauri-apps/plugin-notification`
5. Add permissions to `capabilities/default.json`
6. Use in TypeScript: `import { ... } from "@tauri-apps/plugin-notification"`

---

## Adding a New Custom Rust Command

1. Define the command function in `src-tauri/src/lib.rs`:

```rust
#[derive(serde::Serialize)]
struct MyResult {
    value: String,
}

#[tauri::command]
async fn my_command(param: String) -> Result<MyResult, String> {
    // ... implementation
    Ok(MyResult { value: param })
}
```

2. Register in `invoke_handler`:

```rust
.invoke_handler(tauri::generate_handler![search_contacts, my_command])
```

3. Add capability if needed in `capabilities/default.json`

4. Call from TypeScript:

```typescript
import { invoke } from "@tauri-apps/api/core";
const result = await invoke<MyResult>("my_command", { param: "hello" });
```

---

## Hardcoded Values to Know

| Value | File | Line |
|---|---|---|
| Developer UPI VPA | `src/components/SupportModal.tsx` | `const DEVELOPER_UPI = "ssmendon@icici"` |
| App version (UI) | `src/components/AboutModal.tsx` | `Version 1.0.0` string |
| App version (tip) | `src/components/SupportModal.tsx` | `const APP_VERSION = "1.0.0"` |
| Sidebar width | `src/App.tsx` | `const SIDEBAR_W = 208` (must match `w-52` = 208px) |
| Backup version | `src/db.ts` | `export const BACKUP_VERSION = 1` |
| Dev server port | `src-tauri/tauri.conf.json` | `"devUrl": "http://localhost:1420"` |

---

## Distribution

### File to Distribute

```
src-tauri/target/release/bundle/dmg/Memo_1.0.0_aarch64.dmg
```

### Sharing Options

- Email attachment (DMG is ~15–20 MB)
- iCloud Drive / Google Drive link
- USB drive

### User Instructions to Include

> 1. Double-click the DMG file
> 2. Drag Memo to your Applications folder
> 3. Eject the DMG
> 4. Right-click Memo.app → Open (first time only, to bypass macOS security)
> 5. Click Open in the dialog that appears

---

## GitHub Repository

```bash
# Check status
git status

# Stage and commit all changes
git add .
git commit -m "Memo v1.1.0 — description of changes"

# Push to GitHub
git push origin main
```

The `.gitignore` (set to "Node" type) excludes:
- `node_modules/`
- `src-tauri/target/` (Rust build artefacts — several GB)
- `.DS_Store`

The repository contains all source code, documentation, and configuration. Build artefacts (DMG, .app) are not committed.
