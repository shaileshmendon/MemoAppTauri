# Environment Variables Register

**App:** Memo v1.0.0  
**Last updated:** 2026-05-31

---

## Overview

Memo does not use environment variables for runtime configuration — it is a fully self-contained desktop app with no server component.

The items listed below are **build-time configuration values** that are either compiled into the binary or set by the Tauri / Vite build toolchain.

---

## Build-time Variables (set automatically by Tauri / Vite)

| Variable | Set by | Value | Purpose |
|---|---|---|---|
| `import.meta.env.DEV` | Vite | `true` in dev, `false` in production | Used by `ScreenshotHelper.tsx` to show/hide the dev-only ⌘⇧D seeder |
| `import.meta.env.PROD` | Vite | opposite of DEV | |
| `import.meta.env.MODE` | Vite | `"development"` or `"production"` | |

---

## Hardcoded Application Constants

These are defined directly in source files rather than environment variables. They are listed here so they can be found easily when updating.

| Constant | File | Current Value | Description |
|---|---|---|---|
| `DEVELOPER_UPI` | `src/components/SupportModal.tsx:18` | `ssmendon@icici` | Developer's UPI VPA for tip payments |
| `DEVELOPER_NAME` | `src/components/SupportModal.tsx:19` | `Memo` | Displayed name in UPI payment |
| `APP_VERSION` | `src/components/SupportModal.tsx:20` | `1.0.0` | Shown in tip payment note |
| `APP_VERSION` | `src-tauri/tauri.conf.json` | `1.0.0` | Official app version (controls DMG filename) |
| `identifier` | `src-tauri/tauri.conf.json` | `com.memoapp.app` | macOS bundle identifier (determines data directory path) |
| `SIDEBAR_W` | `src/App.tsx` | `208` (px) | Sidebar width — must match Tailwind `w-52` |
| `BACKUP_VERSION` | `src/db.ts` | `1` | Backup file format version |

---

## Data Paths (macOS)

These paths are determined by the bundle identifier and macOS conventions — not configurable.

| Path | Contents |
|---|---|
| `~/Library/Application Support/com.memoapp.app/memoapp.db` | SQLite database |
| `~/Library/Application Support/com.memoapp.app/` | All app data |

---

## Development Server

When running `npm run tauri dev`:

| Setting | Value | Source |
|---|---|---|
| Dev server URL | `http://localhost:1420` | `tauri.conf.json → build.devUrl` |
| Dev command | `npm run dev` | `tauri.conf.json → build.beforeDevCommand` |

---

## No Secrets or API Keys

Memo has no:
- API keys
- OAuth credentials
- Webhook secrets
- Database connection strings (SQLite is file-based)
- `.env` files

The only credential-adjacent value is the developer's UPI VPA (`ssmendon@icici`) which is intentionally public — it is the payment destination address users see when sending a tip.
