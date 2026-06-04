# Memo — Update Notification System

> v1.2.1 · Last updated: 2026-06-04  
> Phase 1: Notification + Manual Download

---

## Overview

Memo checks for updates automatically and notifies the user when a newer version is available. Updates are **never installed automatically** — the user always chooses to download.

---

## Architecture

```
App launch (3s delay)
        │
        ▼
checkForUpdates()
        │
        ├─ fetchManifest() → GET https://memoapp.in/releases/latest.json
        │
        ├─ Compare: manifest.version > currentVersion?
        │
        ├─ Apply preferences: skipped? snoozed?
        │
        └─ Yes → setPendingUpdate() → <UpdateModal />

Every 24 hours (setInterval in App.tsx)
        │
        └─ isDueForCheck() → checkForUpdates() → same flow
```

---

## Update Manifest

**URL:** `https://memoapp.in/releases/latest.json`

**Schema:**
```json
{
  "version":     "1.3.0",
  "releaseDate": "2026-06-10",
  "downloadUrl": "https://memoapp.in/releases/Memo_1.3.0_aarch64.dmg",
  "mandatory":   false,
  "notes": [
    "New feature description",
    "Bug fix description"
  ]
}
```

**Field rules:**
| Field | Required | Validation |
|---|---|---|
| `version` | Yes | Semver: `\d+\.\d+\.\d+` |
| `releaseDate` | Yes | Any string (displayed as-is) |
| `downloadUrl` | Yes | HTTPS only |
| `mandatory` | No | Boolean; if true, close button hidden |
| `notes` | Yes | Array of strings (may be empty) |

**Hosting the manifest:**
- Place at `https://memoapp.in/releases/latest.json`
- Always reflects the single latest version
- Update this file each time you publish a new release

---

## User Preferences (stored in `settings` table)

| Key | Value | Purpose |
|---|---|---|
| `update_last_check` | ISO timestamp | When did we last successfully check |
| `update_skipped_version` | Semver string | User clicked "Skip This Version" |
| `update_remind_after` | ISO timestamp | User clicked "Remind Me Later" — suppress until this time |

All three are stored via the existing `getSettingValue` / `setSettingValue` functions in `db.ts`.

---

## Update Modal — User Actions

| Button | Behaviour |
|---|---|
| **Download Update** | Opens `manifest.downloadUrl` in the default browser |
| **Remind Me Later** | Snoozes for 24 hours; modal won't show until then |
| **Skip This Version** | Permanently suppresses this version (until cleared) |

When `mandatory: true`:
- Close button is hidden
- "Remind Later" and "Skip" buttons are hidden
- A note explains the update is required

---

## Settings → About Section

Located at: **Settings → About**

Displays:
- App Name, Version, Platform
- Last Update Check (timestamp)
- Skipped Version (with Clear button if set)
- **Check for Updates** button — forces a fresh check bypassing snooze/skip preferences
- Result banner: "Up to date" / "Update available" / "Offline"

---

## Security

| Check | Implementation |
|---|---|
| HTTPS only | `downloadUrl` must begin with `https://` (validated in `fetchManifest`) |
| Semver format | Regex `^\d+\.\d+\.\d+$` applied to manifest `version` field |
| Timeout | `AbortSignal.timeout(8000)` — 8 second fetch limit |
| No auto-execution | Download only opens URL in browser; no code downloaded or run |
| Graceful failure | Any network/parse error returns null (no modal shown, no crash) |

---

## Files

| File | Purpose |
|---|---|
| `src/lib/updates/updateService.ts` | Core logic: fetch, compare, preference storage |
| `src/components/UpdateModal.tsx` | Modal UI with three action buttons |
| `src/components/SettingsPage.tsx` | About section (manual check + version info) |
| `src/App.tsx` | Launch check (3s delay) + 24h interval |

---

## Publishing a New Release

1. Build the DMG: `npm run tauri build`
2. Upload the DMG to `https://memoapp.in/releases/`
3. Update `https://memoapp.in/releases/latest.json` with the new version, date, download URL, and release notes
4. Within 24 hours, all users will see the update modal

---

## Future: Phase 2 (not yet implemented)

- Auto-download the DMG to `~/Downloads`
- Verify SHA-256 checksum against manifest
- Prompt user to open the DMG (still no silent install)

---

*Memo Update System — Phase 1 · v1.2.1*
