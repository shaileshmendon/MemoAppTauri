# Third-Party Services Register

**App:** Memo v1.0.0  
**Last updated:** 2026-05-31

> This register lists every external service, SDK, and library the app depends on.
> Memo is designed to work **fully offline** — no data is ever sent to a remote server during normal use.

---

## 1. Runtime JavaScript / React Libraries

| Library | Version | Purpose | Data Sent Externally? |
|---|---|---|---|
| `react` / `react-dom` | 19.1.0 | UI framework | No |
| `@react-pdf/renderer` | 4.5.1 | Client-side PDF generation (runs entirely in the browser/WebView) | No |
| `date-fns` | 4.3.0 | Date formatting and calculation | No |
| `lucide-react` | 1.16.0 | Icon set | No |
| `uuid` | 14.0.0 | Generate unique record IDs (UUIDv4) | No |

---

## 2. Tauri Plugins (Rust + JS bridge)

These are the bridges between the JavaScript UI and the macOS operating system.

| Plugin | Purpose | Data Sent Externally? |
|---|---|---|
| `@tauri-apps/api` v2 | Core Tauri API (window management, IPC) | No |
| `@tauri-apps/plugin-sql` v2 | SQLite database access | No — database is local |
| `@tauri-apps/plugin-dialog` v2 | Native macOS Save / Open file dialogs | No |
| `@tauri-apps/plugin-fs` v2 | Read and write files (backup export/import, PDF save) | No |
| `@tauri-apps/plugin-opener` v2 | Open URLs in browser or UPI apps; open mail links | Opens URL in system browser / UPI app — user-initiated only |

---

## 3. macOS System Services

| Service | How Used | Data Involved |
|---|---|---|
| **macOS Contacts** (via `osascript` JXA) | Search contacts by name/company and import into client, firm, or contact person records | Contact data stays on device; never uploaded |
| **UPI deep-link** (`upi://`) | Opens a UPI payment app when the user sends a tip | Payment handled by user's UPI app (GPay, PhonePe, etc.) directly to `ssmendon@icici` — Memo has no visibility |
| **macOS Mail** (`mailto:`) | Opens Mail.app addressed to support email | User-initiated; no data sent by Memo |
| **TCC / Privacy framework** | macOS permission system that controls Contacts access | Prompt shown to user on first Contacts search |

---

## 4. Build-time Tools (not shipped in the app)

| Tool | Version | Purpose |
|---|---|---|
| `vite` | 7.0.4 | Frontend build bundler |
| `@vitejs/plugin-react` | 4.6.0 | React JSX transformation |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.0 | Utility CSS framework |
| `typescript` | 5.8.3 | Type checking |
| `@tauri-apps/cli` | 2.x | Build, bundle, and icon generation |
| `sharp` | 0.34.5 | Icon image processing (used by `tauri icon` command) |

---

## 5. Payment / Tip Infrastructure

| Detail | Value |
|---|---|
| Mechanism | UPI deep-link (peer-to-peer, no server) |
| Developer UPI VPA | `ssmendon@icici` |
| Status | **Inactive** (UI hidden; code present for future activation) |
| Data flow | User's device → User's UPI app → Developer's ICICI account |
| Memo's role | Opens the deep-link URL only; never handles or stores payment data |

---

## 6. No External Analytics, Crash Reporting, or Cloud Storage

Memo does **not** use:
- Sentry / Bugsnag (crash reporting)
- Mixpanel / Amplitude / Google Analytics (usage analytics)
- iCloud / Firebase / Supabase (cloud storage)
- Any advertising SDK

All data remains on the user's Mac in `~/Library/Application Support/com.memoapp.app/`.
